import { BlockSkeleton } from "../../components/Skeleton.tsx";
import { dateTimeIn } from "../../format.ts";
import { FormError, Section } from "../../ui.tsx";
import { useApi } from "../../useApi.ts";

interface AgentEvent {
  id: string;
  type: string;
  toolName: string | null;
  bookingId: string | null;
  createdAt: string;
}

const TYPE: Record<string, string> = {
  tool_call: "Consultó datos del negocio",
  proposal: "Preparó una propuesta para un cliente",
  confirmation: "El cliente pulsó «Confirmar»",
  discarded: "El cliente descartó la propuesta",
};

const TOOL: Record<string, string> = {
  search_businesses: "buscar negocios",
  get_business_info: "ficha del negocio",
  list_services: "servicios",
  list_staff: "equipo",
  check_availability: "huecos libres",
  search_faq: "preguntas frecuentes",
  list_my_bookings: "reservas del cliente",
  propose_booking: "reserva nueva",
  propose_cancellation: "cancelación",
  propose_reschedule: "cambio de hora",
  confirm_booking: "reserva nueva",
  confirm_cancellation: "cancelación",
  confirm_reschedule: "cambio de hora",
};

/** Registro de lo que ha hecho el asistente de IA en este negocio: solo metadatos, sin conversaciones. */
export function Asistente() {
  const events = useApi<AgentEvent[]>("/business/agent-events");
  return (
    <>
      <div>
        <h1 className="text-3xl font-bold">Asistente de IA</h1>
        <p className="text-muted mt-1 max-w-2xl">
          Los clientes pueden reservar contigo hablando con el asistente. Aquí ves qué ha hecho en
          tu negocio. El asistente nunca confirma una reserva por su cuenta: la confirma el cliente
          con un botón, y entonces aparece en tu agenda como cualquier otra.
        </p>
      </div>
      <Section title="Actividad reciente">
        {events.loading && <BlockSkeleton rows={4} />}
        {events.error && <FormError message={events.error} />}
        {events.data?.length === 0 && (
          <p className="text-muted">Todavía no hay actividad del asistente en tu negocio.</p>
        )}
        {events.data && events.data.length > 0 && (
          <ul className="divide-line divide-y">
            {events.data.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 py-2 text-sm">
                <time className="text-muted w-36 shrink-0" dateTime={e.createdAt}>
                  {dateTimeIn(e.createdAt, "Europe/Madrid")}
                </time>
                <span className="font-semibold">{TYPE[e.type] ?? e.type}</span>
                {e.toolName && (
                  <span className="text-muted">({TOOL[e.toolName] ?? e.toolName})</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
