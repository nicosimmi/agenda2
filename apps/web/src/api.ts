/** Error de la API con su estado HTTP y su código, para poder reaccionar (401, 409…). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Cliente mínimo de la API: misma ruta base en dev (proxy de Vite) y en producción.
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: "include",
      ...init,
      // Sin cuerpo no se envía Content-Type: Fastify rechaza un JSON vacío con esa cabecera.
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError("No hay conexión con el servidor. Comprueba tu red e inténtalo de nuevo", 0);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string; code?: string };
    } | null;
    throw new ApiError(body?.error?.message ?? res.statusText, res.status, body?.error?.code);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}
