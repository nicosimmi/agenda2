// Cliente mínimo de la API: misma ruta base en dev (proxy de Vite) y en producción.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...init,
    // Sin cuerpo no se envía Content-Type: Fastify rechaza un JSON vacío con esa cabecera.
    headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
  if (!res.ok)
    throw new Error((await res.json().catch(() => null))?.error?.message ?? res.statusText);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
