import { chromium, type FullConfig } from "@playwright/test";

/**
 * Vite en desarrollo compila y optimiza dependencias en la primera visita de cada página (three.js,
 * motion…), y eso puede tardar más que el tiempo de una prueba. Se recorren antes las páginas
 * principales para que las pruebas empiecen con todo ya compilado.
 */
export default async function warmup(config: FullConfig) {
  const baseURL = config.projects[0]!.use.baseURL!;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const path of [
    "/",
    "/buscar",
    "/n/barberia-el-califa",
    "/entrar",
    "/registro",
    "/alta",
    "/mis-reservas",
    "/panel",
  ]) {
    await page.goto(baseURL + path, { waitUntil: "networkidle" }).catch(() => undefined);
  }
  await browser.close();
}
