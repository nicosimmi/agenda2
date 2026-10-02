import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Los tests de integración usan la base de datos de .env (en CI llega DATABASE_URL).
if (existsSync(".env")) process.loadEnvFile(".env");

// Un solo Vitest en la raíz que recorre todos los paquetes.
// Ningún test automático llama a un LLM real (regla 11 del SPEC).
export default defineConfig({
  test: {
    include: ["{apps,packages,evals}/**/*.test.ts"],
    passWithNoTests: false,
  },
});
