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
