import { useState, type FormEvent } from "react";
import { api } from "../../api.ts";
import { BlockSkeleton } from "../../components/Skeleton.tsx";
import type { Booking, Service, Staff } from "../../types.ts";
import {
  buttonClass,
  Field,
  FormError,
  inputClass,
  linkButton,
  Section,
  useAction,
} from "../../ui.tsx";
import { useApi } from "../../useApi.ts";

const STATUS: Record<Booking["status"], string> = {
  pending: "pendiente",
  confirmed: "confirmada",
  cancelled: "cancelada",
  completed: "completada",
  no_show: "no se presentó",
  expired: "caducada",
};

const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD en hora local
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

export function Agenda() {
  const [day, setDay] = useState(today);
  const [staffId, setStaffId] = useState("");
  const staff = useApi<Staff[]>("/business/staff");
  const services = useApi<Service[]>("/business/services");
  // ponytail: los días se cortan en la hora del navegador; si el negocio está en otra zona, usar business.timezone.
  const from = new Date(`${day}T00:00`);
  const to = new Date(from.getTime() + 24 * 3600 * 1000);
  const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  if (staffId) query.set("staffId", staffId);
  const bookings = useApi<Booking[]>(`/business/bookings?${query}`);
  const { error, run } = useAction();

  async function setStatus(id: string, status: string) {
    await run(() =>
      api(`/business/bookings/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
    );
    await bookings.reload();
  }

  async function addManual(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const ok = await run(() =>
      api("/business/bookings", {
        method: "POST",
        body: JSON.stringify({
          staffId: f.get("staffId"),
          serviceId: f.get("serviceId"),
          startsAt: new Date(`${day}T${f.get("time")}`).toISOString(),
          guestName: f.get("guestName"),
          guestPhone: f.get("guestPhone"),
        }),
      }),
    );
    if (ok) form.reset();
    await bookings.reload();
  }

  return (
    <>
      <Section title="Agenda">
        <div className="flex flex-wrap items-end gap-4">
          <Field
            label="Día"
            type="date"
            value={day}
            onChange={(e) => e.target.value && setDay(e.target.value)}
          />
          <label className="block">
            <span className="text-sm font-semibold">Profesional</span>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className={inputClass}
            >
              <option value="">Todos</option>
              {staff.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {bookings.loading && <BlockSkeleton rows={2} />}
        {bookings.data?.length === 0 && <p className="text-muted">No hay reservas este día.</p>}
        <ul className="divide-y divide-line">
          {bookings.data?.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-3 py-2">
              <span>
                <strong>
                  {time(b.startsAt)}–{time(b.endsAt)}
                </strong>{" "}
                {b.serviceName} · {b.customerName} · {b.staffName}{" "}
                <span className="text-muted">({STATUS[b.status]})</span>
              </span>
              {(b.status === "pending" || b.status === "confirmed") && (
                <span className="ml-auto flex gap-4">
                  {new Date(b.startsAt) <= new Date() && (
                    <>
                      <button className={linkButton} onClick={() => setStatus(b.id, "completed")}>
                        Completada
                      </button>
                      <button className={linkButton} onClick={() => setStatus(b.id, "no_show")}>
                        No vino
                      </button>
                    </>
                  )}
                  <button className={linkButton} onClick={() => setStatus(b.id, "cancelled")}>
                    Cancelar
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
        <FormError message={error} />
      </Section>
      <Section title="Reserva manual">
        <form onSubmit={addManual} className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold">Profesional</span>
            <select name="staffId" required className={inputClass}>
              {staff.data
                ?.filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Servicio</span>
            <select name="serviceId" required className={inputClass}>
              {services.data
                ?.filter((s) => s.active)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <Field label={`Hora (${day})`} name="time" type="time" required />
          <Field label="Nombre del cliente" name="guestName" required />
          <Field label="Teléfono (opcional)" name="guestPhone" type="tel" />
          <div className="self-end">
            <button className={buttonClass}>Reservar</button>
          </div>
        </form>
      </Section>
    </>
  );
}
