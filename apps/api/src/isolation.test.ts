// Suite de aislamiento (SPEC §4, obligatoria). La tabla ROUTES describe el acceso de cada ruta
// y cómo se prueba su aislamiento. El primer test recorre las rutas registradas en la app:
// si alguien añade una ruta sin meterla en la tabla, el CI falla.
import type { UserRole } from "@agendia/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { newBookingCode } from "./db/booking-code.ts";

import {
  bookings,
  businessMembers,
  businesses,
  categories,
  services,
  staff,
  staffServices,
  timeOff,
} from "./db/schema.ts";
import { createTestApp, userWithSession, WEB_ORIGIN, type TestContext } from "./test-app.ts";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Access = "public" | "authenticated" | UserRole;
type Cookies = Record<string, string>;

interface Fixture {
  ownerA: Cookies;
  ownerB: Cookies;
  customer1: Cookies;
  customer2: Cookies;
  admin: Cookies;
  businessA: { id: string; name: string };
  businessB: { id: string; name: string };
  /** Reservas de customer1 en A (una fuera de RANGE) y de customer2 en B. */
  bookingA: string;
  bookingALater: string;
  bookingB: string;
  /** Profesional, servicio y ausencia de cada negocio. */
  staffA: string;
  staffB: string;
  serviceA: string;
  serviceB: string;
  timeOffA: string;
  timeOffB: string;
}

interface RouteSpec {
  access: Access;
  /** URL de ejemplo con los parámetros rellenos (para la matriz de roles). */
  sample?: (f: Fixture) => string;
  /** Obligatorio en toda ruta con sesión salvo las de administrador: prueba que no se ve nada ajeno. */
  isolation?: (f: Fixture) => Promise<void>;
}

const RANGE = "from=2030-01-01T00:00:00Z&to=2030-01-31T00:00:00Z";

