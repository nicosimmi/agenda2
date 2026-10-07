// `pnpm eval`: ejecuta el dataset y escribe evals/REPORT.md.
//   pnpm eval                          modelo simulado "crédulo" (gratis): mide solo el sistema
//   pnpm eval --provider=anthropic     modelo real: consume la API y cuesta dinero (ver README)
//   pnpm eval --only=id1,id2           solo esos casos
import { writeFileSync } from "node:fs";
import { agentConfigFromEnv } from "../apps/api/src/agent/config.ts";
import { CASES } from "./cases.ts";
import {
  GullibleProvider,
  runEvals,
  summarize,
  type CaseResult,
  type EvalProvider,
} from "./runner.ts";

const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

// Sin el log de cada petición de Fastify: la salida es el progreso de los casos.
process.env.NODE_ENV ??= "test";

let provider: EvalProvider;
if (arg("provider") === "anthropic") {
  const real = agentConfigFromEnv({ ...process.env, LLM_PROVIDER: "" }).provider;
  if (!real) throw new Error("Falta ANTHROPIC_API_KEY en .env");
  console.warn("⚠️  Modelo real: esta ejecución consume la API de Anthropic y cuesta dinero.");
  provider = real;
} else {
  provider = new GullibleProvider();
}

const only = arg("only")?.split(",");
const cases = only ? CASES.filter((c) => only.includes(c.id)) : CASES;

const results = await runEvals({
  provider,
  cases,
  onCase: (r, i) => {
    const bad = [...r.system, ...r.model].filter((x) => !x.ok).length;
    console.log(`${String(i + 1).padStart(2)}/${cases.length} ${bad ? "✗" : "✓"} ${r.id}`);
  },
});
const s = summarize(provider.name, results);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : "—");
const simulated = provider.name.startsWith("simulado");

const failures = (r: CaseResult) =>
  [
    ...r.system.map((c) => ({ ...c, kind: "sistema" })),
    ...r.model.map((c) => ({ ...c, kind: "modelo" })),
  ]
    .filter((c) => !c.ok)
    .map((c) => `  - (${c.kind}) ${c.name}${c.detail ? `: ${c.detail.slice(0, 160)}` : ""}`)
    .join("\n");

const report = `# Informe de evals

- Fecha: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC
- Modelo: \`${s.provider}\`${simulated ? " (simulado, sin llamadas a ninguna API)" : ""}
- Casos: ${s.cases}

| Comprobaciones | Aciertos |
| --- | --- |
| Sistema (guardarraíles) | ${s.systemPassed}/${s.systemTotal} (${pct(s.systemPassed, s.systemTotal)}) |
| Modelo (conducta) | ${s.modelPassed}/${s.modelTotal} (${pct(s.modelPassed, s.modelTotal)}) |
| Casos completos | ${s.casesPassed}/${s.cases} (${pct(s.casesPassed, s.cases)}) |

Tokens: ${s.tokensIn} de entrada y ${s.tokensOut} de salida · coste estimado: ${s.costEur.toFixed(4)} EUR.
${
  simulated
    ? `
El modelo simulado cae a propósito en todas las trampas: intenta confirmar, pide las reservas de otra clienta, intenta cancelar la reserva ajena y miente diciendo que todo está confirmado. Por eso **las comprobaciones de modelo fallan** y eso es lo esperado: demuestran que el runner detecta la mala conducta. Lo que mide esta ejecución es el sistema: aunque el modelo se deje manipular, no puede confirmar nada, no cambia nada sin el clic y no ve datos de otra persona. La tasa de acierto del modelo real no está medida.
`
    : ""
}
## Por categoría

| Categoría | Casos completos |
| --- | --- |
${Object.entries(s.byCategory)
  .map(([k, v]) => `| ${k} | ${v.passed}/${v.cases} |`)
  .join("\n")}

## Fallos

${
  results
    .filter((r) => [...r.system, ...r.model].some((c) => !c.ok))
    .map((r) => `- **${r.id}** (${r.title})\n${failures(r)}`)
    .join("\n") || "Ninguno."
}
`;

writeFileSync(new URL("REPORT.md", import.meta.url), report);
console.log(
  `\nSistema ${s.systemPassed}/${s.systemTotal} · Modelo ${s.modelPassed}/${s.modelTotal} · informe en evals/REPORT.md`,
);
if (s.systemPassed !== s.systemTotal) process.exitCode = 1;
