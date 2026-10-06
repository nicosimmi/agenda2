// Comportamiento del panel del negocio (el aislamiento entre negocios está en isolation.test.ts).
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { newBookingCode } from "./db/booking-code.ts";
import { bookings, businessMembers, businesses, categories, services } from "./db/schema.ts";
import { createTestApp, userWithSession, WEB_ORIGIN, type TestContext } from "./test-app.ts";

let t: TestContext;
let owner: Record<string, string>;
let businessId: string;

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
    .values({ slug: "demo", name: "Demo", categoryId: category!.id }) // empieza en draft
    .returning();
  businessId = business!.id;
  const session = await userWithSession(t.db, "business_owner", "o@negocio.test");
  await t.db.insert(businessMembers).values({ userId: session.user.id, businessId });
  owner = session.cookies;
});

async function call(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  body?: object,
) {
  const res = await t.app.inject({
    method,
    url,
    cookies: owner,
    headers: { origin: WEB_ORIGIN },
    ...(body && { payload: body }),
  });
  return { status: res.statusCode, body: res.statusCode === 204 ? null : res.json() };
}

const service = { name: "Corte", durationMin: 30, bufferMin: 10, priceCents: 1500 };

async function setUpPublishable() {
  await call("PATCH", "/business/profile", { addressLine: "Calle 1", city: "Madrid" });
  const svc = (await call("POST", "/business/services", service)).body;
  const member = (await call("POST", "/business/staff", { name: "Ana", serviceIds: [svc.id] }))
    .body;
  await call("PUT", `/business/staff/${member.id}/hours`, {
    hours: [{ weekday: 1, startTime: "09:00", endTime: "17:00" }],
  });
  return { serviceId: svc.id as string, staffId: member.id as string };
}

describe("perfil", () => {
  it("rechaza ajustes negativos", async () => {
    for (const field of ["minNoticeMin", "maxHorizonDays", "cancelLimitHours"]) {
      const res = await call("PATCH", "/business/profile", { [field]: -1 });
      expect(res.status, field).toBe(400);
    }
  });

  it("una cadena vacía borra el campo y un PATCH vacío no cambia nada", async () => {
    await call("PATCH", "/business/profile", { city: "Madrid" });
    expect((await call("PATCH", "/business/profile", {})).body.city).toBe("Madrid");
    expect((await call("PATCH", "/business/profile", { city: "" })).body.city).toBeNull();
  });
});

describe("servicios", () => {
  it("un PATCH no pisa los campos que no se envían", async () => {
    const created = (await call("POST", "/business/services", { ...service, active: false })).body;
    const patched = (await call("PATCH", `/business/services/${created.id}`, { name: "Corte+" }))
      .body;
    expect(patched).toMatchObject({ name: "Corte+", active: false, bufferMin: 10 });
  });

  it("borra el servicio sin reservas y archiva el que ya tiene", async () => {
    const { serviceId, staffId } = await setUpPublishable();
    const unused = (await call("POST", "/business/services", service)).body;
    expect((await call("DELETE", `/business/services/${unused.id}`)).body.archived).toBe(false);

    await call("POST", "/business/bookings", {
      staffId,
      serviceId,
      startsAt: "2030-05-06T10:00:00Z",
      guestName: "Pepe",
    });
    expect((await call("DELETE", `/business/services/${serviceId}`)).body.archived).toBe(true);
    const [row] = await t.db.select().from(services).where(eq(services.id, serviceId));
    expect(row?.active).toBe(false);
  });
});

