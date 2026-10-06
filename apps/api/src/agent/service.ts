// Servicio del agente (SPEC §10): el bucle del modelo con herramientas, las sesiones de chat y la
// confirmación por botón. Lo que hace seguro el diseño no es el prompt, es la arquitectura:
//
//  · Cada sesión de chat abre una conexión MCP para el modelo con un token de leer + proponer,
//    de vida corta y propio de la persona. Esa conexión NO tiene herramientas confirm_*.
//  · Cuando el modelo propone algo, el servicio construye la tarjeta con el resultado de la
//    herramienta (no con el texto del modelo) y guarda la acción en la sesión.
//  · Solo el clic de la persona (`confirmAction`, con su sesión de navegador) ejecuta confirm_*,
//    con otra conexión MCP y un token de confirmar de cinco minutos que se revoca al terminar.
import { randomUUID } from "node:crypto";
import { PROPOSAL_TTL_MINUTES } from "@agendia/shared";
import { createMcpServer, fetchScopes } from "@agendia/mcp-server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { and, eq, gte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { Db } from "../db/client.ts";
import { agentEvents, bookings, businesses } from "../db/schema.ts";
import { AppError, notFound } from "../errors.ts";
import { createApiToken, revokeApiToken } from "../tokens.ts";
import { injectApiClient } from "./inject-api.ts";
import {
  costEur,
  LlmError,
  type Block,
  type LlmMessage,
  type LlmProvider,
  type LlmTool,
  type Prices,
} from "./llm.ts";
import { buildSystemPrompt } from "./prompt.ts";

export interface AgentConfig {
  provider: LlmProvider | null;
  prices: Prices;
  /** Topes de gasto diarios en EUR: global, por persona con sesión y por chat anónimo. */
  dailyBudgetEur: number;
  userDailyBudgetEur: number;
  sessionBudgetEur: number;
  maxToolCalls: number;
  turnTimeoutMs: number;
  maxMessageChars: number;
  maxSessionMessages: number;
  /** Mensajes por chat en una ventana de tiempo. */
  sessionRate: { max: number; windowMs: number };
  idleSessionMs: number;
  /** Chats vivos a la vez en esta instancia (los anónimos eligen su propio id). */
  maxSessions: number;
  timeZone: string;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  provider: null,
  // Aproximado para claude-opus-5-5 (4 y 20 USD por millón de tokens). Ajustable con LLM_PRICE_*.
  prices: { inputEurPerMTok: 3.7, outputEurPerMTok: 18.5 },
  dailyBudgetEur: 2,
  userDailyBudgetEur: 0.5,
  sessionBudgetEur: 0.2,
  maxToolCalls: 8,
  turnTimeoutMs: 60_000,
  maxMessageChars: 1000,
  // Sin recortar el historial: editar turnos anteriores invalida el razonamiento guardado del modelo.
  // Al llegar al tope se empieza otro chat.
  maxSessionMessages: 40,
  sessionRate: { max: 12, windowMs: 10 * 60_000 },
  idleSessionMs: 30 * 60_000,
  maxSessions: 500,
  timeZone: "Europe/Madrid",
};

export type AgentStreamEvent =
  | { type: "start"; sessionId: string }
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; status: "running" | "done" | "error"; label: string }
  | { type: "proposal"; actionId: string; kind: ActionKind; card: Record<string, unknown> }
  | { type: "done" }
  | { type: "error"; code: ErrorKind; message: string };

export type ErrorKind =
  | "unavailable"
  | "budget"
  | "rate"
  | "busy"
  | "session_full"
  | "llm"
  | "timeout"
  | "refused"
  | "invalid";

export type ActionKind = "book" | "cancel" | "reschedule";

interface AgentAction {
  id: string;
  kind: ActionKind;
  /** Herramienta confirm_* y argumentos que se ejecutarán al pulsar «Confirmar». */
  tool: string;
  args: Record<string, unknown>;
  bookingId: string;
  card: Record<string, unknown>;
  expiresAt: number;
  state: "open" | "used" | "discarded";
}

interface ModelConnection {
  createdAt: number;
  client: Client;
  tools: LlmTool[];
  tokenId: string | null;
  close: () => Promise<void>;
}

interface Session {
  id: string;
  userId: string | null;
  ip: string;
  messages: LlmMessage[];
  actions: Map<string, AgentAction>;
  connection: ModelConnection | null;
  lastUsed: number;
  busy: boolean;
  turnTimes: number[];
}

