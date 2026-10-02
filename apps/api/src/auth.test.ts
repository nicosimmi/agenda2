// Auth: registro, login, logout, sesión por cookie, CSRF, rate limiting y errores uniformes.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { businessMembers, businesses, categories, sessions } from "./db/schema.ts";
import { SESSION_COOKIE } from "./session.ts";
import {
  createTestApp,
  PASSWORD,
  userWithSession,
  WEB_ORIGIN,
  type TestContext,
} from "./test-app.ts";

let t: TestContext;
let ipCounter = 0;
/** Cada test usa una IP distinta para que el rate limiting de uno no afecte a otro. */
const freshIp = () => `10.0.0.${++ipCounter}`;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});
beforeEach(async () => {
  await t.reset();
  await t.db.insert(categories).values({ slug: "barberia", name: "Barbería" });
});

const post = (url: string, payload: object, extra: { ip?: string; origin?: string } = {}) =>
  t.app.inject({
    method: "POST",
    url,
    payload,
    remoteAddress: extra.ip ?? freshIp(),
    headers: { origin: extra.origin ?? WEB_ORIGIN },
  });

const sessionCookie = (res: { cookies: { name: string; value: string }[] }) =>
  res.cookies.find((c) => c.name === SESSION_COOKIE);

describe("registro", () => {
  it("un cliente se registra y queda con sesión", async () => {
    const res = await post("/auth/register", {
      role: "customer",
      email: "  Ana@Ejemplo.COM ",
      password: "12345678",
      name: "Ana",
    });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ email: "ana@ejemplo.com", role: "customer" });

    const cookie = sessionCookie(res);
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
    const me = await t.app.inject({
      url: "/auth/me",
      cookies: { [SESSION_COOKIE]: cookie!.value },
    });
    expect(me.json()).toMatchObject({ email: "ana@ejemplo.com", role: "customer" });
  });

  it("un negocio se registra con su negocio en borrador", async () => {
    const res = await post("/auth/register", {
      role: "business_owner",
      email: "dueno@ejemplo.com",
      password: "12345678",
      name: "Luis",
      businessName: "Barbería Ñandú",
      categorySlug: "barberia",
    });
    expect(res.statusCode).toBe(201);
    const [member] = await t.db
      .select({ status: businesses.status, slug: businesses.slug })
      .from(businessMembers)
      .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
      .where(eq(businessMembers.userId, res.json().id));
    expect(member?.status).toBe("draft");
    expect(member?.slug).toMatch(/^barberia-nandu-[0-9a-f]{6}$/);
  });

  it("no se puede registrar uno mismo como administrador", async () => {
    const res = await post("/auth/register", {
      role: "platform_admin",
      email: "x@ejemplo.com",
      password: "12345678",
      name: "X",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("email repetido → 409 con el formato de error uniforme", async () => {
    const body = { role: "customer", email: "a@ejemplo.com", password: "12345678", name: "A" };
    await post("/auth/register", body);
    const res = await post("/auth/register", body);
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({
      error: { code: "CONFLICT", message: "Ya existe una cuenta con ese email" },
    });
  });

  it("categoría inexistente → 400 y no deja el usuario a medias", async () => {
    const res = await post("/auth/register", {
      role: "business_owner",
      email: "b@ejemplo.com",
      password: "12345678",
      name: "B",
      businessName: "Negocio",
      categorySlug: "no-existe",
    });
    expect(res.statusCode).toBe(400);
    const retry = await post("/auth/register", {
      role: "customer",
      email: "b@ejemplo.com",
      password: "12345678",
      name: "B",
    });
    expect(retry.statusCode).toBe(201); // la transacción se deshizo
  });

  it("como mucho 3 altas de negocio por IP y día", async () => {
    const ip = freshIp();
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      const res = await post(
        "/auth/register",
        {
          role: "business_owner",
          email: `n${i}@ejemplo.com`,
          password: "12345678",
          name: "N",
          businessName: `Negocio ${i}`,
          categorySlug: "barberia",
        },
        { ip },
      );
      statuses.push(res.statusCode);
    }
    expect(statuses).toEqual([201, 201, 201, 429]);
    // Las altas de cliente desde esa IP siguen permitidas.
    const customer = await post(
      "/auth/register",
      { role: "customer", email: "c@ejemplo.com", password: "12345678", name: "C" },
      { ip },
    );
    expect(customer.statusCode).toBe(201);
  });
});

describe("login y logout", () => {
  it("credenciales correctas abren sesión; incorrectas dan 401 sin decir qué falló", async () => {
    await userWithSession(t.db, "customer", "ana@ejemplo.com");
    const ok = await post("/auth/login", { email: "ana@ejemplo.com", password: PASSWORD });
    expect(ok.statusCode).toBe(200);
    expect(sessionCookie(ok)).toBeDefined();

    const badPassword = await post("/auth/login", { email: "ana@ejemplo.com", password: "mal" });
    const noUser = await post("/auth/login", { email: "nadie@ejemplo.com", password: "mal" });
    expect(badPassword.statusCode).toBe(401);
    expect(noUser.json()).toEqual(badPassword.json());
  });

  it("el login se bloquea tras 10 intentos en 15 minutos", async () => {
    const ip = freshIp();
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await post("/auth/login", { email: "x@ejemplo.com", password: "x" }, { ip }))
        .statusCode;
    }
    expect(last).toBe(429);
  });

  it("el login rota la sesión: la cookie anterior deja de valer", async () => {
    const { cookies } = await userWithSession(t.db, "customer", "ana@ejemplo.com");
    const res = await t.app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ana@ejemplo.com", password: PASSWORD },
      cookies,
      headers: { origin: WEB_ORIGIN },
      remoteAddress: freshIp(),
    });
    expect(res.statusCode).toBe(200);
    expect((await t.app.inject({ url: "/auth/me", cookies })).statusCode).toBe(401);
    expect(await t.db.select().from(sessions)).toHaveLength(1);
  });

  it("el login también se limita por cuenta aunque cambie la IP", async () => {
    let last = 0;
    for (let i = 0; i < 11; i++) {
      last = (await post("/auth/login", { email: "objetivo@ejemplo.com", password: "x" }))
        .statusCode;
    }
    expect(last).toBe(429);
    // Otra cuenta desde una IP nueva no se ve afectada.
    const other = await post("/auth/login", { email: "otra@ejemplo.com", password: "x" });
    expect(other.statusCode).toBe(401);
  });

  it("logout borra la sesión en la base de datos", async () => {
    const { cookies } = await userWithSession(t.db, "customer", "ana@ejemplo.com");
    const res = await t.app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies,
      headers: { origin: WEB_ORIGIN },
    });
    expect(res.statusCode).toBe(204);
    expect(await t.db.select().from(sessions)).toHaveLength(0);
    const me = await t.app.inject({ url: "/auth/me", cookies });
    expect(me.statusCode).toBe(401);
  });

  it("una sesión caducada no vale", async () => {
    const { cookies } = await userWithSession(t.db, "customer", "ana@ejemplo.com");
    await t.db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) });
    const me = await t.app.inject({ url: "/auth/me", cookies });
    expect(me.statusCode).toBe(401);
  });
});

describe("CSRF", () => {
  it("con cookie de sesión, una petición que cambia datos exige Origin permitido", async () => {
    const { cookies } = await userWithSession(t.db, "customer", "ana@ejemplo.com");
    const noOrigin = await t.app.inject({ method: "POST", url: "/auth/logout", cookies });
    const evil = await t.app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies,
      headers: { origin: "https://malvada.example" },
    });
    expect(noOrigin.statusCode).toBe(403);
    expect(evil.json().error.code).toBe("CSRF");
    // La sesión sigue viva: ninguna de las dos llegó a ejecutarse.
    expect(await t.db.select().from(sessions)).toHaveLength(1);
  });
});

describe("errores uniformes", () => {
  it("ruta inexistente → 404 con { error: { code, message } }", async () => {
    const res = await t.app.inject({ url: "/no-existe" });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("JSON mal formado → 400 BAD_REQUEST", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: "/auth/login",
      payload: "{no es json",
      headers: { "content-type": "application/json", origin: WEB_ORIGIN },
      remoteAddress: freshIp(),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("BAD_REQUEST");
  });
});
