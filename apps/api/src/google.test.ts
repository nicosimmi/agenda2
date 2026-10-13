// Acceso con Google: el flujo completo contra un Google simulado (ningún test llama a Google de verdad).
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sessions, users } from "./db/schema.ts";
import { SESSION_COOKIE } from "./session.ts";
import { createTestApp, userWithSession, WEB_ORIGIN, type TestContext } from "./test-app.ts";

const CLIENT_ID = "cliente-de-test.apps.googleusercontent.com";
let t: TestContext;
let ipCounter = 0;
const freshIp = () => `10.1.0.${++ipCounter}`;

/** Lo que "devuelve Google" en el siguiente canje de código; cada test lo ajusta. */
let claims: Record<string, unknown>;
let tokenStatus = 200;
let tokenRequest: URLSearchParams | undefined;

const fakeGoogle: typeof fetch = async (_url, init) => {
  tokenRequest = new URLSearchParams(String(init?.body));
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return new Response(JSON.stringify({ id_token: `cabecera.${payload}.firma` }), {
    status: tokenStatus,
  });
};

beforeAll(async () => {
  t = await createTestApp({
    google: {
      clientId: CLIENT_ID,
      clientSecret: "secreto-de-test",
      redirectUri: "http://localhost:5173/api/auth/google/callback",
      fetch: fakeGoogle,
    },
  });
});
afterAll(async () => {
  await t.close();
});
beforeEach(async () => {
  await t.reset();
  tokenStatus = 200;
  tokenRequest = undefined;
});

/** Empieza el flujo y devuelve lo que Google recibiría y la cookie temporal. */
async function start(query = "") {
  const res = await t.app.inject({
    method: "GET",
    url: `/auth/google/start${query}`,
    remoteAddress: freshIp(),
  });
  const location = new URL(res.headers.location as string);
  const flowCookie = res.cookies.find((c) => c.name === "oauth");
  return { res, location, cookie: flowCookie?.value ?? "", params: location.searchParams };
}

/** Google devuelve al usuario a la API con el código; `mutate` permite falsear el state o la cookie. */
async function callback(
  s: Awaited<ReturnType<typeof start>>,
  extra: { state?: string; cookie?: string } = {},
) {
  return t.app.inject({
    method: "GET",
    url: `/auth/google/callback?code=codigo-123&state=${extra.state ?? s.params.get("state")}`,
    cookies: { oauth: extra.cookie ?? s.cookie },
    remoteAddress: freshIp(),
  });
}

const goodClaims = (s: Awaited<ReturnType<typeof start>>, over: object = {}) => {
  claims = {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce: s.params.get("nonce"),
    sub: "google-sub-1",
    email: "Ana@Gmail.com",
    email_verified: true,
    name: "Ana López",
    ...over,
  };
};

const sessionOf = (res: { cookies: { name: string; value: string }[] }) =>
  res.cookies.find((c) => c.name === SESSION_COOKIE);
const failedLocation = `${WEB_ORIGIN}/entrar?error=google`;

