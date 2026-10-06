#!/usr/bin/env node
// Servidor MCP por stdio, para clientes como Claude Desktop o el inspector de MCP.
//   AGENDIA_API_URL  dirección de la API (por defecto http://localhost:3000)
//   AGENDIA_TOKEN    token de acceso (agt_…) generado en la web; sin él solo hay herramientas públicas
// Ojo: por stdout viaja el protocolo; todo lo demás (avisos, errores) va por stderr.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { httpApiClient } from "./api-client.ts";
import { createMcpServer, fetchScopes } from "./server.ts";

const apiUrl = process.env.AGENDIA_API_URL ?? "http://localhost:3000";
const token = process.env.AGENDIA_TOKEN?.trim() || undefined;
const api = httpApiClient(apiUrl, token);

try {
  const scopes = await fetchScopes(api, token !== undefined);
  await createMcpServer({ api, scopes }).connect(new StdioServerTransport());
  console.error(
    `AgendIA MCP listo (${apiUrl}). ${token ? `Permisos: ${scopes.join(", ")}` : "Sin token: solo lectura pública"}`,
  );
} catch (error) {
  console.error(`No se pudo iniciar el servidor MCP: ${(error as Error).message}`);
  process.exit(1);
}
