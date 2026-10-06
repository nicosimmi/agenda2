// Gestión de los tokens de acceso del cliente (/me/tokens). Solo con sesión de navegador: un token
// no puede crear, listar ni revocar tokens, así que uno filtrado no puede ampliarse a sí mismo.
import { tokenCreateSchema } from "@agendia/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireBrowserSession, requireRole, userOf } from "../guards.ts";
import { createApiToken, listApiTokens, revokeApiToken } from "../tokens.ts";

const idParams = z.object({ id: z.uuid() });

export async function tokenRoutes(app: FastifyInstance) {
  const { db } = app;
  app.addHook("preHandler", requireRole("customer"));
  app.addHook("preHandler", requireBrowserSession);

  app.get("/", async (req) => listApiTokens(db, userOf(req).id));

  app.post(
    "/",
    {
      config: {
        rateLimit: {
          hook: "preHandler",
          max: 20,
          timeWindow: "1 hour",
          keyGenerator: (req) => `token:${req.user?.id ?? req.ip}`,
        },
      },
    },
    async (req, reply) =>
      reply
        .status(201)
        .send(await createApiToken(db, userOf(req).id, tokenCreateSchema.parse(req.body))),
  );

  app.delete("/:id", async (req, reply) => {
    await revokeApiToken(db, userOf(req).id, idParams.parse(req.params).id);
    return reply.status(204).send();
  });
}
