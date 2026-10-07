// Proveedor del modelo de lenguaje detrás de una interfaz propia (`LlmProvider`): el bucle del agente
// no conoce a Anthropic, así que los tests usan un proveedor simulado y nunca llaman a un LLM real
// (regla 11 del SPEC). Hoy hay tres implementaciones: Anthropic, un guion de demostración (sin clave)
// y el simulado de los tests.
import Anthropic from "@anthropic-ai/sdk";

/**
 * Un bloque de contenido. El bucle solo mira `text` y `tool_use`; el resto (por ejemplo, los bloques
 * de razonamiento del modelo) viaja sin tocar, porque hay que devolverlos tal cual en el turno siguiente.
 */
export type Block = { type: string; [key: string]: unknown };

export interface LlmMessage {
  role: "user" | "assistant";
  content: string | Block[];
}

export interface LlmTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LlmRequest {
  /** `stable` no cambia entre peticiones (se cachea); `volatile` lleva la fecha y la sesión. */
  system: { stable: string; volatile: string };
  messages: LlmMessage[];
  tools: LlmTool[];
  maxTokens: number;
  signal?: AbortSignal;
}

export interface LlmResult {
  content: Block[];
  stopReason: "end_turn" | "tool_use" | "max_tokens" | "refusal" | "other";
  usage: { inputTokens: number; outputTokens: number };
}

export interface LlmProvider {
  readonly name: string;
  /** Una llamada al modelo; `onText` recibe el texto según se genera (streaming). */
  complete(request: LlmRequest, onText: (delta: string) => void): Promise<LlmResult>;
}

/** Error del proveedor con un mensaje que se puede enseñar al usuario. */
export class LlmError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable = false) {
    super(message);
    this.retryable = retryable;
  }
}

export interface AnthropicOptions {
  apiKey: string;
  model: string;
  /** Profundidad de razonamiento: `low` basta para reservar y es lo más barato. */
  effort: "low" | "medium" | "high";
  /** Para los tests del proveedor: un cliente falso en vez del real. */
  client?: Pick<Anthropic, "messages">;
}

/** Cuántas veces reintenta el SDK ante 429/5xx/red antes de rendirse. */
const MAX_RETRIES = 2;

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private readonly client: Pick<Anthropic, "messages">;
  private readonly model: string;
  private readonly effort: AnthropicOptions["effort"];

  constructor(options: AnthropicOptions) {
    this.client =
      options.client ?? new Anthropic({ apiKey: options.apiKey, maxRetries: MAX_RETRIES });
    this.model = options.model;
    this.effort = options.effort;
  }

  async complete(request: LlmRequest, onText: (delta: string) => void): Promise<LlmResult> {
    try {
      const stream = this.client.messages.stream(
        {
          model: this.model,
          max_tokens: request.maxTokens,
          // El pensamiento adaptativo viene activado por defecto en este modelo y no se puede apagar.
          output_config: { effort: this.effort },
          // La parte estable lleva la marca de caché: el prefijo (herramientas + sistema) se reutiliza
          // entre turnos. Lo volátil (fecha, sesión) va después, fuera de lo cacheado.
          system: [
            { type: "text", text: request.system.stable, cache_control: { type: "ephemeral" } },
            { type: "text", text: request.system.volatile },
          ],
          // Sin `tool_choice` forzado: este modelo lo rechaza (400). Se guía con el prompt.
          tools: request.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
          })),
          messages: request.messages as Anthropic.MessageParam[],
        },
        request.signal ? { signal: request.signal } : undefined,
      );
      stream.on("text", (delta) => onText(delta));
      const message = await stream.finalMessage();

      const stopReason: LlmResult["stopReason"] =
        message.stop_reason === "end_turn" ||
        message.stop_reason === "tool_use" ||
        message.stop_reason === "max_tokens" ||
        message.stop_reason === "refusal"
          ? message.stop_reason
          : "other";
      return {
        // Se guardan los bloques tal cual (también los de razonamiento) para el siguiente turno.
        content: message.content as unknown as Block[],
        stopReason,
        usage: {
          // Lo leído de la caché también cuenta como entrada, a efectos del tope de gasto.
          inputTokens:
            message.usage.input_tokens +
            (message.usage.cache_read_input_tokens ?? 0) +
            (message.usage.cache_creation_input_tokens ?? 0),
          outputTokens: message.usage.output_tokens,
        },
      };
    } catch (error) {
      throw toLlmError(error);
    }
  }
}

/** Errores del SDK traducidos a mensajes que sirven al usuario (sin detalles internos ni la clave). */
function toLlmError(error: unknown): Error {
  if (error instanceof LlmError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    return new LlmError("El asistente no está bien configurado en este momento");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new LlmError("El asistente está muy ocupado. Inténtalo de nuevo en un momento", true);
  }
  if (error instanceof Anthropic.APIUserAbortError) return error;
  if (error instanceof Anthropic.APIConnectionError) {
    return new LlmError("No se pudo contactar con el asistente. Inténtalo de nuevo", true);
  }
  if (error instanceof Anthropic.APIError) {
    return new LlmError("El asistente no ha podido responder", (error.status ?? 500) >= 500);
  }
  // Cualquier otro error puede llevar datos internos (o la clave): no sale tal cual.
  return new LlmError("El asistente ha tenido un problema");
}

export interface Prices {
  /** EUR por millón de tokens. */
  inputEurPerMTok: number;
  outputEurPerMTok: number;
}

/** Coste aproximado de una llamada. */
export const costEur = (usage: { inputTokens: number; outputTokens: number }, prices: Prices) =>
  (usage.inputTokens * prices.inputEurPerMTok + usage.outputTokens * prices.outputEurPerMTok) /
  1_000_000;
