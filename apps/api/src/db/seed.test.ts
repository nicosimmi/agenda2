import { computeAvailability } from "@agendia/core";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "./schema.ts";
import { seed } from "./seed.ts";
import { prepareTestDatabase } from "./test-db.ts";

let pool: pg.Pool;
let db: ReturnType<typeof drizzle<typeof schema>>;

beforeAll(async () => {
  pool = new pg.Pool({ connectionString: await prepareTestDatabase() });
  db = drizzle({ client: pool, schema });
});

afterAll(async () => {
  await pool.end();
});

describe("seed", () => {
  it("carga limpio dos veces seguidas con el mismo resultado", async () => {
    await seed(db);
    await seed(db);
    const businesses = await db.select().from(schema.businesses);
    expect(businesses.filter((b) => b.status === "published")).toHaveLength(8);
    expect(businesses.filter((b) => b.status === "draft")).toHaveLength(1); // el "malicioso"
    expect(new Set(businesses.map((b) => b.city)).size).toBeGreaterThanOrEqual(4);
  });

  it("los datos sembrados producen huecos con el motor de disponibilidad", async () => {
    const [business] = await db
      .select()
      .from(schema.businesses)
      .where(eq(schema.businesses.slug, "fisio-atlantico"));
    const services = await db
      .select()
      .from(schema.services)
      .where(eq(schema.services.businessId, business!.id));
    const hours = await db
      .select()
      .from(schema.workingHours)
      .where(eq(schema.workingHours.businessId, business!.id));

    const slots = computeAvailability({
      service: services[0]!,
      staffCandidates: [...new Set(hours.map((h) => h.staffId))],
      workingHours: hours.map((h) => ({ ...h })),
      timeOff: [],
      existingBookings: [],
      range: { from: "2026-11-02", to: "2026-11-02" }, // lunes
      now: new Date("2026-10-01T00:00:00Z"),
      businessSettings: business!,
    });
    expect(slots.length).toBeGreaterThan(0);
    // 09:00 en Canarias en noviembre (UTC+0) = 09:00Z
    expect(slots[0]!.startsAt.toISOString()).toBe("2026-11-02T09:00:00.000Z");
  });
});
