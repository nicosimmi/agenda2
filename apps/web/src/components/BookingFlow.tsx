import { IconCheck, IconCopy } from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api.ts";
import { useAuth } from "../auth.tsx";
import { dateTimeIn, duration, euros, longDay, localDay, timeIn } from "../format.ts";
import type { BusinessDetail, Slot } from "../types.ts";
import { buttonClass, inputClass, secondaryButtonClass, SubmitButton, useAction } from "../ui.tsx";
import { SlotPicker } from "./SlotPicker.tsx";

const PENDING_KEY = "agendia-pending-booking";
const STEPS = ["Servicio", "Profesional", "Fecha y hora", "Confirmar"] as const;

interface Done {
  code: string;
  startsAt: string;
  serviceName: string;
  staffName: string;
}

/** Clave de idempotencia. `randomUUID` solo existe en contextos seguros (https o localhost). */
const newKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        x: (i / 28) * 100 + Math.random() * 3,
        delay: Math.random() * 0.4,
        size: 6 + Math.random() * 6,
        rotate: Math.random() * 360,
        color: ["#c89b3c", "#e7d3a3", "#1c1917", "#a67c22"][i % 4]!,
      })),
    [],
  );
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: 260, opacity: 0, rotate: p.rotate }}
          transition={{ duration: 1.8, delay: p.delay, ease: "easeIn" }}
          style={{ left: `${p.x}%`, width: p.size, height: p.size, background: p.color }}
          className="absolute top-0 rounded-sm"
        />
      ))}
    </div>
  );
}

function DoneView({
  done,
  business,
  onAgain,
}: {
  done: Done;
  business: BusinessDetail;
  onAgain: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(done.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sin permiso para el portapapeles: el código sigue a la vista */
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative text-center"
    >
      <Confetti />
      <motion.svg
        viewBox="0 0 52 52"
        className="text-gold mx-auto size-20"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <motion.circle
          cx="26"
          cy="26"
          r="23"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.6 }}
        />
        <motion.path
          d="m15 27 8 8 14-16"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        />
      </motion.svg>
      <h3 className="mt-3 text-2xl font-bold">Reserva confirmada</h3>
      <p className="text-muted mt-1">
        {done.serviceName} con {done.staffName}
      </p>
      <p className="mt-1 font-semibold capitalize">
        {dateTimeIn(done.startsAt, business.timezone)}
      </p>
      <div className="border-line bg-surface-2 mx-auto mt-5 max-w-xs rounded-xl border border-dashed p-4">
        <p className="text-muted text-sm">Tu código de reserva</p>
        <p className="mt-1 font-mono text-2xl font-bold tracking-widest" data-testid="booking-code">
          {done.code}
        </p>
        <button
          onClick={copy}
          className="text-gold-dark mt-2 inline-flex cursor-pointer items-center gap-1 text-sm font-semibold"
        >
          {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
          {copied ? "Copiado" : "Copiar código"}
        </button>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/mis-reservas" className={`${buttonClass} inline-block`}>
          Ver mis reservas
        </Link>
        <button onClick={onAgain} className={secondaryButtonClass}>
          Reservar otra cita
        </button>
      </div>
    </motion.div>
  );
}

