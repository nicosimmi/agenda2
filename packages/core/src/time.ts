// Conversión entre hora local de un negocio y UTC usando solo Intl (sin librerías).
// Los horarios laborales se guardan en hora local ("10:00" en Europe/Madrid) y las
// reservas en UTC; estas funciones hacen el puente teniendo en cuenta los cambios de hora.

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Diferencia (ms) entre la hora local de `timeZone` y UTC en un instante dado. */
function offsetMs(instant: number, timeZone: string): number {
  const parts = formatterFor(timeZone).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const localAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return localAsUtc - Math.floor(instant / 1000) * 1000;
}

function parseDate(date: string): [number, number, number] {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) throw new Error(`Fecha no válida: ${date}`);
  return [year, month, day];
}

/**
 * Convierte una fecha ("2026-03-29") y una hora ("10:00" o "10:00:00") locales a un instante UTC.
 * Una hora que no existe (salto de primavera) se desplaza hacia delante; una hora repetida
 * (otoño) se resuelve como la segunda vez que ocurre.
 */
export function localToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = parseDate(date);
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = wall - offsetMs(wall, timeZone);
  const offsetAtGuess = offsetMs(firstGuess, timeZone);
  return new Date(wall - offsetAtGuess);
}

/** Día de la semana ISO (1 = lunes … 7 = domingo) de una fecha local. */
export function isoWeekday(date: string): number {
  const [year, month, day] = parseDate(date);
  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return sundayFirst === 0 ? 7 : sundayFirst;
}

/** Fechas locales de `from` a `to`, ambas incluidas ("2026-03-28", "2026-03-29", …). */
export function datesBetween(from: string, to: string): string[] {
  const [fy, fm, fd] = parseDate(from);
  const [ty, tm, td] = parseDate(to);
  const dates: string[] = [];
  for (let t = Date.UTC(fy, fm - 1, fd); t <= Date.UTC(ty, tm - 1, td); t += DAY_MS) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

export { MINUTE_MS, DAY_MS };
