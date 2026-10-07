// Rutas del agente: el chat con streaming (públicas) y los botones «Confirmar» y «Descartar»
// (solo con la sesión de un cliente en el navegador: un token no puede confirmar por el agente).
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AgentService, AgentStreamEvent } from "../agent/service.ts";
import { AppError } from "../errors.ts";
import { requireBrowserSession, requireRole, userOf } from "../guards.ts";

const chatSchema = z.object({
  sessionId: z.uuid(),
  // La longitud real se comprueba en el servicio, con el tope configurado.
  message: z.string().min(1).max(5000),
});
const actionSchema = z.object({ sessionId: z.uuid() });
const idParams = z.object({ id: z.uuid() });

export async function agentPublicRoutes(
  app: FastifyInstance,
  { service }: { service: AgentService },
) {
  // Estado del asistente: la web decide con esto si muestra el chat.
  app.get("/", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async () => ({
    enabled: service.enabled,
    maxMessageChars: service.config.maxMessageChars,
  }));

  app.post(
    "/",
    // Límite por IP; los de sesión, persona y gasto los aplica el servicio.
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const body = chatSchema.parse(req.body);

      // Respuesta en streaming (Server-Sent Events). Se escribe a mano para conservar las cabeceras
      // de seguridad y de CORS que ya puso Fastify.
      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        ...(reply.getHeaders() as Record<string, string | string[]>),
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      const controller = new AbortController();
      raw.on("close", () => {
        if (!raw.writableEnded) controller.abort(); // la persona cerró el chat a mitad de respuesta
      });
      const emit = (event: AgentStreamEvent) => {
        if (!raw.writableEnded && !raw.destroyed) {
          raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        }
      };

      try {
        await service.chat({
          sessionId: body.sessionId,
          // Solo la sesión del navegador de un cliente; un token de acceso no abre un chat con su cuenta.
          userId: req.user?.role === "customer" && req.scopes === null ? req.user.id : null,
          ip: req.ip,
          message: body.message,
          emit,
          signal: controller.signal,
        });
      } catch (error) {
        const message =
          error instanceof AppError
            ? error.message
            : "El asistente ha tenido un problema. Inténtalo de nuevo";
        if (!(error instanceof AppError)) req.log.error(error);
        emit({ type: "error", code: "invalid", message });
      }
      raw.end();
    },
  );
}

export async function agentActionRoutes(
  app: FastifyInstance,
  { service }: { service: AgentService },
) {
  app.addHook("preHandler", requireRole("customer"));
  app.addHook("preHandler", requireBrowserSession);

  const limit = {
    rateLimit: {
      hook: "preHandler" as const,
      max: 60,
      timeWindow: "1 hour",
      keyGenerator: (req: { user: { id: string } | null; ip: string }) =>
        `agent-action:${req.user?.id ?? req.ip}`,
    },
  };

  // El clic en «Confirmar»: lo único que ejecuta confirm_*. Solo vale una acción que el servicio
  // registró en ese chat y que la persona ha visto en su tarjeta.
  app.post("/actions/:id/confirm", { config: limit }, async (req) =>
    service.confirmAction({
      sessionId: actionSchema.parse(req.body).sessionId,
      userId: userOf(req).id,
      actionId: idParams.parse(req.params).id,
      ip: req.ip,
    }),
  );

  app.post("/actions/:id/discard", { config: limit }, async (req, reply) => {
    await service.discardAction({
      sessionId: actionSchema.parse(req.body).sessionId,
      userId: userOf(req).id,
      actionId: idParams.parse(req.params).id,
    });
    return reply.status(204).send();
  });
}
