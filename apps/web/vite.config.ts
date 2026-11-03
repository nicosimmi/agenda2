import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Content-Security-Policy como <meta> solo en el build (en desarrollo Vite inyecta scripts en línea).
// Sirve también en GitHub Pages, donde no se pueden poner cabeceras. Los scripts en línea se
// autorizan por hash. `frame-ancestors` no funciona en meta: lo pondría el proxy de producción.
function csp(): Plugin {
  return {
    name: "agendia-csp",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const hashes = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
          (m) => `'sha256-${createHash("sha256").update(m[1]!).digest("base64")}'`,
        );
        const policy = [
          "default-src 'self'",
          `script-src 'self' ${hashes.join(" ")}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self'",
          "connect-src 'self' https://firestore.googleapis.com",
          "worker-src 'self' blob:",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; ");
        return html.replace(
          "<head>",
          `<head>
    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
        );
      },
    },
  };
}

// En desarrollo, el navegador habla solo con Vite (5173) y Vite reenvía a la API:
// así la cookie de sesión es del mismo origen y no hace falta CORS.
export default defineConfig({
  // En GitHub Pages la web vive en /<repositorio>/ (VITE_BASE la pone el workflow).
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), tailwindcss(), csp()],
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
