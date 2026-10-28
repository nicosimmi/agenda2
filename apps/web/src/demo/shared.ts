// Reservas compartidas de la demo (opcional). La demo no tiene servidor, así que cada navegador
// guarda sus datos aparte. Con esta pieza, las reservas se copian además a Firestore (plan gratuito,
// API REST con fetch, sin dependencias) y cualquiera las ve desde el panel del negocio.
// Solo viajan reservas con datos ficticios: nada de emails, teléfonos ni notas, y del cliente solo
// el nombre de pila. Sin VITE_FIREBASE_PROJECT_ID y VITE_FIREBASE_API_KEY no hace nada.
// Las reglas que lo protegen están en firestore.rules (raíz del repositorio).

const PROJECT = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
export const sharingEnabled = Boolean(PROJECT && API_KEY);

/** Los ids de negocio, profesional y servicio se generan en cada navegador: se usan nombres. */
export interface SharedBooking {
  id: string;
  businessSlug: string;
  staffName: string;
  serviceName: string;
  code: string;
  startsAt: string;
  endsAt: string;
  status: string;
  source: string;
  customerName: string;
  expiresAt: string;
}

const KEYS = [
  "id",
  "businessSlug",
  "staffName",
  "serviceName",
  "code",
  "startsAt",
  "endsAt",
  "status",
  "source",
  "customerName",
  "expiresAt",
] as const satisfies readonly (keyof SharedBooking)[];

type Fields = Record<string, { stringValue: string }>;

export const toFields = (b: SharedBooking): Fields =>
  Object.fromEntries(KEYS.map((k) => [k, { stringValue: b[k] }]));

/** Descarta lo que no tenga la forma esperada: cualquiera puede escribir en la colección. */
export function fromFields(fields: Record<string, { stringValue?: string }> | undefined) {
  const out: Record<string, string> = {};
  for (const k of KEYS) {
    const v = fields?.[k]?.stringValue;
    if (typeof v !== "string") return null;
    out[k] = v;
  }
  return out as unknown as SharedBooking;
}

const base = () =>
  `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Reservas de ayer en adelante: lo anterior no cambia nada en la agenda ni en los huecos. */
export async function fetchShared(): Promise<SharedBooking[]> {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const res = await fetch(`${base()}:runQuery?key=${API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "bookings" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "startsAt" },
            op: "GREATER_THAN_OR_EQUAL",
            value: { stringValue: since },
          },
        },
        limit: 500,
      },
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  const rows = (await res.json()) as { document?: { fields?: Record<string, never> } }[];
  return rows.flatMap((r) => fromFields(r.document?.fields) ?? []);
}

/** Crea o actualiza la reserva (el id del documento es el de la reserva). */
export async function pushShared(b: SharedBooking) {
  const res = await fetch(`${base()}/bookings/${encodeURIComponent(b.id)}?key=${API_KEY}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fields: toFields(b) }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
}

// --- Fotos compartidas ---
// Los negocios de la demo suben fotos desde su panel y se ven en cualquier dispositivo. Cada foto es
// un documento de la colección `media` con la imagen ya reducida como data URL (menos de 1 MB, el
// límite de un documento de Firestore). Borrar es marcarla (`removed`): las reglas no dejan borrar.

export interface SharedMedia {
  id: string;
  businessSlug: string;
  /** Vacío: foto de la galería del negocio. Con nombre: foto de ese profesional. */
  staffName: string;
  image: string;
  removed: string;
}

const MEDIA_KEYS = [
  "id",
  "businessSlug",
  "staffName",
  "image",
  "removed",
] as const satisfies readonly (keyof SharedMedia)[];

/** Solo imágenes: cualquiera puede escribir en la colección, así que se vuelve a comprobar al leer. */
export const IMAGE_DATA_URL = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export const mediaToFields = (m: SharedMedia): Fields =>
  Object.fromEntries(MEDIA_KEYS.map((k) => [k, { stringValue: m[k] }]));

export function mediaFromFields(fields: Record<string, { stringValue?: string }> | undefined) {
  const out: Record<string, string> = {};
  for (const k of MEDIA_KEYS) {
    const v = fields?.[k]?.stringValue;
    if (typeof v !== "string") return null;
    out[k] = v;
  }
  if (!IMAGE_DATA_URL.test(out.image!)) return null;
  return out as unknown as SharedMedia;
}

/** Fotos visibles de un negocio, de la más antigua a la más nueva (el id empieza por la hora). */
export async function fetchSharedMedia(businessSlug: string): Promise<SharedMedia[]> {
  const filter = (field: string, value: string) => ({
    fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } },
  });
  const res = await fetch(`${base()}:runQuery?key=${API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "media" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [filter("businessSlug", businessSlug), filter("removed", "")],
          },
        },
        limit: 40,
      },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
  const rows = (await res.json()) as { document?: { fields?: Record<string, never> } }[];
  return rows
    .flatMap((r) => mediaFromFields(r.document?.fields) ?? [])
    .sort((a, b) => a.id.localeCompare(b.id));
}

export async function pushSharedMedia(m: SharedMedia) {
  const res = await fetch(`${base()}/media/${encodeURIComponent(m.id)}?key=${API_KEY}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fields: mediaToFields(m) }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
}

/** «Borra» una foto: la marca como retirada (solo se puede cambiar ese campo). */
export async function removeSharedMedia(id: string) {
  const res = await fetch(
    `${base()}/media/${encodeURIComponent(id)}?updateMask.fieldPaths=removed&key=${API_KEY}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fields: { removed: { stringValue: "1" } } }),
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!res.ok) throw new Error(`Firestore ${res.status}`);
}
