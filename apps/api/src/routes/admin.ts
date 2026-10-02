// Administración de plataforma (solo dev/demo, SPEC §4). Es la única zona que recibe un
// business_id por parámetro, porque el administrador no pertenece a ningún negocio.
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { businesses } from "../db/schema.ts";
import { notFound } from "../errors.ts";
import { requireRole } from "../guards.ts";

const params = z.object({ id: z.uuid() });

export async function adminRoutes(app: FastifyInstance) {
  const { db } = app;
  app.addHook("preHandler", requireRole("platform_admin"));

  app.post("/businesses/:id/suspend", async (req) => {
    const { id } = params.parse(req.params);
    const [row] = await db
      .update(businesses)
      .set({ status: "suspended" })
      .where(eq(businesses.id, id))
      .returning({ id: businesses.id, status: businesses.status });
    if (!row) throw notFound("Negocio");
    return row;
  });
}
