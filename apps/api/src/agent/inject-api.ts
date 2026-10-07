import type { ApiClient } from "@agendia/mcp-server";
import type { FastifyInstance } from "fastify";

/**
 * Cliente de la API que llama a la propia aplicación en memoria (sin red) y con la IP real de quien
 * chatea: así los límites de uso por IP de la API se aplican a cada persona y no a todas a la vez.
 */
export function injectApiClient(app: FastifyInstance, ip: string, token?: string): ApiClient {
  return {
    async request(method, path, options = {}) {
      const res = await app.inject({
        method,
        url: path,
        remoteAddress: ip,
        headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...options.headers },
        ...(options.body !== undefined && { payload: options.body as object }),
      });
      let body: unknown;
      try {
        body = res.json();
      } catch {
        body = res.body;
      }
      return { status: res.statusCode, body };
    },
  };
}
