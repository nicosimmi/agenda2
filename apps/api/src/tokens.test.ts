// Tokens de acceso (clientes MCP y agentes) y el ciclo propuesta → confirmación, contra Postgres real.
// Lo esencial: un token solo puede lo que sus permisos dicen, no puede crear otros tokens, y una
// propuesta retiene el hueco pero no es una reserva hasta que se confirma con otro permiso.
import { DAY_MS, localDate } from "@agendia/core";
import type { TokenScope } from "@agendia/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  apiTokens,
  bookings,
  businesses,
  categories,
  services,
  staff,
  staffServices,
  workingHours,
} from "./db/schema.ts";
import { createTestApp, userWithSession, WEB_ORIGIN, type TestContext } from "./test-app.ts";

let t: TestContext;
type Cookies = Record<string, string>;
interface Slot {
  staffId: string;
  startsAt: string;
}

let slug: string;
let businessId: string;
let serviceId: string;
let ana: string;
let customer1: Cookies;
let customer2: Cookies;
let day: string;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

beforeEach(async () => {
  await t.reset();
  const [category] = await t.db
    .insert(categories)
    .values({ slug: "barberia", name: "Barbería" })
    .returning();
  const [business] = await t.db
    .insert(businesses)
    .values({
      slug: "barberia-test",
      name: "Barbería Test",
      categoryId: category!.id,
      status: "published",
    })
    .returning();
  slug = business!.slug;
  businessId = business!.id;
  const [service] = await t.db
    .insert(services)
    .values({ businessId, name: "Corte", durationMin: 30, bufferMin: 0, priceCents: 1500 })
    .returning();
  serviceId = service!.id;
  const [member] = await t.db.insert(staff).values({ businessId, name: "Ana" }).returning();
  ana = member!.id;
  await t.db.insert(staffServices).values({ businessId, staffId: ana, serviceId });
  await t.db.insert(workingHours).values(
    [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
      businessId,
      staffId: ana,
      weekday,
      startTime: "09:00",
      endTime: "13:00",
    })),
  );
  customer1 = (await userWithSession(t.db, "customer", "c1@cliente.test")).cookies;
  customer2 = (await userWithSession(t.db, "customer", "c2@cliente.test")).cookies;
  day = localDate(new Date(Date.now() + 3 * DAY_MS), "Europe/Madrid");
});

// --- ayudas ---

const withCookies = (
  cookies: Cookies,
  method: "GET" | "POST" | "DELETE",
  url: string,
  payload?: object,
) =>
  t.app.inject({
    method,
    url,
    cookies,
    headers: { origin: WEB_ORIGIN },
    ...(payload && { payload }),
  });

