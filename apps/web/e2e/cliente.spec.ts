// Recorrido de una persona cliente: ve el aviso de cookies, cambia el tema, busca un negocio,
// reserva (creando su cuenta por el camino), ve y cancela la reserva, y el negocio la ve en su agenda.
// Usa los negocios de demostración: antes de la primera ejecución, `pnpm --filter @agendia/api db:seed`.
import { expect, madridDay, test } from "./fixtures.ts";

const BUSINESS = "Barbería El Califa";

test("aviso de cookies: aparece, se cierra y no vuelve", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("e2e-keep-cookie-banner", "1"));
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("agendia-cookies"));
  await page.reload();
  const banner = page.getByRole("dialog", { name: "Aviso de cookies" });
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "Entendido" }).click();
  await expect(banner).toBeHidden();
  await page.reload();
  await expect(banner).toBeHidden();
});

test("modo oscuro: el interruptor cambia el tema y se recuerda", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("switch", { name: "Modo oscuro" }).first();
  const html = page.locator("html");
  const before = await html.evaluate((el) => el.classList.contains("dark"));
  await toggle.click();
  await expect(html).toHaveClass(before ? /^(?!.*dark).*$/ : /dark/);
  await page.reload();
  await expect(html).toHaveClass(before ? /^(?!.*dark).*$/ : /dark/);
  await page.getByRole("switch", { name: "Modo oscuro" }).first().click();
  await expect(html).toHaveClass(before ? /dark/ : /^(?!.*dark).*$/);
});

test("subir arriba y preguntas frecuentes", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Lo esencial para que reserven en un minuto" }),
  ).toBeAttached();
  await page.evaluate(() => window.scrollTo(0, 1800));
  const up = page.getByRole("button", { name: "Volver arriba" });
  await expect(up).toBeVisible();
  await up.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);

  const question = page.getByRole("button", { name: "¿Tengo que pagar para reservar?" });
  await question.scrollIntoViewIfNeeded();
  await question.click();
  await expect(question).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Reservar en AgendIA es gratis")).toBeVisible();
});

test("el buscador rápido se abre con la tecla / y lleva al negocio", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /^Buscar \(atajo/ })).toBeVisible(); // la página ya está montada
  await page.keyboard.press("/");
  const dialog = page.getByRole("dialog", { name: "Buscar negocios" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox").fill("califa");
  await expect(dialog.getByRole("option", { name: new RegExp(BUSINESS) })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/n\/barberia-el-califa/);
  await expect(page.getByRole("heading", { level: 1, name: BUSINESS })).toBeVisible();
});

test("cliente: busca, reserva creando su cuenta, cancela, y el negocio la ve", async ({
  page,
  browser,
}) => {
  const email = `cliente-${Date.now()}@demo.agendia.test`;
  const name = `Clara E2E ${Date.now() % 10000}`;

  // Buscar desde la portada
  await page.goto("/");
  await page.getByPlaceholder("Barbería, fisio…").fill("califa");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/\/buscar\?q=califa/);
  await page.getByRole("link", { name: new RegExp(BUSINESS) }).click();
  await expect(page.getByRole("heading", { level: 1, name: BUSINESS })).toBeVisible();

  // Elegir servicio, profesional y un hueco de otro día (para quedar fuera del plazo de cancelación)
  const flow = page.locator("#reservar");
  await flow.getByRole("radio", { name: /Corte de pelo/ }).click();
  await flow.getByRole("radio", { name: "Cualquiera disponible" }).click(); // el negocio tiene dos profesionales
  const lastDay = flow.locator('[role="option"]:not([disabled])').last();
  await lastDay.click();
  await expect(lastDay).toHaveAttribute("aria-selected", "true");
  await page.waitForTimeout(400); // los horarios del día anterior salen con una animación
  await flow
    .locator("button[aria-pressed]")
    .filter({ hasText: /^\d{1,2}:\d{2}$/ })
    .first()
    .click();

  // Sin sesión se pide entrar; la selección se conserva al volver
  await expect(flow.getByText("Entra para confirmar tu reserva")).toBeVisible();
  await flow.getByRole("link", { name: "Crear cuenta" }).click();
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Contraseña/).fill("clave-segura-123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/n\/barberia-el-califa/);
  await expect(
    flow
      .getByText("Confirmar reserva", { exact: true })
      .or(flow.getByRole("button", { name: "Confirmar reserva" }))
      .first(),
  ).toBeVisible();
  await flow.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(flow.getByRole("heading", { name: "Reserva confirmada" })).toBeVisible();
  const code = (await flow.getByTestId("booking-code").textContent())!.trim();
  expect(code).toHaveLength(10);

  // Mis reservas
  await flow.getByRole("link", { name: "Ver mis reservas" }).click();
  await expect(page.getByRole("heading", { name: "Mis reservas" })).toBeVisible();
  const card = page.getByRole("listitem").filter({ hasText: code });
  await expect(card).toContainText("Confirmada");
  await expect(card).toContainText("Corte de pelo");

  // El negocio ve la reserva en su agenda
  const booking = await page.evaluate(
    async () => (await (await fetch("/api/me/bookings")).json())[0],
  );
  const owner = await browser.newContext();
  await owner.addInitScript(() => localStorage.setItem("agendia-cookies", "ok"));
  const panel = await owner.newPage();
  await panel.goto("/entrar");
  await panel.getByLabel("Email").fill("barberia-el-califa@demo.agendia.test");
  await panel.getByLabel("Contraseña").fill("demo-1234");
  await panel.getByRole("button", { name: "Entrar", exact: true }).click();
  await panel.getByRole("link", { name: "Agenda" }).click();
  await panel.getByLabel("Día").fill(madridDay(booking.startsAt));
  await expect(panel.getByText(name)).toBeVisible();
  await owner.close();

  // Cancelar
  await card.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí, cancelar" }).click();
  await page.getByRole("tab", { name: /Pasadas y canceladas/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: code })).toContainText("Cancelada");
});

