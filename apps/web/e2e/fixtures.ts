import { test as base, expect } from "@playwright/test";

/** `test` con el aviso de cookies ya aceptado (salvo en las pruebas que lo comprueban). */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem("e2e-keep-cookie-banner"))
        localStorage.setItem("agendia-cookies", "ok");
    });
    await use(page);
  },
});

export { expect };

/** Fecha local "AAAA-MM-DD" de un instante en Madrid (la zona de los negocios de demostración). */
export const madridDay = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