/** Reserva en cuatro pasos: servicio, profesional, fecha y hora, y confirmación. */
export function BookingFlow({ business }: { business: BusinessDetail }) {
  const { me } = useAuth();
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [slot, setSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [done, setDone] = useState<Done | null>(null);
  const { error, busy, run } = useAction();
  const attempt = useRef<{ sig: string; key: string }>({ sig: "", key: "" });

  const service = business.services.find((s) => s.id === serviceId);
  const team = business.staff.filter((m) => m.serviceIds.includes(serviceId));
  const member = business.staff.find((m) => m.id === (staffId || slot?.staffId));

  // Si la persona tuvo que iniciar sesión para confirmar, vuelve a su selección.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PENDING_KEY);
      const saved = JSON.parse(raw) as {
        slug: string;
        serviceId: string;
        staffId: string;
        slot: Slot;
      };
      if (saved.slug !== business.slug) return;
      setServiceId(saved.serviceId);
      setStaffId(saved.staffId);
      setSlot(saved.slot);
      setStep(3);
    } catch {
      /* selección guardada ilegible: se empieza de cero */
    }
  }, [business.slug]);

  const pickService = (id: string) => {
    setServiceId(id);
    setSlot(null);
    const pros = business.staff.filter((m) => m.serviceIds.includes(id));
    // Con un único profesional no hay nada que elegir.
    if (pros.length <= 1) {
      setStaffId(pros[0]?.id ?? "");
      setStep(2);
    } else {
      setStaffId("");
      setStep(1);
    }
  };

  const pickStaff = (id: string) => {
    setStaffId(id);
    setSlot(null);
    setStep(2);
  };

  const back = () => setStep((s) => (s === 2 && team.length <= 1 ? 0 : Math.max(0, s - 1)));

  const confirm = async () => {
    if (!slot || !service) return;
    // La misma clave mientras no cambie la petición: un reintento no crea otra reserva.
    const sig = [serviceId, staffId, slot.startsAt, notes].join("|");
    if (attempt.current.sig !== sig) attempt.current = { sig, key: newKey() };
    await run(async () => {
      try {
        const res = await api<Done>("/me/bookings", {
          method: "POST",
          headers: { "Idempotency-Key": attempt.current.key },
          body: JSON.stringify({
            businessSlug: business.slug,
            serviceId,
            ...(staffId ? { staffId } : {}),
            startsAt: slot.startsAt,
            notes: notes.trim(),
          }),
        });
        setDone(res);
      } catch (e) {
        // Un hueco ocupado: se vuelve a pedir la lista y a elegir hora.
        if (e instanceof ApiError && e.status === 409) {
          setSlot(null);
          setRefresh((n) => n + 1);
          setStep(2);
        }
        throw e;
      }
    });
  };

  const needLogin = () => {
    if (!slot) return;
    try {
      sessionStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ slug: business.slug, serviceId, staffId, slot }),
      );
    } catch {
      /* sin almacenamiento, tendrá que volver a elegir */
    }
  };

  const reset = () => {
    setDone(null);
    setStep(0);
    setServiceId("");
    setStaffId("");
    setSlot(null);
    setNotes("");
  };

  const next = `?volver=${encodeURIComponent(`/n/${business.slug}`)}`;
  const canBook = me?.role === "customer";

  return (
    <div className="border-line bg-surface rounded-2xl border p-5 shadow-lg shadow-amber-900/5 sm:p-6">
      {done ? (
        <DoneView done={done} business={business} onAgain={reset} />
      ) : (
        <>
          <h2 className="text-xl font-bold">Reserva tu cita</h2>
          <ol className="mt-4 flex items-center gap-2" aria-label="Pasos de la reserva">
            {STEPS.map((label, i) => (
              <li
                key={label}
                className="flex flex-1 items-center gap-2"
                aria-current={i === step ? "step" : undefined}
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    i <= step ? "bg-gold text-ink" : "bg-surface-2 text-muted"
                  }`}
                >
                  {i < step ? <IconCheck className="size-4" /> : i + 1}
                </span>
                {i < STEPS.length - 1 && <span className="bg-line h-px flex-1" aria-hidden />}
              </li>
            ))}
          </ol>
          <p className="text-muted mt-3 text-sm">
            Paso {step + 1} de {STEPS.length}: <strong className="text-fg">{STEPS[step]}</strong>
          </p>

          <div className="mt-5 min-h-[14rem]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
              >
                {step === 0 && (
                  <div role="radiogroup" aria-label="Servicio" className="space-y-2">
                    {business.services.map((s) => (
                      <button
                        key={s.id}
                        role="radio"
                        aria-checked={s.id === serviceId}
                        onClick={() => pickService(s.id)}
                        className={`flex w-full cursor-pointer items-start justify-between gap-3 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 ${
                          s.id === serviceId
                            ? "border-gold bg-gold/10"
                            : "border-line hover:border-gold"
                        }`}
                      >
                        <span>
                          <span className="block font-semibold">{s.name}</span>
                          <span className="text-muted block text-sm">
                            {duration(s.durationMin)}
                            {s.description && ` · ${s.description}`}
                          </span>
                        </span>
                        <span className="shrink-0 font-bold">{euros(s.priceCents)}</span>
                      </button>
                    ))}
                    {business.services.length === 0 && (
                      <p className="text-muted">
                        Este negocio todavía no tiene servicios disponibles.
                      </p>
                    )}
                  </div>
                )}

                {step === 1 && (
                  <div role="radiogroup" aria-label="Profesional" className="space-y-2">
                    {[{ id: "", name: "Cualquiera disponible" }, ...team].map((m) => (
                      <button
                        key={m.id || "any"}
                        role="radio"
                        aria-checked={m.id === staffId}
                        onClick={() => pickStaff(m.id)}
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border p-4 text-left font-semibold transition-all hover:-translate-y-0.5 ${
                          m.id === staffId
                            ? "border-gold bg-gold/10"
                            : "border-line hover:border-gold"
                        }`}
                      >
                        <span className="bg-gold text-ink flex size-9 items-center justify-center rounded-full">
                          {m.id ? m.name.slice(0, 1) : "★"}
                        </span>
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}

                {step === 2 && service && (
                  <SlotPicker
                    slug={business.slug}
                    timezone={business.timezone}
                    serviceId={service.id}
                    staffId={staffId}
                    selected={slot?.startsAt ?? null}
                    refreshKey={refresh}
                    onSelect={(s) => {
                      setSlot(s);
                      setStep(3);
                    }}
                  />
                )}

                {step === 3 && service && slot && (
                  <div className="space-y-4">
                    <dl className="border-line bg-surface-2 divide-line divide-y rounded-xl border">
                      {[
                        ["Servicio", `${service.name} · ${duration(service.durationMin)}`],
                        ["Profesional", member?.name ?? "Asignado al confirmar"],
                        ["Día", longDay(localDay(new Date(slot.startsAt), business.timezone))],
                        ["Hora", timeIn(slot.startsAt, business.timezone)],
                        ["Precio", euros(service.priceCents)],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                          <dt className="text-muted">{k}</dt>
                          <dd className="text-right font-semibold">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <label className="block">
                      <span className="text-sm font-semibold">Nota para el negocio (opcional)</span>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        maxLength={500}
                        rows={2}
                        className={inputClass}
                      />
                    </label>
                    {error && (
                      <p
                        role="alert"
                        className="text-sm font-semibold text-red-600 dark:text-red-400"
                      >
                        {error}
                      </p>
                    )}
                    {me === undefined && (
                      <p className="text-muted text-sm">Comprobando tu sesión…</p>
                    )}
                    {me === null && (
                      <div className="bg-gold/10 rounded-xl p-4">
                        <p className="font-semibold">Entra para confirmar tu reserva</p>
                        <p className="text-muted mt-1 text-sm">
                          Guardamos tu selección y la recuperas al volver.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          <Link
                            to={`/entrar${next}`}
                            onClick={needLogin}
                            className={`${buttonClass} inline-block`}
                          >
                            Entrar
                          </Link>
                          <Link
                            to={`/registro${next}`}
                            onClick={needLogin}
                            className={`${secondaryButtonClass} inline-block`}
                          >
                            Crear cuenta
                          </Link>
                        </div>
                      </div>
                    )}
                    {me && !canBook && (
                      <p
                        role="alert"
                        className="text-sm font-semibold text-red-600 dark:text-red-400"
                      >
                        Las cuentas de negocio no pueden reservar. Entra con una cuenta de cliente.
                      </p>
                    )}
                    {canBook && (
                      <SubmitButton
                        busy={busy}
                        onClick={confirm}
                        className={`${buttonClass} w-full py-3`}
                      >
                        Confirmar reserva
                      </SubmitButton>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {step > 0 && (
            <button
              type="button"
              onClick={back}
              className="text-gold-dark mt-4 cursor-pointer text-sm font-semibold underline"
            >
              ← Volver al paso anterior
            </button>
          )}
        </>
      )}
    </div>
  );
}
