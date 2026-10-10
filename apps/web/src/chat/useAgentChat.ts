import { uuid } from "../uuid.ts";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api.ts";
import { streamChat, type ChatErrorCode, type ChatEvent, type ProposalKind } from "./stream.ts";

/** Aviso para que las pantallas que muestran reservas (Mis reservas) se actualicen. */
export const BOOKINGS_CHANGED = "agendia:bookings-changed";

export type ProposalState = "open" | "working" | "confirmed" | "discarded";

export interface Proposal {
  actionId: string;
  kind: ProposalKind;
  card: Record<string, unknown>;
  state: ProposalState;
  error?: string | undefined;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  /** Lo que está haciendo el asistente ahora ("Buscando negocios…"). */
  working?: string | undefined;
  proposals: Proposal[];
  code?: ChatErrorCode;
}

let counter = 0;
const nextId = () => `m${++counter}`;

/** Estado de un chat con el asistente: mensajes, streaming y botones de la propuesta. */
export function useAgentChat(userId: string | undefined) {
  const [sessionId, setSessionId] = useState(() => uuid());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const patch = useCallback((id: string, change: (m: ChatMessage) => ChatMessage) => {
    setMessages((all) => all.map((m) => (m.id === id ? change(m) : m)));
  }, []);

  const reset = useCallback(() => {
    abort.current?.abort();
    setMessages([]);
    setBusy(false);
    setSessionId(uuid());
  }, []);

  // Al entrar o salir de la cuenta el chat empieza de cero: una conversación no cambia de dueño.
  const lastUser = useRef(userId);
  useEffect(() => {
    if (lastUser.current !== userId) {
      // Iniciar sesión a mitad de chat conserva la conversación (el servidor la acepta);
      // cerrar sesión o cambiar de cuenta no.
      if (lastUser.current !== undefined) reset();
      lastUser.current = userId;
    }
  }, [userId, reset]);

  useEffect(() => () => abort.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      const reply = nextId();
      setMessages((all) => [
        ...all,
        { id: nextId(), role: "user", text: message, proposals: [] },
        { id: reply, role: "assistant", text: "", working: "Pensando", proposals: [] },
      ]);
      setBusy(true);
      const controller = new AbortController();
      abort.current = controller;

      const onEvent = (event: ChatEvent) => {
        switch (event.type) {
          case "text":
            patch(reply, (m) => ({ ...m, text: m.text + event.delta, working: undefined }));
            break;
          case "tool":
            patch(reply, (m) => ({
              ...m,
              working: event.status === "running" ? event.label : "Pensando",
            }));
            break;
          case "proposal":
            patch(reply, (m) => ({
              ...m,
              proposals: [
                ...m.proposals,
                { actionId: event.actionId, kind: event.kind, card: event.card, state: "open" },
              ],
            }));
            break;
          case "error":
            setMessages((all) => [
              ...all,
              { id: nextId(), role: "error", text: event.message, code: event.code, proposals: [] },
            ]);
            break;
          default:
            break;
        }
      };

      try {
        await streamChat(sessionId, message, onEvent, controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) {
          const text =
            error instanceof ApiError ? error.message : "El asistente ha tenido un problema";
          setMessages((all) => [
            ...all,
            { id: nextId(), role: "error", text, code: "llm", proposals: [] },
          ]);
        }
      } finally {
        // Un mensaje del asistente que quedó vacío (error antes de hablar) no se muestra.
        setMessages((all) =>
          all
            .map((m) => (m.id === reply ? { ...m, working: undefined } : m))
            .filter((m) => !(m.id === reply && !m.text && m.proposals.length === 0)),
        );
        if (abort.current === controller) abort.current = null;
        setBusy(false);
      }
    },
    [busy, patch, sessionId],
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  /** El clic de la persona: lo único que ejecuta la acción propuesta. */
  const resolve = useCallback(
    async (messageId: string, actionId: string, how: "confirm" | "discard") => {
      const set = (change: Partial<Proposal>) =>
        patch(messageId, (m) => ({
          ...m,
          proposals: m.proposals.map((p) => (p.actionId === actionId ? { ...p, ...change } : p)),
        }));
      set({ state: "working", error: undefined });
      try {
        await api(`/me/agent/actions/${actionId}/${how}`, {
          method: "POST",
          body: JSON.stringify({ sessionId }),
        });
        set({ state: how === "confirm" ? "confirmed" : "discarded" });
        if (how === "confirm") window.dispatchEvent(new Event(BOOKINGS_CHANGED));
      } catch (error) {
        set({
          state: "open",
          error: error instanceof ApiError ? error.message : "No se pudo completar la acción",
        });
      }
    },
    [patch, sessionId],
  );

  return { messages, busy, send, stop, reset, resolve };
}
