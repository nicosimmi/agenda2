import { buildApp } from "./app.ts";
import { agentConfigFromEnv } from "./agent/config.ts";
import { createDb } from "./db/client.ts";
import { startOutboxWorker } from "./outbox.ts";

const list = (value = "") =>
  value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const { db } = createDb();
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
if (Boolean(GOOGLE_CLIENT_ID) !== Boolean(GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI)) {
  throw new Error(
    "El acceso con Google necesita GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REDIRECT_URI",
  );
}
const app = await buildApp(db, {
  webOrigins: list(process.env.WEB_ORIGIN ?? "http://localhost:5173"),
  trustedProxies: list(process.env.TRUSTED_PROXIES),
  secureCookies: process.env.NODE_ENV === "production",
  agent: agentConfigFromEnv(process.env),
  automationSecret: process.env.AUTOMATION_SECRET,
  google: GOOGLE_CLIENT_ID
    ? {
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET!,
        redirectUri: GOOGLE_REDIRECT_URI!,
      }
    : undefined,
});

// Entrega de avisos a n8n. Sin N8N_WEBHOOK_BASE no se entrega nada: los eventos se acumulan en
// el outbox y salen cuando se configure.
const { N8N_WEBHOOK_BASE, AUTOMATION_SECRET } = process.env;
if (N8N_WEBHOOK_BASE) {
  if (!AUTOMATION_SECRET) throw new Error("N8N_WEBHOOK_BASE necesita AUTOMATION_SECRET");
  const stop = startOutboxWorker(
    db,
    { baseUrl: N8N_WEBHOOK_BASE, secret: AUTOMATION_SECRET },
    (message) => app.log.info(message),
  );
  app.addHook("onClose", async () => stop());
}
await app.listen({
  host: process.env.API_HOST ?? "127.0.0.1",
  port: Number(process.env.API_PORT ?? 3000),
});