const ROUTES: Record<string, RouteSpec> = {
  "GET /health": { access: "public" },
  "OPTIONS *": { access: "public" }, // preflight de CORS
  "POST /auth/register": { access: "public" },
  "POST /auth/login": { access: "public" },
  "POST /auth/logout": { access: "public" },
  "GET /auth/me": {
    access: "authenticated",
    isolation: async (f) => {
      expect((await get("/auth/me", f.customer1)).email).toBe("c1@cliente.test");
      expect((await get("/auth/me", f.ownerB)).email).toBe("b@negocio.test");
    },
  },

  "GET /me/bookings": {
    access: "customer",
    isolation: async (f) => {
      const res = await get("/me/bookings", f.customer1);
      expect(res.map((b: { id: string }) => b.id)).toEqual([f.bookingALater, f.bookingA]);
    },
  },

  "GET /business/profile": {
    access: "business_owner",
    isolation: async (f) => {
      expect((await get("/business/profile", f.ownerA)).id).toBe(f.businessA.id);
      expect((await get("/business/profile", f.ownerB)).id).toBe(f.businessB.id);
      // Un business_id en la URL se ignora: el negocio sale de la sesión.
      const forged = await get(`/business/profile?businessId=${f.businessB.id}`, f.ownerA);
      expect(forged.id).toBe(f.businessA.id);
    },
  },
  "GET /business/bookings": {
    access: "business_owner",
    sample: () => `/business/bookings?${RANGE}`,
    isolation: async (f) => {
      const a = await get(`/business/bookings?${RANGE}&businessId=${f.businessB.id}`, f.ownerA);
      expect(a.map((b: { id: string }) => b.id)).toEqual([f.bookingA]);
      const b = await get(`/business/bookings?${RANGE}`, f.ownerB);
      expect(b.map((x: { id: string }) => x.id)).toEqual([f.bookingB]);
    },
  },

  "PATCH /business/profile": {
    access: "business_owner",
    isolation: async (f) => {
      // Un businessId en el cuerpo se ignora: solo cambia el negocio de la sesión.
      const res = await send("PATCH", "/business/profile", f.ownerA, {
        name: "Nombre nuevo",
        businessId: f.businessB.id,
      });
      expect(res.json().name).toBe("Nombre nuevo");
      expect((await businessRow(f.businessB.id)).name).toBe(f.businessB.name);
    },
  },
  "GET /business/checklist": {
    access: "business_owner",
    isolation: async (f) => {
      await send("PATCH", "/business/profile", f.ownerA, {
        addressLine: "Calle 1",
        city: "Madrid",
      });
      const address = async (c: Cookies) =>
        (await get("/business/checklist", c)).items.find(
          (i: { key: string }) => i.key === "address",
        ).ok;
      expect(await address(f.ownerA)).toBe(true);
      expect(await address(f.ownerB)).toBe(false);
    },
  },
  "POST /business/publish": {
    access: "business_owner",
    isolation: async (f) => {
      await t.db
        .update(businesses)
        .set({ status: "draft" })
        .where(eq(businesses.id, f.businessA.id));
      // A no cumple la lista (sin dirección) y B ya está publicado: ninguno cambia.
      expect((await send("POST", "/business/publish", f.ownerA)).statusCode).toBe(409);
      expect((await businessRow(f.businessB.id)).status).toBe("published");
    },
  },
  "POST /business/unpublish": {
    access: "business_owner",
    isolation: async (f) => {
      await send("POST", "/business/unpublish", f.ownerA);
      expect((await businessRow(f.businessA.id)).status).toBe("draft");
      expect((await businessRow(f.businessB.id)).status).toBe("published");
    },
  },

  "GET /business/services": {
    access: "business_owner",
    isolation: async (f) => {
      expect(ids(await get("/business/services", f.ownerA))).toEqual([f.serviceA]);
      expect(ids(await get("/business/services", f.ownerB))).toEqual([f.serviceB]);
    },
  },
  "POST /business/services": {
    access: "business_owner",
    isolation: async (f) => {
      const body = { name: "Tinte", durationMin: 60, priceCents: 3000, businessId: f.businessB.id };
      expect((await send("POST", "/business/services", f.ownerA, body)).statusCode).toBe(201);
      expect(await get("/business/services", f.ownerA)).toHaveLength(2);
      expect(await get("/business/services", f.ownerB)).toHaveLength(1);
    },
  },
  "PATCH /business/services/:id": {
    access: "business_owner",
    sample: (f) => `/business/services/${f.serviceB}`,
    isolation: async (f) => {
      const res = await send("PATCH", `/business/services/${f.serviceB}`, f.ownerA, { name: "X" });
      expect(res.statusCode).toBe(404);
      expect((await get("/business/services", f.ownerB))[0].name).toBe("Corte");
    },
  },
  "DELETE /business/services/:id": {
    access: "business_owner",
    sample: (f) => `/business/services/${f.serviceB}`,
    isolation: async (f) => {
      const res = await send("DELETE", `/business/services/${f.serviceB}`, f.ownerA);
      expect(res.statusCode).toBe(404);
      expect(await get("/business/services", f.ownerB)).toHaveLength(1);
    },
  },

  "GET /business/staff": {
    access: "business_owner",
    isolation: async (f) => {
      expect(ids(await get("/business/staff", f.ownerA))).toEqual([f.staffA]);
      expect(ids(await get("/business/staff", f.ownerB))).toEqual([f.staffB]);
    },
  },
  "POST /business/staff": {
    access: "business_owner",
    isolation: async (f) => {
      // No se puede asignar un servicio de otro negocio.
      const bad = { name: "Luis", serviceIds: [f.serviceB] };
      expect((await send("POST", "/business/staff", f.ownerA, bad)).statusCode).toBe(400);
      const ok = { name: "Luis", serviceIds: [f.serviceA] };
      expect((await send("POST", "/business/staff", f.ownerA, ok)).statusCode).toBe(201);
      expect(await get("/business/staff", f.ownerB)).toHaveLength(1);
    },
  },
  "PATCH /business/staff/:id": {
    access: "business_owner",
    sample: (f) => `/business/staff/${f.staffB}`,
    isolation: async (f) => {
      const res = await send("PATCH", `/business/staff/${f.staffB}`, f.ownerA, { name: "X" });
      expect(res.statusCode).toBe(404);
      expect((await get("/business/staff", f.ownerB))[0].name).toBe("Ana");
    },
  },
  "DELETE /business/staff/:id": {
    access: "business_owner",
    sample: (f) => `/business/staff/${f.staffB}`,
    isolation: async (f) => {
      expect((await send("DELETE", `/business/staff/${f.staffB}`, f.ownerA)).statusCode).toBe(404);
      expect(await get("/business/staff", f.ownerB)).toHaveLength(1);
    },
  },
  "GET /business/staff/:id/hours": {
    access: "business_owner",
    sample: (f) => `/business/staff/${f.staffB}/hours`,
    isolation: async (f) => {
      expect((await send("GET", `/business/staff/${f.staffB}/hours`, f.ownerA)).statusCode).toBe(
        404,
      );
      expect((await get(`/business/staff/${f.staffA}/hours`, f.ownerA)).hours).toEqual([]);
    },
  },
  "PUT /business/staff/:id/hours": {
    access: "business_owner",
    sample: (f) => `/business/staff/${f.staffB}/hours`,
    isolation: async (f) => {
      const body = { hours: [{ weekday: 1, startTime: "09:00", endTime: "17:00" }] };
      const res = await send("PUT", `/business/staff/${f.staffB}/hours`, f.ownerA, body);
      expect(res.statusCode).toBe(404);
      expect((await get(`/business/staff/${f.staffB}/hours`, f.ownerB)).hours).toEqual([]);
    },
  },

  "GET /business/time-off": {
    access: "business_owner",
    isolation: async (f) => {
      expect(ids(await get("/business/time-off", f.ownerA))).toEqual([f.timeOffA]);
      expect(ids(await get("/business/time-off", f.ownerB))).toEqual([f.timeOffB]);
    },
  },
  "POST /business/time-off": {
    access: "business_owner",
    isolation: async (f) => {
      const range = { startsAt: "2030-03-01T00:00:00Z", endsAt: "2030-03-02T00:00:00Z" };
      // Una ausencia de un profesional ajeno se rechaza.
      const bad = await send("POST", "/business/time-off", f.ownerA, {
        ...range,
        staffId: f.staffB,
      });
      expect(bad.statusCode).toBe(404);
      const ok = await send("POST", "/business/time-off", f.ownerA, {
        ...range,
        staffId: f.staffA,
      });
      expect(ok.statusCode).toBe(201);
      expect(await get("/business/time-off", f.ownerB)).toHaveLength(1);
    },
  },
  "DELETE /business/time-off/:id": {
    access: "business_owner",
    sample: (f) => `/business/time-off/${f.timeOffB}`,
    isolation: async (f) => {
      expect((await send("DELETE", `/business/time-off/${f.timeOffB}`, f.ownerA)).statusCode).toBe(
        404,
      );
      expect(await get("/business/time-off", f.ownerB)).toHaveLength(1);
    },
  },

  "POST /business/bookings": {
    access: "business_owner",
    isolation: async (f) => {
      const base = { guestName: "Pepe", startsAt: "2030-05-06T10:00:00Z" };
      // Profesional o servicio de otro negocio: para A no existen.
      const withStaffB = { ...base, staffId: f.staffB, serviceId: f.serviceA };
      expect((await send("POST", "/business/bookings", f.ownerA, withStaffB)).statusCode).toBe(400);
      const withServiceB = { ...base, staffId: f.staffA, serviceId: f.serviceB };
      expect((await send("POST", "/business/bookings", f.ownerA, withServiceB)).statusCode).toBe(
        404,
      );
      const own = { ...base, staffId: f.staffA, serviceId: f.serviceA };
      expect((await send("POST", "/business/bookings", f.ownerA, own)).statusCode).toBe(201);
      const may = "from=2030-05-01T00:00:00Z&to=2030-05-31T00:00:00Z";
      expect(await get(`/business/bookings?${may}`, f.ownerB)).toEqual([]);
    },
  },
  "POST /business/bookings/:id/status": {
    access: "business_owner",
    sample: (f) => `/business/bookings/${f.bookingB}/status`,
    isolation: async (f) => {
      const res = await send("POST", `/business/bookings/${f.bookingB}/status`, f.ownerA, {
        status: "cancelled",
      });
      expect(res.statusCode).toBe(404);
      const [row] = await t.db.select().from(bookings).where(eq(bookings.id, f.bookingB));
      expect(row?.status).toBe("confirmed");
    },
  },

  "POST /admin/businesses/:id/suspend": {
    access: "platform_admin",
    sample: (f) => `/admin/businesses/${f.businessB.id}/suspend`,
  },
};

