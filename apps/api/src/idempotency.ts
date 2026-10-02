// Idempotencia: si el cliente repite una petición con la misma cabecera Idempotency-Key
// (por ejemplo, tras un corte de red), recibe la respuesta guardada en vez de crear otra reserva.
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import { idempotencyKeys } from "./db/schema.ts";

export interface StoredResponse {
  status: number;
  body: unknown;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Ejecuta `run` una sola vez por (usuario, clave). Un cerrojo de transacción (advisory lock)
 * serializa dos peticiones simultáneas con la misma clave: la segunda espera y lee la respuesta.
 * `run` recibe la transacción para que su escritura y la clave se guarden juntas o ninguna.
 */
// ponytail: las claves no caducan; añadir limpieza (> 24 h) cuando la tabla crezca.
export async function withIdempotency(
  db: Db,
  userId: string,
  key: string,
  run: (tx: Tx) => Promise<StoredResponse>,
): Promise<StoredResponse> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId + ":" + key}))`);
    const [existing] = await tx
      .select({ response: idempotencyKeys.response })
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)));
    if (existing) return existing.response as StoredResponse;

    const response = await run(tx);
    await tx.insert(idempotencyKeys).values({ userId, key, response });
    return response;
  });
}
