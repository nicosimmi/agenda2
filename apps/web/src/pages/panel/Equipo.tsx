import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api.ts";
import type { Service, Shift, Staff } from "../../types.ts";
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

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function Equipo() {
  const staff = useApi<Staff[]>("/business/staff");
  const services = useApi<Service[]>("/business/services");
  const { error, run } = useAction();

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const name = new FormData(form).get("name");
    if (await run(() => api("/business/staff", { method: "POST", body: JSON.stringify({ name }) })))
      form.reset();
    await staff.reload();
  }

  return (
    <>
      {staff.data?.map((member) => (
        <Member
          key={member.id}
          member={member}
          services={services.data?.filter((s) => s.active) ?? []}
          reload={staff.reload}
        />
      ))}
      <Section title="Añadir profesional">
        <form onSubmit={add} className="flex items-end gap-4">
          <div className="flex-1">
            <Field label="Nombre" name="name" required />
          </div>
          <button className={buttonClass}>Añadir</button>
        </form>
        <FormError message={error} />
      </Section>
    </>
  );
}

function Member({
  member,
  services,
  reload,
}: {
  member: Staff;
  services: Service[];
  reload: () => Promise<void>;
}) {
  const { error, run } = useAction();

  const patch = async (body: Partial<Staff>) => {
    await run(() =>
      api(`/business/staff/${member.id}`, { method: "PATCH", body: JSON.stringify(body) }),
    );
    await reload();
  };
  const toggleService = (id: string) =>
    patch({
      serviceIds: member.serviceIds.includes(id)
        ? member.serviceIds.filter((s) => s !== id)
        : [...member.serviceIds, id],
    });

  return (
    <Section title={member.name}>
      <div className="flex gap-4">
        <button className={linkButton} onClick={() => patch({ active: !member.active })}>
          {member.active ? "Desactivar" : "Activar"}
        </button>
        <button
          className={linkButton}
          onClick={async () => {
            await run(() => api(`/business/staff/${member.id}`, { method: "DELETE" }));
            await reload();
          }}
        >
          Eliminar
        </button>
        {!member.active && <span className="text-muted">(inactivo)</span>}
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Servicios que realiza</legend>
        {services.length === 0 && <p className="text-muted">Crea primero un servicio.</p>}
        <div className="flex flex-wrap gap-x-5">
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={member.serviceIds.includes(s.id)}
                onChange={() => toggleService(s.id)}
                className="accent-gold-dark"
              />
              {s.name}
            </label>
          ))}
        </div>
      </fieldset>
      <FormError message={error} />
      <Hours staffId={member.id} />
    </Section>
  );
}

function Hours({ staffId }: { staffId: string }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const { error, run } = useAction();

  useEffect(() => {
    api<{ hours: Shift[]; warnings: string[] }>(`/business/staff/${staffId}/hours`).then((r) =>
      setShifts(r.hours),
    );
  }, [staffId]);

  const edit = (i: number, change: Partial<Shift>) => {
    setSaved(false);
    setShifts((all) => all.map((s, j) => (j === i ? { ...s, ...change } : s)));
  };

  async function save() {
    const ok = await run(async () => {
      const r = await api<{ hours: Shift[]; warnings: string[] }>(
        `/business/staff/${staffId}/hours`,
        { method: "PUT", body: JSON.stringify({ hours: shifts }) },
      );
      setWarnings(r.warnings);
    });
    setSaved(ok);
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Horario semanal</h3>
      {shifts.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Día"
            value={s.weekday}
            onChange={(e) => edit(i, { weekday: Number(e.target.value) })}
            className={`${inputClass} !mt-0 !w-auto`}
          >
            {DAYS.map((d, n) => (
              <option key={d} value={n + 1}>
                {d}
              </option>
            ))}
          </select>
          <input
            type="time"
            aria-label="Desde"
            value={s.startTime}
            onChange={(e) => edit(i, { startTime: e.target.value })}
            className={`${inputClass} !mt-0 !w-auto`}
          />
          <input
            type="time"
            aria-label="Hasta"
            value={s.endTime}
            onChange={(e) => edit(i, { endTime: e.target.value })}
            className={`${inputClass} !mt-0 !w-auto`}
          />
          <button
            className={linkButton}
            onClick={() => {
              setSaved(false);
              setShifts(shifts.filter((_, j) => j !== i));
            }}
          >
            Quitar
          </button>
        </div>
      ))}
      {warnings.map((w) => (
        <p key={w} role="status" className="text-gold-dark text-sm font-semibold">
          {w}
        </p>
      ))}
      <FormError message={error} />
      <div className="flex items-center gap-4">
        <button
          className={linkButton}
          onClick={() => {
            setSaved(false);
            setShifts([...shifts, { weekday: 1, startTime: "09:00", endTime: "14:00" }]);
          }}
        >
          Añadir franja
        </button>
        <button className={buttonClass} onClick={save}>
          Guardar horario
        </button>
        {saved && <span role="status">Guardado</span>}
      </div>
    </div>
  );
}