test("token para un asistente: se crea en la web, propone pero no confirma, y se revoca", async ({
  page,
}) => {
  const email = `token-${Date.now()}@demo.agendia.test`;
  await page.goto("/registro");
  await page.getByLabel("Tu nombre").fill("Tomás Token");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Contraseña/).fill("clave-segura-123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page.getByRole("heading", { name: "Mis reservas" })).toBeVisible();

  // Crear un token del tipo «asistente» (leer y proponer)
  await page.getByRole("button", { name: "Crear token" }).click();
  const token = (await page.getByTestId("new-token").textContent())!.trim();
  expect(token).toMatch(/^agt_/);
  const auth = { authorization: `Bearer ${token}` };

  // Un hueco libre de un negocio de demostración
  const detail = await (await page.request.get("/api/public/businesses/barberia-el-califa")).json();
  const service = detail.services.find((s: { name: string }) => s.name === "Corte de pelo");
  const from = madridDay(new Date(Date.now() + 2 * 86_400_000).toISOString());
  const to = madridDay(new Date(Date.now() + 9 * 86_400_000).toISOString());
  const slots = (
    await (
      await page.request.get(
        `/api/public/businesses/barberia-el-califa/availability?serviceId=${service.id}&from=${from}&to=${to}`,
      )
    ).json()
  ).slots as { staffId: string; startsAt: string }[];
  const slot = slots[0]!;
  const body = {
    businessSlug: "barberia-el-califa",
    serviceId: service.id,
    staffId: slot.staffId,
    startsAt: slot.startsAt,
  };

  // Con ese token se puede proponer, pero no confirmar ni reservar directamente ni crear más tokens
  const proposed = await page.request.post("/api/me/bookings/propose", {
    headers: auth,
    data: body,
  });
  expect(proposed.status()).toBe(201);
  const { id } = await proposed.json();
  expect(
    (await page.request.post(`/api/me/bookings/${id}/confirm`, { headers: auth })).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/me/bookings", {
        headers: { ...auth, "idempotency-key": "k" },
        data: body,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/me/tokens", {
        headers: auth,
        data: { label: "x", scopes: ["bookings:read"] },
      })
    ).status(),
  ).toBe(403);

  // La propuesta aparece como pendiente en Mis reservas y la persona la puede cancelar
  await page.reload();
  const card = page.getByRole("listitem").filter({ hasText: "Pendiente" });
  await expect(card).toContainText("Corte de pelo");
  await card.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sí, cancelar" }).click();

  // Revocar el token lo deja sin acceso al momento
  await page.getByRole("button", { name: "Revocar" }).click();
  await expect
    .poll(async () => (await page.request.get("/api/me/bookings", { headers: auth })).status())
    .toBe(401);
});
