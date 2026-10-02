import { buildApp } from "./app.ts";
import { createDb } from "./db/client.ts";

const list = (value = "") =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const { db } = createDb();
const app = await buildApp(db, {
  webOrigins: list(process.env.WEB_ORIGIN ?? "http://localhost:5173"),
  trustedProxies: list(process.env.TRUSTED_PROXIES),
  secureCookies: process.env.NODE_ENV === "production",
});
await app.listen({
  host: process.env.API_HOST ?? "127.0.0.1",
  port: Number(process.env.API_PORT ?? 3000),
});
