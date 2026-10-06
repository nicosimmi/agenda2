import { useState, type FormEvent } from "react";
import { api } from "../../api.ts";
import { BlockSkeleton } from "../../components/Skeleton.tsx";
import type { Profile } from "../../types.ts";
import { buttonClass, Field, FormError, inputClass, Section, useAction } from "../../ui.tsx";
import { useApi } from "../../useApi.ts";

const fields = [
  ["name", "Nombre"],
  ["addressLine", "Dirección"],
  ["city", "Ciudad"],
  ["province", "Provincia"],
  ["postalCode", "Código postal"],
  ["contactPhone", "Teléfono"],
  ["contactEmail", "Email de contacto"],
] as const;

export function Perfil() {
  const { data, reload } = useApi<Profile>("/business/profile");
  const { error, run } = useAction();
  const [saved, setSaved] = useState(false);
  if (!data) return <BlockSkeleton rows={6} />;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    setSaved(
      await run(() => api("/business/profile", { method: "PATCH", body: JSON.stringify(body) })),
    );
    await reload();
  }

  return (
    <Section title="Perfil del negocio">
      <form onSubmit={submit} className="space-y-4">
        {fields.map(([key, label]) => (
          <Field key={key} label={label} name={key} defaultValue={data[key] ?? ""} />
        ))}
        <label className="block">
          <span className="text-sm font-semibold">Descripción</span>
          <textarea
            name="description"
            rows={4}
            defaultValue={data.description}
            className={inputClass}
          />
        </label>
        <FormError message={error} />
        {saved && <p role="status">Guardado</p>}
        <button className={buttonClass}>Guardar</button>
      </form>
    </Section>
  );
}
