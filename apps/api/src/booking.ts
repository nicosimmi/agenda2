// Reservas del cliente (/me/bookings): crear, cancelar y mover. Cada operación revalida el hueco
// con el motor de disponibilidad dentro de la transacción; la restricción de exclusión de
// Postgres es la última defensa si dos personas reservan a la vez (se traduce a 409).
import {
  PROPOSAL_TTL_MINUTES,
  type customerBookingSchema,
  type rescheduleSchema,
} from "@agendia/shared";
import { localDate } from "@agendia/core";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { z } from "zod";
import { findSlots, type BusinessRow } from "./availability.ts";
import { newBookingCode } from "./db/booking-code.ts";
import type { Db } from "./db/client.ts";
import { bookings, businesses, services, staff } from "./db/schema.ts";
import { AppError, notFound, pgErrorCode } from "./errors.ts";
import type { StoredResponse } from "./idempotency.ts";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const taken = () => new AppError(409, "CONFLICT", "Ese hueco ya no está disponible. Elige otro");

/** Negocio publicado por slug: un negocio en borrador o suspendido ni se ve ni admite reservas. */
async function publishedBusiness(tx: Tx, slug: string): Promise<BusinessRow> {
  const [business] = await tx
    .select()
    .from(businesses)
    .where(and(eq(businesses.slug, slug), eq(businesses.status, "published")));
  if (!business) throw notFound("Negocio");
  return business;
}

/** Una propuesta caducada sigue bloqueando el hueco hasta que pase a `expired`. */
async function expireStalePending(tx: Tx, staffId: string) {
  await tx
    .update(bookings)
    .set({ status: "expired" })
    .where(
      and(
        eq(bookings.staffId, staffId),
        eq(bookings.status, "pending"),
        lt(bookings.expiresAt, new Date()),
      ),
    );
}

type Input = z.infer<typeof customerBookingSchema>;

export async function createCustomerBooking(
  tx: Tx,
  userId: string,
  input: Input,
): Promise<StoredResponse> {
  const business = await publishedBusiness(tx, input.businessSlug);
  const day = localDate(input.startsAt, business.timezone);
  const { slots, service } = await findSlots(tx, business, {
    serviceId: input.serviceId,
    staffId: input.staffId,
    from: day,
    to: day,
  });
  if (!service) throw notFound("Servicio");
  // Sin profesional elegido, se asigna el primero libre a esa hora (orden estable por nombre).
  const slot = slots.find((s) => s.startsAt.getTime() === input.startsAt.getTime());
  if (!slot) throw taken();

  await expireStalePending(tx, slot.staffId);
  try {
    const [row] = await tx
      .insert(bookings)
      .values({
        businessId: business.id,
        code: newBookingCode(),
        staffId: slot.staffId,
        serviceId: service.id,
        customerId: userId,
        notes: input.notes,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: "confirmed",
        source: "web",
      })
      .returning({ id: bookings.id, code: bookings.code });
    const [member] = await tx
      .select({ name: staff.name })
      .from(staff)
      .where(eq(staff.id, slot.staffId));
    return {
      status: 201,
      body: {
        id: row!.id,
        code: row!.code,
        status: "confirmed",
        startsAt: slot.startsAt,
        businessName: business.name,
        businessSlug: business.slug,
        serviceName: service.name,
        staffName: member?.name ?? "",
      },
    };
  } catch (error) {
    if (pgErrorCode(error) === "23P01") throw taken();
    throw error;
  }
}

/** Reserva propia, con los datos del negocio que hacen falta para aplicar sus reglas. */
async function ownBooking(tx: Tx, userId: string, id: string) {
  const [row] = await tx
    .select({
      booking: bookings,
      business: businesses,
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(and(eq(bookings.id, id), eq(bookings.customerId, userId)));
  if (!row) throw notFound("Reserva");
  return row;
}

function assertChangeable(row: Awaited<ReturnType<typeof ownBooking>>) {
  const { booking, business } = row;
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    throw new AppError(409, "CONFLICT", "Esta reserva ya no admite cambios");
  }
  const limitMs = business.cancelLimitHours * 3_600_000;
  if (booking.startsAt.getTime() - Date.now() < limitMs) {
    throw new AppError(
      409,
      "CONFLICT",
      `Ya no se puede cambiar por la web (límite: ${business.cancelLimitHours} h antes). Contacta con el negocio`,
    );
  }
}

export async function cancelCustomerBooking(db: Db, userId: string, id: string) {
  return db.transaction(async (tx) => {
    const row = await ownBooking(tx, userId, id);
    assertChangeable(row);
    await tx
      .update(bookings)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(bookings.id, id));
    return { id, status: "cancelled" as const };
  });
}

type Reschedule = z.infer<typeof rescheduleSchema>;

