// Contexto de tenant: la única forma de consultar datos de un negocio.
// TenantContext lleva una marca de tipo (brand) que solo se puede fabricar en tenantForOwner,
// a partir del usuario de la sesión. Así el compilador impide montar un contexto con un
// business_id que venga de la URL o del cuerpo de la petición.
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import { bookings, businesses, businessMembers, services, staff, users } from "./db/schema.ts";

declare const tenantBrand: unique symbol;
export type TenantContext = { readonly businessId: string; readonly [tenantBrand]: true };

/** Negocio del propietario que tiene la sesión (D6: un negocio por propietario). */
export async function tenantForOwner(db: Db, userId: string): Promise<TenantContext | null> {
  const [member] = await db
    .select({ businessId: businessMembers.businessId })
    .from(businessMembers)
    .where(eq(businessMembers.userId, userId))
    .limit(1);
  return member ? ({ businessId: member.businessId } as TenantContext) : null;
}

export async function getBusinessProfile(db: Db, t: TenantContext) {
  const [row] = await db
    .select({
      id: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      description: businesses.description,
      status: businesses.status,
      addressLine: businesses.addressLine,
      city: businesses.city,
      province: businesses.province,
      postalCode: businesses.postalCode,
      contactPhone: businesses.contactPhone,
      contactEmail: businesses.contactEmail,
      timezone: businesses.timezone,
      minNoticeMin: businesses.minNoticeMin,
      maxHorizonDays: businesses.maxHorizonDays,
      cancelLimitHours: businesses.cancelLimitHours,
    })
    .from(businesses)
    .where(eq(businesses.id, t.businessId));
  return row ?? null;
}

/** Reservas del negocio en [from, to). Solo expone datos de clientes que han reservado aquí. */
export async function listBusinessBookings(
  db: Db,
  t: TenantContext,
  from: Date,
  to: Date,
  staffId?: string,
) {
  return db
    .select({
      id: bookings.id,
      code: bookings.code,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      // Una propuesta cuyo plazo ha pasado ya no retiene el hueco: se enseña como caducada.
      status: sql<
        typeof bookings.$inferSelect.status
      >`case when ${bookings.status} = 'pending' and ${bookings.expiresAt} <= now() then 'expired' else ${bookings.status} end`,
      source: bookings.source,
      staffId: bookings.staffId,
      serviceName: services.name,
      staffName: staff.name,
      customerName: sql<string | null>`coalesce(${users.name}, ${bookings.guestName})`,
    })
    .from(bookings)
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(staff, eq(staff.id, bookings.staffId))
    .leftJoin(users, eq(users.id, bookings.customerId))
    .where(
      and(
        eq(bookings.businessId, t.businessId),
        gte(bookings.startsAt, from),
        lt(bookings.startsAt, to),
        staffId ? eq(bookings.staffId, staffId) : undefined,
      ),
    )
    .orderBy(asc(bookings.startsAt));
}
