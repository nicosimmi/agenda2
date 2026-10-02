// Base de datos aislada para los tests de integración (agendia_test), migrada al arrancar.
// Requiere `docker compose up -d`. En CI la proporciona un servicio de Postgres.
import pg from "pg";
import { databaseUrl } from "./client.ts";
import { runMigrations } from "./migrate.ts";

const TEST_DB = "agendia_test";

export async function prepareTestDatabase(): Promise<string> {
  const adminUrl = new URL(databaseUrl());
  const testUrl = new URL(adminUrl);
  testUrl.pathname = `/${TEST_DB}`;

  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      TEST_DB,
    ]);
    if (!rowCount) await admin.query(`CREATE DATABASE ${TEST_DB}`);
  } finally {
    await admin.end();
  }

  await runMigrations(testUrl.toString());
  return testUrl.toString();
}

export async function truncateAll(pool: pg.Pool): Promise<void> {
  await pool.query(`
    TRUNCATE users, categories, businesses, business_members, services, staff, staff_services,
      working_hours, time_off, bookings, faq_entries, agent_events, outbox_events,
      idempotency_keys CASCADE`);
}
