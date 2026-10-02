// Sesiones propias: un token aleatorio en una cookie HttpOnly y su hash SHA-256 en la tabla sessions.
// Cerrar sesión borra la fila, así que la sesión se invalida al momento (con un JWT no se podría).
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import { sessions, users } from "./db/schema.ts";

export const SESSION_COOKIE = "sid";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionUser = Pick<typeof users.$inferSelect, "id" | "email" | "name" | "role">;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Crea una sesión y devuelve el token en claro (solo viaja en la cookie). */
export async function createSession(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return token;
}

export async function findSessionUser(db: Db, token: string): Promise<SessionUser | null> {
  const [row] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
  return row ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}
