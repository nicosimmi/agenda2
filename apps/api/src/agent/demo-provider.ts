// Proveedor de demostración: NO es un modelo de lenguaje, sigue un guion fijo. Sirve para enseñar y
// probar el flujo completo del chat (buscar, mirar huecos, proponer, confirmar con el botón) sin
// clave de API ni gasto. Se activa con LLM_PROVIDER=demo y nunca en producción.
import { randomBytes } from "node:crypto";
import type { Block, LlmProvider, LlmRequest, LlmResult } from "./llm.ts";

const id = () => `toolu_demo_${randomBytes(6).toString("hex")}`;
const USAGE = { inputTokens: 150, outputTokens: 60 };

const toolUse = (name: string, input: Record<string, unknown>): LlmResult => ({
  content: [{ type: "tool_use", id: id(), name, input }],
  stopReason: "tool_use",
  usage: USAGE,
});

const parse = (block: Block | undefined): Record<string, unknown> | null => {
  try {
    return JSON.parse(String(block?.content ?? "")) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export class DemoProvider implements LlmProvider {
  readonly name = "demo";

  async complete(request: LlmRequest, onText: (delta: string) => void): Promise<LlmResult> {
    const say = async (text: string): Promise<LlmResult> => {
      for (const word of text.split(/(?<=\s)/)) {
        onText(word);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      return { content: [{ type: "text", text }], stopReason: "end_turn", usage: USAGE };
    };

    // El último mensaje de texto del usuario y lo que ha pasado desde entonces en este turno.
    const messages = request.messages;
    let lastText = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!;
      if (
        m.role === "user" &&
        typeof m.content === "string" &&
        !m.content.startsWith("[Sistema]")
      ) {
        lastText = i;
        break;
      }
    }
    const userText = lastText >= 0 ? String(messages[lastText]!.content) : "";
    const results = messages
      .slice(lastText + 1)
      .flatMap((m) => (m.role === "user" && Array.isArray(m.content) ? m.content : []))
      .filter((b) => b.type === "tool_result");
    const can = (tool: string) => request.tools.some((t) => t.name === tool);

    const wantsBooking = /reserv|cita|hueco|quiero|corte/i.test(userText);
    if (!wantsBooking && results.length === 0) {
      return say(
        "Hola, soy el asistente de demostración de AgendIA. Dime qué negocio buscas y para cuándo, por ejemplo: «Quiero reservar un corte en una barbería de Córdoba».",
      );
    }

    switch (results.length) {
      case 0: {
        const category =
          /barber[ií]a|peluquer[ií]a|fisio\w*|p[aá]del|est[eé]tica|veterinari\w*/i.exec(userText);
        return toolUse("search_businesses", { query: category?.[0] ?? "barbería" });
      }
      case 1: {
        const found = parse(results[0]);
        const slug = ((found?.businesses as { slug?: string }[] | undefined) ?? [])[0]?.slug;
        if (!slug)
          return say(
            "No he encontrado ningún negocio con eso. ¿Probamos con otra categoría o ciudad?",
          );
        return toolUse("list_services", { businessSlug: slug });
      }
      case 2: {
        const slug = (parse(results[0])?.businesses as { slug: string }[])[0]!.slug;
        const services =
          (parse(results[1])?.services as { id: string; name: string }[] | undefined) ?? [];
        const service = services.find((s) => /corte/i.test(s.name)) ?? services[0];
        if (!service) return say("Ese negocio todavía no tiene servicios disponibles.");
        const from = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
        return toolUse("check_availability", {
          businessSlug: slug,
          serviceId: service.id,
          from,
          days: 7,
        });
      }
      case 3: {
        const slug = (parse(results[0])?.businesses as { slug: string }[])[0]!.slug;
        const services = (parse(results[1])?.services as { id: string; name: string }[]) ?? [];
        const service = services.find((s) => /corte/i.test(s.name)) ?? services[0]!;
        const days =
          (parse(results[2])?.days as { slots: { startsAt: string }[] }[] | undefined) ?? [];
        const slot = days[0]?.slots[0];
        if (!slot) return say("No hay huecos libres en los próximos días. ¿Miramos otro negocio?");
        if (!can("propose_booking")) {
          return say(
            `Hay hueco en ${slug.replace(/-/g, " ")}. Para prepararte la reserva necesito que inicies sesión; mientras tanto puedo seguir buscando contigo.`,
          );
        }
        return toolUse("propose_booking", {
          businessSlug: slug,
          serviceId: service.id,
          startsAt: slot.startsAt,
        });
      }
      default:
        return say(
          "Te he preparado la reserva: revisa la tarjeta y pulsa «Confirmar» si todo está bien. La propuesta retiene el hueco unos minutos.",
        );
    }
  }
}
