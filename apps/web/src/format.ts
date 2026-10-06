// Formato de dinero, duraciones y fechas. Las fechas del negocio se muestran siempre en SU zona
// horaria (la de la ficha), no en la del navegador: "10:00" tiene que ser lo que verá el negocio.

export const euros = (cents: number) =>
  (cents / 100).toLocaleString("es-ES", { style: "currency", currency: "EUR" });

export function duration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Fecha local "YYYY-MM-DD" de un instante en una zona horaria. */
export const localDay = (date: Date, timeZone: string) =>
  date.toLocaleDateString("sv-SE", { timeZone });

/** Suma días a una fecha "YYYY-MM-DD" (calendario, sin horas: no le afecta el cambio de hora). */
export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const asDate = (day: string) => new Date(`${day}T12:00:00Z`);

export const weekdayShort = (day: string) =>
  asDate(day).toLocaleDateString("es-ES", { weekday: "short", timeZone: "UTC" }).replace(".", "");

export const dayNumber = (day: string) => Number(day.slice(8, 10));

export const monthShort = (day: string) =>
  asDate(day).toLocaleDateString("es-ES", { month: "short", timeZone: "UTC" }).replace(".", "");

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const longDay = (day: string) =>
  cap(
    asDate(day).toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }),
  );

export const timeIn = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone });

export const dateTimeIn = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
