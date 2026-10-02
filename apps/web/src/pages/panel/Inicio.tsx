import { api } from "../../api.ts";
import type { Checklist, Profile } from "../../types.ts";
import { buttonClass, FormError, Section, useAction } from "../../ui.tsx";
import { useApi } from "../../useApi.ts";

const STATUS = { draft: "borrador", published: "publicado", suspended: "suspendido" } as const;

export function Inicio() {
  const profile = useApi<Profile>("/business/profile");
  const checklist = useApi<Checklist>("/business/checklist");
  const { error, run } = useAction();
  if (!profile.data || !checklist.data) return <FormError message={profile.error} />;

  const published = profile.data.status === "published";
  const toggle = async () => {
    await run(() => api(`/business/${published ? "unpublish" : "publish"}`, { method: "POST" }));
    await Promise.all([profile.reload(), checklist.reload()]);
  };

  return (
    <Section title={profile.data.name}>
      <p>
        Estado: <strong>{STATUS[profile.data.status]}</strong>
      </p>
      <ul className="space-y-1">
        {checklist.data.items.map((i) => (
          <li key={i.key}>
            <span aria-hidden>{i.ok ? "✓" : "○"}</span> {i.label}
            <span className="sr-only">{i.ok ? " (hecho)" : " (pendiente)"}</span>
          </li>
        ))}
      </ul>
      <FormError message={error} />
      {profile.data.status !== "suspended" && (
        <button
          className={buttonClass}
          disabled={!published && !checklist.data.ready}
          onClick={toggle}
        >
          {published ? "Despublicar" : "Publicar negocio"}
        </button>
      )}
    </Section>
  );
}
