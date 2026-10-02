import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withIdempotency } from "./idempotency.ts";
import { createTestApp, userWithSession, type TestContext } from "./test-app.ts";

let t: TestContext;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.close();
});
beforeEach(async () => {
  await t.reset();
});

describe("withIdempotency", () => {
  it("dos peticiones simultáneas con la misma clave ejecutan la acción una sola vez", async () => {
    const { user } = await userWithSession(t.db, "customer", "ana@ejemplo.com");
    let runs = 0;
    const action = async () => {
      runs++;
      await new Promise((r) => setTimeout(r, 50));
      return { status: 201, body: { run: runs } };
    };

    const [a, b] = await Promise.all([
      withIdempotency(t.db, user.id, "clave-1", action),
      withIdempotency(t.db, user.id, "clave-1", action),
    ]);
    expect(runs).toBe(1);
    expect(a).toEqual(b);
  });

  it("la misma clave de otro usuario no devuelve la respuesta ajena", async () => {
    const ana = await userWithSession(t.db, "customer", "ana@ejemplo.com");
    const luis = await userWithSession(t.db, "customer", "luis@ejemplo.com");
    await withIdempotency(t.db, ana.user.id, "k", async () => ({ status: 201, body: "ana" }));
    const res = await withIdempotency(t.db, luis.user.id, "k", async () => ({
      status: 201,
      body: "luis",
    }));
    expect(res.body).toBe("luis");
  });

  it("si la acción falla no se guarda la clave y se puede reintentar", async () => {
    const { user } = await userWithSession(t.db, "customer", "ana@ejemplo.com");
    await expect(
      withIdempotency(t.db, user.id, "k", async () => {
        throw new Error("fallo");
      }),
    ).rejects.toThrow("fallo");
    const res = await withIdempotency(t.db, user.id, "k", async () => ({ status: 201, body: 1 }));
    expect(res.body).toBe(1);
  });
});
