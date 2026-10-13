// Acceso con Google (OpenID Connect, flujo de código con PKCE). Sin dependencias: dos redirecciones
// y una petición a Google. Solo para clientes; las cuentas de negocio y de administración no se
// pueden abrir ni reclamar con Google.
//
// El ID token se recibe directamente del endpoint de Google por HTTPS (OpenID Connect Core §3.1.3.7
// permite no verificar la firma en ese caso), pero se comprueban emisor, destinatario, caducidad,
// nonce y que Google haya verificado el email.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import { hash } from "@node-rs/argon2";
import { z } from "zod";
import { sessions, users } from "../db/schema.ts";
import { AppError, pgErrorCode } from "../errors.ts";
import { startSession } from "../session.ts";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  /** Debe coincidir con la URI autorizada en Google: la ruta /auth/google/callback de esta API. */
  redirectUri: string;
  /** Solo para los tests: nunca se llama a Google de verdad. */
  fetch?: typeof fetch;
}

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const OAUTH_COOKIE = "oauth";
const OAUTH_TTL_S = 10 * 60;

const random = (bytes = 32) => randomBytes(bytes).toString("base64url");
/** Solo rutas internas de la web ("/mis-reservas"), nunca una URL externa ni "//otra.web". */
const safePath = (v: string | undefined) => (v && /^\/(?!\/)[^\\\s]*$/.test(v) ? v : "");

const idTokenSchema = z.object({
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  nonce: z.string().optional(),
  sub: z.string().min(1),
  email: z.string(),
  email_verified: z.boolean().or(z.literal("true").transform(() => true)),
  name: z.string().optional(),
});
const flowCookieSchema = z.object({
  state: z.string(),
  nonce: z.string(),
  verifier: z.string(),
  volver: z.string(),
});

export async function googleRoutes(app: FastifyInstance) {
  const { db, config } = app;
  const google = config.google;
  const web = config.webOrigins[0]!;
  const callLimit = { rateLimit: { max: 30, timeWindow: "1 minute" } };

  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.secureCookies,
    path: "/",
  };
  /** Los errores no se detallan al navegador: vuelve a /entrar con un aviso genérico. */
  const failed = (reply: FastifyReply) => {
    reply.clearCookie(OAUTH_COOKIE, { path: "/" });
    return reply.redirect(`${web}/entrar?error=google`);
  };

  app.get("/start", { config: callLimit }, async (req, reply) => {
    if (!google) throw new AppError(404, "NOT_FOUND", "El acceso con Google no está activado");
    const { volver } = z.object({ volver: z.string().max(500).optional() }).parse(req.query);
    const flow = { state: random(), nonce: random(), verifier: random(), volver: safePath(volver) };
    reply.setCookie(OAUTH_COOKIE, JSON.stringify(flow), { ...cookieOptions, maxAge: OAUTH_TTL_S });
    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({
      client_id: google.clientId,
      redirect_uri: google.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state: flow.state,
      nonce: flow.nonce,
      code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    return reply.redirect(url.toString());
  });

  app.get("/callback", { config: callLimit }, async (req, reply) => {
    if (!google) throw new AppError(404, "NOT_FOUND", "El acceso con Google no está activado");
    const query = z
      .object({ code: z.string().max(2048), state: z.string().max(200) })
      .safeParse(req.query);
    let flow: z.infer<typeof flowCookieSchema>;
    try {
      flow = flowCookieSchema.parse(JSON.parse(req.cookies[OAUTH_COOKIE] ?? ""));
    } catch {
      return failed(reply);
    }
    // El state liga esta respuesta con el navegador que empezó el flujo (protege de CSRF en el login).
    if (!query.success || query.data.state !== flow.state) return failed(reply);

    let claims: z.infer<typeof idTokenSchema>;
    try {
      const res = await (google.fetch ?? fetch)(TOKEN_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: query.data.code,
          client_id: google.clientId,
          client_secret: google.clientSecret,
          redirect_uri: google.redirectUri,
          grant_type: "authorization_code",
          code_verifier: flow.verifier,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return failed(reply);
      const { id_token } = z.object({ id_token: z.string() }).parse(await res.json());
      const payload = id_token.split(".")[1] ?? "";
      claims = idTokenSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString()));
    } catch (error) {
      // Sin el error completo: un id_token mal formado podría dejar email y sub en los logs.
      req.log.warn(
        { kind: error instanceof Error ? error.name : "desconocido" },
        "Fallo al canjear el código de Google",
      );
      return failed(reply);
    }
    if (
      !ISSUERS.includes(claims.iss) ||
      claims.aud !== google.clientId ||
      claims.exp * 1000 <= Date.now() ||
      claims.nonce !== flow.nonce ||
      !claims.email_verified
    ) {
      return failed(reply);
    }

    const email = claims.email.trim().toLowerCase();
    const userId = await resolveUser(claims.sub, email, claims.name).catch((error: unknown) => {
      if (error instanceof AppError || pgErrorCode(error) === "23505") return null;
      throw error;
    });
    if (!userId) return failed(reply);

    reply.clearCookie(OAUTH_COOKIE, { path: "/" });
    await startSession(db, config.secureCookies, req, reply, userId);
    // La web decide a dónde ir con /auth/me: /entrar redirige a la zona que toca (o a `volver`).
    return reply.redirect(
      `${web}/entrar${flow.volver ? `?volver=${encodeURIComponent(flow.volver)}` : ""}`,
    );
  });

  /**
   * Usuario de esta cuenta de Google: el ya vinculado, una cuenta de cliente existente con ese
   * email, o una nueva. Reclamar una cuenta con contraseña invalida esa contraseña y sus sesiones:
   * como el registro no verifica el email, alguien pudo crearla antes con el correo ajeno y
   * conocer la clave (pre-secuestro de cuenta).
   */
  async function resolveUser(sub: string, email: string, name: string | undefined) {
    const [linked] = await db.select().from(users).where(eq(users.googleSub, sub));
    if (linked) {
      if (linked.role !== "customer") throw new AppError(403, "FORBIDDEN", "Cuenta no permitida");
      return linked.id;
    }
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) {
      if (existing.role !== "customer") throw new AppError(403, "FORBIDDEN", "Cuenta no permitida");
      // Ya vinculada a otra cuenta de Google (por ejemplo, un email reciclado): no se pisa.
      if (existing.googleSub) throw new AppError(403, "FORBIDDEN", "Cuenta no permitida");
      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({
            googleSub: sub,
            emailVerifiedAt: new Date(),
            passwordHash: await unusablePassword(),
          })
          .where(and(eq(users.id, existing.id), isNull(users.googleSub)));
        await tx.delete(sessions).where(eq(sessions.userId, existing.id));
      });
      return existing.id;
    }
    const [created] = await db
      .insert(users)
      .values({
        email,
        googleSub: sub,
        emailVerifiedAt: new Date(),
        passwordHash: await unusablePassword(),
        role: "customer",
        name: (name?.trim() || email.split("@")[0]!).slice(0, 100),
      })
      .returning({ id: users.id });
    return created!.id;
  }
}

/** Hash de una clave aleatoria que nadie conoce: la cuenta solo se abre con Google. */
const unusablePassword = () => hash(randomBytes(32).toString("hex"));
