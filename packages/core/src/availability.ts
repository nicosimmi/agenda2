import { DAY_MS, MINUTE_MS, datesBetween, isoWeekday, localToUtc } from "./time.ts";

export interface WorkingHours {
  staffId: string;
  weekday: number; // 1 = lunes … 7 = domingo
  startTime: string; // hora local "HH:MM"
  endTime: string;
}

export interface TimeOff {
  staffId: string | null; // null = cierra todo el negocio
  startsAt: Date;
  endsAt: Date;
}

export interface ExistingBooking {
  staffId: string;
  startsAt: Date;
  endsAt: Date; // incluye el buffer del servicio (ver DECISIONS F1-3)
}

export interface BusinessSettings {
  timezone: string;
  slotStepMin: number;
  minNoticeMin: number;
  maxHorizonDays: number;
}

export interface AvailabilityInput {
  service: { durationMin: number; bufferMin: number };
  staffCandidates: string[]; // ids de profesionales que hacen el servicio (o solo el elegido)
  workingHours: WorkingHours[];
  timeOff: TimeOff[];
  existingBookings: ExistingBooking[]; // solo las activas (pending sin caducar y confirmed)
  range: { from: string; to: string }; // fechas locales "YYYY-MM-DD", ambas incluidas
  now: Date;
  businessSettings: BusinessSettings;
}

/** Hueco reservable. `endsAt` = inicio + duración + buffer: lo que ocupa al profesional. */
export interface Slot {
  staffId: string;
  startsAt: Date;
  endsAt: Date;
}

interface Interval {
  start: number;
  end: number;
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/**
 * Calcula los huecos libres de un servicio. Función pura: no consulta la base de datos;
 * la API le pasa los datos ya cargados y revalida el hueco elegido al reservar.
 */
export function computeAvailability(input: AvailabilityInput): Slot[] {
  const { service, businessSettings: settings } = input;
  const blockMs = (service.durationMin + service.bufferMin) * MINUTE_MS;
  const stepMs = settings.slotStepMin * MINUTE_MS;
  const earliest = input.now.getTime() + settings.minNoticeMin * MINUTE_MS;
  const latest = input.now.getTime() + settings.maxHorizonDays * DAY_MS;

  const slots: Slot[] = [];
  for (const staffId of input.staffCandidates) {
    const busy: Interval[] = [
      ...input.timeOff.filter((off) => off.staffId === null || off.staffId === staffId),
      ...input.existingBookings.filter((booking) => booking.staffId === staffId),
    ].map((item) => ({ start: item.startsAt.getTime(), end: item.endsAt.getTime() }));

    for (const date of datesBetween(input.range.from, input.range.to)) {
      const weekday = isoWeekday(date);
      const shifts = input.workingHours.filter(
        (hours) => hours.staffId === staffId && hours.weekday === weekday,
      );
      for (const shift of shifts) {
        const shiftStart = localToUtc(date, shift.startTime, settings.timezone).getTime();
        const shiftEnd = localToUtc(date, shift.endTime, settings.timezone).getTime();
        for (let start = shiftStart; start + blockMs <= shiftEnd; start += stepMs) {
          if (start < earliest || start > latest) continue;
          const block = { start, end: start + blockMs };
          if (busy.some((interval) => overlaps(block, interval))) continue;
          slots.push({ staffId, startsAt: new Date(block.start), endsAt: new Date(block.end) });
        }
      }
    }
  }

  return slots.sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime() || a.staffId.localeCompare(b.staffId),
  );
}
