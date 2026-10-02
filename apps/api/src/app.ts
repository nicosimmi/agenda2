// Construye la aplicación Fastify. Recibe la base de datos para que los tests usen agendia_test.
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { ApiError, ErrorCode } from "@agendia/shared";
import Fastify, { type FastifyError } from "fastify";
import { ZodError } from "zod";
import type { Db } from "./db/client.ts";
import { AppError } from "./errors.ts";
import { adminRoutes } from "./routes/admin.ts";
import { authRoutes } from "./routes/auth.ts";
import { businessRoutes } from "./routes/business.ts";
import { customerRoutes } from "./routes/customer.ts";
import { SESSION_COOKIE, findSessionUser, type SessionUser } from "./session.ts";
import type { TenantContext } from "./tenant.ts";

declare module "fastify" {
  interface FastifyInstance {
    db: Db;
    config: AppConfig;
    /** "MÉTODO /ruta" de cada ruta registrada; la suite de aislamiento la recorre. */
    routeList: string[];
  }
  interface FastifyRequest {
    user: SessionUser | null;
    tenant: TenantContext | null;
  }
}

export interface AppConfig {
  /** Orígenes de la web que pueden llamar a la API con cookies (CORS y CSRF). */
  webOrigins: string[];
  /** Cookie solo por HTTPS; en producción, siempre. */
  secureCookies: boolean;
  /**
   * IP o CIDR de los proxies inversos de confianza delante de la API (vacío = ninguno). Sin esto,
   * detrás de un proxy todas las peticiones tendrían su IP y el rate limiting sería global.
   * No se usa un número de saltos: Fastify lo desaconseja porque permite falsear X-Forwarded-For.
   */
  trustedProxies: string[];
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function buildApp(db: Db, config: AppConfig) {
  const app = Fastify({
    logger: process.env.NODE_ENV !== "test",
    trustProxy: config.trustedProxies.length > 0 ? config.trustedProxies : false,
  });
  app.decorate("db", db);
  app.decorate("config", config);
  app.decorate("routeList", [] as string[]);
  app.decorateRequest("user", null);
  app.decorateRequest("tenant", null);

  app.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    for (const m of methods) if (m !== "HEAD") app.routeList.push(`${m} ${route.url}`);
  });

  await app.register(helmet);
  await app.register(cors, { origin: config.webOrigins, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_req, ctx) =>
      new AppError(
        429,
        "RATE_LIMITED",
        `Demasiados intentos. Prueba de nuevo en ${Math.ceil(ctx.ttl / 1000)} s`,
      ),
  });

  app.addHook("onRequest", async (req) => {
    const token = req.cookies[SESSION_COOKIE];
    // CSRF: una petición de navegador que cambia datos trae Origin. Si viene de otra web, se
    // rechaza; si lleva la cookie de sesión, Origin es obligatorio. Junto con SameSite=Lax,
    // otra web no puede actuar en nombre del usuario.
    if (!SAFE_METHODS.has(req.method)) {
      const origin = req.headers.origin;
      if (origin ? !config.webOrigins.includes(origin) : token !== undefined) {
        throw new AppError(403, "CSRF", "Origen de la petición no permitido");
      }
    }
    if (token) req.user = await findSessionUser(db, token);
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    const send = (status: number, code: ErrorCode, message: string) =>
      reply.status(status).send({ error: { code, message } } satisfies ApiError);

    if (err instanceof ZodError) {
      const issue = err.issues[0];
      const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
      return send(400, "VALIDATION_ERROR", `${where}${issue?.message ?? "Datos no válidos"}`);
    }
    if (err instanceof AppError) return send(err.statusCode, err.code, err.message);
    if (err.statusCode === 429) return send(429, "RATE_LIMITED", err.message);
    if (err.statusCode && err.statusCode < 500) {
      return send(err.statusCode, "BAD_REQUEST", err.message);
    }
    req.log.error(err);
    return send(500, "INTERNAL", "Error interno");
  });
  app.setNotFoundHandler((_req, reply) =>
    reply
      .status(404)
      .send({ error: { code: "NOT_FOUND", message: "Ruta no encontrada" } } satisfies ApiError),
  );

  app.get("/health", async () => ({ status: "ok" }));
  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(customerRoutes, { prefix: "/me" });
  await app.register(businessRoutes, { prefix: "/business" });
  await app.register(adminRoutes, { prefix: "/admin" });
  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
