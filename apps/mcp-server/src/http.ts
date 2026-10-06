// Servidor MCP por HTTP (Streamable HTTP sin estado), para el servicio del agente y clientes remotos.
// Cada petición lleva su propio token en `Authorization: Bearer …` y recibe un servidor con las
// herramientas que permiten SUS permisos; no se guarda ninguna sesión entre peticiones.
//   MCP_PORT             puerto (3200)
//   MCP_HOST             dirección de escucha (127.0.0.1: solo la propia máquina)
//   MCP_ALLOWED_ORIGINS  orígenes de navegador permitidos, separados por comas (por defecto ninguno)
//   AGENDIA_API_URL      dirección de la API
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ApiFailure, httpApiClient } from "./api-client.ts";
import { createMcpServer, fetchScopes } from "./server.ts";

const port = Number(process.env.MCP_PORT ?? 3200);
const host = process.env.MCP_HOST ?? "127.0.0.1";
const apiUrl = process.env.AGENDIA_API_URL ?? "http://localhost:3000";
const allowedOrigins = (process.env.MCP_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const MAX_BODY = 256 * 1024;

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
};
const rpcError = (res: ServerResponse, status: number, message: string) =>
  json(res, status, { jsonrpc: "2.0", error: { code: -32000, message }, id: null });

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("Cuerpo demasiado grande"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("JSON no válido"));
      }
    });
    req.on("error", reject);
  });
}

createServer(async (req, res) => {
  try {
    if (new URL(req.url ?? "/", "http://x").pathname !== "/mcp")
      return json(res, 404, { error: "No encontrado" });

    // Protección contra DNS rebinding: un navegador solo entra desde un origen permitido.
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin))
      return rpcError(res, 403, "Origen no permitido");

    if (req.method !== "POST") {
      res.setHeader("allow", "POST");
      return rpcError(res, 405, "Solo se admite POST (servidor sin estado)");
    }

    const bearer = /^Bearer (\S+)$/i.exec(req.headers.authorization ?? "")?.[1];
    if (req.headers.authorization && !bearer)
      return rpcError(res, 401, "Cabecera Authorization no válida");
    const api = httpApiClient(apiUrl, bearer);
    const scopes = await fetchScopes(api, bearer !== undefined);

    const server = createMcpServer({ api, scopes });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // sin estado
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, await readBody(req));
  } catch (error) {
    if (res.headersSent) return;
    if (error instanceof ApiFailure && error.status === 401)
      return rpcError(res, 401, error.message);
    rpcError(
      res,
      500,
      error instanceof Error && /JSON|grande/.test(error.message) ? error.message : "Error interno",
    );
  }
}).listen(port, host, () => {
  console.error(`AgendIA MCP (HTTP) en http://${host}:${port}/mcp → API ${apiUrl}`);
});
