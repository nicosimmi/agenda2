import type { FormEvent } from "react";
import { api } from "../../api.ts";
import { BlockSkeleton } from "../../components/Skeleton.tsx";
import type { Service } from "../../types.ts";
import { buttonClass, Field, FormError, linkButton, Section, useAction } from "../../ui.tsx";
import { useApi } from "../../useApi.ts";

const euros = (cents: number) =>
  (cents / 100).toLocaleString("es-ES", { minimumFractionDigits: 2 });

export function Servicios() {
  const { data, loading, reload } = useApi<Service[]>("/business/services");
  const { error, run } = useAction();

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const ok = await run(() =>
      api("/business/services", {
        method: "POST",
        body: JSON.stringify({
          name: f.get("name"),
          durationMin: Number(f.get("durationMin")),
          bufferMin: Number(f.get("bufferMin") || 0),
          priceCents: Math.round(Number(f.get("price")) * 100),
        }),
      }),
    );
    if (ok) form.reset();
    await reload();
  }

  const act = (fn: () => Promise<unknown>) => async () => {
    await run(fn);
    await reload();
  };

  return (
    <>
      <Section title="Servicios">
        {loading && <BlockSkeleton rows={3} />}
        {data?.length === 0 && <p className="text-muted">Aún no tienes servicios.</p>}
        <ul className="divide-y divide-line">
          {data?.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className={s.active ? "" : "text-muted line-through"}>
                <strong>{s.name}</strong> · {s.durationMin} min · {euros(s.priceCents)} €
              </span>
              <span className="ml-auto flex gap-4">
                <button
                  className={linkButton}
                  onClick={act(() =>
                    api(`/business/services/${s.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ active: !s.active }),
                    }),
                  )}
                >
                  {s.active ? "Desactivar" : "Activar"}
                </button>
                <button
                  className={linkButton}
                  onClick={act(() => api(`/business/services/${s.id}`, { method: "DELETE" }))}
                >
                  Eliminar
                </button>
              </span>
            </li>
          ))}
        </ul>
        <FormError message={error} />
      </Section>
      <Section title="Añadir servicio">
        <form onSubmit={add} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nombre" name="name" required />
          </div>
          <Field
            label="Duración (min)"
            name="durationMin"
            type="number"
            min={1}
            max={480}
            required
          />
          <Field label="Pausa posterior (min)" name="bufferMin" type="number" min={0} max={240} />
          <Field label="Precio (€)" name="price" type="number" min={0} step="0.01" required />
          <div className="self-end">
            <button className={buttonClass}>Añadir</button>
          </div>
        </form>
      </Section>
    </>
  );
}
