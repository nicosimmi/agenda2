// Activa la demo en el navegador: las peticiones a /api/… las contesta demo/server.ts en lugar de
// la red. Solo se carga en el build de GitHub Pages (VITE_DEMO=1); el resto del código no cambia.
import { handle } from "./server.ts";

export function installDemoApi() {
  const network = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin !== location.origin || !url.pathname.startsWith("/api/"))
      return network(input, init);
    const body =
      request.method === "GET" || request.method === "HEAD" ? null : await request.text();
    return handle(request.method, url, body || null);
  };
}
