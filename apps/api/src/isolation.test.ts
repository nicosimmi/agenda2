// Suite de aislamiento (SPEC §4, obligatoria). La tabla ROUTES describe el acceso de cada ruta
// y cómo se prueba su aislamiento. El primer test recorre las rutas registradas en la app:
// si alguien añade una ruta sin meterla en la tabla, el CI falla.
import type { UserRole } from "@agendia/shared";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { newBookingCode } from "./db/booking-code.ts";
import { bookings, businessMembers, businesses, categories, services, staff } from "./db/schema.ts";
import { createTestApp, userWithSession, WEB_ORIGIN, type TestContext } from "./test-app.ts";

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
  return { business: business!, staffId: member!.id, serviceId: service!.id };
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
    const [method, path] = route.split(" ") as ["GET" | "POST", string];
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
