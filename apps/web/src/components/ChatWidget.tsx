import {
  IconMessageChatbot,
  IconPlayerStop,
  IconRefresh,
  IconSend,
  IconX,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { useAgentChat, type ChatMessage, type Proposal } from "../chat/useAgentChat.ts";
import { buttonClass, secondaryButtonClass } from "../ui.tsx";

interface Status {
  enabled: boolean;
  maxMessageChars: number;
}

const SUGGESTIONS = [
  "Quiero reservar un corte de pelo esta semana",
  "¿Qué barberías hay en Córdoba?",
  "¿Qué servicios ofrece una peluquería?",
];

/**
 * Asistente de reservas: un chat en el que la IA busca, mira huecos y PREPARA la reserva, pero
 * nunca la hace. La tarjeta que aparece tiene su botón y solo ese clic confirma.
 */
export function ChatWidget() {
  const [status, setStatus] = useState<Status | null>(null);
  const [open, setOpen] = useState(false);
  const { me } = useAuth();
  const chat = useAgentChat(me?.id);

  // Si el asistente no está disponible (sin clave de API, por ejemplo) simplemente no se ofrece.
  useEffect(() => {
    api<Status>("/public/chat").then(setStatus, () => setStatus(null));
  }, []);
  if (!status?.enabled) return null;

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            aria-label="Abrir el asistente de reservas"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setOpen(true)}
            className="bg-gold text-ink fixed right-4 bottom-4 z-40 flex h-12 cursor-pointer items-center gap-2 rounded-full px-4 font-bold shadow-xl sm:right-6 sm:bottom-6"
          >
            <IconMessageChatbot className="size-6" />
            <span className="hidden sm:inline">Asistente</span>
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <ChatPanel chat={chat} maxChars={status.maxMessageChars} onClose={() => setOpen(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

function ChatPanel({
  chat,
  maxChars,
  onClose,
}: {
  chat: ReturnType<typeof useAgentChat>;
  maxChars: number;
  onClose: () => void;
}) {
  const { me } = useAuth();
  const { pathname, search } = useLocation();
  const [draft, setDraft] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => input.current?.focus(), []);
  // Sigue el final de la conversación mientras llega la respuesta.
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [chat.messages]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || chat.busy) return;
    void chat.send(draft);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const customer = me?.role === "customer";
  const empty = chat.messages.length === 0;

  return (
    <motion.section
      role="dialog"
      aria-label="Asistente de reservas"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 24, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="bg-page border-line fixed inset-x-2 bottom-2 z-[70] flex h-[min(40rem,calc(100dvh-1rem))] flex-col overflow-hidden rounded-2xl border shadow-2xl sm:right-6 sm:bottom-6 sm:left-auto sm:w-[26rem]"
    >
      <header className="bg-ink flex items-center gap-2 px-4 py-3 text-white">
        <IconMessageChatbot className="text-gold size-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Asistente de reservas</p>
          <p className="truncate text-xs text-stone-300">Prepara la reserva, tú la confirmas</p>
        </div>
        <button
          type="button"
          onClick={chat.reset}
          disabled={empty}
          aria-label="Empezar un chat nuevo"
          title="Chat nuevo"
          className="hover:text-gold cursor-pointer rounded p-1 disabled:opacity-30"
        >
          <IconRefresh className="size-5" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar el asistente"
          className="hover:text-gold cursor-pointer rounded p-1"
        >
          <IconX className="size-5" />
        </button>
      </header>

      <div
        ref={log}
        role="log"
        aria-live="polite"
        aria-label="Conversación"
        className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        {empty && (
          <div className="text-fg">
            <p className="font-semibold">Hola, ¿qué quieres reservar?</p>
            <p className="text-muted mt-1 text-sm">
              Puedo buscar negocios, mirar huecos libres y preparar tu cita. Es una IA y puede
              equivocarse: antes de confirmar, comprueba la tarjeta.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void chat.send(s)}
                  className="border-line hover:border-gold-dark cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {!customer && !empty && (
          <p className="text-muted text-xs">
            Para que pueda preparar una reserva necesitas{" "}
            <Link
              to={`/entrar?volver=${encodeURIComponent(pathname + search)}`}
              className="text-gold-dark font-semibold underline"
              onClick={onClose}
            >
              iniciar sesión
            </Link>
            .
          </p>
        )}
        {chat.messages.map((m) => (
          <Message key={m.id} message={m} onResolve={chat.resolve} onNavigate={onClose} />
        ))}
      </div>

      <form onSubmit={submit} className="border-line border-t p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={maxChars}
            placeholder="Escribe tu mensaje…"
            aria-label="Mensaje para el asistente"
            className="border-muted/50 focus:border-gold-dark focus:ring-gold bg-surface max-h-28 min-h-10 flex-1 resize-none rounded-md border px-3 py-2 text-base focus:ring-2 focus:outline-none"
          />
          {chat.busy ? (
            <button
              type="button"
              onClick={chat.stop}
              aria-label="Parar la respuesta"
              className={`${secondaryButtonClass} flex size-10 items-center justify-center !p-0`}
            >
              <IconPlayerStop className="size-5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Enviar"
              className={`${buttonClass} flex size-10 items-center justify-center !p-0`}
            >
              <IconSend className="size-5" />
            </button>
          )}
        </div>
        <p className="text-muted mt-2 text-[11px] leading-snug">
          Asistente con IA de un tercero (Anthropic). No escribas datos sensibles.{" "}
          <Link to="/privacidad" onClick={onClose} className="underline">
            Más información
          </Link>
        </p>
      </form>
    </motion.section>
  );
}