let t: TestContext;
let f: Fixture;

async function get(url: string, cookies: Cookies) {
  const res = await t.app.inject({ url, cookies });
  expect(res.statusCode, `${url}: ${res.body}`).toBe(200);
  return res.json();
}

async function send(method: Method, url: string, cookies: Cookies, payload?: object) {
  return t.app.inject({
    method,
    url,
    cookies,
    headers: { origin: WEB_ORIGIN },
    ...(payload && { payload }),
  });
}

const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

async function businessRow(id: string) {
  const [row] = await t.db.select().from(businesses).where(eq(businesses.id, id));
  return row!;
}

async function createBusiness(slug: string, categoryId: string) {
  const [business] = await t.db
    .insert(businesses)
    .values({ slug, name: `Negocio ${slug}`, categoryId, status: "published" })
    .returning();
  const [member] = await t.db
    .insert(staff)
    .values({ businessId: business!.id, name: "Ana" })
    .returning();
  const [service] = await t.db
    .insert(services)
    .values({ businessId: business!.id, name: "Corte", durationMin: 30, priceCents: 1500 })
    .returning();
  await t.db
    .insert(staffServices)
    .values({ businessId: business!.id, staffId: member!.id, serviceId: service!.id });
  const [off] = await t.db
    .insert(timeOff)
    .values({
      businessId: business!.id,
      staffId: null,
      startsAt: new Date("2030-02-01T00:00:00Z"),
      endsAt: new Date("2030-02-02T00:00:00Z"),
    })
    .returning();
  return { business: business!, staffId: member!.id, serviceId: service!.id, timeOffId: off!.id };
}

