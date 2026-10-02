import { buildApp } from "./app.ts";
import { createDb } from "./db/client.ts";

const { db } = createDb();
const app = await buildApp(db, {
  webOrigins: (process.env.WEB_ORIGIN ?? "http://localhost:5173").split(","),
  secureCookies: process.env.NODE_ENV === "production",
});
await app.listen({
  host: process.env.API_HOST ?? "127.0.0.1",
  port: Number(process.env.API_PORT ?? 3000),
});
