import { IconCalendarEvent, IconMapPin } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { api } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { Faq } from "../components/Faq.tsx";
import { TokenManager } from "../components/TokenManager.tsx";
import { Modal } from "../components/Modal.tsx";
import { Loading, PageLoader, Skeleton } from "../components/Skeleton.tsx";
import { SlotPicker } from "../components/SlotPicker.tsx";
import { FAQ } from "../faqs.ts";
import {
  dateTimeIn,
  dayNumber,
  euros,
  localDay,
  monthShort,
  timeIn,
  weekdayShort,
} from "../format.ts";
import type { MyBooking, Slot } from "../types.ts";
import {
  buttonClass,
  ButtonLink,
  FormError,
  Page,
  secondaryButtonClass,
  SubmitButton,
  useAction,
} from "../ui.tsx";
import { BOOKINGS_CHANGED } from "../chat/useAgentChat.ts";
import { useApi } from "../useApi.ts";

const STATUS: Record<MyBooking["status"], [string, string]> = {
  confirmed: ["Confirmada", "bg-gold/20 text-gold-dark"],
  pending: ["Pendiente", "bg-gold/20 text-gold-dark"],
  completed: ["Completada", "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"],
  cancelled: ["Cancelada", "bg-surface-2 text-muted"],
  no_show: ["No se presentó", "bg-red-500/15 text-red-700 dark:text-red-300"],
  expired: ["Caducada", "bg-surface-2 text-muted"],
};

const isActive = (b: MyBooking) => b.status === "confirmed" || b.status === "pending";
const isUpcoming = (b: MyBooking) => isActive(b) && new Date(b.endsAt) > new Date();
const canChange = (b: MyBooking) =>
  isUpcoming(b) && new Date(b.startsAt).getTime() - Date.now() >= b.cancelLimitHours * 3_600_000;

function BookingCard({
  b,
  onConfirm,
  onCancel,
  onMove,
}: {
  b: MyBooking;
  onConfirm: () => void;
  onCancel: () => void;
  onMove: () => void;
}) {
  const day = localDay(new Date(b.startsAt), b.businessTimezone);
  const [label, tone] = STATUS[b.status];
  const changeable = canChange(b);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="border-line bg-surface flex gap-4 rounded-2xl border p-4 shadow-sm sm:p-5"
    >
      <div
        className={`flex size-16 shrink-0 flex-col items-center justify-center rounded-xl ${
          isUpcoming(b) ? "bg-gold text-ink" : "bg-surface-2 text-muted"
        }`}
        aria-hidden
      >
        <span className="text-xs capitalize">{weekdayShort(day)}</span>
        <span className="text-2xl leading-none font-bold">{dayNumber(day)}</span>
        <span className="text-xs">{monthShort(day)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold">{b.serviceName}</h3>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone}`}>
            {label}
          </span>
        </div>
        <p className="text-muted mt-1 text-sm">
          <Link to={`/n/${b.businessSlug}`} className="text-fg font-semibold hover:underline">
            {b.businessName}
          </Link>
          {b.businessCity && (
            <>
              {" · "}
              <IconMapPin className="inline size-3.5" aria-hidden /> {b.businessCity}
            </>
          )}
        </p>
        <p className="mt-1 text-sm">
          <span className="capitalize">{dateTimeIn(b.startsAt, b.businessTimezone)}</span>
          {" · "}con {b.staffName} · {euros(b.priceCents)}
        </p>
        <p className="text-muted mt-1 text-xs">
          Código <span className="font-mono tracking-wider">{b.code}</span>
        </p>
        {isUpcoming(b) && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {b.status === "pending" && b.expiresAt && (
              <>
                <button onClick={onConfirm} className={`${buttonClass} !px-3 !py-1.5 text-sm`}>
                  Confirmar
                </button>
                <span className="text-muted text-sm">
                  Propuesta retenida hasta las {timeIn(b.expiresAt, b.businessTimezone)}
                </span>
              </>
            )}
            {changeable ? (
              <>
                <button
                  onClick={onMove}
                  className={`${secondaryButtonClass} !px-3 !py-1.5 text-sm`}
                >
                  Mover
                </button>
                <button
                  onClick={onCancel}
                  className="cursor-pointer text-sm font-semibold text-red-600 underline dark:text-red-400"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <p className="text-muted text-sm">
                Faltan menos de {b.cancelLimitHours} h: para cambiarla, contacta con el negocio.
              </p>
            )}
          </div>
        )}
      </div>
    </motion.li>
  );
}

