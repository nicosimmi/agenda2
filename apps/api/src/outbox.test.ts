// Automatizaciones (Fase 7): firma HMAC, eventos del outbox al reservar/cancelar/mover, entrega
// con reintentos y rutas de recordatorios. Ningún test llama a n8n: la entrega usa un fetch falso.
import { DAY_MS, localDate } from "@agendia/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.ts";
import { confirmProposal, proposeCustomerBooking } from "./booking.ts";
import { newBookingCode } from "./db/booking-code.ts";
import {
  bookings,
  businesses,
  categories,
  outboxEvents,
  services,
  staff,
  staffServices,
  workingHours,
} from "./db/schema.ts";
import { dispatchDue } from "./outbox.ts";
import { signHeaders, verifySignature } from "./signing.ts";
import { createTestApp, userWithSession, WEB_ORIGIN, type TestContext } from "./test-app.ts";

const SECRET = "secreto-de-test";

describe("firma HMAC", () => {
  const data = '{"id":"1"}';
  const headers = (now?: number) => signHeaders(SECRET, data, now);

  it("acepta una firma correcta", () => {
    expect(verifySignature(SECRET, headers(), data)).toBe(true);
  });
  it("rechaza un cuerpo cambiado, otro secreto, una marca antigua y la falta de cabeceras", () => {
    expect(verifySignature(SECRET, headers(), '{"id":"2"}')).toBe(false);
    expect(verifySignature("otro-secreto", headers(), data)).toBe(false);
    expect(verifySignature(SECRET, headers(Date.now() - 10 * 60_000), data)).toBe(false);
    expect(verifySignature(SECRET, {}, data)).toBe(false);
    expect(verifySignature("", headers(), data)).toBe(false); // sin secreto configurado, nada pasa
  });
});

let t: TestContext;
let slug: string;
let businessId: string;
let serviceId: string;
let ana: string;
let day: string;
let customer: Awaited<ReturnType<typeof userWithSession>>;

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
      contactEmail: "hola@barberia-test.test",
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
  customer = await userWithSession(t.db, "customer", "ana@cliente.test");
  day = localDate(new Date(Date.now() + 3 * DAY_MS), "Europe/Madrid");
});

async function freeSlots() {
  const query = new URLSearchParams({ serviceId, from: day, to: day, staffId: ana });
  const res = await t.app.inject({ url: `/public/businesses/${slug}/availability?${query}` });
  return (res.json() as { slots: { startsAt: string }[] }).slots;
}

const events = () => t.db.select().from(outboxEvents).orderBy(outboxEvents.createdAt);

function post(url: string, payload?: object) {
  return t.app.inject({
    method: "POST",
    url,
    cookies: customer.cookies,
    headers: { origin: WEB_ORIGIN, "idempotency-key": `k-${Math.random()}` },
    ...(payload && { payload }),
  });
}

describe("eventos del outbox", () => {
  it("reservar anota booking.created con los datos del email", async () => {
    const slot = (await freeSlots())[0]!;
    const res = await post("/me/bookings", {
      businessSlug: slug,
      serviceId,
      staffId: ana,
      startsAt: slot.startsAt,
    });
    expect(res.statusCode, res.body).toBe(201);
    const [event] = await events();
    expect(event).toMatchObject({ type: "booking.created", businessId, deliveredAt: null });
    expect(event!.payload).toMatchObject({
      code: res.json().code,
      customer: { name: "ana", email: "ana@cliente.test" },
      business: { name: "Barbería Test", email: "hola@barberia-test.test" },
      service: { name: "Corte" },
      staff: "Ana",
    });
    expect((event!.payload as { when: string }).when).toMatch(/\d{1,2}:\d{2}/);
  });

  it("un hueco ocupado no deja evento (misma transacción)", async () => {
    const slot = (await freeSlots())[0]!;
    const body = { businessSlug: slug, serviceId, staffId: ana, startsAt: slot.startsAt };
    expect((await post("/me/bookings", body)).statusCode).toBe(201);
    expect((await post("/me/bookings", body)).statusCode).toBe(409);
    expect(await events()).toHaveLength(1);
  });

  it("mover y cancelar anotan sus eventos; mover lleva la hora antigua", async () => {
    const [first, second] = await freeSlots();
    const created = await post("/me/bookings", {
      businessSlug: slug,
      serviceId,
      staffId: ana,
      startsAt: first!.startsAt,
    });
    const id = created.json().id as string;
    expect(
      (await post(`/me/bookings/${id}/reschedule`, { startsAt: second!.startsAt })).statusCode,
    ).toBe(200);
    expect((await post(`/me/bookings/${id}/cancel`)).statusCode).toBe(200);
    const all = await events();
    expect(all.map((e) => e.type)).toEqual([
      "booking.created",
      "booking.rescheduled",
      "booking.cancelled",
    ]);
    expect(all[1]!.payload).toHaveProperty("previousWhen");
    expect(all[2]!.payload).toMatchObject({ cancelledBy: "customer" });
  });

  it("una propuesta no avisa hasta que se confirma, y confirmar dos veces avisa una", async () => {
    const slot = (await freeSlots())[0]!;
    const proposal = await proposeCustomerBooking(t.db, customer.user.id, {
      businessSlug: slug,
      serviceId,
      staffId: ana,
      startsAt: new Date(slot.startsAt),
      notes: null,
    });
    expect(await events()).toHaveLength(0);
    await confirmProposal(t.db, customer.user.id, proposal.id);
    await confirmProposal(t.db, customer.user.id, proposal.id);
    expect((await events()).map((e) => e.type)).toEqual(["booking.created"]);
  });
});