async function createBooking(
  b: Awaited<ReturnType<typeof createBusiness>>,
  customerId: string | null,
  startsAt: string,
) {
  const start = new Date(startsAt);
  const [row] = await t.db
    .insert(bookings)
    .values({
      businessId: b.business.id,
      staffId: b.staffId,
      serviceId: b.serviceId,
      customerId,
      guestName: customerId ? null : "Invitado",
      code: newBookingCode(),
      startsAt: start,
      endsAt: new Date(start.getTime() + 30 * 60_000),
      status: "confirmed",
      source: customerId ? "web" : "business",
    })
    .returning();
  return row!.id;
}

async function createFixture(): Promise<Fixture> {
  const [category] = await t.db
    .insert(categories)
    .values({ slug: "barberia", name: "Barbería" })
    .returning();
  const a = await createBusiness("negocio-a", category!.id);
  const b = await createBusiness("negocio-b", category!.id);

  const ownerA = await userWithSession(t.db, "business_owner", "a@negocio.test");
  const ownerB = await userWithSession(t.db, "business_owner", "b@negocio.test");
  await t.db.insert(businessMembers).values([
    { userId: ownerA.user.id, businessId: a.business.id },
    { userId: ownerB.user.id, businessId: b.business.id },
  ]);
  const customer1 = await userWithSession(t.db, "customer", "c1@cliente.test");
  const customer2 = await userWithSession(t.db, "customer", "c2@cliente.test");
  const admin = await userWithSession(t.db, "platform_admin", "admin@agendia.test");

  const bookingA = await createBooking(a, customer1.user.id, "2030-01-10T10:00:00Z");
  const bookingB = await createBooking(b, customer2.user.id, "2030-01-10T10:00:00Z");
  // Reserva de customer1 fuera del rango: no debe aparecer en el panel de A.
  const bookingALater = await createBooking(a, customer1.user.id, "2030-03-10T10:00:00Z");

  return {
    ownerA: ownerA.cookies,
    ownerB: ownerB.cookies,
    customer1: customer1.cookies,
    customer2: customer2.cookies,
    admin: admin.cookies,
    businessA: a.business,
    businessB: b.business,
    bookingA,
    bookingALater,
    bookingB,
    staffA: a.staffId,
    staffB: b.staffId,
    serviceA: a.serviceId,
    serviceB: b.serviceId,
    timeOffA: a.timeOffId,
    timeOffB: b.timeOffId,
  };
}

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});
beforeEach(async () => {
  await t.reset();
  f = await createFixture();
});

