import { MAX_GALLERY_PHOTOS } from "@agendia/shared";
import { api } from "../../api.ts";
import { PhotoInput } from "../../components/PhotoInput.tsx";
import { BlockSkeleton } from "../../components/Skeleton.tsx";
import { imageToDataUrl, photoSrc } from "../../lib/image.ts";
import type { MediaItem } from "../../types.ts";
import { FormError, linkButton, Section, useAction } from "../../ui.tsx";
import { useApi } from "../../useApi.ts";

export function Fotos() {
  const { data, loading, reload } = useApi<MediaItem[]>("/business/media");
  const { error, busy, run } = useAction();
  const gallery = data?.filter((p) => p.staffId === null) ?? [];
  const room = MAX_GALLERY_PHOTOS - gallery.length;

  async function add(files: File[]) {
    // Se suben una a una y se corta en la primera que falle (por ejemplo, al llegar al máximo).
    await run(async () => {
      for (const file of files.slice(0, room)) {
        const image = await imageToDataUrl(file);
        await api("/business/media", { method: "POST", body: JSON.stringify({ image }) });
      }
    });
    await reload();
  }

  async function remove(id: string) {
    await run(() => api(`/business/media/${id}`, { method: "DELETE" }));
    await reload();
  }

  return (
    <Section title="Fotos del negocio">
      <p className="text-muted">
        Se muestran en tu ficha pública. Hasta {MAX_GALLERY_PHOTOS} fotos; la de cada profesional se
        sube desde Equipo.
      </p>
      {loading && <BlockSkeleton rows={2} />}
      {gallery.length === 0 && !loading && <p className="text-muted">Aún no has subido fotos.</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {gallery.map((p, i) => (
          <li key={p.id} className="border-line overflow-hidden rounded-xl border">
            <img
              src={photoSrc(p.id, p.src)}
              alt={`Foto ${i + 1} del negocio`}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
            <div className="p-2">
              <button
                className={linkButton}
                aria-label={`Eliminar la foto ${i + 1}`}
                onClick={() => remove(p.id)}
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
      {room > 0 ? (
        <PhotoInput label="Añadir fotos" multiple disabled={busy} onFiles={add} />
      ) : (
        <p className="text-muted">Has llegado al máximo. Elimina una para añadir otra.</p>
      )}
      <FormError message={error} />
    </Section>
  );
}
