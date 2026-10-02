// Tests de integración contra Postgres real: demuestran que las reglas críticas
// las impone la base de datos, no solo el código de la aplicación.
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { pgErrorCode } from "../errors.ts";
import { newBookingCode } from "./booking-code.ts";
import * as schema from "./schema.ts";
import { prepareTestDatabase, truncateAll } from "./test-db.ts";

let pool: pg.Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: await prepareTestDatabase() });
  db = drizzle({ client: pool, schema });
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await truncateAll(pool);
});

/** Crea un negocio con un profesional y un servicio de 30 min. */
async function createBusiness(
  slug: string,
  overrides: Partial<typeof schema.businesses.$inferInsert> = {},
) {
  const [category] = await db
    .insert(schema.categories)
    .values({ slug: `cat-${slug}`, name: "Fisioterapia" })
    .returning();
  const [business] = await db
    .insert(schema.businesses)
    .values({ slug, name: `Negocio ${slug}`, categoryId: category!.id, ...overrides })
    .returning();
  const [member] = await db
    .insert(schema.staff)
    .values({ businessId: business!.id, name: "Ana" })
    .returning();
  const [service] = await db
    .insert(schema.services)
    .values({ businessId: business!.id, name: "Sesión", durationMin: 30, priceCents: 3000 })
    .returning();
  return { business: business!, staff: member!, service: service! };
}

function booking(
  b: Awaited<ReturnType<typeof createBusiness>>,
  startsAt: string,
  endsAt: string,
): typeof schema.bookings.$inferInsert {
  return {
    businessId: b.business.id,
    staffId: b.staff.id,
    serviceId: b.service.id,
    code: newBookingCode(),
    guestName: "Cliente de prueba",
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    status: "confirmed",
    source: "business",
  };
}

describe("restricción de exclusión (sin solapamientos por profesional)", () => {
  it("de dos reservas concurrentes del mismo hueco, solo una entra (23P01)", async () => {
    const b = await createBusiness("fisio");
    const slot = booking(b, "2026-11-02T09:00:00Z", "2026-11-02T09:30:00Z");

    // Dos conexiones distintas, cada una en su transacción, insertando a la vez.
    const attempt = async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO bookings (business_id, staff_id, service_id, code, guest_name, starts_at, ends_at, status, source)
           VALUES ($1, $2, $3, $4, 'Concurrente', $5, $6, 'pending', 'web')`,
          [
            slot.businessId,
            slot.staffId,
            slot.serviceId,
            newBookingCode(),
            slot.startsAt,
            slot.endsAt,
          ],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    };

    const results = await Promise.allSettled([attempt(), attempt()]);
    const rejected = results.filter((r) => r.status === "rejected");
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(pgErrorCode(rejected[0]!.reason)).toBe("23P01");
  });

  it("permite reservas pegadas (el final de una es el inicio de otra)", async () => {
    const b = await createBusiness("fisio");
    await db
      .insert(schema.bookings)
      .values(booking(b, "2026-11-02T09:00:00Z", "2026-11-02T09:30:00Z"));
    await expect(
      db.insert(schema.bookings).values(booking(b, "2026-11-02T09:30:00Z", "2026-11-02T10:00:00Z")),
    ).resolves.toBeDefined();
  });

  it("una reserva cancelada no bloquea el hueco", async () => {
    const b = await createBusiness("fisio");
    await db.insert(schema.bookings).values({
      ...booking(b, "2026-11-02T09:00:00Z", "2026-11-02T09:30:00Z"),
      status: "cancelled",
    });
    await expect(
      db.insert(schema.bookings).values(booking(b, "2026-11-02T09:00:00Z", "2026-11-02T09:30:00Z")),
    ).resolves.toBeDefined();
  });
});

describe("claves foráneas compuestas (aislamiento entre negocios)", () => {
  it("una reserva no puede mezclar el profesional de un negocio con el servicio de otro", async () => {
    const a = await createBusiness("negocio-a");
    const b = await createBusiness("negocio-b");
    const mixed = {
      ...booking(a, "2026-11-02T09:00:00Z", "2026-11-02T09:30:00Z"),
      serviceId: b.service.id,
    };
    const error = await db
      .insert(schema.bookings)
      .values(mixed)
      .catch((e: unknown) => e);
    expect(pgErrorCode(error)).toBe("23503");
  });

  it("no se puede asignar a un profesional un servicio de otro negocio", async () => {
    const a = await createBusiness("negocio-a");
    const b = await createBusiness("negocio-b");
    const error = await db
      .insert(schema.staffServices)
      .values({ businessId: a.business.id, staffId: a.staff.id, serviceId: b.service.id })
      .catch((e: unknown) => e);
    expect(pgErrorCode(error)).toBe("23503");
  });

  it("rechaza una reserva que termina antes de empezar", async () => {
    const b = await createBusiness("fisio");
    const error = await db
      .insert(schema.bookings)
      .values(booking(b, "2026-11-02T10:00:00Z", "2026-11-02T09:00:00Z"))
      .catch((e: unknown) => e);
    expect(pgErrorCode(error)).toBe("23514");
  });
});

describe("búsqueda", () => {
  it("el trigger rellena search_vector sin tildes y con la categoría", async () => {
    const { business } = await createBusiness("fisio-cordoba", {
      name: "Fisioterapia Mezquita",
      city: "Córdoba",
    });
    const match = (q: string) =>
      db
        .select({ id: schema.businesses.id })
        .from(schema.businesses)
        .where(sql`search_vector @@ websearch_to_tsquery('spanish', f_unaccent(${q}))`);

    expect(await match("cordoba")).toEqual([{ id: business.id }]);
    expect(await match("fisioterapia")).toEqual([{ id: business.id }]);
    expect(await match("peluquería")).toEqual([]);

    await db
      .update(schema.businesses)
      .set({ city: "Sevilla" })
      .where(eq(schema.businesses.id, business.id));
    expect(await match("cordoba")).toEqual([]);
  });

  it("pg_trgm tolera erratas leves en el nombre", async () => {
    const { business } = await createBusiness("barberia", { name: "Barbería El Tijeras" });
    const rows = await db
      .select({ id: schema.businesses.id })
      .from(schema.businesses)
      .where(sql`f_unaccent(lower(name)) % f_unaccent(lower(${"barberia el tijera"}))`);
    expect(rows).toEqual([{ id: business.id }]);
  });
});