describe("tabla de rutas", () => {
  it("toda ruta registrada está en la tabla, y viceversa", () => {
    expect([...t.app.routeList].sort()).toEqual(Object.keys(ROUTES).sort());
  });

  it("toda ruta con sesión (salvo las de administrador) tiene su test de aislamiento", () => {
    const missing = Object.entries(ROUTES)
      .filter(([, s]) => s.access !== "public" && s.access !== "platform_admin" && !s.isolation)
      .map(([route]) => route);
    expect(missing).toEqual([]);
  });
});

const ROLE_SESSIONS: [UserRole, (f: Fixture) => Cookies][] = [
  ["customer", (f) => f.customer1],
  ["business_owner", (f) => f.ownerA],
  ["platform_admin", (f) => f.admin],
];

describe.each(Object.entries(ROUTES).filter(([, s]) => s.access !== "public"))(
  "%s",
  (route, spec) => {
    const [method, path] = route.split(" ") as [Method, string];
    const call = (cookies?: Cookies) =>
      t.app.inject({
        method,
        url: spec.sample?.(f) ?? path,
        headers: { origin: WEB_ORIGIN },
        ...(cookies && { cookies }),
      });

    it("sin sesión → 401", async () => {
      expect((await call()).statusCode).toBe(401);
    });

    if (spec.access !== "authenticated") {
      it.each(ROLE_SESSIONS.filter(([role]) => role !== spec.access))(
        "con rol %s → 403",
        async (_role, cookiesOf) => {
          const res = await call(cookiesOf(f));
          expect(res.statusCode).toBe(403);
          expect(res.json().error.code).toBe("FORBIDDEN");
        },
      );
    }

    if (spec.isolation) {
      it("no expone datos de otro negocio ni de otro cliente", async () => {
        await spec.isolation!(f);
      });
    }
  },
);

describe("roles", () => {
  it("un propietario sin negocio asociado no entra en el panel", async () => {
    const orphan = await userWithSession(t.db, "business_owner", "sin@negocio.test");
    const res = await t.app.inject({ url: "/business/profile", cookies: orphan.cookies });
    expect(res.statusCode).toBe(403);
  });

  it("el administrador suspende un negocio", async () => {
    const res = await t.app.inject({
      method: "POST",
      url: `/admin/businesses/${f.businessB.id}/suspend`,
      cookies: f.admin,
      headers: { origin: WEB_ORIGIN },
    });
    expect(res.json()).toEqual({ id: f.businessB.id, status: "suspended" });
    const [b] = await t.db.select().from(businesses).where(eq(businesses.id, f.businessB.id));
    expect(b?.status).toBe("suspended");
  });
});