describe("entrega a n8n", () => {
  async function queueOne() {
    const slot = (await freeSlots())[0]!;
    await post("/me/bookings", {
      businessSlug: slug,
      serviceId,
      staffId: ana,
      startsAt: slot.startsAt,
    });
  }

  it("envía el evento firmado a su webhook y lo marca como entregado", async () => {
    await queueOne();
    const calls: { url: string; init: RequestInit }[] = [];
    const fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("ok");
    }) as typeof globalThis.fetch;
    const config = { baseUrl: "http://n8n.test/webhook", secret: SECRET, fetch };

    expect(await dispatchDue(t.db, config)).toEqual({ delivered: 1, failed: 0 });
    expect(calls[0]!.url).toBe("http://n8n.test/webhook/agendia-booking-created");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(verifySignature(SECRET, headers, calls[0]!.init.body as string)).toBe(true);
    expect(JSON.parse(calls[0]!.init.body as string)).toMatchObject({ type: "booking.created" });

    expect((await events())[0]!.deliveredAt).not.toBeNull();
    expect(await dispatchDue(t.db, config)).toEqual({ delivered: 0, failed: 0 }); // no se repite
  });

  it("si n8n falla, reintenta más tarde con espera creciente", async () => {
    await queueOne();
    const down = (async () => new Response("no", { status: 503 })) as typeof globalThis.fetch;
    const config = { baseUrl: "http://n8n.test/webhook", secret: SECRET, fetch: down };

    expect(await dispatchDue(t.db, config)).toEqual({ delivered: 0, failed: 1 });
    const [after] = await events();
    expect(after).toMatchObject({ attempts: 1, deliveredAt: null });
    expect(after!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 30_000);
    expect(await dispatchDue(t.db, config)).toEqual({ delivered: 0, failed: 0 }); // aún no toca

    // Cuando llega su turno y n8n ya responde, se entrega.
    await t.db.update(outboxEvents).set({ nextAttemptAt: new Date(Date.now() - 1000) });
    const up = (async () => new Response("ok")) as typeof globalThis.fetch;
    expect(await dispatchDue(t.db, { ...config, fetch: up })).toEqual({ delivered: 1, failed: 0 });
  });
});

describe("recordatorios (/internal)", () => {
  const signed = (method: "GET" | "POST", url: string, secret = SECRET) => ({
    method,
    url,
    headers: signHeaders(secret, `${method} ${url}\n`),
  });

  async function booking(startsInHours: number, createdDaysAgo: number) {
    const startsAt = new Date(Date.now() + startsInHours * 3_600_000);
    const [row] = await t.db
      .insert(bookings)
      .values({
        businessId,
        code: newBookingCode(),
        staffId: ana,
        serviceId,
        customerId: customer.user.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 30 * 60_000),
        status: "confirmed",
        source: "web",
        createdAt: new Date(Date.now() - createdDaysAgo * DAY_MS),
      })
      .returning({ id: bookings.id });
    return row!.id;
  }

  const secured = async () => {
    return buildApp(t.db, {
      webOrigins: [WEB_ORIGIN],
      secureCookies: false,
      trustedProxies: [],
      automationSecret: SECRET,
    });
  };

  it("sin firma válida responde 401, también si el servidor no tiene secreto", async () => {
    const app = await secured();
    expect((await app.inject({ url: "/internal/reminders" })).statusCode).toBe(401);
    expect((await app.inject(signed("GET", "/internal/reminders", "otro"))).statusCode).toBe(401);
    // La app de test no tiene secreto: ni una firma hecha con el secreto de otra la deja pasar.
    const headers = signHeaders(SECRET, "GET /internal/reminders\n");
    expect((await t.app.inject({ url: "/internal/reminders", headers })).statusCode).toBe(401);
    await app.close();
  });

  it("lista las reservas de las próximas 24 h con antelación suficiente y las marca al enviarlas", async () => {
    const due = await booking(10, 2);
    await booking(30, 2); // empieza dentro de más de 24 h
    await booking(12, 0); // reservada hace un momento: ya recibió la confirmación
    const cancelled = await booking(8, 2);
    await t.db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, cancelled));

    const app = await secured();
    const list = await app.inject(signed("GET", "/internal/reminders"));
    expect(list.statusCode, list.body).toBe(200);
    expect(list.json().map((r: { bookingId: string }) => r.bookingId)).toEqual([due]);
    expect(list.json()[0]).toMatchObject({ customer: { email: "ana@cliente.test" } });

    const sent = await app.inject(signed("POST", `/internal/reminders/${due}/sent`));
    expect(sent.statusCode).toBe(204);
    expect((await app.inject(signed("GET", "/internal/reminders"))).json()).toEqual([]);
    await app.close();
  });
});
