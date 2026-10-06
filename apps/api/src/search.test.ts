// Búsqueda de negocios contra Postgres real: tildes, mayúsculas, plurales, erratas leves,
// filtros, paginación y que solo salgan negocios publicados.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { businesses, categories, services } from "./db/schema.ts";
import { createTestApp, type TestContext } from "./test-app.ts";

let t: TestContext;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});

interface Seed {
  name: string;
  category: string;
  city: string;
  description?: string;
  status?: "published" | "draft";
  price?: number;
}

const SEEDS: Seed[] = [
  { name: "Barbería El Califa", category: "barberia", city: "Córdoba", price: 1200 },
  { name: "Peluquería Lola Gil", category: "peluqueria", city: "Sevilla", price: 2500 },
  { name: "Fisio Mezquita", category: "fisioterapia", city: "Córdoba", price: 4000 },
  { name: "Estética Sol y Luna", category: "estetica", city: "Málaga", price: 3000 },
  { name: "Barbería Oculta", category: "barberia", city: "Córdoba", status: "draft" },
];

const CATEGORY_NAMES: Record<string, string> = {
  barberia: "Barbería",
  peluqueria: "Peluquería",
  fisioterapia: "Fisioterapia",
  estetica: "Estética",
};

beforeEach(async () => {
  await t.reset();
  const rows = await t.db
    .insert(categories)
    .values(Object.entries(CATEGORY_NAMES).map(([slug, name]) => ({ slug, name })))
    .returning();
  const categoryId = new Map(rows.map((c) => [c.slug, c.id]));
  for (const s of SEEDS) {
    const [business] = await t.db
      .insert(businesses)
      .values({
        slug: s.name.toLowerCase().replace(/\W+/g, "-"),
        name: s.name,
        categoryId: categoryId.get(s.category)!,
        city: s.city,
        description: s.description ?? "",
        status: s.status ?? "published",
      })
      .returning();
    if (s.price) {
      await t.db.insert(services).values([
        { businessId: business!.id, name: "Básico", durationMin: 30, priceCents: s.price },
        { businessId: business!.id, name: "Premium", durationMin: 60, priceCents: s.price * 2 },
        {
          businessId: business!.id,
          name: "Retirado",
          durationMin: 60,
          priceCents: 1,
          active: false,
        },
      ]);
    }
  }
});

async function search(query: string) {
  const res = await t.app.inject({ url: `/public/businesses?${query}` });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as { items: { name: string; minPriceCents: number | null }[]; total: number };
}
const names = (r: { items: { name: string }[] }) => r.items.map((i) => i.name);

describe("texto libre", () => {
  it("sin texto devuelve los publicados, ordenados por nombre", async () => {
    const r = await search("");
    expect(names(r)).toEqual([
      "Barbería El Califa",
      "Estética Sol y Luna",
      "Fisio Mezquita",
      "Peluquería Lola Gil",
    ]);
    expect(r.total).toBe(4);
  });

  it("no distingue tildes ni mayúsculas", async () => {
    expect(names(await search("q=barberia"))).toEqual(["Barbería El Califa"]);
    expect(names(await search("q=BARBERÍA"))).toEqual(["Barbería El Califa"]);
    expect(names(await search("q=estetica"))).toEqual(["Estética Sol y Luna"]);
  });

  it("entiende plurales (stemming del español)", async () => {
    expect(names(await search("q=peluquerias"))).toContain("Peluquería Lola Gil");
  });

  it("tolera erratas leves en el nombre", async () => {
    expect(names(await search("q=califo"))).toContain("Barbería El Califa");
    expect(names(await search("q=mezqita"))).toContain("Fisio Mezquita");
  });

  it("encuentra por categoría y por ciudad aunque no estén en el nombre", async () => {
    expect(names(await search("q=fisioterapia"))).toEqual(["Fisio Mezquita"]);
    expect(names(await search("q=malaga"))).toEqual(["Estética Sol y Luna"]);
  });

  it("un texto sin coincidencias no devuelve nada", async () => {
    const r = await search("q=zzzzzzzz");
    expect(r.items).toEqual([]);
    expect(r.total).toBe(0);
  });

  it("los caracteres especiales no rompen la consulta", async () => {
    for (const q of ["%25", "_", "'%20OR%201=1", "%22", "a%5Cb"]) {
      const res = await t.app.inject({ url: `/public/businesses?q=${q}` });
      expect(res.statusCode, q).toBe(200);
    }
  });
});

describe("filtros", () => {
  it("por ciudad, sin tildes ni mayúsculas, y los borradores no salen", async () => {
    expect(names(await search("city=cordoba"))).toEqual(["Barbería El Califa", "Fisio Mezquita"]);
    expect(names(await search("city=CÓRDOBA"))).toEqual(["Barbería El Califa", "Fisio Mezquita"]);
  });

  it("por categoría", async () => {
    expect(names(await search("category=peluqueria"))).toEqual(["Peluquería Lola Gil"]);
    expect(names(await search("category=barberia"))).toEqual(["Barbería El Califa"]);
  });

  it("combina texto, ciudad y categoría", async () => {
    expect(names(await search("q=califa&city=cordoba&category=barberia"))).toEqual([
      "Barbería El Califa",
    ]);
    expect(names(await search("q=califa&city=sevilla"))).toEqual([]);
  });
});

describe("resultado", () => {
  it("incluye el precio desde del servicio activo más barato", async () => {
    const r = await search("q=califa");
    expect(r.items[0]?.minPriceCents).toBe(1200); // el servicio retirado (1 céntimo) no cuenta
  });

  it("pagina y devuelve el total", async () => {
    const page1 = await search("pageSize=3&page=1");
    const page2 = await search("pageSize=3&page=2");
    expect(page1.items).toHaveLength(3);
    expect(page2.items).toHaveLength(1);
    expect(page1.total).toBe(4);
    expect(new Set([...names(page1), ...names(page2)]).size).toBe(4);
  });

  it("rechaza parámetros no válidos", async () => {
    for (const q of ["page=0", "pageSize=500", "page=abc"]) {
      const res = await t.app.inject({ url: `/public/businesses?${q}` });
      expect(res.statusCode, q).toBe(400);
    }
  });
});
