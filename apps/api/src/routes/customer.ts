// Zona del cliente (/me/*). Solo ve y modifica sus reservas: el filtro es el usuario de la sesión.
// Cada ruta exige además un permiso si la petición llega con token (clientes MCP y agentes):
//   bookings:read     ver sus reservas
//   bookings:propose  proponer una reserva (la deja `pending` y retiene el hueco 10 minutos)
//   bookings:confirm  confirmar propuestas y reservar, cancelar o mover directamente
// Una sesión de navegador no tiene permisos acotados: puede todo lo que permita su rol.
import { createHash } from "node:crypto";
import { customerBookingSchema, rescheduleSchema } from "@agendia/shared";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  cancelCustomerBooking,
  confirmProposal,
  createCustomerBooking,
  proposeCustomerBooking,
  rescheduleCustomerBooking,
} from "../booking.ts";
import { bookings, businesses, services, staff } from "../db/schema.ts";
import { requireRole, requireScope, userOf } from "../guards.ts";
import { withIdempotency } from "../idempotency.ts";

const idParams = z.object({ id: z.uuid() });
const keySchema = z
  .string({ error: "Falta la cabecera Idempotency-Key" })
  .min(1, "Falta la cabecera Idempotency-Key")
  .max(255, "La cabecera Idempotency-Key es demasiado larga");

/** En preHandler ya hay usuario: el límite es por usuario, no por IP. */
const perUser = (prefix: string, max: number) => ({
  rateLimit: {
    hook: "preHandler" as const,
    max,
    timeWindow: "1 hour",
    keyGenerator: (req: { user: { id: string } | null; ip: string }) =>
      `${prefix}:${req.user?.id ?? req.ip}`,
  },
});

export async function customerRoutes(app: FastifyInstance) {
  const { db } = app;
  app.addHook("preHandler", requireRole("customer"));

  app.get("/bookings", { preHandler: requireScope("bookings:read") }, async (req) => {
    const rows = await db
      .select({
        id: bookings.id,
        code: bookings.code,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        status: bookings.status,
        expiresAt: bookings.expiresAt,
        notes: bookings.notes,
        businessName: businesses.name,
        businessSlug: businesses.slug,
        businessCity: businesses.city,
        businessTimezone: businesses.timezone,
        cancelLimitHours: businesses.cancelLimitHours,
        serviceId: bookings.serviceId,
        serviceName: services.name,
        priceCents: services.priceCents,
        staffId: bookings.staffId,
        staffName: staff.name,
      })
      .from(bookings)
      .innerJoin(businesses, eq(businesses.id, bookings.businessId))
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .innerJoin(staff, eq(staff.id, bookings.staffId))
      .where(eq(bookings.customerId, userOf(req).id))
      .orderBy(desc(bookings.startsAt));
    // Una propuesta cuyo plazo ha pasado ya no retiene el hueco: se cuenta como caducada
    // aunque la fila todavía no se haya marcado.
    const now = Date.now();
    return rows.map((r) =>
      r.status === "pending" && r.expiresAt && r.expiresAt.getTime() <= now
        ? { ...r, status: "expired" as const }
        : r,
    );
  });

  app.post(
    "/bookings",
    {
      preHandler: requireScope("bookings:confirm"),
      config: perUser("book", 30),
    },
    async (req, reply) => {
      const key = keySchema.parse(req.headers["idempotency-key"]);
      const input = customerBookingSchema.parse(req.body);
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(["POST", "/me/bookings", input]))
        .digest("hex");
      const user = userOf(req);
      const res = await withIdempotency(
        db,
        user.id,
        key,
        (tx) => createCustomerBooking(tx, user.id, input),
        fingerprint,
      );
      return reply.status(res.status).send(res.body);
    },
  );

  // Propuesta: deja la reserva en `pending` y retiene el hueco. No confirma nada.
  app.post(
    "/bookings/propose",
    { preHandler: requireScope("bookings:propose"), config: perUser("propose", 60) },
    async (req, reply) =>
      reply
        .status(201)
        .send(
          await proposeCustomerBooking(db, userOf(req).id, customerBookingSchema.parse(req.body)),
        ),
  );

  app.post("/bookings/:id/confirm", { preHandler: requireScope("bookings:confirm") }, async (req) =>
    confirmProposal(db, userOf(req).id, idParams.parse(req.params).id),
  );

  app.post("/bookings/:id/cancel", { preHandler: requireScope("bookings:confirm") }, async (req) =>
    cancelCustomerBooking(db, userOf(req).id, idParams.parse(req.params).id),
  );

  app.post(
    "/bookings/:id/reschedule",
    { preHandler: requireScope("bookings:confirm") },
    async (req) =>
      rescheduleCustomerBooking(
        db,
        userOf(req).id,
        idParams.parse(req.params).id,
        rescheduleSchema.parse(req.body),
      ),
  );
}