export async function rescheduleCustomerBooking(
  db: Db,
  userId: string,
  id: string,
  input: Reschedule,
) {
  try {
    return await db.transaction(async (tx) => {
      const row = await ownBooking(tx, userId, id);
      assertChangeable(row);
      const { booking, business } = row;
      const day = localDate(input.startsAt, business.timezone);
      const { slots } = await findSlots(tx, business, {
        serviceId: booking.serviceId,
        // Si no se indica otro profesional, se intenta primero con el mismo.
        staffId: input.staffId ?? booking.staffId,
        from: day,
        to: day,
        excludeBookingId: booking.id,
      });
      const slot = slots.find((s) => s.startsAt.getTime() === input.startsAt.getTime());
      if (!slot) throw taken();
      await expireStalePending(tx, slot.staffId);
      await tx
        .update(bookings)
        .set({
          staffId: slot.staffId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, id));
      return { id, status: booking.status, startsAt: slot.startsAt };
    });
  } catch (error) {
    if (pgErrorCode(error) === "23P01") throw taken();
    throw error;
  }
}

// --- Propuestas: reservas `pending` que retienen el hueco hasta que una persona las confirma ---

/** Una persona no puede acaparar huecos con propuestas sin confirmar. */
const MAX_PENDING_PROPOSALS = 3;

/** Datos de una reserva tal como se le enseñan al usuario en la tarjeta de confirmación. */
export async function bookingSummary(db: Pick<Db, "select">, id: string) {
  const [row] = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      status: bookings.status,
      expiresAt: bookings.expiresAt,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      businessName: businesses.name,
      businessSlug: businesses.slug,
      timezone: businesses.timezone,
      serviceName: services.name,
      durationMin: services.durationMin,
      priceCents: services.priceCents,
      staffName: staff.name,
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .innerJoin(services, eq(services.id, bookings.serviceId))
    .innerJoin(staff, eq(staff.id, bookings.staffId))
    .where(eq(bookings.id, id));
  return row!;
}

/**
 * Crea una reserva `pending` que retiene el hueco PROPOSAL_TTL_MINUTES. No confirma nada: lo hace
 * `confirmProposal`, que en el producto solo se ejecuta cuando la persona pulsa "Confirmar".
 */
export async function proposeCustomerBooking(
  db: Db,
  userId: string,
  input: Input,
  source: "web" | "agent" = "agent",
) {
  try {
    return await db.transaction(async (tx) => {
      // Cerrojo por persona: sin él, varias propuestas en paralelo leerían el mismo recuento y
      // se saltarían el tope de pendientes (en READ COMMITTED no se ven entre sí).
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"propose:" + userId}))`);
      const business = await publishedBusiness(tx, input.businessSlug);
      const day = localDate(input.startsAt, business.timezone);
      const { slots, service } = await findSlots(tx, business, {
        serviceId: input.serviceId,
        staffId: input.staffId,
        from: day,
        to: day,
      });
      if (!service) throw notFound("Servicio");
      const slot = slots.find((s) => s.startsAt.getTime() === input.startsAt.getTime());
      if (!slot) throw taken();

      const [{ count } = { count: 0 }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(bookings)
        .where(
          and(
            eq(bookings.customerId, userId),
            eq(bookings.status, "pending"),
            gt(bookings.expiresAt, new Date()),
          ),
        );
      if (count >= MAX_PENDING_PROPOSALS) {
        throw new AppError(
          409,
          "CONFLICT",
          `Ya tienes ${MAX_PENDING_PROPOSALS} propuestas pendientes. Confirma o espera a que caduquen`,
        );
      }

      await expireStalePending(tx, slot.staffId);
      const [row] = await tx
        .insert(bookings)
        .values({
          businessId: business.id,
          code: newBookingCode(),
          staffId: slot.staffId,
          serviceId: service.id,
          customerId: userId,
          notes: input.notes,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          status: "pending",
          source,
          expiresAt: new Date(Date.now() + PROPOSAL_TTL_MINUTES * 60_000),
        })
        .returning({ id: bookings.id });
      return bookingSummary(tx, row!.id);
    });
  } catch (error) {
    if (pgErrorCode(error) === "23P01") throw taken();
    throw error;
  }
}

/** Confirma una propuesta propia que no haya caducado. Repetirlo sobre una ya confirmada no cambia nada. */
export async function confirmProposal(db: Db, userId: string, id: string) {
  const confirmed = await db
    .update(bookings)
    .set({ status: "confirmed", expiresAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(bookings.id, id),
        eq(bookings.customerId, userId),
        eq(bookings.status, "pending"),
        gt(bookings.expiresAt, new Date()),
        // Una propuesta de una hora que ya ha empezado, o de un negocio suspendido entretanto,
        // no puede convertirse en reserva.
        gt(bookings.startsAt, new Date()),
        sql`exists (select 1 from ${businesses} where ${businesses.id} = ${bookings.businessId} and ${businesses.status} = 'published')`,
      ),
    )
    .returning({ id: bookings.id });
  if (!confirmed.length) {
    const [own] = await db
      .select({ status: bookings.status })
      .from(bookings)
      .where(and(eq(bookings.id, id), eq(bookings.customerId, userId)));
    if (!own) throw notFound("Reserva");
    if (own.status !== "confirmed") {
      throw new AppError(
        409,
        "CONFLICT",
        "La propuesta ha caducado o ya no se puede confirmar. Pide una nueva",
      );
    }
  }
  return bookingSummary(db, id);
}
