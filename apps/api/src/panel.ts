// Datos del panel del negocio. Cada función exige un TenantContext y filtra por su business_id:
// un id de la URL que pertenezca a otro negocio no encuentra nada (404), nunca se "comprueba después".
import type { BusinessProfileUpdate } from "@agendia/shared";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import { newBookingCode } from "./db/booking-code.ts";
import type { Db } from "./db/client.ts";
import {
  bookings,
  businesses,
  staff,
  staffServices,
  services,
  timeOff,
  workingHours,
} from "./db/schema.ts";
import { AppError, notFound, pgErrorCode } from "./errors.ts";
import type { TenantContext } from "./tenant.ts";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Con `exactOptionalPropertyTypes`, Zod marca los campos opcionales como `T | undefined`. */
type Patch<T> = { [K in keyof T]?: T[K] | undefined };

/** `.set({})` falla en Drizzle: sin cambios se devuelve la fila tal cual. */
const isEmpty = (patch: object) => Object.keys(patch).length === 0;

// --- Perfil ---

export async function updateBusinessProfile(
  db: Db,
  t: TenantContext,
  patch: BusinessProfileUpdate,
) {
  if (isEmpty(patch)) return;
  await db.update(businesses).set(patch).where(eq(businesses.id, t.businessId));
}

// --- Servicios ---

export const listServices = (db: Db, t: TenantContext) =>
  db
    .select()
    .from(services)
    .where(eq(services.businessId, t.businessId))
    .orderBy(asc(services.name));

export async function createService(
  db: Db,
  t: TenantContext,
  input: Omit<typeof services.$inferInsert, "id" | "businessId">,
) {
  const [row] = await db
    .insert(services)
    .values({ ...input, businessId: t.businessId })
    .returning();
  return row!;
}

export async function updateService(
  db: Db,
  t: TenantContext,
  id: string,
  patch: Patch<Omit<typeof services.$inferInsert, "id" | "businessId">>,
) {
  const where = and(eq(services.id, id), eq(services.businessId, t.businessId));
  const [row] = isEmpty(patch)
    ? await db.select().from(services).where(where)
    : await db.update(services).set(patch).where(where).returning();
  if (!row) throw notFound("Servicio");
  return row;
}

/** Con reservas se archiva (active = false) para no perder el historial; sin ellas se borra. */
export async function deleteService(db: Db, t: TenantContext, id: string) {
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({ id: services.id })
      .from(services)
      .where(and(eq(services.id, id), eq(services.businessId, t.businessId)));
    if (!found) throw notFound("Servicio");
    const [used] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.serviceId, id), eq(bookings.businessId, t.businessId)))
      .limit(1);
    if (used) {
      await tx.update(services).set({ active: false }).where(eq(services.id, id));
      return { id, archived: true };
    }
    await tx.delete(services).where(eq(services.id, id));
    return { id, archived: false };
  });
}

// --- Profesionales ---

export async function listStaff(db: Db, t: TenantContext) {
  const [members, links] = await Promise.all([
    db.select().from(staff).where(eq(staff.businessId, t.businessId)).orderBy(asc(staff.name)),
    db.select().from(staffServices).where(eq(staffServices.businessId, t.businessId)),
  ]);
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    active: m.active,
    serviceIds: links.filter((l) => l.staffId === m.id).map((l) => l.serviceId),
  }));
}

async function setStaffServices(tx: Tx, t: TenantContext, staffId: string, serviceIds: string[]) {
  const ids = [...new Set(serviceIds)];
  if (ids.length) {
    const own = await tx
      .select({ id: services.id })
      .from(services)
      .where(and(inArray(services.id, ids), eq(services.businessId, t.businessId)));
    if (own.length !== ids.length)
      throw new AppError(400, "VALIDATION_ERROR", "Servicio no válido");
  }
  await tx
    .delete(staffServices)
    .where(and(eq(staffServices.staffId, staffId), eq(staffServices.businessId, t.businessId)));
  if (ids.length) {
    await tx
      .insert(staffServices)
      .values(ids.map((serviceId) => ({ businessId: t.businessId, staffId, serviceId })));
  }
}

export async function createStaff(
  db: Db,
  t: TenantContext,
  input: { name: string; active: boolean; serviceIds: string[] },
) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(staff)
      .values({ businessId: t.businessId, name: input.name, active: input.active })
      .returning();
    await setStaffServices(tx, t, row!.id, input.serviceIds);
    return { id: row!.id, name: row!.name, active: row!.active, serviceIds: input.serviceIds };
  });
}

export async function updateStaff(
  db: Db,
  t: TenantContext,
  id: string,
  patch: Patch<{ name: string; active: boolean; serviceIds: string[] }>,
) {
  const { serviceIds, ...columns } = patch;
  await db.transaction(async (tx) => {
    const where = and(eq(staff.id, id), eq(staff.businessId, t.businessId));
    const [row] = isEmpty(columns)
      ? await tx.select().from(staff).where(where)
      : await tx.update(staff).set(columns).where(where).returning();
    if (!row) throw notFound("Profesional");
    if (serviceIds) await setStaffServices(tx, t, id, serviceIds);
  });
  return (await listStaff(db, t)).find((m) => m.id === id)!;
}