function Message({
  message,
  onResolve,
  onNavigate,
}: {
  message: ChatMessage;
  onResolve: (messageId: string, actionId: string, how: "confirm" | "discard") => void;
  onNavigate: () => void;
}) {
  if (message.role === "error") {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
      >
        <p>{message.text}</p>
        {message.code !== "invalid" && message.code !== "rate" && message.code !== "busy" && (
          <Link
            to="/buscar"
            onClick={onNavigate}
            className="mt-1 inline-block font-semibold underline"
          >
            Usar la búsqueda de siempre
          </Link>
        )}
      </div>
    );
  }
  const mine = message.role === "user";
  return (
    <div className={`flex flex-col gap-2 ${mine ? "items-end" : "items-start"}`}>
      {(message.text || message.working) && (
        <div
          className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
            mine ? "bg-ink rounded-br-sm text-white" : "bg-surface-2 text-fg rounded-bl-sm"
          }`}
        >
          {message.text}
          {message.working && (
            <span className="text-muted flex items-center gap-2 italic">
              <span className="flex gap-1" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="bg-gold size-1.5 animate-bounce rounded-full"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </span>
              {message.working}…
            </span>
          )}
        </div>
      )}
      {message.proposals.map((p) => (
        <ProposalCard
          key={p.actionId}
          proposal={p}
          onResolve={(how) => onResolve(message.id, p.actionId, how)}
          onNavigate={onNavigate}
        />
      ))}
    </div>
  );
}

const CONFIRM_LABEL = {
  book: "Confirmar reserva",
  cancel: "Sí, cancelar la reserva",
  reschedule: "Confirmar el cambio",
} as const;
const DONE_LABEL = {
  book: "Reserva confirmada",
  cancel: "Reserva cancelada",
  reschedule: "Reserva movida",
} as const;

const str = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";

/** La tarjeta de la propuesta. Sus datos vienen de la API, no del texto del modelo. */
function ProposalCard({
  proposal,
  onResolve,
  onNavigate,
}: {
  proposal: Proposal;
  onResolve: (how: "confirm" | "discard") => void;
  onNavigate: () => void;
}) {
  const { card, kind, state } = proposal;
  const all: [string, string][] =
    kind === "reschedule"
      ? [
          ["Negocio", str(card.business)],
          ["Servicio", str(card.service)],
          ["Ahora", str(card.from)],
          ["Pasa a", str(card.to)],
        ]
      : [
          ["Negocio", str(card.business)],
          ["Servicio", str(card.service)],
          ["Profesional", str(card.professional)],
          ["Cuándo", str(card.when)],
          ["Precio", str(card.price)],
        ];
  const rows = all.filter(([, value]) => value !== "");

  return (
    <div className="border-gold-dark bg-surface w-full rounded-xl border-2 p-3 text-sm">
      <p className="font-bold">{str(card.title)}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      {state === "confirmed" ? (
        <p role="status" className="mt-3 font-semibold text-green-700 dark:text-green-400">
          ✓ {DONE_LABEL[kind]}.{" "}
          <Link to="/mis-reservas" onClick={onNavigate} className="underline">
            Ver mis reservas
          </Link>
        </p>
      ) : state === "discarded" ? (
        <p className="text-muted mt-3">Propuesta descartada. No se ha hecho nada.</p>
      ) : (
        <>
          {kind === "book" && card.holdsSlotForMinutes !== undefined && (
            <p className="text-muted mt-2 text-xs">
              El hueco queda retenido {str(card.holdsSlotForMinutes)} minutos.
            </p>
          )}
          {proposal.error && (
            <p role="alert" className="mt-2 text-red-700 dark:text-red-300">
              {proposal.error}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={state === "working"}
              onClick={() => onResolve("confirm")}
              className={buttonClass}
            >
              {state === "working" ? "Un momento…" : CONFIRM_LABEL[kind]}
            </button>
            <button
              type="button"
              disabled={state === "working"}
              onClick={() => onResolve("discard")}
              className={secondaryButtonClass}
            >
              Descartar
            </button>
          </div>
        </>
      )}
    </div>
  );
}