describe("horarios", () => {
  it("guarda la semana con HH:MM y avisa de franjas solapadas", async () => {
    const { staffId } = await setUpPublishable();
    const res = await call("PUT", `/business/staff/${staffId}/hours`, {
      hours: [
        { weekday: 2, startTime: "09:00", endTime: "14:00" },
        { weekday: 2, startTime: "13:00", endTime: "18:00" },
        { weekday: 3, startTime: "09:00", endTime: "14:00" },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.hours[0]).toEqual({ weekday: 2, startTime: "09:00", endTime: "14:00" });
    expect(res.body.warnings).toEqual(["Las franjas del martes se solapan"]);
  });

  it("rechaza una franja que termina antes de empezar", async () => {
    const { staffId } = await setUpPublishable();
    const res = await call("PUT", `/business/staff/${staffId}/hours`, {
      hours: [{ weekday: 1, startTime: "17:00", endTime: "09:00" }],
    });
    expect(res.status).toBe(400);
  });
});

describe("publicar", () => {
  it("no publica con la lista incompleta y sí cuando se completa", async () => {
    const before = await call("GET", "/business/checklist");
    expect(before.body.ready).toBe(false);
    expect((await call("POST", "/business/publish")).status).toBe(409);

    await setUpPublishable();
    expect((await call("GET", "/business/checklist")).body.ready).toBe(true);
    expect((await call("POST", "/business/publish")).body).toEqual({ status: "published" });
    expect((await call("POST", "/business/unpublish")).body).toEqual({ status: "draft" });
  });

  it("un profesional sin horario no cumple la lista", async () => {
    const { staffId } = await setUpPublishable();
    await call("PUT", `/business/staff/${staffId}/hours`, { hours: [] });
    const items = (await call("GET", "/business/checklist")).body.items;
    expect(items.find((i: { key: string }) => i.key === "hours").ok).toBe(false);
  });

  it("un negocio suspendido no se puede publicar ni despublicar", async () => {
    await setUpPublishable();
    await t.db.update(businesses).set({ status: "suspended" }).where(eq(businesses.id, businessId));
    expect((await call("POST", "/business/publish")).status).toBe(409);
    expect((await call("POST", "/business/unpublish")).status).toBe(409);
  });
});

describe("reserva manual y estados", () => {
  const start = "2030-05-06T10:00:00Z";
  const book = (staffId: string, serviceId: string, startsAt = start) =>
    call("POST", "/business/bookings", { staffId, serviceId, startsAt, guestName: "Pepe" });

  it("crea una reserva confirmada de origen business, con la duración y el buffer", async () => {
    const { serviceId, staffId } = await setUpPublishable();
    expect((await book(staffId, serviceId)).status).toBe(201);
    const [row] = await t.db.select().from(bookings);
    expect(row).toMatchObject({ status: "confirmed", source: "business", guestName: "Pepe" });
    expect(row!.endsAt.getTime() - row!.startsAt.getTime()).toBe(40 * 60_000);
  });

  it("responde 409 si el hueco está ocupado y deja reservar al terminar la anterior", async () => {
    const { serviceId, staffId } = await setUpPublishable();
    await book(staffId, serviceId);
    expect((await book(staffId, serviceId, "2030-05-06T10:20:00Z")).status).toBe(409);
    expect((await book(staffId, serviceId, "2030-05-06T10:40:00Z")).status).toBe(201);
  });

  it("una propuesta caducada no bloquea el hueco", async () => {
    const { serviceId, staffId } = await setUpPublishable();
    await t.db.insert(bookings).values({
      businessId,
      staffId,
      serviceId,
      guestName: "Caducada",
      code: newBookingCode(),
      startsAt: new Date(start),
      endsAt: new Date("2030-05-06T10:40:00Z"),
      status: "pending",
      source: "web",
      expiresAt: new Date("2020-01-01T00:00:00Z"),
    });
    expect((await book(staffId, serviceId)).status).toBe(201);
  });

  it("rechaza un profesional que no hace el servicio", async () => {
    const { serviceId } = await setUpPublishable();
    const other = (await call("POST", "/business/staff", { name: "Luis" })).body;
    expect((await book(other.id, serviceId)).status).toBe(400);
  });

  it("cancela, libera el hueco y no permite más cambios", async () => {
    const { serviceId, staffId } = await setUpPublishable();
    const id = (await book(staffId, serviceId)).body.id;
    const status = (s: string) => call("POST", `/business/bookings/${id}/status`, { status: s });
    expect((await status("cancelled")).body.status).toBe("cancelled");
    expect((await status("cancelled")).status).toBe(409);
    expect((await book(staffId, serviceId)).status).toBe(201);
  });

  it("completar o no_show exigen que la reserva ya haya empezado", async () => {
    const { serviceId, staffId } = await setUpPublishable();
    const future = (await book(staffId, serviceId)).body.id;
    const res = await call("POST", `/business/bookings/${future}/status`, { status: "completed" });
    expect(res.status).toBe(409);
    await t.db
      .update(bookings)
      .set({ startsAt: new Date("2020-01-01T10:00:00Z"), endsAt: new Date("2020-01-01T10:40:00Z") })
      .where(eq(bookings.id, future));
    const done = await call("POST", `/business/bookings/${future}/status`, { status: "completed" });
    expect(done.body.status).toBe("completed");
  });
});