export async function deleteStaff(db: Db, t: TenantContext, id: string) {
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.id, id), eq(staff.businessId, t.businessId)));
    if (!found) throw notFound("Profesional");
    const [used] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.staffId, id), eq(bookings.businessId, t.businessId)))
      .limit(1);
    if (used) {
      await tx.update(staff).set({ active: false }).where(eq(staff.id, id));
      return { id, archived: true };
    }
    await tx.delete(staff).where(eq(staff.id, id)); // horarios y servicios caen en cascada
    return { id, archived: false };
  });
}

// --- Horarios semanales ---

interface Shift {
  weekday: number;
  startTime: string;
  endTime: string;
}

async function assertOwnStaff(db: Db | Tx, t: TenantContext, staffId: string) {
  const [found] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.id, staffId), eq(staff.businessId, t.businessId)));
  if (!found) throw notFound("Profesional");
}

export async function getStaffHours(db: Db, t: TenantContext, staffId: string): Promise<Shift[]> {
  await assertOwnStaff(db, t, staffId);
  const rows = await db
    .select()
    .from(workingHours)
    .where(and(eq(workingHours.staffId, staffId), eq(workingHours.businessId, t.businessId)))
    .orderBy(asc(workingHours.weekday), asc(workingHours.startTime));
  // Postgres devuelve "09:00:00"; la API usa "HH:MM".
  return rows.map((r) => ({
    weekday: r.weekday,
    startTime: r.startTime.slice(0, 5),
    endTime: r.endTime.slice(0, 5),
  }));
}

/** Reemplaza la semana completa del profesional. */
export async function replaceStaffHours(db: Db, t: TenantContext, staffId: string, hours: Shift[]) {
  await db.transaction(async (tx) => {
    await assertOwnStaff(tx, t, staffId);
    await tx
      .delete(workingHours)
      .where(and(eq(workingHours.staffId, staffId), eq(workingHours.businessId, t.businessId)));
    if (hours.length) {
      await tx
        .insert(workingHours)
        .values(hours.map((h) => ({ ...h, businessId: t.businessId, staffId })));
    }
  });
  return getStaffHours(db, t, staffId);
}

