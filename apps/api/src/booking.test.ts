// Flujo del cliente contra Postgres real: huecos libres, reservar, idempotencia, reservas
// simultáneas del mismo hueco, cancelar y mover, y que un negocio sin publicar no admita reservas.
import { localDate, DAY_MS } from "@agendia/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { newBookingCode } from "./db/booking-code.ts";
import {
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
let luis: string;
let customer1: Cookies;
let customer2: Cookies;
/** Fecha local (dentro del horizonte y pasado el preaviso) en la que se prueban las reservas. */
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
      cancelLimitHours: 12,
    })
    .returning();
  slug = business!.slug;
  businessId = business!.id;
  const [service] = await t.db
    .insert(services)
    .values({ businessId, name: "Corte", durationMin: 30, bufferMin: 0, priceCents: 1500 })
    .returning();
  serviceId = service!.id;
  const members = await t.db
    .insert(staff)
    .values([
      { businessId, name: "Ana" },
      { businessId, name: "Luis" },
    ])
    .returning();
  ana = members[0]!.id;
  luis = members[1]!.id;
  for (const m of members) {
    await t.db.insert(staffServices).values({ businessId, staffId: m.id, serviceId });
    await t.db.insert(workingHours).values(
      [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
        businessId,
        staffId: m.id,
        weekday,
        startTime: "09:00",
        endTime: "13:00",
      })),
    );
  }
  customer1 = (await userWithSession(t.db, "customer", "c1@cliente.test")).cookies;
  customer2 = (await userWithSession(t.db, "customer", "c2@cliente.test")).cookies;
  day = localDate(new Date(Date.now() + 3 * DAY_MS), "Europe/Madrid");
});

async function slotsFor(staffId?: string, forDay = day) {
  const query = new URLSearchParams({ serviceId, from: forDay, to: forDay });
  if (staffId) query.set("staffId", staffId);
  const res = await t.app.inject({ url: `/public/businesses/${slug}/availability?${query}` });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { slots: Slot[] }).slots;
}

let keyCounter = 0;
function book(cookies: Cookies, body: object, key = `k-${++keyCounter}`) {
  return t.app.inject({
    method: "POST",
    url: "/me/bookings",
    cookies,
    headers: { origin: WEB_ORIGIN, "idempotency-key": key },
    payload: { businessSlug: slug, serviceId, ...body },
  });
}

const post = (url: string, cookies: Cookies, payload?: object) =>
  t.app.inject({
    method: "POST",
    url,
    cookies,
    headers: { origin: WEB_ORIGIN },
    ...(payload && { payload }),
  });

const myBookings = async (cookies: Cookies) =>
  (await t.app.inject({ url: "/me/bookings", cookies })).json() as {
    id: string;
    status: string;
    staffId: string;
  }[];

describe("huecos libres", () => {
  it("devuelve huecos de ambos profesionales y respeta el horario", async () => {
    const slots = await slotsFor();
    expect(slots.length).toBeGreaterThan(0);
    expect(new Set(slots.map((s) => s.staffId))).toEqual(new Set([ana, luis]));
    const first = slots[0]!;
    expect(new Date(first.startsAt).getUTCHours()).toBeGreaterThanOrEqual(7); // 09:00 Madrid
  });

  it("filtra por profesional", async () => {
    const slots = await slotsFor(ana);
    expect(new Set(slots.map((s) => s.staffId))).toEqual(new Set([ana]));
  });

  it("un hueco reservado desaparece de la lista", async () => {
    const slot = (await slotsFor(ana))[0]!;
    expect((await book(customer1, { staffId: ana, startsAt: slot.startsAt })).statusCode).toBe(201);
    const after = await slotsFor(ana);
    expect(after.map((s) => s.startsAt)).not.toContain(slot.startsAt);
  });

  it("un negocio sin publicar responde 404", async () => {
    await t.db.update(businesses).set({ status: "draft" }).where(eq(businesses.id, businessId));
    const res = await t.app.inject({
      url: `/public/businesses/${slug}/availability?serviceId=${serviceId}&from=${day}&to=${day}`,
    });
    expect(res.statusCode).toBe(404);
  });

  it("rechaza rangos demasiado largos y fechas mal formadas", async () => {
    for (const q of [`from=${day}&to=2999-01-01`, "from=hoy&to=mañana", `from=${day}`]) {
      const res = await t.app.inject({
        url: `/public/businesses/${slug}/availability?serviceId=${serviceId}&${q}`,
      });
      expect(res.statusCode, q).toBe(400);
    }
  });
});

