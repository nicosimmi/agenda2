// Búsqueda de negocios (SPEC §7, implementación A sobre Postgres). Solo negocios publicados.
// Texto libre: búsqueda de texto completo en español sin tildes (tsvector) + trigramas para
// tolerar erratas en el nombre. Ciudad: subcadena sin tildes ni mayúsculas.
import type { SearchQuery } from "@agendia/shared";
import { and, asc, desc, eq, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import { businesses, categories, services } from "./db/schema.ts";

export interface BusinessSummary {
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  city: string | null;
  addressLine: string | null;
  minPriceCents: number | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Por encima de este valor, el texto buscado se parece lo bastante a una palabra del nombre.
const SIMILARITY = 0.45;

const normalized = (value: SQL | AnyColumn | string) => sql`f_unaccent(lower(${value}))`;

export async function searchBusinesses(db: Db, input: SearchQuery): Promise<Page<BusinessSummary>> {
  const nameNorm = normalized(businesses.name);
  const filters: (SQL | undefined)[] = [eq(businesses.status, "published")];
  let rank: SQL | undefined;

  if (input.q) {
    const q = normalized(input.q);
    const tsquery = sql`websearch_to_tsquery('spanish', f_unaccent(${input.q}))`;
    const similarity = sql`word_similarity(${q}, ${nameNorm})`;
    filters.push(
      sql`(${businesses.searchVector} @@ ${tsquery}
        OR ${similarity} > ${SIMILARITY}
        OR strpos(${nameNorm}, ${q}) > 0)`,
    );
    rank = sql`(ts_rank(${businesses.searchVector}, ${tsquery}) + ${similarity})`;
  }
  if (input.city) {
    filters.push(sql`strpos(${normalized(businesses.city)}, ${normalized(input.city)}) > 0`);
  }
  if (input.category) filters.push(eq(categories.slug, input.category));
  const where = and(...filters);

  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(businesses)
    .innerJoin(categories, eq(categories.id, businesses.categoryId))
    .where(where);

  const items = await db
    .select({
      slug: businesses.slug,
      name: businesses.name,
      description: sql<string>`left(${businesses.description}, 180)`,
      categorySlug: categories.slug,
      categoryName: categories.name,
      city: businesses.city,
      addressLine: businesses.addressLine,
      minPriceCents: sql<
        number | null
      >`(SELECT min(${services.priceCents}) FROM ${services} WHERE ${services.businessId} = ${businesses.id} AND ${services.active})`,
    })
    .from(businesses)
    .innerJoin(categories, eq(categories.id, businesses.categoryId))
    .where(where)
    .orderBy(...(rank ? [desc(rank)] : []), asc(businesses.name))
    .limit(input.pageSize)
    .offset((input.page - 1) * input.pageSize);

  return { items, total: counted?.total ?? 0, page: input.page, pageSize: input.pageSize };
}