const TOOL_LABELS: Record<string, string> = {
  search_businesses: "Buscando negocios",
  get_business_info: "Consultando el negocio",
  list_services: "Mirando los servicios",
  list_staff: "Mirando el equipo",
  check_availability: "Comprobando huecos libres",
  search_faq: "Buscando en las preguntas frecuentes",
  list_my_bookings: "Revisando tus reservas",
  propose_booking: "Preparando la reserva",
  propose_cancellation: "Comprobando la cancelación",
  propose_reschedule: "Comprobando el cambio de hora",
};

const MAX_TOOL_RESULT_CHARS = 12_000;

export function createAgentService(app: FastifyInstance, db: Db, config: AgentConfig) {
  const sessions = new Map<string, Session>();

  // --- registro de eventos (agent_events) ---

  async function log(
    session: Pick<Session, "id" | "userId">,
    event: {
      type: string;
      toolName?: string;
      payload?: Record<string, unknown>;
      latencyMs?: number;
      tokensIn?: number;
      tokensOut?: number;
      businessId?: string | null;
      bookingId?: string | null;
    },
  ) {
    try {
      await db.insert(agentEvents).values({
        sessionId: session.id,
        userId: session.userId,
        businessId: event.businessId ?? null,
        bookingId: event.bookingId ?? null,
        type: event.type,
        toolName: event.toolName ?? null,
        payload: event.payload ?? {},
        latencyMs: event.latencyMs ?? null,
        tokensIn: event.tokensIn ?? null,
        tokensOut: event.tokensOut ?? null,
      });
    } catch (error) {
      // El registro no puede tumbar el chat.
      app.log.error({ err: error }, "no se pudo guardar un evento del agente");
    }
  }

  /** Negocio y reserva a los que se refiere una llamada, para que el negocio vea lo suyo en su registro. */
  async function relatedIds(args: Record<string, unknown>) {
    let businessId: string | null = null;
    let bookingId: string | null = null;
    try {
      if (typeof args.businessSlug === "string") {
        const [row] = await db
          .select({ id: businesses.id })
          .from(businesses)
          .where(eq(businesses.slug, args.businessSlug.slice(0, 100)));
        businessId = row?.id ?? null;
      }
      if (typeof args.bookingId === "string" && /^[0-9a-f-]{36}$/i.test(args.bookingId)) {
        const [row] = await db
          .select({ id: bookings.id, businessId: bookings.businessId })
          .from(bookings)
          .where(eq(bookings.id, args.bookingId));
        if (row) {
          bookingId = row.id;
          businessId ??= row.businessId;
        }
      }
    } catch {
      /* sin relación conocida */
    }
    return { businessId, bookingId };
  }

  // --- tope de gasto ---

  async function spentEur(where: { userId?: string; sessionId?: string }) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const [row] = await db
      .select({
        tin: sql<number>`coalesce(sum(${agentEvents.tokensIn}), 0)::float8`,
        tout: sql<number>`coalesce(sum(${agentEvents.tokensOut}), 0)::float8`,
      })
      .from(agentEvents)
      .where(
        and(
          gte(agentEvents.createdAt, startOfDay),
          where.userId ? eq(agentEvents.userId, where.userId) : undefined,
          where.sessionId ? eq(agentEvents.sessionId, where.sessionId) : undefined,
        ),
      );
    return costEur({ inputTokens: row?.tin ?? 0, outputTokens: row?.tout ?? 0 }, config.prices);
  }

  async function overBudget(session: Session): Promise<boolean> {
    if ((await spentEur({})) >= config.dailyBudgetEur) return true;
    if (
      session.userId &&
      (await spentEur({ userId: session.userId })) >= config.userDailyBudgetEur
    ) {
      return true;
    }
    return (await spentEur({ sessionId: session.id })) >= config.sessionBudgetEur;
  }

  // --- conexiones MCP ---

  async function connect(
    ip: string,
    token?: string,
  ): Promise<{ client: Client; close: () => Promise<void> }> {
    const api = injectApiClient(app, ip, token);
    const scopes = await fetchScopes(api, token !== undefined);
    const server = createMcpServer({ api, scopes });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await server.connect(serverSide);
    const client = new Client({ name: "agendia-agent", version: "1.0.0" });
    await client.connect(clientSide);
    return {
      client,
      close: async () => {
        await client.close().catch(() => undefined);
        await server.close().catch(() => undefined);
      },
    };
  }

  /** Conexión del modelo: sin sesión, solo lectura pública; con sesión, leer y proponer (nunca confirmar). */
  async function modelConnection(session: Session): Promise<ModelConnection> {
    let tokenId: string | null = null;
    let token: string | undefined;
    if (session.userId) {
      const created = await createApiToken(db, session.userId, {
        label: "Asistente (chat)",
        scopes: ["bookings:read", "bookings:propose"],
        ttlMinutes: 60,
      });
      tokenId = created.id;
      token = created.token;
    }
    const { client, close } = await connect(session.ip, token);
    const { tools } = await client.listTools();
    return {
      createdAt: Date.now(),
      client,
      tokenId,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description ?? "",
        inputSchema: t.inputSchema as Record<string, unknown>,
      })),
      close: async () => {
        await close();
        if (tokenId && session.userId) {
          await revokeApiToken(db, session.userId, tokenId).catch(() => undefined);
        }
      },
    };
  }

  // --- sesiones ---

  async function dropSession(session: Session) {
    sessions.delete(session.id);
    await session.connection?.close();
    session.connection = null;
  }

  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const session of sessions.values()) {
      if (!session.busy && now - session.lastUsed > config.idleSessionMs) void dropSession(session);
    }
  }, 60_000);
  sweeper.unref();

  async function sessionFor(
    sessionId: string,
    userId: string | null,
    ip: string,
  ): Promise<Session> {
    let session = sessions.get(sessionId);
    if (!session) {
      if (sessions.size >= config.maxSessions) {
        throw new AppError(
          429,
          "RATE_LIMITED",
          "El asistente está muy ocupado. Inténtalo más tarde",
        );
      }
      // Un chat vivo por persona: así los tokens internos de chats abandonados no se acumulan.
      if (userId) {
        for (const other of [...sessions.values()]) {
          if (other.userId === userId && !other.busy) await dropSession(other);
        }
      }
      session = {
        id: sessionId,
        userId,
        ip,
        messages: [],
        actions: new Map(),
        connection: null,
        lastUsed: Date.now(),
        busy: false,
        turnTimes: [],
      };
      sessions.set(sessionId, session);
      return session;
    }
    if (session.userId !== userId) {
      // Alguien inició sesión a mitad de chat: se conserva la conversación pero la conexión pasa a
      // ser la suya. Lo contrario (otra persona con el mismo id de chat) no se permite.
      if (session.userId === null && userId !== null) {
        await session.connection?.close();
        session.connection = null;
        session.userId = userId;
      } else {
        throw new AppError(409, "CONFLICT", "Este chat pertenece a otra cuenta. Empieza uno nuevo");
      }
    }
    session.ip = ip;
    return session;
  }

  // --- propuestas ---

  const text = (value: unknown) => (typeof value === "string" ? value : "");

  function parseJson(raw: string): Record<string, unknown> | null {
    try {
      const value = JSON.parse(raw) as unknown;
      return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }

  /**
   * Si el resultado de una herramienta es una propuesta válida, la convierte en una acción que el
   * usuario puede confirmar. La tarjeta sale de aquí, de los datos que devolvió la API.
   */
  function toAction(
    tool: string,
    input: Record<string, unknown>,
    result: Record<string, unknown> | null,
  ): AgentAction | null {
    if (!result) return null;
    if (tool === "propose_booking" && result.proposal && typeof result.proposal === "object") {
      const p = result.proposal as Record<string, unknown>;
      return {
        id: randomUUID(),
        kind: "book",
        tool: "confirm_booking",
        args: { bookingId: text(p.bookingId) },
        bookingId: text(p.bookingId),
        card: {
          title: "Reserva propuesta",
          business: p.business,
          service: p.service,
          professional: p.professional,
          when: p.when,
          price: p.price,
          holdsSlotForMinutes: p.holdsSlotForMinutes,
        },
        expiresAt: Date.now() + PROPOSAL_TTL_MINUTES * 60_000,
        state: "open",
      };
    }
    if (tool === "propose_cancellation" && result.canCancel === true && result.booking) {
      const b = result.booking as Record<string, unknown>;
      return {
        id: randomUUID(),
        kind: "cancel",
        tool: "confirm_cancellation",
        args: { bookingId: text(input.bookingId) },
        bookingId: text(input.bookingId),
        card: {
          title: "Cancelar esta reserva",
          business: b.business,
          service: b.service,
          professional: b.professional,
          when: b.when,
        },
        expiresAt: Date.now() + 15 * 60_000,
        state: "open",
      };
    }
    if (tool === "propose_reschedule" && result.canReschedule === true) {
      return {
        id: randomUUID(),
        kind: "reschedule",
        tool: "confirm_reschedule",
        args: {
          bookingId: text(input.bookingId),
          startsAt: text(input.startsAt),
          ...(typeof result.staffId === "string" ? { staffId: result.staffId } : {}),
        },
        bookingId: text(input.bookingId),
        card: {
          title: "Mover la reserva",
          business: result.business,
          service: result.service,
          from: result.from,
          to: result.to,
        },
        expiresAt: Date.now() + 15 * 60_000,
        state: "open",
      };
    }
    return null;
  }

  async function callTool(
    session: Session,
    connection: ModelConnection,
    name: string,
    input: Record<string, unknown>,
  ) {
    const started = Date.now();
    let out: { text: string; isError: boolean };
    try {
      // Lo que el modelo nombre y la conexión no ofrezca (p. ej. confirm_booking) ni se intenta.
      if (!connection.tools.some((t) => t.name === name))
        throw new Error("herramienta no ofrecida");
      const res = (await connection.client.callTool({ name, arguments: input })) as {
        isError?: boolean;
        content?: { type: string; text?: string }[];
      };
      out = {
        text: (res.content ?? [])
          .map((c) => c.text ?? "")
          .join("\n")
          .slice(0, MAX_TOOL_RESULT_CHARS),
        isError: res.isError === true,
      };
    } catch (error) {
      // Una herramienta que la conexión no tiene (por ejemplo confirm_booking) o argumentos inválidos.
      out = {
        text: `La herramienta ${name} no está disponible o los argumentos no son válidos`,
        isError: true,
      };
      await log(session, {
        type: "tool_blocked",
        toolName: name.slice(0, 80),
        payload: { reason: error instanceof Error ? error.message.slice(0, 200) : "error" },
      });
    }
    const related = out.isError ? {} : await relatedIds(input);
    await log(session, {
      type: "tool_call",
      toolName: name.slice(0, 80),
      payload: { args: input, ok: !out.isError, resultChars: out.text.length },
      latencyMs: Date.now() - started,
      ...related,
    });
    return out;
  }

  // --- un turno de chat ---

  async function chat(options: {
    sessionId: string;
    userId: string | null;
    ip: string;
    message: string;
    emit: (event: AgentStreamEvent) => void;
    signal?: AbortSignal;
  }) {
    const { emit } = options;
    const provider = config.provider;
    if (!provider) {
      emit({
        type: "error",
        code: "unavailable",
        message: "El asistente no está disponible ahora mismo",
      });
      return;
    }
    const message = options.message.trim();
    if (!message || message.length > config.maxMessageChars) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `El mensaje debe tener entre 1 y ${config.maxMessageChars} caracteres`,
      );
    }

    const session = await sessionFor(options.sessionId, options.userId, options.ip);
    if (session.busy) {
      emit({
        type: "error",
        code: "busy",
        message: "Estoy terminando de responder. Espera un momento",
      });
      return;
    }
    const now = Date.now();
    session.turnTimes = session.turnTimes.filter((t) => now - t < config.sessionRate.windowMs);
    if (session.turnTimes.length >= config.sessionRate.max) {
      await log(session, { type: "blocked", payload: { reason: "rate" } });
      emit({
        type: "error",
        code: "rate",
        message: "Estás escribiendo muy deprisa. Prueba en unos minutos",
      });
      return;
    }
    if (session.messages.length >= config.maxSessionMessages) {
      emit({
        type: "error",
        code: "session_full",
        message: "Esta conversación ya es muy larga. Empieza un chat nuevo",
      });
      return;
    }
    session.busy = true;
    session.turnTimes.push(now);
    let over: boolean;
    try {
      over = await overBudget(session);
    } catch (error) {
      session.busy = false;
      throw error;
    }
    if (over) {
      session.busy = false;
      await log(session, { type: "blocked", payload: { reason: "budget" } });
      emit({
        type: "error",
        code: "budget",
        message:
          "El asistente ha alcanzado su límite de uso por hoy. Puedes seguir con la búsqueda de siempre",
      });
      return;
    }

    session.lastUsed = now;
    const historyStart = session.messages.length;
    let inFlight = false;
    const timeout = AbortSignal.timeout(config.turnTimeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

    try {
      // El token del chat dura 60 minutos: se renueva antes de que caduque.
      if (session.connection && Date.now() - session.connection.createdAt > 50 * 60_000) {
        await session.connection.close();
        session.connection = null;
      }
      session.connection ??= await modelConnection(session);
      const connection = session.connection;
      emit({ type: "start", sessionId: session.id });
      session.messages.push({ role: "user", content: message });
      await log(session, { type: "user_message", payload: { chars: message.length } });

      let toolCalls = 0;
      let limited = false;
      let refused = false;
      for (;;) {
        if (signal.aborted) throw signal.reason ?? new Error("abortado");
        const started = Date.now();
        inFlight = true;
        const result = await provider.complete(
          {
            system: buildSystemPrompt({
              now: new Date(),
              timeZone: config.timeZone,
              loggedIn: session.userId !== null,
            }),
            messages: session.messages,
            tools: connection.tools,
            maxTokens: 2048,
            signal,
          },
          (delta) => emit({ type: "text", delta }),
        );
        inFlight = false;
        await log(session, {
          type: "assistant_turn",
          payload: { stopReason: result.stopReason, provider: provider.name },
          latencyMs: Date.now() - started,
          tokensIn: result.usage.inputTokens,
          tokensOut: result.usage.outputTokens,
        });
        session.messages.push({ role: "assistant", content: result.content });

        if (result.stopReason === "refusal") {
          emit({ type: "error", code: "refused", message: "No puedo ayudarte con eso" });
          refused = true;
          break;
        }
        if (result.stopReason !== "tool_use") break;

        const uses = result.content.filter((b) => b.type === "tool_use");
        const results: Block[] = [];
        for (const use of uses) {
          const name = text(use.name);
          const input = (use.input && typeof use.input === "object" ? use.input : {}) as Record<
            string,
            unknown
          >;
          if (toolCalls >= config.maxToolCalls) {
            limited = true;
            results.push({
              type: "tool_result",
              tool_use_id: use.id,
              content: "Límite de herramientas por turno alcanzado",
              is_error: true,
            });
            continue;
          }
          toolCalls++;
          emit({
            type: "tool",
            name,
            status: "running",
            label: TOOL_LABELS[name] ?? "Consultando",
          });
          const out = await callTool(session, connection, name, input);
          emit({
            type: "tool",
            name,
            status: out.isError ? "error" : "done",
            label: TOOL_LABELS[name] ?? "Consultando",
          });

          if (!out.isError) {
            const action = toAction(name, input, parseJson(out.text));
            if (action) {
              session.actions.set(action.id, action);
              const related = await relatedIds({ bookingId: action.bookingId });
              await log(session, {
                type: "proposal",
                toolName: name,
                payload: { kind: action.kind },
                ...related,
              });
              emit({ type: "proposal", actionId: action.id, kind: action.kind, card: action.card });
            }
          }
          results.push({
            type: "tool_result",
            tool_use_id: use.id,
            content: out.text,
            is_error: out.isError,
          });
        }
        session.messages.push({ role: "user", content: results });
        if (limited) {
          emit({
            type: "text",
            delta: "\n\nNo he podido completarlo en un solo paso. ¿Lo intentamos por partes?",
          });
          break;
        }
      }
      if (!refused) emit({ type: "done" });
    } catch (error) {
      // Se deshace el turno a medias: el historial nunca queda con una llamada sin su resultado.
      // Una llamada cortada se cobra igual: se anota una estimación de la entrada (≈3 caracteres por
      // token) para que el tope de gasto la vea.
      const estimate = inFlight ? Math.ceil(JSON.stringify(session.messages).length / 3) : 0;
      session.messages.length = historyStart;
      const aborted = signal.aborted;
      if (options.signal?.aborted) {
        // el cliente se fue
        await log(session, {
          type: "error",
          payload: { kind: "aborted" },
          ...(estimate ? { tokensIn: estimate } : {}),
        });
        return;
      }
      const kind: ErrorKind = aborted ? "timeout" : "llm";
      const messageText = aborted
        ? "El asistente tarda demasiado. Inténtalo de nuevo o usa la búsqueda de siempre"
        : error instanceof LlmError
          ? error.message
          : "El asistente ha tenido un problema. Puedes seguir con la búsqueda de siempre";
      await log(session, {
        type: "error",
        payload: { kind, detail: error instanceof Error ? error.message.slice(0, 200) : "error" },
        ...(estimate ? { tokensIn: estimate } : {}),
      });
      emit({ type: "error", code: kind, message: messageText });
    } finally {
      session.busy = false;
      session.lastUsed = Date.now();
    }
  }

  // --- el clic en «Confirmar» o «Cancelar» ---

  function takeAction(sessionId: string, userId: string, actionId: string) {
    const session = sessions.get(sessionId);
    if (!session || session.userId !== userId) throw notFound("Conversación");
    if (session.busy)
      throw new AppError(409, "CONFLICT", "El asistente está respondiendo. Espera un momento");
    const action = session.actions.get(actionId);
    if (!action) throw notFound("Propuesta");
    if (action.state !== "open")
      throw new AppError(409, "CONFLICT", "Esta propuesta ya se ha resuelto");
    if (action.expiresAt < Date.now()) {
      throw new AppError(
        409,
        "CONFLICT",
        "La propuesta ha caducado. Pídele al asistente que la repita",
      );
    }
    return { session, action };
  }

  async function confirmAction(options: {
    sessionId: string;
    userId: string;
    actionId: string;
    ip: string;
  }) {
    const { session, action } = takeAction(options.sessionId, options.userId, options.actionId);
    action.state = "used"; // se marca antes de ejecutar: un doble clic no puede ejecutar dos veces
    session.busy = true; // y el chat no escribe en el historial mientras se confirma
    let done = false;
    let token: Awaited<ReturnType<typeof createApiToken>> | null = null;
    let connection: Awaited<ReturnType<typeof connect>> | null = null;
    try {
      // Conexión de confirmación: token solo de confirmar, de cinco minutos, que se revoca al acabar.
      token = await createApiToken(db, options.userId, {
        label: "Asistente (confirmación)",
        scopes: ["bookings:confirm"],
        ttlMinutes: 5,
      });
      connection = await connect(options.ip, token.token);
      const res = (await connection.client.callTool({
        name: action.tool,
        arguments: action.args,
      })) as { isError?: boolean; content?: { text?: string }[] };
      const body = (res.content ?? []).map((c) => c.text ?? "").join("\n");
      const related = await relatedIds({ bookingId: action.bookingId });
      if (res.isError) {
        await log(session, {
          type: "confirmation",
          toolName: action.tool,
          payload: { ok: false },
          ...related,
        });
        throw new AppError(409, "CONFLICT", body || "No se pudo completar la acción");
      }
      done = true;
      await log(session, {
        type: "confirmation",
        toolName: action.tool,
        payload: { ok: true, kind: action.kind },
        ...related,
      });
      // El modelo se entera en su siguiente turno, sin gastar una llamada ahora.
      session.messages.push({
        role: "user",
        content: `[Sistema] El usuario pulsó «Confirmar» y se completó: ${action.kind === "book" ? "reserva confirmada" : action.kind === "cancel" ? "reserva cancelada" : "reserva movida"}.`,
      });
      session.lastUsed = Date.now();
      return { kind: action.kind, result: parseJson(body) };
    } finally {
      // Si no se hizo (la API la rechazó o algo falló antes), la propuesta sigue abierta para reintentar.
      if (!done) action.state = "open";
      session.busy = false;
      await connection?.close();
      if (token) await revokeApiToken(db, options.userId, token.id).catch(() => undefined);
    }
  }

  async function discardAction(options: { sessionId: string; userId: string; actionId: string }) {
    const { session, action } = takeAction(options.sessionId, options.userId, options.actionId);
    action.state = "discarded";
    session.busy = true;
    try {
      const related = await relatedIds({ bookingId: action.bookingId });
      await log(session, { type: "discarded", payload: { kind: action.kind }, ...related });
      session.messages.push({
        role: "user",
        content: "[Sistema] El usuario ha descartado la propuesta; no se ha hecho nada.",
      });
    } finally {
      session.busy = false;
    }
  }

  return {
    enabled: config.provider !== null,
    config,
    chat,
    confirmAction,
    discardAction,
    /** Para los tests y el cierre ordenado. */
    sessionCount: () => sessions.size,
    async close() {
      clearInterval(sweeper);
      for (const session of [...sessions.values()]) await dropSession(session);
    },
  };
}

export type AgentService = ReturnType<typeof createAgentService>;