describe("reservar", () => {
  it("crea la reserva, devuelve un código y aparece en Mis reservas", async () => {
    const slot = (await slotsFor(ana))[0]!;
    const res = await book(customer1, { staffId: ana, startsAt: slot.startsAt });
    expect(res.statusCode, res.body).toBe(201);
    expect(res.json().code).toHaveLength(10);
    const mine = await myBookings(customer1);
    expect(mine).toHaveLength(1);
    expect(mine[0]?.status).toBe("confirmed");
    expect(await myBookings(customer2)).toHaveLength(0);
  });

  it("una hora que no es un hueco libre se rechaza con 409", async () => {
    const res = await book(customer1, { staffId: ana, startsAt: `${day}T03:00:00Z` });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toMatch(/disponible/);
  });

  it("sin profesional elegido asigna uno libre, y cuando no queda ninguno da 409", async () => {
    const slot = (await slotsFor())[0]!;
    const a = await book(customer1, { startsAt: slot.startsAt });
    const b = await book(customer2, { startsAt: slot.startsAt });
    expect([a.statusCode, b.statusCode]).toEqual([201, 201]);
    const used = [...(await myBookings(customer1)), ...(await myBookings(customer2))].map(
      (x) => x.staffId,
    );
    expect(new Set(used)).toEqual(new Set([ana, luis]));
    const third = await userWithSession(t.db, "customer", "c3@cliente.test");
    expect((await book(third.cookies, { startsAt: slot.startsAt })).statusCode).toBe(409);
  });

  it("dos clientes que reservan a la vez el mismo hueco: uno gana y el otro recibe 409", async () => {
    const slot = (await slotsFor(ana))[0]!;
    const results = await Promise.all([
      book(customer1, { staffId: ana, startsAt: slot.startsAt }),
      book(customer2, { staffId: ana, startsAt: slot.startsAt }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    const rows = await t.db.select().from(bookings).where(eq(bookings.staffId, ana));
    expect(rows).toHaveLength(1);
  });

  it("un negocio sin publicar no admite reservas", async () => {
    const slot = (await slotsFor(ana))[0]!;
    await t.db.update(businesses).set({ status: "draft" }).where(eq(businesses.id, businessId));
    const res = await book(customer1, { staffId: ana, startsAt: slot.startsAt });
    expect(res.statusCode).toBe(404);
  });

  it("un servicio retirado no se puede reservar", async () => {
    const slot = (await slotsFor(ana))[0]!;
    await t.db.update(services).set({ active: false }).where(eq(services.id, serviceId));
    const res = await book(customer1, { staffId: ana, startsAt: slot.startsAt });
    expect(res.statusCode).toBe(404);
  });

  it("valida el cuerpo", async () => {
    const res = await book(customer1, { startsAt: "mañana" });
    expect(res.statusCode).toBe(400);
  });

  it("una propuesta pendiente caducada no bloquea el hueco", async () => {
    const slot = (await slotsFor(ana))[0]!;
    const start = new Date(slot.startsAt);
    await t.db.insert(bookings).values({
      businessId,
      staffId: ana,
      serviceId,
      code: newBookingCode(),
      startsAt: start,
      endsAt: new Date(start.getTime() + 30 * 60_000),
      status: "pending",
      source: "agent",
      expiresAt: new Date(Date.now() - 60_000),
      guestName: "Propuesta caducada",
    });
    const res = await book(customer1, { staffId: ana, startsAt: slot.startsAt });
    expect(res.statusCode, res.body).toBe(201);
  });
});

describe("idempotencia", () => {
  it("repetir la petición con la misma clave devuelve la misma reserva sin duplicarla", async () => {
    const slot = (await slotsFor(ana))[0]!;
    const body = { staffId: ana, startsAt: slot.startsAt };
    const first = await book(customer1, body, "clave-fija");
    const second = await book(customer1, body, "clave-fija");
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json().code).toBe(first.json().code);
    expect(await myBookings(customer1)).toHaveLength(1);
  });

  it("la misma clave con otro cuerpo es un 422", async () => {
    const [s1, s2] = (await slotsFor(ana)).slice(0, 2) as [Slot, Slot];
    await book(customer1, { staffId: ana, startsAt: s1.startsAt }, "clave-fija");
    const res = await book(customer1, { staffId: ana, startsAt: s2.startsAt }, "clave-fija");
    expect(res.statusCode).toBe(422);
    expect(await myBookings(customer1)).toHaveLength(1);
  });

  it("sin cabecera Idempotency-Key es un 400, y una clave demasiado larga también", async () => {
    const slot = (await slotsFor(ana))[0]!;
    const body = { businessSlug: slug, serviceId, staffId: ana, startsAt: slot.startsAt };
    const none = await t.app.inject({
      method: "POST",
      url: "/me/bookings",
      cookies: customer1,
      headers: { origin: WEB_ORIGIN },
      payload: body,
    });
    expect(none.statusCode).toBe(400);
    const long = await book(customer1, body, "x".repeat(300));
    expect(long.statusCode).toBe(400);
  });
});

describe("cancelar y mover", () => {
  async function bookAndGet() {
    const slot = (await slotsFor(ana))[0]!;
    const res = await book(customer1, { staffId: ana, startsAt: slot.startsAt });
    return { id: res.json().id as string, slot };
  }

  it("cancela una reserva propia y libera el hueco", async () => {
    const { id, slot } = await bookAndGet();
    const res = await post(`/me/bookings/${id}/cancel`, customer1);
    expect(res.statusCode, res.body).toBe(200);
    expect((await myBookings(customer1))[0]?.status).toBe("cancelled");
    expect((await slotsFor(ana)).map((s) => s.startsAt)).toContain(slot.startsAt);
  });

  it("no se puede cancelar una reserva de otro cliente (404)", async () => {
    const { id } = await bookAndGet();
    expect((await post(`/me/bookings/${id}/cancel`, customer2)).statusCode).toBe(404);
    expect((await myBookings(customer1))[0]?.status).toBe("confirmed");
  });

  it("dentro del plazo límite ya no se puede cancelar ni mover (409)", async () => {
    const start = new Date(Date.now() + 2 * 3_600_000);
    const [row] = await t.db
      .insert(bookings)
      .values({
        businessId,
        staffId: ana,
        serviceId,
        code: newBookingCode(),
        startsAt: start,
        endsAt: new Date(start.getTime() + 30 * 60_000),
        status: "confirmed",
        source: "web",
        customerId: (await t.db.query.users.findFirst({
          where: (u, { eq: is }) => is(u.email, "c1@cliente.test"),
        }))!.id,
      })
      .returning();
    const cancel = await post(`/me/bookings/${row!.id}/cancel`, customer1);
    expect(cancel.statusCode).toBe(409);
    expect(cancel.json().error.message).toMatch(/12 h/);
    const move = await post(`/me/bookings/${row!.id}/reschedule`, customer1, {
      startsAt: start.toISOString(),
    });
    expect(move.statusCode).toBe(409);
  });

  it("no se puede cancelar dos veces", async () => {
    const { id } = await bookAndGet();
    await post(`/me/bookings/${id}/cancel`, customer1);
    expect((await post(`/me/bookings/${id}/cancel`, customer1)).statusCode).toBe(409);
  });

  it("mueve la reserva a otro hueco y libera el anterior", async () => {
    const { id, slot } = await bookAndGet();
    const target = (await slotsFor(ana)).find((s) => s.startsAt !== slot.startsAt)!;
    const res = await post(`/me/bookings/${id}/reschedule`, customer1, {
      startsAt: target.startsAt,
    });
    expect(res.statusCode, res.body).toBe(200);
    const after = (await slotsFor(ana)).map((s) => s.startsAt);
    expect(after).toContain(slot.startsAt);
    expect(after).not.toContain(target.startsAt);
  });

  it("no se puede mover a un hueco ocupado (409) ni mover la reserva de otro (404)", async () => {
    const { id } = await bookAndGet();
    const [s1, s2] = (await slotsFor(luis)).slice(0, 2) as [Slot, Slot];
    await book(customer2, { staffId: luis, startsAt: s2.startsAt });
    const busy = await post(`/me/bookings/${id}/reschedule`, customer1, {
      staffId: luis,
      startsAt: s2.startsAt,
    });
    expect(busy.statusCode).toBe(409);
    const foreign = await post(`/me/bookings/${id}/reschedule`, customer2, {
      startsAt: s1.startsAt,
    });
    expect(foreign.statusCode).toBe(404);
  });
});

describe("ficha pública", () => {
  it("muestra servicios, equipo y horarios, sin datos de otros negocios", async () => {
    const res = await t.app.inject({ url: `/public/businesses/${slug}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.services).toHaveLength(1);
    expect(body.staff.map((m: { name: string }) => m.name)).toEqual(["Ana", "Luis"]);
    expect(body.hours.length).toBeGreaterThan(0);
  });

  it("un negocio en borrador no existe para el público", async () => {
    await t.db.update(businesses).set({ status: "draft" }).where(eq(businesses.id, businessId));
    expect((await t.app.inject({ url: `/public/businesses/${slug}` })).statusCode).toBe(404);
  });

  it("un profesional sin servicios activos no se muestra", async () => {
    await t.db.update(services).set({ active: false }).where(eq(services.id, serviceId));
    const body = (await t.app.inject({ url: `/public/businesses/${slug}` })).json();
    expect(body.staff).toEqual([]);
  });
});
