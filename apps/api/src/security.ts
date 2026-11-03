// Registro de eventos sospechosos (CSRF, tokens malos, logins fallidos, límites superados).
// Salen como líneas de log con `security` para poder filtrarlas: nunca incluyen contraseñas ni tokens.
import type { FastifyRequest } from "fastify";

export function securityEvent(req: FastifyRequest, event: string, extra: object = {}) {
  req.log.warn({ security: event, ip: req.ip, method: req.method, url: req.url, ...extra }, event);
}

/** Qué falta o sobra en el entorno para arrancar en producción; vacío si está bien. */
export function productionProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  const origins = (env.WEB_ORIGIN ?? "").split(",").filter(Boolean);
  if (origins.length === 0 || origins.some((o) => !o.trim().startsWith("https://"))) {
    problems.push("WEB_ORIGIN debe ser una o varias URL https://");
  }
  if (!env.TRUSTED_PROXIES?.trim()) {
    problems.push("TRUSTED_PROXIES es obligatorio (el proxy que termina HTTPS)");
  }
  if (env.AUTOMATION_SECRET !== undefined && env.AUTOMATION_SECRET !== "") {
    if (env.AUTOMATION_SECRET.length < 32) problems.push("AUTOMATION_SECRET: mínimo 32 caracteres");
  }
  if (!env.DATABASE_URL) {
    const pass = env.POSTGRES_PASSWORD ?? "";
    if (pass.length < 16 || pass.includes("cambia-esto")) {
      problems.push("POSTGRES_PASSWORD: mínimo 16 caracteres y distinta de la de .env.example");
    }
  }
  if (env.LLM_PROVIDER === "demo") problems.push("LLM_PROVIDER=demo no vale en producción");
  return problems;
}
