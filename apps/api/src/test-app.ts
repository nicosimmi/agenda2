// Utilidades para los tests de la API: app contra agendia_test y usuarios con sesión.
import { hash } from "@node-rs/argon2";
import type { UserRole } from "@agendia/shared";
import type pg from "pg";
import { buildApp, type App } from "./app.ts";
import { createDb, type Db } from "./db/client.ts";
import { users } from "./db/schema.ts";
import { SESSION_COOKIE, createSession } from "./session.ts";
import { prepareTestDatabase, truncateAll } from "./db/test-db.ts";

export const WEB_ORIGIN = "http://localhost:5173";
export const PASSWORD = "contraseña-de-test";

export interface TestContext {
  app: App;
  db: Db;
  pool: pg.Pool;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestContext> {
  const { db, pool } = createDb(await prepareTestDatabase());
  const app = await buildApp(db, { webOrigins: [WEB_ORIGIN], secureCookies: false });
  await app.ready();
  return {
    app,
    db,
    pool,
    reset: () => truncateAll(pool),
    close: async () => {
      await app.close();
      await pool.end();
    },
  };
}

let passwordHash: Promise<string> | undefined;

/** Crea un usuario con sesión abierta y devuelve la cookie para app.inject. */
export async function userWithSession(db: Db, role: UserRole, email: string) {
  passwordHash ??= hash(PASSWORD);
  const [user] = await db
    .insert(users)
    .values({ email, role, name: email.split("@")[0]!, passwordHash: await passwordHash })
    .returning();
  const token = await createSession(db, user!.id);
  return { user: user!, cookies: { [SESSION_COOKIE]: token } };
}
