import { randomBytes } from "node:crypto";
import { loginSchema, registerSchema, type Me } from "@agendia/shared";
import { hash, verify } from "@node-rs/argon2";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import { businessMembers, businesses, categories, users } from "../db/schema.ts";
import { AppError, pgErrorCode } from "../errors.ts";
import { requireRole, userOf } from "../guards.ts";
import { SESSION_COOKIE, SESSION_TTL_MS, createSession, deleteSession } from "../session.ts";

// Si el email no existe se verifica igualmente contra este hash, para que el tiempo de
// respuesta no revele qué emails están registrados.
const dummyHash = hash(randomBytes(16).toString("hex"));

/** "Peluquería Ñoño" → "peluqueria-nono-3fa9c1" (sufijo aleatorio para que no choque). */
function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "negocio"}-${randomBytes(3).toString("hex")}`;
}

const isBusinessSignup = (body: unknown) =>
  (body as { role?: unknown } | null)?.role === "business_owner";

export async function authRoutes(app: FastifyInstance) {
  const { db, config } = app;

  async function startSession(reply: FastifyReply, userId: string) {
    const token = await createSession(db, userId);
    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.secureCookies,
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
    });
  }

  app.post(
    "/register",
    {
      config: {
        // En preHandler el cuerpo ya está leído, así que las altas de negocio tienen su propio límite.
        rateLimit: {
          hook: "preHandler",
          timeWindow: "1 day",
          keyGenerator: (req) =>
            `${req.ip}:${isBusinessSignup(req.body) ? "business" : "customer"}`,
          max: (req) => (isBusinessSignup(req.body) ? 3 : 20),
        },
      },
    },
    async (req, reply) => {
      const input = registerSchema.parse(req.body);
      const passwordHash = await hash(input.password);

      const userId = await db
        .transaction(async (tx) => {
          const [user] = await tx
            .insert(users)
            .values({ email: input.email, passwordHash, role: input.role, name: input.name })
            .returning({ id: users.id });
          if (input.role === "business_owner") {
            const [category] = await tx
              .select({ id: categories.id })
              .from(categories)
              .where(eq(categories.slug, input.categorySlug));
            if (!category) throw new AppError(400, "VALIDATION_ERROR", "Categoría no válida");
            const [business] = await tx
              .insert(businesses)
              .values({
                slug: slugify(input.businessName),
                name: input.businessName,
                categoryId: category.id,
                contactEmail: input.email,
              })
              .returning({ id: businesses.id });
            await tx.insert(businessMembers).values({ userId: user!.id, businessId: business!.id });
          }
          return user!.id;
        })
        .catch((error: unknown) => {
          if (pgErrorCode(error) === "23505") {
            throw new AppError(409, "CONFLICT", "Ya existe una cuenta con ese email");
          }
          throw error;
        });

      await startSession(reply, userId);
      const me: Me = { id: userId, email: input.email, name: input.name, role: input.role };
      return reply.status(201).send(me);
    },
  );

  app.post(
    "/login",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const input = loginSchema.parse(req.body);
      const [user] = await db.select().from(users).where(eq(users.email, input.email));
      const ok = await verify(user?.passwordHash ?? (await dummyHash), input.password);
      if (!user || !ok) throw new AppError(401, "UNAUTHORIZED", "Email o contraseña incorrectos");

      await startSession(reply, user.id);
      return { id: user.id, email: user.email, name: user.name, role: user.role } satisfies Me;
    },
  );

  app.post("/logout", async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE];
    if (token) await deleteSession(db, token);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.status(204).send();
  });

  app.get("/me", { preHandler: requireRole() }, async (req) => userOf(req) satisfies Me);
}