/** Avisos (no errores) de franjas que se pisan el mismo día: el motor las admite sin duplicar huecos. */
export function overlapWarnings(hours: Shift[]): string[] {
  const names = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  const warnings: string[] = [];
  const sorted = [...hours].sort(
    (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
  );
  sorted.forEach((h, i) => {
    const next = sorted[i + 1];
    if (next && next.weekday === h.weekday && next.startTime < h.endTime) {
      warnings.push(`Las franjas del ${names[h.weekday - 1]} se solapan`);
    }
  });
  return [...new Set(warnings)];
}

// --- Ausencias ---

export const listTimeOff = (db: Db, t: TenantContext) =>
  db
    .select()
    .from(timeOff)
    .where(eq(timeOff.businessId, t.businessId))
    .orderBy(asc(timeOff.startsAt));

export async function createTimeOff(
  db: Db,
  t: TenantContext,
  input: { staffId: string | null; startsAt: Date; endsAt: Date; reason: string | null },
) {
  if (input.staffId) await assertOwnStaff(db, t, input.staffId);
  const [row] = await db
    .insert(timeOff)
    .values({ ...input, businessId: t.businessId })
    .returning();
  return row!;
}

export async function deleteTimeOff(db: Db, t: TenantContext, id: string) {
  const rows = await db
    .delete(timeOff)
    .where(and(eq(timeOff.id, id), eq(timeOff.businessId, t.businessId)))
    .returning({ id: timeOff.id });
  if (!rows.length) throw notFound("Ausencia");
}

// --- Lista de comprobación y publicación (SPEC §5) ---

export async function getChecklist(db: Db, t: TenantContext) {
  const [[biz], active, hours] = await Promise.all([
    db
      .select({ addressLine: businesses.addressLine, city: businesses.city })
      .from(businesses)
      .where(eq(businesses.id, t.businessId)),
    // Profesionales activos con al menos un servicio activo asignado.
    db
      .selectDistinct({ staffId: staff.id })
      .from(staff)
      .innerJoin(staffServices, eq(staffServices.staffId, staff.id))
      .innerJoin(services, eq(services.id, staffServices.serviceId))
      .where(
        and(eq(staff.businessId, t.businessId), eq(staff.active, true), eq(services.active, true)),
      ),
    db
      .selectDistinct({ staffId: workingHours.staffId })
      .from(workingHours)
      .where(eq(workingHours.businessId, t.businessId)),
  ]);
  const [{ count: activeServices } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(services)
    .where(and(eq(services.businessId, t.businessId), eq(services.active, true)));

  const withHours = new Set(hours.map((h) => h.staffId));
  const items = [
    { key: "address", label: "Dirección y ciudad", ok: !!biz?.addressLine && !!biz.city },
    { key: "service", label: "Al menos un servicio activo", ok: activeServices > 0 },
    { key: "staff", label: "Un profesional activo con servicios asignados", ok: active.length > 0 },
    {
      key: "hours",
      label: "Horario semanal del profesional",
      ok: active.some((a) => withHours.has(a.staffId)),
    },
  ];
  return { items, ready: items.every((i) => i.ok) };
}

export async function setPublished(db: Db, t: TenantContext, publish: boolean) {
  const from = publish ? "draft" : "published";
  if (publish && !(await getChecklist(db, t)).ready) {
    throw new AppError(409, "CONFLICT", "Completa la lista de comprobación antes de publicar");
  }
  const rows = await db
    .update(businesses)
    .set({ status: publish ? "published" : "draft" })
    .where(and(eq(businesses.id, t.businessId), eq(businesses.status, from)))
    .returning({ status: businesses.status });
  if (!rows.length) {
    // Ya estaba en el estado pedido, o está suspendido (solo lo levanta el administrador).
    const [biz] = await db
      .select({ status: businesses.status })
      .from(businesses)
      .where(eq(businesses.id, t.businessId));
    if (biz?.status === "suspended")
      throw new AppError(409, "CONFLICT", "El negocio está suspendido");
    return { status: biz!.status };
  }
  return { status: rows[0]!.status };
}

// --- Reservas manuales y estados ---

interface ManualBooking {
  staffId: string;
  serviceId: string;
  startsAt: Date;
  guestName: string;
  guestPhone: string | null;
  notes: string | null;
}

/**
 * Reserva creada por el negocio (cliente sin cuenta). Decisión F3-2: el propietario puede
 * reservar fuera de horario y sin preaviso; solo manda el solapamiento, que ya impide la base
 * de datos con la restricción de exclusión.
 */
export async function createManualBooking(db: Db, t: TenantContext, input: ManualBooking) {
  try {
    return await db.transaction(async (tx) => {
      const [service] = await tx
        .select()
        .from(services)
        .where(
          and(
            eq(services.id, input.serviceId),
            eq(services.businessId, t.businessId),
            eq(services.active, true),
          ),
        );
      if (!service) throw notFound("Servicio");
      const [link] = await tx
        .select({ staffId: staff.id })
        .from(staff)
        .innerJoin(staffServices, eq(staffServices.staffId, staff.id))
        .where(
          and(
            eq(staff.id, input.staffId),
            eq(staff.businessId, t.businessId),
            eq(staff.active, true),
            eq(staffServices.serviceId, service.id),
          ),
        );
      if (!link)
        throw new AppError(400, "VALIDATION_ERROR", "Ese profesional no hace ese servicio");

      // Una propuesta caducada sigue bloqueando el hueco hasta que pase a `expired`.
      await tx
        .update(bookings)
        .set({ status: "expired" })
        .where(
          and(
            eq(bookings.staffId, input.staffId),
            eq(bookings.businessId, t.businessId),
            eq(bookings.status, "pending"),
            lt(bookings.expiresAt, new Date()),
          ),
        );

      const endsAt = new Date(
        input.startsAt.getTime() + (service.durationMin + service.bufferMin) * 60_000,
      );
      const [row] = await tx
        .insert(bookings)
        .values({
          businessId: t.businessId,
          code: newBookingCode(),
          staffId: input.staffId,
          serviceId: input.serviceId,
          guestName: input.guestName,
          guestPhone: input.guestPhone,
          notes: input.notes,
          startsAt: input.startsAt,
          endsAt,
          status: "confirmed",
          source: "business",
        })
        .returning({ id: bookings.id, code: bookings.code, startsAt: bookings.startsAt });
      return row!;
    });
  } catch (error) {
    if (pgErrorCode(error) === "23P01") {
      throw new AppError(409, "CONFLICT", "Ese hueco ya está ocupado");
    }
    throw error;
  }
}

/** Cancelar, completar o marcar no presentado. Solo desde pending/confirmed; completar y no_show, ya empezada. */
export async function setBookingStatus(
  db: Db,
  t: TenantContext,
  id: string,
  status: "cancelled" | "completed" | "no_show",
) {
  const [row] = await db
    .select({ status: bookings.status, startsAt: bookings.startsAt })
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.businessId, t.businessId)));
  if (!row) throw notFound("Reserva");
  if (row.status !== "pending" && row.status !== "confirmed") {
    throw new AppError(409, "CONFLICT", "La reserva ya no admite cambios de estado");
  }
  if (status !== "cancelled" && row.startsAt > new Date()) {
    throw new AppError(409, "CONFLICT", "La reserva todavía no ha empezado");
  }
  await db
    .update(bookings)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(bookings.id, id), eq(bookings.businessId, t.businessId)));
  return { id, status };
}
