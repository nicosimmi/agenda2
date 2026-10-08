import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// En desarrollo, el navegador habla solo con Vite (5173) y Vite reenvía a la API:
// así la cookie de sesión es del mismo origen y no hace falta CORS.
export default defineConfig({
  // En GitHub Pages la web vive en /<repositorio>/ (VITE_BASE la pone el workflow).
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.API_URL ?? "http://localhost:3000",
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
