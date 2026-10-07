import { DemoProvider } from "./demo-provider.ts";
import { AnthropicProvider, type LlmProvider } from "./llm.ts";
import type { AgentConfig } from "./service.ts";

const number = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : fallback;
};

/**
 * Configuración del agente a partir de las variables de entorno.
 *   ANTHROPIC_API_KEY        clave de la API (solo en .env local); sin ella el asistente queda desactivado
 *   LLM_MODEL                modelo (por defecto claude-opus-5-5)
 *   LLM_EFFORT               low | medium | high (por defecto low: basta para reservar y es lo más barato)
 *   LLM_DAILY_BUDGET_EUR     tope global diario (2); LLM_USER_DAILY_BUDGET_EUR por persona (0,5) y
 *                            LLM_SESSION_BUDGET_EUR por chat (0,2)
 *   LLM_PRICE_IN_EUR_PER_MTOK / LLM_PRICE_OUT_EUR_PER_MTOK  precios para estimar el gasto
 *   LLM_PROVIDER=demo        guion de demostración sin clave ni gasto (no vale para producción)
 */
export function agentConfigFromEnv(env: NodeJS.ProcessEnv): Partial<AgentConfig> {
  let provider: LlmProvider | null = null;
  if (env.LLM_PROVIDER === "demo") {
    if (env.NODE_ENV === "production")
      throw new Error("LLM_PROVIDER=demo no se puede usar en producción");
    provider = new DemoProvider();
  } else if (env.ANTHROPIC_API_KEY) {
    const effort =
      env.LLM_EFFORT === "medium" || env.LLM_EFFORT === "high" ? env.LLM_EFFORT : "low";
    provider = new AnthropicProvider({
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.LLM_MODEL || "claude-opus-5-5",
      effort,
    });
  }
  return {
    provider,
    dailyBudgetEur: number(env.LLM_DAILY_BUDGET_EUR, 2),
    userDailyBudgetEur: number(env.LLM_USER_DAILY_BUDGET_EUR, 0.5),
    sessionBudgetEur: number(env.LLM_SESSION_BUDGET_EUR, 0.2),
    prices: {
      inputEurPerMTok: number(env.LLM_PRICE_IN_EUR_PER_MTOK, 3.7),
      outputEurPerMTok: number(env.LLM_PRICE_OUT_EUR_PER_MTOK, 18.5),
    },
  };
}
