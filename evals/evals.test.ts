// CI de las evals (SPEC §13): valida el dataset y el runner sin llamar a ningún LLM real.
// 1. El dataset tiene la forma que pide el SPEC.
// 2. Con el modelo simulado "crédulo" (cae en todas las trampas), todas las comprobaciones de
//    SISTEMA pasan en los 51 casos, y las de modelo detectan su mala conducta.
// 3. Con un modelo "bueno" guionizado, un caso completo pasa entero: las comprobaciones de modelo
//    no fallan siempre, también saben aprobar.
import { describe, expect, it } from "vitest";
import type { Block, LlmRequest, LlmResult } from "../apps/api/src/agent/llm.ts";
import { CASES, type Category } from "./cases.ts";
import { GullibleProvider, runEvals, type EvalProvider } from "./runner.ts";

const CATEGORIES: Category[] = [
  "busqueda",
  "reserva",
  "fechas",
  "sin-hueco",
  "cancelar-mover",
  "sin-sesion",
  "manipulacion",
  "inyeccion",
  "fuera-de-ambito",
];

describe("dataset", () => {
  it("tiene entre 40 y 60 casos con id único y todas las categorías", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(40);
    expect(CASES.length).toBeLessThanOrEqual(60);
    expect(new Set(CASES.map((c) => c.id)).size).toBe(CASES.length);
    expect(new Set(CASES.map((c) => c.category))).toEqual(new Set(CATEGORIES));
  });

  it("cada caso comprueba algo y los de inyección y manipulación vigilan la confirmación", () => {
    for (const c of CASES) {
      expect(Object.keys(c.expect).length, c.id).toBeGreaterThan(0);
      expect(c.turns.length, c.id).toBeGreaterThan(0);
    }
    const guarded = CASES.filter(
      (c) => c.category === "inyeccion" || c.category === "manipulacion",
    );
    for (const c of guarded) {
      const e = c.expect;
      expect(
        Boolean(
          e.avoidTools?.length || e.replyAvoids?.length || e.proposal || e.maxCalls || e.reply,
        ),
        c.id,
      ).toBe(true);
    }
  });
});

describe("runner con el modelo simulado crédulo", () => {
  it("el sistema aguanta los 51 casos aunque el modelo caiga en todas las trampas", async () => {
    const results = await runEvals({ provider: new GullibleProvider(), cases: CASES });
    expect(results).toHaveLength(CASES.length);
    for (const r of results) {
      // El caso llegó a conversar: el modelo intentó sus herramientas.
      expect(r.tools.length, r.id).toBeGreaterThan(0);
      const failed = r.system.filter((c) => !c.ok);
      expect(failed, `${r.id}: ${JSON.stringify(failed)}`).toEqual([]);
    }
    // Las comprobaciones de modelo detectan lo que hizo mal: intentar confirmar y mentir.
    const byId = new Map(results.map((r) => [r.id, r]));
    const failedNames = (id: string) =>
      byId
        .get(id)!
        .model.filter((c) => !c.ok)
        .map((c) => c.name);
    expect(failedNames("manipulacion-confirma-tu")).toContain("no intenta confirm_booking");
    expect(failedNames("manipulacion-falso-sistema").join()).toContain("la respuesta evita");
  }, 180_000);
});

/** Modelo "bueno" para reserva-completa: servicios → huecos → propuesta → pide pulsar Confirmar. */
class GoodBookingModel implements EvalProvider {
  readonly name = "simulado-bueno";
  async complete(request: LlmRequest, onText: (delta: string) => void): Promise<LlmResult> {
    const usage = { inputTokens: 0, outputTokens: 0 };
    const results = request.messages
      .flatMap((m) => (m.role === "user" && Array.isArray(m.content) ? m.content : []))
      .filter((b) => b.type === "tool_result")
      .map((b) => JSON.parse(String(b.content)) as Record<string, unknown>);
    const use = (name: string, input: Record<string, unknown>): LlmResult => ({
      content: [{ type: "tool_use", id: `toolu_${results.length}`, name, input } as Block],
      stopReason: "tool_use",
      usage,
    });
    const businessSlug = "barberia-el-califa";
    const services = (results[0]?.services ?? []) as { id: string; name: string }[];
    const serviceId = services.find((s) => /corte de pelo/i.test(s.name))?.id;
    switch (results.length) {
      case 0:
        return use("list_services", { businessSlug });
      case 1: {
        const from = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
        return use("check_availability", { businessSlug, serviceId, from, days: 7 });
      }
      case 2: {
        const days = (results[1]?.days ?? []) as { slots: { startsAt: string }[] }[];
        const slot = days.flatMap((d) => d.slots)[0]!;
        return use("propose_booking", { businessSlug, serviceId, startsAt: slot.startsAt });
      }
      default: {
        const text =
          "Te he preparado la reserva: revisa la tarjeta y pulsa «Confirmar» si todo está bien.";
        onText(text);
        return { content: [{ type: "text", text }], stopReason: "end_turn", usage };
      }
    }
  }
}

describe("runner con un modelo bueno", () => {
  it("un caso de reserva con clic en Confirmar pasa todas las comprobaciones", async () => {
    const [result] = await runEvals({
      provider: new GoodBookingModel(),
      cases: CASES.filter((c) => c.id === "reserva-completa"),
    });
    const failed = [...result!.system, ...result!.model].filter((c) => !c.ok);
    expect(failed).toEqual([]);
    expect(result!.model.map((c) => c.name)).toContain(
      "tras el clic, reserva confirmed en barberia-el-califa",
    );
  }, 60_000);
});
