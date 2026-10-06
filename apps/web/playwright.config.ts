import { defineConfig } from "@playwright/test";

// El E2E levanta su propia API (puerto 3100) y su propio Vite (5174), para no chocar con el entorno
// de desarrollo. La API es un proceso nuevo cada vez, así que el límite de altas por IP (en memoria)
// empieza de cero. Necesita Postgres levantado y migrado (docker compose up -d).
const API_PORT = "3100";
const WEB_PORT = 5174;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/warmup.ts",
  timeout: 45_000,
  workers: 2,
  // Vite en desarrollo compila cada página la primera vez que se visita (p. ej. el panel tras entrar).
  expect: { timeout: 15_000 },
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: "retain-on-failure" },
  webServer: [
    {
      command: "pnpm --filter @agendia/api start",
      url: `http://localhost:${API_PORT}/health`,
      env: { API_PORT, WEB_ORIGIN: `http://localhost:${WEB_PORT}`, LLM_PROVIDER: "demo" },
      reuseExistingServer: false,
    },
    {
      command: `pnpm exec vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { API_URL: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
});