export function MyBookings() {
  const { me } = useAuth();
  const bookings = useApi<MyBooking[]>(me?.role === "customer" ? "/me/bookings" : null);
  const reloadBookings = bookings.reload;
  // El asistente de IA puede confirmar o cancelar una reserva mientras esta pantalla está abierta.
  useEffect(() => {
    const onChange = () => void reloadBookings();
    window.addEventListener(BOOKINGS_CHANGED, onChange);
    return () => window.removeEventListener(BOOKINGS_CHANGED, onChange);
  }, [reloadBookings]);
  const [tab, setTab] = useState<"next" | "past">("next");
  const [cancelling, setCancelling] = useState<MyBooking | null>(null);
  const [moving, setMoving] = useState<MyBooking | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [anyStaff, setAnyStaff] = useState(false);
  const { error, busy, run } = useAction();

  if (me === undefined) return <PageLoader />;
  if (me === null) return <Navigate to="/entrar?volver=/mis-reservas" replace />;
  if (me.role !== "customer") return <Navigate to="/panel" replace />;

  const upcoming = (bookings.data ?? [])
    .filter(isUpcoming)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = (bookings.data ?? []).filter((b) => !isUpcoming(b));
  const list = tab === "next" ? upcoming : past;

  const closeCancel = () => setCancelling(null);
  const closeMove = () => {
    setMoving(null);
    setSlot(null);
    setAnyStaff(false);
  };

  // Una propuesta (por ejemplo, de un asistente de IA) retiene el hueco 10 minutos: aquí se confirma.
  const doConfirm = async (b: MyBooking) => {
    await run(() => api(`/me/bookings/${b.id}/confirm`, { method: "POST" }));
    await bookings.reload();
  };

  const doCancel = async () => {
    if (!cancelling) return;
    if (await run(() => api(`/me/bookings/${cancelling.id}/cancel`, { method: "POST" }))) {
      closeCancel();
      await bookings.reload();
    }
  };

  const doMove = async () => {
    if (!moving || !slot) return;
    const ok = await run(() =>
      api(`/me/bookings/${moving.id}/reschedule`, {
        method: "POST",
        body: JSON.stringify({ startsAt: slot.startsAt, staffId: slot.staffId }),
      }),
    );
    if (ok) {
      closeMove();
      await bookings.reload();
    }
  };

  return (
    <Page className="py-10">
      <h1 className="text-3xl font-bold md:text-4xl">Mis reservas</h1>
      <p className="text-muted mt-1">Hola, {me.name}. Aquí tienes tus citas.</p>

      <div
        role="tablist"
        aria-label="Tipo de reservas"
        className="border-line mt-8 flex gap-1 border-b"
      >
        {(
          [
            ["next", "Próximas", upcoming.length],
            ["past", "Pasadas y canceladas", past.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`relative cursor-pointer px-4 py-3 font-semibold transition-colors ${
              tab === key ? "" : "text-muted hover:text-fg"
            }`}
          >
            {label}
            {bookings.data && <span className="text-muted ml-1.5 text-sm">({count})</span>}
            {tab === key && (
              <motion.span
                layoutId="booking-tab"
                className="bg-gold absolute inset-x-0 -bottom-px h-0.5"
              />
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {bookings.loading && (
          <ul className="space-y-4" aria-hidden>
            <Loading label="Cargando tus reservas…" />
            {[0, 1, 2].map((n) => (
              <li key={n} className="border-line bg-surface flex gap-4 rounded-2xl border p-5">
                <Skeleton className="size-16 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
              </li>
            ))}
          </ul>
        )}
        {bookings.error && (
          <div role="alert" className="border-line bg-surface rounded-xl border p-8 text-center">
            <p className="font-semibold">No hemos podido cargar tus reservas</p>
            <p className="text-muted mt-1">{bookings.error}</p>
            <button onClick={() => void bookings.reload()} className={`${buttonClass} mt-4`}>
              Reintentar
            </button>
          </div>
        )}
        {bookings.data && list.length === 0 && (
          <div className="border-line bg-surface rounded-xl border p-10 text-center">
            <IconCalendarEvent className="text-gold mx-auto size-10" aria-hidden />
            <p className="mt-3 text-lg font-bold">
              {tab === "next" ? "No tienes citas próximas" : "Todavía no hay reservas pasadas"}
            </p>
            <p className="text-muted mt-1">Busca un negocio y reserva en menos de un minuto.</p>
            <div className="mt-5">
              <ButtonLink to="/buscar">Buscar negocios</ButtonLink>
            </div>
          </div>
        )}
        <ul className="space-y-4">
          <AnimatePresence initial={false}>
            {list.map((b) => (
              <BookingCard
                key={b.id}
                b={b}
                onConfirm={() => doConfirm(b)}
                onCancel={() => setCancelling(b)}
                onMove={() => setMoving(b)}
              />
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <TokenManager />

      <Faq items={FAQ.misReservas!} className="mt-16" />

      <Modal open={cancelling !== null} onClose={closeCancel} title="¿Cancelar esta reserva?">
        {cancelling && (
          <>
            <p className="text-muted">
              {cancelling.serviceName} en {cancelling.businessName},{" "}
              <span className="capitalize">
                {dateTimeIn(cancelling.startsAt, cancelling.businessTimezone)}
              </span>
              . El hueco quedará libre para otras personas.
            </p>
            <FormError message={error} />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeCancel} className={secondaryButtonClass}>
                Mantener
              </button>
              <SubmitButton busy={busy} onClick={doCancel}>
                Sí, cancelar
              </SubmitButton>
            </div>
          </>
        )}
      </Modal>

      <Modal open={moving !== null} onClose={closeMove} title="Mover la reserva">
        {moving && (
          <>
            <p className="text-muted mb-4 text-sm">
              {moving.serviceName} con {moving.staffName}. Ahora:{" "}
              <span className="capitalize">
                {dateTimeIn(moving.startsAt, moving.businessTimezone)}
              </span>
            </p>
            <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={anyStaff}
                onChange={(e) => {
                  setAnyStaff(e.target.checked);
                  setSlot(null);
                }}
                className="accent-gold size-4"
              />
              Ver también huecos de otros profesionales
            </label>
            <SlotPicker
              slug={moving.businessSlug}
              timezone={moving.businessTimezone}
              serviceId={moving.serviceId}
              staffId={anyStaff ? "" : moving.staffId}
              selected={slot?.startsAt ?? null}
              onSelect={setSlot}
            />
            {slot && (
              <p className="mt-4 text-sm font-semibold">
                Nueva hora: {timeIn(slot.startsAt, moving.businessTimezone)}
              </p>
            )}
            <FormError message={error} />
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={closeMove} className={secondaryButtonClass}>
                Cerrar
              </button>
              <SubmitButton busy={busy} disabled={!slot} onClick={doMove}>
                Confirmar cambio
              </SubmitButton>
            </div>
          </>
        )}
      </Modal>
    </Page>
  );
}