describe("inicio del flujo", () => {
  it("redirige a Google con state, nonce y PKCE, y guarda el secreto solo en una cookie HttpOnly", async () => {
    const s = await start("?volver=/mis-reservas");
    expect(s.res.statusCode).toBe(302);
    expect(s.location.origin + s.location.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(s.params.get("client_id")).toBe(CLIENT_ID);
    expect(s.params.get("code_challenge_method")).toBe("S256");
    expect(s.params.get("scope")).toBe("openid email profile");
    expect(s.params.get("state")).toBeTruthy();
    expect(s.location.toString()).not.toContain("verifier");
    expect(s.res.headers["set-cookie"]).toMatch(/oauth=.*HttpOnly/i);
  });

  it("sin configuración de Google responde 404 y /auth/providers dice que no", async () => {
    const plain = await createTestApp();
    const providers = await plain.app.inject({ method: "GET", url: "/auth/providers" });
    expect(providers.json()).toEqual({ google: false });
    const res = await plain.app.inject({ method: "GET", url: "/auth/google/start" });
    expect(res.statusCode).toBe(404);
    await plain.close();

    const on = await t.app.inject({ method: "GET", url: "/auth/providers" });
    expect(on.json()).toEqual({ google: true });
  });
});

describe("retorno de Google", () => {
  it("crea una cuenta de cliente nueva, abre sesión y vuelve a /entrar", async () => {
    const s = await start("?volver=/mis-reservas");
    goodClaims(s);
    const res = await callback(s);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe(
      `${WEB_ORIGIN}/entrar?volver=${encodeURIComponent("/mis-reservas")}`,
    );
    expect(sessionOf(res)).toBeDefined();

    const [user] = await t.db.select().from(users);
    expect(user).toMatchObject({
      email: "ana@gmail.com",
      role: "customer",
      name: "Ana López",
      googleSub: "google-sub-1",
    });
    expect(user!.emailVerifiedAt).not.toBeNull();
    // El canje lleva el verificador PKCE y el secreto: solo la API los conoce.
    expect(tokenRequest?.get("code_verifier")).toBeTruthy();
    expect(tokenRequest?.get("client_secret")).toBe("secreto-de-test");

    const me = await t.app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { [SESSION_COOKIE]: sessionOf(res)!.value },
    });
    expect(me.json()).toMatchObject({ email: "ana@gmail.com", role: "customer" });
  });

  it("no se puede entrar con contraseña en una cuenta creada con Google", async () => {
    const s = await start();
    goodClaims(s);
    await callback(s);
    const res = await t.app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ana@gmail.com", password: "cualquiera-123" },
      headers: { origin: WEB_ORIGIN },
      remoteAddress: freshIp(),
    });
    expect(res.statusCode).toBe(401);
  });

  it("al reclamar una cuenta con contraseña, invalida la clave y las sesiones anteriores", async () => {
    const { user } = await userWithSession(t.db, "customer", "ana@gmail.com");
    const s = await start();
    goodClaims(s);
    const res = await callback(s);
    expect(sessionOf(res)).toBeDefined();

    const all = await t.db.select().from(users).where(eq(users.id, user.id));
    expect(all).toHaveLength(1);
    expect(all[0]!.googleSub).toBe("google-sub-1");
    expect(all[0]!.passwordHash).not.toBe(user.passwordHash);
    // Solo queda la sesión nueva, la del "otro" (quien creara la cuenta antes) ya no vale.
    const left = await t.db.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(left).toHaveLength(1);
  });

  it("reconoce a la misma persona por su sub aunque cambie de email", async () => {
    const s1 = await start();
    goodClaims(s1);
    await callback(s1);
    const s2 = await start();
    goodClaims(s2, { email: "otro@gmail.com" });
    const res = await callback(s2);
    expect(sessionOf(res)).toBeDefined();
    expect(await t.db.select().from(users)).toHaveLength(1);
  });

  it.each([
    ["una cuenta de negocio", "business_owner" as const],
    ["una cuenta de administración", "platform_admin" as const],
  ])("no abre ni reclama %s", async (_name, role) => {
    await userWithSession(t.db, role, "ana@gmail.com");
    const s = await start();
    goodClaims(s);
    const res = await callback(s);
    expect(res.headers.location).toBe(failedLocation);
    expect(sessionOf(res)).toBeUndefined();
    const [u] = await t.db.select().from(users);
    expect(u!.googleSub).toBeNull();
  });

  const rejected: [string, (s: Awaited<ReturnType<typeof start>>) => Promise<unknown> | unknown][] =
    [
      ["email no verificado", (s) => goodClaims(s, { email_verified: false })],
      ["otro destinatario (aud)", (s) => goodClaims(s, { aud: "otra-app" })],
      ["otro emisor (iss)", (s) => goodClaims(s, { iss: "https://evil.example" })],
      ["token caducado", (s) => goodClaims(s, { exp: Math.floor(Date.now() / 1000) - 10 })],
      ["nonce distinto", (s) => goodClaims(s, { nonce: "otro" })],
      ["Google responde con error", (s) => ((tokenStatus = 400), goodClaims(s))],
    ];
  it.each(rejected)("rechaza: %s", async (_name, setup) => {
    const s = await start();
    await setup(s);
    const res = await callback(s);
    expect(res.headers.location).toBe(failedLocation);
    expect(sessionOf(res)).toBeUndefined();
    expect(await t.db.select().from(users)).toHaveLength(0);
  });

  it("rechaza un state que no es el de la cookie, o sin cookie", async () => {
    const s = await start();
    goodClaims(s);
    const wrongState = await callback(s, { state: "falsificado" });
    expect(wrongState.headers.location).toBe(failedLocation);
    const noCookie = await callback(s, { cookie: "no-es-json" });
    expect(noCookie.headers.location).toBe(failedLocation);
    expect(tokenRequest).toBeUndefined(); // ni siquiera llegó a hablar con Google
    expect(await t.db.select().from(users)).toHaveLength(0);
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])(
    "descarta un volver peligroso (%s)",
    async (volver) => {
      const s = await start(`?volver=${encodeURIComponent(volver)}`);
      goodClaims(s);
      const res = await callback(s);
      expect(res.headers.location).toBe(`${WEB_ORIGIN}/entrar`);
    },
  );
});
