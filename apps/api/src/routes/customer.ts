// Zona del cliente (/me/*). Solo ve sus reservas: el filtro es el usuario de la sesión.
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { bookings, businesses, services, staff } from "../db/schema.ts";
import { requireRole, userOf } from "../guards.ts";

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
        businessName: businesses.name,
        businessSlug: businesses.slug,
        serviceName: services.name,
        staffName: staff.name,
      })
      .from(bookings)
      .innerJoin(businesses, eq(businesses.id, bookings.businessId))
      .innerJoin(services, eq(services.id, bookings.serviceId))
      .innerJoin(staff, eq(staff.id, bookings.staffId))
      .where(eq(bookings.customerId, userOf(req).id))
      .orderBy(desc(bookings.startsAt)),
  );
}
