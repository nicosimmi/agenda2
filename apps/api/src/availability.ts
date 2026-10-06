// Huecos reales de un servicio: carga los datos del negocio y se los pasa al motor puro de
// `packages/core`. La reserva vuelve a llamar a esta función dentro de su transacción para
// revalidar el hueco elegido.
import { computeAvailability, localToUtc, DAY_MS, type Slot } from "@agendia/core";
import { and, asc, eq, gt, inArray, isNull, lt, ne, or } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import {
  bookings,
  staff,
  staffServices,
  services,
  timeOff,
  workingHours,
  type businesses,
} from "./db/schema.ts";

type Executor = Pick<Db, "select">;
export type BusinessRow = typeof businesses.$inferSelect;

export interface SlotQuery {
  serviceId: string;
  staffId?: string | undefined;
  from: string; // fecha local "YYYY-MM-DD"
  to: string;
  /** Al mover una reserva, ella misma no cuenta como ocupada. */
  excludeBookingId?: string | undefined;
  now?: Date;
}

export async function findSlots(
  db: Executor,
  business: BusinessRow,
  q: SlotQuery,
): Promise<{ slots: Slot[]; service: typeof services.$inferSelect | null }> {
  const [service] = await db
    .select()
    .from(services)
    .where(
      and(
        eq(services.id, q.serviceId),
        eq(services.businessId, business.id),
        eq(services.active, true),
      ),
    );
  if (!service) return { slots: [], service: null };

  const candidates = await db
    .select({ id: staff.id })
    .from(staff)
    .innerJoin(staffServices, eq(staffServices.staffId, staff.id))
    .where(
      and(
        eq(staff.businessId, business.id),
        eq(staff.active, true),
        eq(staffServices.serviceId, service.id),
        q.staffId ? eq(staff.id, q.staffId) : undefined,
      ),
    )
    .orderBy(asc(staff.name), asc(staff.id));
  const staffIds = candidates.map((c) => c.id);
  if (!staffIds.length) return { slots: [], service };

  // Ventana UTC con un día de margen por cada lado: así se ve lo que roza los extremos.
  const from = new Date(localToUtc(q.from, "00:00", business.timezone).getTime() - DAY_MS);
  const to = new Date(localToUtc(q.to, "23:59", business.timezone).getTime() + DAY_MS);
  const now = q.now ?? new Date();

  const [hours, off, existing] = await Promise.all([
    db.select().from(workingHours).where(inArray(workingHours.staffId, staffIds)),
    db
      .select()
      .from(timeOff)
      .where(
        and(
          eq(timeOff.businessId, business.id),
          lt(timeOff.startsAt, to),
          gt(timeOff.endsAt, from),
        ),
      ),
    db
      .select({
        staffId: bookings.staffId,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.businessId, business.id),
          inArray(bookings.staffId, staffIds),
          lt(bookings.startsAt, to),
          gt(bookings.endsAt, from),
          // Activas: confirmadas, o pendientes que todavía no han caducado.
          or(
            eq(bookings.status, "confirmed"),
            and(
              eq(bookings.status, "pending"),
              or(isNull(bookings.expiresAt), gt(bookings.expiresAt, now)),
            ),
          ),
          q.excludeBookingId ? ne(bookings.id, q.excludeBookingId) : undefined,
        ),
      ),
  ]);

  const slots = computeAvailability({
    service: { durationMin: service.durationMin, bufferMin: service.bufferMin },
    staffCandidates: staffIds,
    workingHours: hours,
    timeOff: off.filter((o) => o.staffId === null || staffIds.includes(o.staffId)),
    existingBookings: existing,
    range: { from: q.from, to: q.to },
    now,
    businessSettings: {
      timezone: business.timezone,
      slotStepMin: business.slotStepMin,
      minNoticeMin: business.minNoticeMin,
      maxHorizonDays: business.maxHorizonDays,
    },
  });
  return { slots, service };
}
