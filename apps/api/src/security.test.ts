import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { productionProblems } from "./security.ts";
import { createTestApp, type TestContext } from "./test-app.ts";

const good = {
  WEB_ORIGIN: "https://agendia.example",
  TRUSTED_PROXIES: "10.0.0.0/8",
  AUTOMATION_SECRET: "a".repeat(40),
  POSTGRES_PASSWORD: "una-clave-larga-y-unica-123",
};

describe("entorno de producción", () => {
  it("acepta una configuración correcta", () => {
    expect(productionProblems(good)).toEqual([]);
  });
  it("rechaza http, falta de proxy, secretos cortos, clave de ejemplo y proveedor demo", () => {
    const bad = {
      WEB_ORIGIN: "http://agendia.example",
      AUTOMATION_SECRET: "corto",
      POSTGRES_PASSWORD: "cambia-esto-en-local",
      LLM_PROVIDER: "demo",
    };
    expect(productionProblems(bad)).toHaveLength(5);
  });
});

describe("HTTPS forzado", () => {
  let t: TestContext;
  beforeAll(async () => {
    t = await createTestApp({ forceHttps: true, trustedProxies: ["127.0.0.1"] });
  });
  afterAll(() => t.close());

  it("rechaza HTTP plano, acepta X-Forwarded-Proto https y deja pasar /health", async () => {
    const plain = await t.app.inject({ url: "/public/categories" });
    const secure = await t.app.inject({
      url: "/public/categories",
      headers: { "x-forwarded-proto": "https" },
    });
    const health = await t.app.inject({ url: "/health" });
    expect(plain.statusCode).toBe(400);
    expect(secure.statusCode).toBe(200);
    expect(health.statusCode).toBe(200);
    expect(secure.headers["strict-transport-security"]).toMatch(/max-age=31536000/);
  });
});
