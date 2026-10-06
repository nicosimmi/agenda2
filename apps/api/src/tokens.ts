// Tokens de acceso para clientes MCP y agentes. Funcionan como las sesiones (token aleatorio, solo
// se guarda su hash) pero llevan permisos concretos y caducan. Un token solo puede ser de un
// cliente, y no puede crear ni listar tokens: eso exige una sesión de navegador.
import { createHash, randomBytes } from "node:crypto";
import type { TokenScope } from "@agendia/shared";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import { apiTokens, users } from "./db/schema.ts";
import { AppError, notFound } from "./errors.ts";
import type { SessionUser } from "./session.ts";

export const TOKEN_PREFIX = "agt_";
const MAX_ACTIVE_TOKENS = 10;
/** Para no escribir en la base de datos en cada petición, "último uso" se actualiza como mucho cada minuto. */
const TOUCH_EVERY_MS = 60_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const active = (now: Date) => and(isNull(apiTokens.revokedAt), gt(apiTokens.expiresAt, now));

export async function createApiToken(
  db: Db,
  userId: string,
  input: { label: string; scopes: TokenScope[]; ttlMinutes: number },
) {
  await deleteOldTokens(db);
  return db.transaction(async (tx) => {
    // Cerrojo por persona: dos peticiones a la vez no pueden pasar el tope de tokens activos.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"token:" + userId}))`);
    const now = new Date();
    const [{ count } = { count: 0 }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(apiTokens)
      .where(and(eq(apiTokens.userId, userId), active(now)));
    if (count >= MAX_ACTIVE_TOKENS) {
      throw new AppError(
        409,
        "CONFLICT",
        `Ya tienes ${MAX_ACTIVE_TOKENS} tokens activos. Revoca alguno`,
      );
    }
    const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + input.ttlMinutes * 60_000);
    const [row] = await tx
      .insert(apiTokens)
      .values({
        userId,
        tokenHash: hashToken(token),
        label: input.label,
        scopes: input.scopes,
        expiresAt,
      })
      .returning({ id: apiTokens.id });
    // El token en claro solo se devuelve aquí, una vez.
    return { id: row!.id, token, label: input.label, scopes: input.scopes, expiresAt };
  });
}

export interface TokenAuth {
  user: SessionUser;
  scopes: string[];
}

/** Usuario y permisos de un token válido (existe, sin revocar, sin caducar); si no, null. */
export async function findTokenUser(db: Db, token: string): Promise<TokenAuth | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const now = new Date();
  const [row] = await db
    .select({
      id: apiTokens.id,
      scopes: apiTokens.scopes,
      lastUsedAt: apiTokens.lastUsedAt,
      user: { id: users.id, email: users.email, name: users.name, role: users.role },
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .where(and(eq(apiTokens.tokenHash, hashToken(token)), active(now)));
  // Un token solo vale para clientes, aunque la cuenta cambiara de rol después.
  if (!row || row.user.role !== "customer") return null;
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
    await db.update(apiTokens).set({ lastUsedAt: now }).where(eq(apiTokens.id, row.id));
  }
  return { user: row.user, scopes: row.scopes };
}

export function listApiTokens(db: Db, userId: string) {
  return (
    db
      .select({
        id: apiTokens.id,
        label: apiTokens.label,
        scopes: apiTokens.scopes,
        expiresAt: apiTokens.expiresAt,
        revokedAt: apiTokens.revokedAt,
        lastUsedAt: apiTokens.lastUsedAt,
        createdAt: apiTokens.createdAt,
      })
      .from(apiTokens)
      // Se muestran los activos y los caducados o revocados en el último día.
      .where(
        and(
          eq(apiTokens.userId, userId),
          gt(apiTokens.expiresAt, new Date(Date.now() - 24 * 3_600_000)),
        ),
      )
      .orderBy(desc(apiTokens.createdAt))
  );
}

export async function revokeApiToken(db: Db, userId: string, id: string) {
  const rows = await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .returning({ id: apiTokens.id });
  if (!rows.length) throw notFound("Token");
}

// ponytail: sin limpieza periódica; borrar los caducados hace más de 30 días cuando crezca la tabla.
export async function deleteOldTokens(db: Db) {
  await db.delete(apiTokens).where(lt(apiTokens.expiresAt, new Date(Date.now() - 30 * 86_400_000)));
}
