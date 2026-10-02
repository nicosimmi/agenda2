import { defineConfig } from "vitest/config";

// Un solo Vitest en la raíz que recorre todos los paquetes.
// Ningún test automático llama a un LLM real (regla 11 del SPEC).
export default defineConfig({
  test: {
    include: ["{apps,packages,evals}/**/*.test.ts"],
    passWithNoTests: false,
  },
});
