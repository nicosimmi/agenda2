// Patrón outbox (SPEC §12): el evento se escribe en la misma transacción que la reserva, así no
// se pierde ni se envía un aviso de algo que no llegó a guardarse. Un proceso aparte lo entrega
// a n8n con la petición firmada y, si falla, lo reintenta con espera creciente.
import { and, eq, inArray, isNull, lt, lte } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import { bookings, businesses, outboxEvents, services, staff, users } from "./db/schema.ts";
import { signHeaders } from "./signing.ts";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type BookingEventType = "booking.created" | "booking.cancelled" | "booking.rescheduled";

const MAX_ATTEMPTS = 8;
const BATCH = 10;
const TIMEOUT_MS = 5_000;
/** Tiempo que una pasada se reserva sus eventos; más que BATCH × TIMEOUT_MS. */
const LEASE_MS = 60_000;

export const formatWhen = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat("es-ES", { dateStyle: "full", timeStyle: "short", timeZone }).format(
    date,
  );

/**
 * Datos de una reserva tal como los necesita un email, ya formateados: n8n solo rellena la plantilla.
 * El cliente es la cuenta o, en una reserva manual del negocio, el invitado (sin email).
 */
export async function bookingEmailData(db: Pick<Db, "select">, id: string) {
  const [row] = await db
    .select({
      code: bookings.code,
      startsAt: bookings.startsAt,
      notes: bookings.notes,
      guestName: bookings.guestName,
      businessId: bookings.businessId,
      businessName: businesses.name,
      contactEmail: businesses.contactEmail,
      timezone: businesses.timezone,
      serviceName: services.name,
      priceCents: services.priceCents,
      staffName: staff.name,
      customerName: users.name,
      customerEmail: users.email,
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(staff, eq(staff.id, bookings.staffId))
    .leftJoin(users, eq(users.id, bookings.customerId))
    .where(eq(bookings.id, id));
  const r = row!;
  return {
    businessId: r.businessId,
    timezone: r.timezone,
    payload: {
      bookingId: id,
      code: r.code,
      startsAt: r.startsAt.toISOString(),
      when: formatWhen(r.startsAt, r.timezone),
      notes: r.notes,
      business: { name: r.businessName, email: r.contactEmail },
      customer: { name: r.customerName ?? r.guestName ?? "", email: r.customerEmail },
      service: {
        name: r.serviceName,
        price: new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
          r.priceCents / 100,
        ),
      },
      staff: r.staffName,
    },
  };
}

/**
 * Anota un evento de reserva en el outbox; llamar dentro de la transacción que la cambia.
 * `previousStartsAt` (solo al mover) añade la hora antigua al aviso.
 */
export async function enqueueBookingEvent(
  tx: Tx,
  type: BookingEventType,
  bookingId: string,
  extra: { previousStartsAt?: Date; cancelledBy?: "customer" | "business" } = {},
) {
  const { businessId, timezone, payload } = await bookingEmailData(tx, bookingId);
  await tx.insert(outboxEvents).values({
    businessId,
    type,
    payload: {
      ...payload,
      ...(extra.previousStartsAt && { previousWhen: formatWhen(extra.previousStartsAt, timezone) }),
      ...(extra.cancelledBy && { cancelledBy: extra.cancelledBy }),
    },
  });
}

export interface DeliveryConfig {
  /** Base de los webhooks de n8n, p. ej. http://localhost:5678/webhook (cada tipo tiene su ruta). */
  baseUrl: string;
  secret: string;
  fetch?: typeof fetch;
}

const backoffSeconds = (attempts: number) => Math.min(30 * 2 ** attempts, 3600);

/**
 * Entrega los eventos pendientes cuyo turno ha llegado. Primero se los reserva en una transacción
 * corta (`SKIP LOCKED` y un préstamo de LEASE_MS en `next_attempt_at`), así otra instancia de la API
 * no los coge y ninguna llamada HTTP se hace con una transacción abierta. Si el proceso cae a mitad,
 * se reintentan al acabar el préstamo. Entrega al menos una vez: el cuerpo lleva el `id` del evento
 * por si n8n quiere descartar repetidos. Tras MAX_ATTEMPTS fallos se deja de intentar (el evento
 * queda en la tabla para revisarlo a mano). Al entregarse se vacía el payload, que lleva datos
 * personales (RGPD: no se guardan más de lo necesario).
 */
export async function dispatchDue(db: Db, config: DeliveryConfig) {
  const send = config.fetch ?? fetch;
  const due = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(outboxEvents)
      .where(
        and(
          isNull(outboxEvents.deliveredAt),
          lt(outboxEvents.attempts, MAX_ATTEMPTS),
          lte(outboxEvents.nextAttemptAt, new Date()),
        ),
      )
      .orderBy(outboxEvents.createdAt)
      .limit(BATCH)
      .for("update", { skipLocked: true });
    if (rows.length) {
      await tx
        .update(outboxEvents)
        .set({ nextAttemptAt: new Date(Date.now() + LEASE_MS) })
        .where(
          inArray(
            outboxEvents.id,
            rows.map((r) => r.id),
          ),
        );
    }
    return rows;
  });

  let delivered = 0;
  for (const event of due) {
    const body = JSON.stringify({
      id: event.id,
      type: event.type,
      createdAt: event.createdAt,
      data: event.payload,
    });
    let ok = false;
    try {
      const res = await send(`${config.baseUrl}/agendia-${event.type.replace(".", "-")}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...signHeaders(config.secret, body) },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      ok = res.ok;
    } catch {
      // Sin respuesta (n8n caído o lento): se reintenta más tarde.
    }
    const attempts = event.attempts + 1;
    await db
      .update(outboxEvents)
      .set(
        ok
          ? { deliveredAt: new Date(), attempts, payload: {} }
          : { attempts, nextAttemptAt: new Date(Date.now() + backoffSeconds(attempts) * 1000) },
      )
      .where(eq(outboxEvents.id, event.id));
    if (ok) delivered++;
  }
  return { delivered, failed: due.length - delivered };
}

/** Revisa el outbox cada `intervalMs`. Devuelve la función que lo detiene. */
export function startOutboxWorker(
  db: Db,
  config: DeliveryConfig,
  log: (message: string) => void,
  intervalMs = 5_000,
) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return; // una pasada lenta no se solapa con la siguiente
    running = true;
    try {
      const { delivered, failed } = await dispatchDue(db, config);
      if (failed) log(`outbox: ${failed} evento(s) sin entregar; se reintentarán`);
      else if (delivered) log(`outbox: ${delivered} evento(s) entregado(s)`);
    } catch (error) {
      log(`outbox: error al revisar la cola (${(error as Error).message})`);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