const withToken = (
  token: string,
  method: "GET" | "POST" | "DELETE",
  url: string,
  payload?: object,
) =>
  t.app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${token}` },
    ...(payload && { payload }),
  });

async function newToken(cookies: Cookies, scopes: TokenScope[], extra: object = {}) {
  const res = await withCookies(cookies, "POST", "/me/tokens", {
    label: "Prueba",
    scopes,
    ...extra,
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as { id: string; token: string; expiresAt: string };
}

async function slots() {
  const res = await t.app.inject({
    url: `/public/businesses/${slug}/availability?serviceId=${serviceId}&from=${day}&to=${day}`,
  });
  return (res.json() as { slots: Slot[] }).slots;
}

const proposal = (slot: Slot) => ({
  businessSlug: slug,
  serviceId,
  staffId: slot.staffId,
  startsAt: slot.startsAt,
});

const ALL: TokenScope[] = ["bookings:read", "bookings:propose", "bookings:confirm"];

// --- gestión de tokens ---

describe("gestión de tokens", () => {
  it("se crea con sesión de navegador y el secreto solo se devuelve una vez", async () => {
    const created = await newToken(customer1, ["bookings:read"]);
    expect(created.token).toMatch(/^agt_/);
    const list = await withCookies(customer1, "GET", "/me/tokens");
    expect(list.statusCode).toBe(200);
    expect(list.body).not.toContain(created.token);
    expect(list.json()).toHaveLength(1);
    // En la base de datos solo está el hash.
    const [row] = await t.db.select().from(apiTokens);
    expect(row?.tokenHash).not.toBe(created.token);
    expect(row?.tokenHash).toHaveLength(64);
  });

  it("caduca pronto por defecto y el plazo tiene tope", async () => {
    const created = await newToken(customer1, ["bookings:read"]);
    const minutes = (new Date(created.expiresAt).getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(55);
    expect(minutes).toBeLessThanOrEqual(60);
    for (const ttlMinutes of [1, 1441]) {
      const res = await withCookies(customer1, "POST", "/me/tokens", {
        label: "x",
        scopes: ["bookings:read"],
        ttlMinutes,
      });
      expect(res.statusCode, String(ttlMinutes)).toBe(400);
    }
  });

  it("rechaza permisos desconocidos o vacíos", async () => {
    for (const scopes of [[], ["bookings:delete"], ["admin"]]) {
      const res = await withCookies(customer1, "POST", "/me/tokens", { label: "x", scopes });
      expect(res.statusCode, JSON.stringify(scopes)).toBe(400);
    }
  });

  it("un token no puede crear, listar ni revocar tokens", async () => {
    const { token, id } = await newToken(customer1, ALL);
    expect(
      (await withToken(token, "POST", "/me/tokens", { label: "x", scopes: ALL })).statusCode,
    ).toBe(403);
    expect((await withToken(token, "GET", "/me/tokens")).statusCode).toBe(403);
    expect((await withToken(token, "DELETE", `/me/tokens/${id}`)).statusCode).toBe(403);
  });

  it("un propietario de negocio no puede crear tokens", async () => {
    const owner = await userWithSession(t.db, "business_owner", "o@negocio.test");
    const res = await withCookies(owner.cookies, "POST", "/me/tokens", { label: "x", scopes: ALL });
    expect(res.statusCode).toBe(403);
  });

  it("revocar un token propio lo invalida al momento; el de otro es un 404", async () => {
    const { token, id } = await newToken(customer1, ["bookings:read"]);
    expect((await withToken(token, "GET", "/me/bookings")).statusCode).toBe(200);
    expect((await withCookies(customer2, "DELETE", `/me/tokens/${id}`)).statusCode).toBe(404);
    expect((await withToken(token, "GET", "/me/bookings")).statusCode).toBe(200);
    expect((await withCookies(customer1, "DELETE", `/me/tokens/${id}`)).statusCode).toBe(204);
    expect((await withToken(token, "GET", "/me/bookings")).statusCode).toBe(401);
  });

  it("como mucho 10 tokens activos por persona", async () => {
    for (let i = 0; i < 10; i++) await newToken(customer1, ["bookings:read"]);
    const res = await withCookies(customer1, "POST", "/me/tokens", {
      label: "x",
      scopes: ["bookings:read"],
    });
    expect(res.statusCode).toBe(409);
  });
});

// --- autenticación con token ---

describe("autenticación con token", () => {
  it("sin cabecera, mal formada, inventada, caducada o de un propietario: 401", async () => {
    const { token } = await newToken(customer1, ["bookings:read"]);
    const call = (headers: Record<string, string>) =>
      t.app.inject({ url: "/me/bookings", headers });
    expect((await call({ authorization: `Bearer ${token}` })).statusCode).toBe(200);
    expect((await call({ authorization: token })).statusCode).toBe(401);
    expect((await call({ authorization: "Bearer agt_inventado" })).statusCode).toBe(401);
    expect((await call({ authorization: "Basic abc" })).statusCode).toBe(401);

    await t.db.update(apiTokens).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await call({ authorization: `Bearer ${token}` })).statusCode).toBe(401);
  });

  it("un token de una cuenta que ya no es de cliente deja de valer", async () => {
    const { token } = await newToken(customer1, ["bookings:read"]);
    const owner = await userWithSession(t.db, "business_owner", "o@negocio.test");
    await t.db.update(apiTokens).set({ userId: owner.user.id });
    expect((await withToken(token, "GET", "/me/bookings")).statusCode).toBe(401);
  });

  it("con token se ignora la cookie: un token malo no se salva por llevar una sesión buena", async () => {
    const res = await t.app.inject({
      url: "/me/bookings",
      cookies: customer1,
      headers: { authorization: "Bearer agt_malo" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("un token no sirve para el panel de negocio ni para la administración", async () => {
    const { token } = await newToken(customer1, ALL);
    expect((await withToken(token, "GET", "/business/profile")).statusCode).toBe(403);
    expect(
      (await withToken(token, "POST", `/admin/businesses/${businessId}/suspend`)).statusCode,
    ).toBe(403);
  });
});

// --- permisos por ruta ---

describe("permisos del token", () => {
  it("solo lectura: ve sus reservas pero no propone ni confirma", async () => {
    const { token } = await newToken(customer1, ["bookings:read"]);
    const slot = (await slots())[0]!;
    expect((await withToken(token, "GET", "/me/bookings")).statusCode).toBe(200);
    const propose = await withToken(token, "POST", "/me/bookings/propose", proposal(slot));
    expect(propose.statusCode).toBe(403);
    expect(propose.json().error.message).toContain("bookings:propose");
  });

  it("leer y proponer NO basta para reservar, confirmar, cancelar ni mover", async () => {
    const { token } = await newToken(customer1, ["bookings:read", "bookings:propose"]);
    const slot = (await slots())[0]!;
    const proposed = await withToken(token, "POST", "/me/bookings/propose", proposal(slot));
    expect(proposed.statusCode, proposed.body).toBe(201);
    const id = proposed.json().id as string;

    const direct = await t.app.inject({
      method: "POST",
      url: "/me/bookings",
      headers: { authorization: `Bearer ${token}`, "idempotency-key": "k1" },
      payload: { businessSlug: slug, serviceId, staffId: slot.staffId, startsAt: slot.startsAt },
    });
    expect(direct.statusCode).toBe(403);
    expect((await withToken(token, "POST", `/me/bookings/${id}/confirm`)).statusCode).toBe(403);
    expect((await withToken(token, "POST", `/me/bookings/${id}/cancel`)).statusCode).toBe(403);
    expect(
      (await withToken(token, "POST", `/me/bookings/${id}/reschedule`, { startsAt: slot.startsAt }))
        .statusCode,
    ).toBe(403);
    // Sigue siendo una propuesta: no hay ninguna reserva confirmada.
    const rows = await t.db.select().from(bookings);
    expect(rows.map((r) => r.status)).toEqual(["pending"]);
  });

  it("con el permiso de confirmar sí puede confirmar", async () => {
    const proposer = await newToken(customer1, ["bookings:propose"]);
    const confirmer = await newToken(customer1, ["bookings:confirm"]);
    const slot = (await slots())[0]!;
    const id = (
      await withToken(proposer.token, "POST", "/me/bookings/propose", proposal(slot))
    ).json().id;
    const res = await withToken(confirmer.token, "POST", `/me/bookings/${id}/confirm`);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().status).toBe("confirmed");
  });
});

// --- propuestas ---

describe("propuestas de reserva", () => {
  it("retienen el hueco 10 minutos y devuelven el resumen para la tarjeta de confirmación", async () => {
    const { token } = await newToken(customer1, ALL);
    const slot = (await slots())[0]!;
    const res = await withToken(token, "POST", "/me/bookings/propose", proposal(slot));
    expect(res.statusCode, res.body).toBe(201);
    const summary = res.json();
    expect(summary).toMatchObject({
      status: "pending",
      businessName: "Barbería Test",
      serviceName: "Corte",
      staffName: "Ana",
      priceCents: 1500,
    });
    const minutes = (new Date(summary.expiresAt).getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(9);
    expect(minutes).toBeLessThanOrEqual(10);
    // El hueco ya no se ofrece a nadie mientras dure la retención.
    expect((await slots()).map((s) => s.startsAt)).not.toContain(slot.startsAt);
  });

  it("otra persona no puede reservar un hueco retenido", async () => {
    const { token } = await newToken(customer1, ALL);
    const slot = (await slots())[0]!;
    await withToken(token, "POST", "/me/bookings/propose", proposal(slot));
    const other = await newToken(customer2, ALL);
    const res = await withToken(other.token, "POST", "/me/bookings/propose", proposal(slot));
    expect(res.statusCode).toBe(409);
  });

  it("dos personas que proponen a la vez el mismo hueco: una gana y la otra recibe 409", async () => {
    const a = await newToken(customer1, ALL);
    const b = await newToken(customer2, ALL);
    const slot = (await slots())[0]!;
    const results = await Promise.all([
      withToken(a.token, "POST", "/me/bookings/propose", proposal(slot)),
      withToken(b.token, "POST", "/me/bookings/propose", proposal(slot)),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
  });

  it("al caducar, el hueco vuelve a estar libre y la propuesta figura como caducada", async () => {
    const { token } = await newToken(customer1, ALL);
    const slot = (await slots())[0]!;
    const id = (await withToken(token, "POST", "/me/bookings/propose", proposal(slot))).json().id;
    await t.db
      .update(bookings)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(bookings.id, id));

    expect((await slots()).map((s) => s.startsAt)).toContain(slot.startsAt);
    const mine = (await withToken(token, "GET", "/me/bookings")).json();
    expect(mine[0].status).toBe("expired");
    const confirm = await withToken(token, "POST", `/me/bookings/${id}/confirm`);
    expect(confirm.statusCode).toBe(409);
    expect(confirm.json().error.message).toMatch(/caducado/);
  });

  it("una propuesta caducada no se puede confirmar aunque otra persona se haya llevado el hueco", async () => {
    const a = await newToken(customer1, ALL);
    const b = await newToken(customer2, ALL);
    const slot = (await slots())[0]!;
    const id = (await withToken(a.token, "POST", "/me/bookings/propose", proposal(slot))).json().id;
    await t.db
      .update(bookings)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(bookings.id, id));
    const taken = await withToken(b.token, "POST", "/me/bookings/propose", proposal(slot));
    expect(taken.statusCode).toBe(201);
    expect((await withToken(a.token, "POST", `/me/bookings/${id}/confirm`)).statusCode).toBe(409);
  });

  it("como mucho 3 propuestas pendientes por persona", async () => {
    const { token } = await newToken(customer1, ALL);
    const all = await slots();
    // Tres horas distintas del mismo profesional.
    const picks = [all[0]!, all[3]!, all[6]!];
    for (const s of picks) {
      expect((await withToken(token, "POST", "/me/bookings/propose", proposal(s))).statusCode).toBe(
        201,
      );
    }
    const fourth = await withToken(token, "POST", "/me/bookings/propose", proposal(all[9]!));
    expect(fourth.statusCode).toBe(409);
    expect(fourth.json().error.message).toMatch(/3 propuestas/);
  });

  it("un negocio sin publicar o una hora inexistente no se pueden proponer", async () => {
    const { token } = await newToken(customer1, ALL);
    const slot = (await slots())[0]!;
    const noHueco = await withToken(token, "POST", "/me/bookings/propose", {
      ...proposal(slot),
      startsAt: `${day}T03:00:00Z`,
    });
    expect(noHueco.statusCode).toBe(409);
    await t.db.update(businesses).set({ status: "draft" }).where(eq(businesses.id, businessId));
    const draft = await withToken(token, "POST", "/me/bookings/propose", proposal(slot));
    expect(draft.statusCode).toBe(404);
  });
});

describe("confirmación", () => {
  it("convierte la propuesta en reserva confirmada y repetirla no cambia nada", async () => {
    const { token } = await newToken(customer1, ALL);
    const slot = (await slots())[0]!;
    const id = (await withToken(token, "POST", "/me/bookings/propose", proposal(slot))).json().id;
    const first = await withToken(token, "POST", `/me/bookings/${id}/confirm`);
    const again = await withToken(token, "POST", `/me/bookings/${id}/confirm`);
    expect(first.statusCode).toBe(200);
    expect(again.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ status: "confirmed", expiresAt: null });
    expect(again.json().code).toBe(first.json().code);
    const mine = (await withToken(token, "GET", "/me/bookings")).json();
    expect(mine).toHaveLength(1);
    expect(mine[0].status).toBe("confirmed");
  });

  it("nadie confirma la propuesta de otra persona (404)", async () => {
    const a = await newToken(customer1, ALL);
    const b = await newToken(customer2, ALL);
    const slot = (await slots())[0]!;
    const id = (await withToken(a.token, "POST", "/me/bookings/propose", proposal(slot))).json().id;
    expect((await withToken(b.token, "POST", `/me/bookings/${id}/confirm`)).statusCode).toBe(404);
    expect((await withCookies(customer2, "POST", `/me/bookings/${id}/confirm`)).statusCode).toBe(
      404,
    );
    const rows = await t.db.select().from(bookings);
    expect(rows[0]?.status).toBe("pending");
  });

  it("no se puede confirmar una reserva cancelada", async () => {
    const { token } = await newToken(customer1, ALL);
    const slot = (await slots())[0]!;
    const id = (await withToken(token, "POST", "/me/bookings/propose", proposal(slot))).json().id;
    await t.db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, id));
    expect((await withToken(token, "POST", `/me/bookings/${id}/confirm`)).statusCode).toBe(409);
  });
});
