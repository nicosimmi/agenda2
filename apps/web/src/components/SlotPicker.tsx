import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  dayNumber,
  localDay,
  longDay,
  monthShort,
  timeIn,
  weekdayShort,
} from "../format.ts";
import type { Slot } from "../types.ts";
import { useApi } from "../useApi.ts";
import { Loading, Skeleton } from "./Skeleton.tsx";

const DAYS = 14;

/**
 * Elige día y hora entre los huecos libres de los próximos 14 días. Los días y las horas se
 * muestran en la zona horaria del negocio. Sin profesional elegido, cada hora sale una sola vez.
 */
export function SlotPicker({
  slug,
  timezone,
  serviceId,
  staffId,
  selected,
  onSelect,
  refreshKey = 0,
}: {
  slug: string;
  timezone: string;
  serviceId: string;
  staffId: string;
  selected: string | null;
  onSelect: (slot: Slot) => void;
  /** Al cambiar, se vuelven a pedir los huecos (por ejemplo, tras un 409). */
  refreshKey?: number;
}) {
  const today = useMemo(() => localDay(new Date(), timezone), [timezone]);
  const query = new URLSearchParams({ serviceId, from: today, to: addDays(today, DAYS - 1) });
  if (staffId) query.set("staffId", staffId);
  const { data, error, loading, reload } = useApi<{ slots: Slot[] }>(
    `/public/businesses/${slug}/availability?${query}&k=${refreshKey}`,
  );

  // Huecos por día local, sin repetir horas cuando hay varios profesionales libres.
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of data?.slots ?? []) {
      const day = localDay(new Date(slot.startsAt), timezone);
      const list = map.get(day) ?? [];
      if (!list.some((s) => s.startsAt === slot.startsAt)) list.push(slot);
      map.set(day, list);
    }
    return map;
  }, [data, timezone]);

  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(today, i)), [today]);
  const [day, setDay] = useState<string | null>(null);

  // Al llegar los huecos, se abre el primer día que tenga alguno (o el del hueco ya elegido).
  useEffect(() => {
    if (!data) return;
    const chosen = selected ? localDay(new Date(selected), timezone) : null;
    setDay((current) => {
      if (chosen && byDay.has(chosen)) return chosen;
      if (current && byDay.has(current)) return current;
      return days.find((d) => byDay.has(d)) ?? null;
    });
  }, [data, byDay, days, selected, timezone]);

  if (loading) {
    return (
      <div aria-hidden>
        <Loading label="Buscando huecos libres…" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }, (_, n) => (
            <Skeleton key={n} className="h-20 w-16 shrink-0" />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, n) => (
            <Skeleton key={n} className="h-10" />
          ))}
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="text-center">
        <p className="font-semibold text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={() => void reload()}
          className="text-gold-dark mt-2 font-semibold underline"
        >
          Reintentar
        </button>
      </div>
    );
  }
  if (byDay.size === 0) {
    return (
      <p className="text-muted rounded-lg p-4 text-center">
        No hay huecos libres en los próximos {DAYS} días. Prueba con otro profesional o vuelve más
        tarde.
      </p>
    );
  }

  const slots = day ? (byDay.get(day) ?? []) : [];
  const hour = (s: Slot) => Number(timeIn(s.startsAt, timezone).slice(0, 2));
  const groups = [
    ["Mañana", slots.filter((s) => hour(s) < 14)],
    ["Tarde", slots.filter((s) => hour(s) >= 14)],
  ] as const;

  return (
    <div>
      <div
        role="listbox"
        aria-label="Días disponibles"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
      >
        {days.map((d) => {
          const count = byDay.get(d)?.length ?? 0;
          const active = d === day;
          return (
            <button
              key={d}
              role="option"
              aria-selected={active}
              disabled={count === 0}
              onClick={() => setDay(d)}
              aria-label={`${longDay(d)}, ${count} huecos`}
              className={`relative flex w-16 shrink-0 cursor-pointer flex-col items-center rounded-xl border px-2 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                active ? "border-gold text-ink" : "border-line hover:border-gold"
              }`}
            >
              {active && (
                <motion.span
                  layoutId={`day-${slug}`}
                  className="bg-gold absolute inset-0 rounded-xl"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative text-xs capitalize">{weekdayShort(d)}</span>
              <span className="relative text-xl font-bold">{dayNumber(d)}</span>
              <span className="relative text-xs">{monthShort(d)}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={day}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="mt-4 space-y-4"
        >
          {day && <p className="text-muted text-sm capitalize">{longDay(day)}</p>}
          {groups.map(
            ([label, list]) =>
              list.length > 0 && (
                <div key={label}>
                  <p className="mb-2 text-sm font-semibold">{label}</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {list.map((slot) => (
                      <button
                        key={slot.startsAt}
                        type="button"
                        aria-pressed={slot.startsAt === selected}
                        onClick={() => onSelect(slot)}
                        className={`cursor-pointer rounded-lg border px-2 py-2 font-semibold transition-all hover:-translate-y-0.5 ${
                          slot.startsAt === selected
                            ? "border-gold bg-gold text-ink"
                            : "border-line hover:border-gold"
                        }`}
                      >
                        {timeIn(slot.startsAt, timezone)}
                      </button>
                    ))}
                  </div>
                </div>
              ),
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
