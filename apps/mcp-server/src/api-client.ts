// Cliente delgado de la API REST. El servidor MCP no tiene lógica de negocio ni acceso a la base de
// datos: todo pasa por la API con el token de quien se conecta, así que las reglas (aislamiento,
// permisos, disponibilidad, plazos) son siempre las de la API.

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface ApiClient {
  request(
    method: "GET" | "POST",
    path: string,
    options?: { body?: unknown; headers?: Record<string, string> },
  ): Promise<ApiResponse>;
}

/** Error de la API traducido para el modelo: estado, código y el mensaje de la API tal cual. */
export class ApiFailure extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Cliente HTTP. Sin token solo funcionan las rutas públicas. */
export function httpApiClient(baseUrl: string, token?: string): ApiClient {
  const root = baseUrl.replace(/\/+$/, "");
  return {
    async request(method, path, options = {}) {
      let res: Response;
      try {
        res = await fetch(`${root}${path}`, {
          method,
          headers: {
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
            ...options.headers,
          },
          ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
          // Un modelo no debe quedarse esperando a una API colgada.
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        throw new ApiFailure(
          "No se pudo contactar con el servicio de reservas. Inténtalo más tarde",
          0,
        );
      }
      const text = await res.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      return { status: res.status, body };
    },
  };
}

/** Llama a la API y devuelve el cuerpo; cualquier error de la API se convierte en `ApiFailure`. */
export async function call<T>(
  api: ApiClient,
  method: "GET" | "POST",
  path: string,
  options?: { body?: unknown; headers?: Record<string, string> },
): Promise<T> {
  const res = await api.request(method, path, options);
  if (res.status >= 400) {
    const message = (res.body as { error?: { message?: string } } | null)?.error?.message;
    throw new ApiFailure(explain(res.status, message), res.status);
  }
  return res.body as T;
}

/** Mensajes pensados para que el modelo sepa qué hacer a continuación. */
function explain(status: number, message?: string): string {
  switch (status) {
    case 401:
      return "El token de acceso no es válido o ha caducado. Pide al usuario que genere uno nuevo";
    case 403:
      return `Esta conexión no tiene permiso para esa acción${message ? ` (${message})` : ""}`;
    case 404:
      return message ?? "No encontrado";
    case 429:
      return "Demasiadas peticiones seguidas. Espera un momento antes de volver a intentarlo";
    default:
      return message ?? `Error del servicio de reservas (${status})`;
  }
}
