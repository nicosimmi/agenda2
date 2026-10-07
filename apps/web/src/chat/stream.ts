import { ApiError } from "../api.ts";

export type ProposalKind = "book" | "cancel" | "reschedule";
export type ChatErrorCode =
  | "unavailable"
  | "budget"
  | "rate"
  | "busy"
  | "session_full"
  | "llm"
  | "timeout"
  | "refused"
  | "invalid";

/** Eventos que emite el servidor del agente (Server-Sent Events). */
export type ChatEvent =
  | { type: "start"; sessionId: string }
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; status: "running" | "done" | "error"; label: string }
  | { type: "proposal"; actionId: string; kind: ProposalKind; card: Record<string, unknown> }
  | { type: "done" }
  | { type: "error"; code: ChatErrorCode; message: string };

/**
 * Envía un mensaje y entrega los eventos según llegan. Se usa fetch y no EventSource porque
 * EventSource solo hace GET y aquí el mensaje viaja en un POST.
 */
export async function streamChat(
  sessionId: string,
  message: string,
  onEvent: (event: ChatEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/public/chat", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ApiError("No hay conexión con el servidor. Comprueba tu red e inténtalo de nuevo", 0);
  }
  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new ApiError(body?.error?.message ?? "El asistente no responde ahora mismo", res.status);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    let end: number;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = chunk.split("\n").find((line) => line.startsWith("data: "));
      if (data) onEvent(JSON.parse(data.slice(6)) as ChatEvent);
    }
  }
}
