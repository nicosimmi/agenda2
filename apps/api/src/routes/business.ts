// Panel del negocio. El negocio sale SIEMPRE de la sesión (D3): ninguna ruta acepta un business_id.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { forbidden, notFound } from "../errors.ts";
import { requireRole, tenantOf, userOf } from "../guards.ts";
import { getBusinessProfile, listBusinessBookings, tenantForOwner } from "../tenant.ts";

const MAX_RANGE_MS = 31 * 24 * 60 * 60 * 1000;
const rangeQuery = z
  .object({ from: z.coerce.date(), to: z.coerce.date() })
  .refine((r) => r.to > r.from && r.to.getTime() - r.from.getTime() <= MAX_RANGE_MS, {
    message: "Rango de fechas no válido (máximo 31 días)",
  });

export async function businessRoutes(app: FastifyInstance) {
  const { db } = app;

  // Todas las rutas de este plugin exigen ser propietario y cargan su contexto de tenant.
  app.addHook("preHandler", requireRole("business_owner"));
  app.addHook("preHandler", async (req) => {
    req.tenant = await tenantForOwner(db, userOf(req).id);
    if (!req.tenant) throw forbidden();
  });

  app.get("/profile", async (req) => {
    const profile = await getBusinessProfile(db, tenantOf(req));
    if (!profile) throw notFound("Negocio");
    return profile;
  });

  app.get("/bookings", async (req) => {
    const { from, to } = rangeQuery.parse(req.query);
    return listBusinessBookings(db, tenantOf(req), from, to);
  });
}
