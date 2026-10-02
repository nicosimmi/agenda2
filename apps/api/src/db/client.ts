import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

export function databaseUrl(): string {
  const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_PORT } = process.env;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB) {
    throw new Error("Falta DATABASE_URL o las variables POSTGRES_* (copia .env.example a .env)");
  }
  return `postgres://${POSTGRES_USER}:${encodeURIComponent(POSTGRES_PASSWORD)}@localhost:${POSTGRES_PORT ?? 5433}/${POSTGRES_DB}`;
}

export function createDb(url = databaseUrl()) {
  const pool = new pg.Pool({ connectionString: url });
  return { db: drizzle({ client: pool, schema }), pool };
}

export type Db = ReturnType<typeof createDb>["db"];
