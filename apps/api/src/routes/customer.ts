// Zona del cliente (/me/*). Solo ve y modifica sus reservas: el filtro es el usuario de la sesión.
import { createHash } from "node:crypto";
import { customerBookingSchema, rescheduleSchema } from "@agendia/shared";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  cancelCustomerBooking,
  createCustomerBooking,
  rescheduleCustomerBooking,
} from "../booking.ts";
import { bookings, businesses, services, staff } from "../db/schema.ts";
import { requireRole, userOf } from "../guards.ts";
import { withIdempotency } from "../idempotency.ts";

const idParams = z.object({ id: z.uuid() });
const keySchema = z
  .string({ error: "Falta la cabecera Idempotency-Key" })
  .min(1, "Falta la cabecera Idempotency-Key")
  .max(255, "La cabecera Idempotency-Key es demasiado larga");

export async function customerRoutes(app: FastifyInstance) {
  const { db } = app;
  app.addHook("preHandler", requireRole("customer"));

  app.get("/bookings", async (req) =>
    db
      .select({
        id: bookings.id,
        code: bookings.code,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        status: bookings.status,
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
      .orderBy(desc(bookings.startsAt)),
  );

  app.post(
    "/bookings",
    {
      config: {
        // En preHandler ya hay sesión: el límite es por usuario, no por IP.
        rateLimit: {
          hook: "preHandler",
          max: 30,
          timeWindow: "1 hour",
          keyGenerator: (req) => `book:${req.user?.id ?? req.ip}`,
        },
      },
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

  app.post("/bookings/:id/cancel", async (req) =>
    cancelCustomerBooking(db, userOf(req).id, idParams.parse(req.params).id),
  );

  app.post("/bookings/:id/reschedule", async (req) =>
    rescheduleCustomerBooking(
      db,
      userOf(req).id,
      idParams.parse(req.params).id,
      rescheduleSchema.parse(req.body),
    ),
  );
}
