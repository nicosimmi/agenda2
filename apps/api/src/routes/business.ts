// Panel del negocio. El negocio sale SIEMPRE de la sesión (D3): ninguna ruta acepta un business_id.
// Los `:id` de la URL son de servicios, profesionales, etc., y se buscan siempre dentro del negocio.
import {
  bookingStatusSchema,
  businessProfileUpdateSchema,
  manualBookingSchema,
  serviceSchema,
  serviceUpdateSchema,
  staffSchema,
  staffUpdateSchema,
  timeOffSchema,
  weeklyHoursSchema,
} from "@agendia/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { forbidden, notFound } from "../errors.ts";
import { requireRole, tenantOf, userOf } from "../guards.ts";
import * as panel from "../panel.ts";
import { getBusinessProfile, listBusinessBookings, tenantForOwner } from "../tenant.ts";

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
const rangeQuery = z
  .object({ from: z.coerce.date(), to: z.coerce.date(), staffId: z.uuid().optional() })
  .refine((r) => r.to > r.from && r.to.getTime() - r.from.getTime() <= MAX_RANGE_MS, {
    message: "Rango de fechas no válido (máximo 31 días)",
  });
const idParams = z.object({ id: z.uuid() });

export async function businessRoutes(app: FastifyInstance) {
  const { db } = app;

  // Todas las rutas de este plugin exigen ser propietario y cargan su contexto de tenant.
  app.addHook("preHandler", requireRole("business_owner"));
  app.addHook("preHandler", async (req) => {
    req.tenant = await tenantForOwner(db, userOf(req).id);
    if (!req.tenant) throw forbidden();
  });

  const profile = async (req: Parameters<typeof tenantOf>[0]) => {
    const row = await getBusinessProfile(db, tenantOf(req));
    if (!row) throw notFound("Negocio");
    return row;
  };

  // --- Perfil y publicación ---
  app.get("/profile", async (req) => profile(req));
  app.patch("/profile", async (req) => {
    await panel.updateBusinessProfile(
      db,
      tenantOf(req),
      businessProfileUpdateSchema.parse(req.body ?? {}),
    );
    return profile(req);
  });
  app.get("/checklist", async (req) => panel.getChecklist(db, tenantOf(req)));
  app.post("/publish", async (req) => panel.setPublished(db, tenantOf(req), true));
  app.post("/unpublish", async (req) => panel.setPublished(db, tenantOf(req), false));

  // --- Servicios ---
  app.get("/services", async (req) => panel.listServices(db, tenantOf(req)));
  app.post("/services", async (req, reply) =>
    reply
      .code(201)
      .send(await panel.createService(db, tenantOf(req), serviceSchema.parse(req.body))),
  );
  app.patch("/services/:id", async (req) =>
    panel.updateService(
      db,
      tenantOf(req),
      idParams.parse(req.params).id,
      serviceUpdateSchema.parse(req.body ?? {}),
    ),
  );
  app.delete("/services/:id", async (req) =>
    panel.deleteService(db, tenantOf(req), idParams.parse(req.params).id),
  );

  // --- Profesionales y sus horarios ---
  app.get("/staff", async (req) => panel.listStaff(db, tenantOf(req)));
  app.post("/staff", async (req, reply) =>
    reply.code(201).send(await panel.createStaff(db, tenantOf(req), staffSchema.parse(req.body))),
  );
  app.patch("/staff/:id", async (req) =>
    panel.updateStaff(
      db,
      tenantOf(req),
      idParams.parse(req.params).id,
      staffUpdateSchema.parse(req.body ?? {}),
    ),
  );
  app.delete("/staff/:id", async (req) =>
    panel.deleteStaff(db, tenantOf(req), idParams.parse(req.params).id),
  );
  app.get("/staff/:id/hours", async (req) => {
    const hours = await panel.getStaffHours(db, tenantOf(req), idParams.parse(req.params).id);
    return { hours, warnings: panel.overlapWarnings(hours) };
  });
  app.put("/staff/:id/hours", async (req) => {
    const { hours } = weeklyHoursSchema.parse(req.body);
    const saved = await panel.replaceStaffHours(
      db,
      tenantOf(req),
      idParams.parse(req.params).id,
      hours,
    );
    return { hours: saved, warnings: panel.overlapWarnings(saved) };
  });

  // --- Ausencias ---
  app.get("/time-off", async (req) => panel.listTimeOff(db, tenantOf(req)));
  app.post("/time-off", async (req, reply) =>
    reply
      .code(201)
      .send(await panel.createTimeOff(db, tenantOf(req), timeOffSchema.parse(req.body))),
  );
  app.delete("/time-off/:id", async (req, reply) => {
    await panel.deleteTimeOff(db, tenantOf(req), idParams.parse(req.params).id);
    return reply.code(204).send();
  });

  // --- Agenda ---
  app.get("/bookings", async (req) => {
    const { from, to, staffId } = rangeQuery.parse(req.query);
    return listBusinessBookings(db, tenantOf(req), from, to, staffId);
  });
  app.post("/bookings", async (req, reply) =>
    reply
      .code(201)
      .send(
        await panel.createManualBooking(db, tenantOf(req), manualBookingSchema.parse(req.body)),
      ),
  );
  app.post("/bookings/:id/status", async (req) =>
    panel.setBookingStatus(
      db,
      tenantOf(req),
      idParams.parse(req.params).id,
      bookingStatusSchema.parse(req.body).status,
    ),
  );
}
