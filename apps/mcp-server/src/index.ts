// Punto de entrada de la biblioteca: el servicio del agente (apps/api) usa el servidor MCP en el
// mismo proceso, sin pasar por la red.
export { createMcpServer, fetchScopes } from "./server.ts";
export { httpApiClient, ApiFailure, type ApiClient, type ApiResponse } from "./api-client.ts";
