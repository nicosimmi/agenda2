import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

const ROWS = [
  ["10:00", "Corte + barba", "Marcos R."],
  ["11:00", "Corte clásico", "Pablo S."],
  ["12:30", "Arreglo de barba", "Iván L."],
] as const;

// Pasos del guion: 0 = agenda en reposo, 1 = el asistente escribe, 2 = propone un hueco,
// 3 = el cliente acepta, 4 = aparece la reserva nueva. Después vuelve a empezar.
const STEP_MS = [1400, 1200, 1800, 1400, 3400];

/** Cuenta una reserva en bucle: el asistente propone un hueco y, al aceptar, entra en la agenda. */
export function AgendaMock() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setStep((s) => (s + 1) % STEP_MS.length), STEP_MS[step]);
    return () => clearTimeout(t);
  }, [step]);

  const booked = step === 4;

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-2xl bg-white p-6 shadow-2xl shadow-amber-900/15">
        <div className="flex items-center justify-between">
          <strong className="text-lg">Hoy · Agenda</strong>
          <span className="bg-gold/25 text-gold-dark flex gap-1 rounded-full px-3 py-1 text-xs font-bold">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={booked ? 4 : 3}
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -12, opacity: 0 }}
              >
                {booked ? 4 : 3}
              </motion.span>
            </AnimatePresence>
            reservas
          </span>
        </div>

        <ul className="mt-4 space-y-3">
          {ROWS.map(([time, service, who], i) => (
            <motion.li
              key={time}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.5 }}
              className={`flex items-center gap-4 rounded-lg px-4 py-3 ${
                i % 2 === 0 ? "bg-gold/25" : "bg-stone-100"
              }`}
            >
              <span className="font-bold">{time}</span>
              <span className="flex-1">{service}</span>
              <span className="text-muted text-sm">{who}</span>
            </motion.li>
          ))}
          <AnimatePresence>
            {booked && (
              <motion.li
                initial={{ opacity: 0, scale: 0.9, height: 0 }}
                animate={{ opacity: 1, scale: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="bg-gold flex items-center gap-4 rounded-lg px-4 py-3 shadow-lg shadow-amber-600/30"
              >
                <span className="font-bold">17:30</span>
                <span className="flex-1">Corte clásico</span>
                <span className="text-sm font-bold">✓ Confirmada</span>
              </motion.li>
            )}
          </AnimatePresence>
        </ul>

        <div className="mt-5 flex min-h-[6.5rem] flex-col justify-end gap-2 text-sm">
          <AnimatePresence>
            {step === 1 && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-ink flex w-fit gap-1 rounded-2xl rounded-bl-sm px-4 py-3"
                aria-hidden
              >
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: d * 0.12 }}
                    className="size-1.5 rounded-full bg-stone-300"
                  />
                ))}
              </motion.div>
            )}
            {(step === 2 || step === 3) && (
              <motion.div
                key="assistant"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-ink w-fit max-w-[16rem] rounded-2xl rounded-bl-sm px-4 py-3 text-white"
              >
                Tengo hueco hoy a las 17:30. ¿Te lo reservo?
              </motion.div>
            )}
            {step === 3 && (
              <motion.div
                key="user"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-gold text-ink ml-auto w-fit rounded-2xl rounded-br-sm px-4 py-3 font-semibold"
              >
                Sí, resérvamelo
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
