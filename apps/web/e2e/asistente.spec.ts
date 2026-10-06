// El asistente de IA con el guion de demostración (LLM_PROVIDER=demo, sin clave ni gasto): habla,
// prepara una reserva y esta solo existe cuando la persona pulsa «Confirmar» en la tarjeta.
// Usa los negocios de demostración: antes de la primera ejecución, `pnpm --filter @agendia/api db:seed`.
import { expect, test } from "./fixtures.ts";

const ASK = "Quiero reservar un corte en una barbería";

test("sin sesión el asistente busca pero pide iniciar sesión para proponer", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir el asistente de reservas" }).click();
  const chat = page.getByRole("dialog", { name: "Asistente de reservas" });
  await expect(chat.getByText("Asistente con IA de un tercero")).toBeVisible();

  await chat.getByLabel("Mensaje para el asistente").fill(ASK);
  await chat.getByRole("button", { name: "Enviar" }).click();
  await expect(chat.getByText("necesito que inicies sesión")).toBeVisible({ timeout: 20_000 });
  await expect(chat.getByRole("button", { name: "Confirmar reserva" })).toHaveCount(0);
  await expect(chat.getByRole("link", { name: "iniciar sesión" })).toBeVisible();
});

test("cliente: el asistente propone y la reserva solo existe al pulsar «Confirmar»", async ({
  page,
}) => {
  const email = `asistente-${Date.now()}@demo.agendia.test`;
  await page.goto("/registro");
  await page.getByLabel("Tu nombre").fill("Ana Asistente");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Contraseña/).fill("clave-segura-123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/mis-reservas/);

  await page.getByRole("button", { name: "Abrir el asistente de reservas" }).click();
  const chat = page.getByRole("dialog", { name: "Asistente de reservas" });
  await chat.getByLabel("Mensaje para el asistente").fill(ASK);
  await chat.getByRole("button", { name: "Enviar" }).click();

  // La tarjeta sale de los datos de la API y trae su botón.
  const card = chat.getByText("Reserva propuesta");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(chat.getByText("Te he preparado la reserva")).toBeVisible();

  // Mientras no se pulsa, la reserva está pendiente y no figura como confirmada.
  const mine = () =>
    page.evaluate(
      async () => (await (await fetch("/api/me/bookings")).json()) as { status: string }[],
    );
  expect((await mine()).map((b) => b.status)).not.toContain("confirmed");

  await chat.getByRole("button", { name: "Confirmar reserva" }).click();
  await expect(chat.getByText("Reserva confirmada")).toBeVisible();
  expect((await mine()).map((b) => b.status)).toContain("confirmed");

  await chat.getByRole("link", { name: "Ver mis reservas" }).click();
  await expect(page).toHaveURL(/\/mis-reservas/);
  await expect(page.getByRole("listitem").filter({ hasText: "Confirmada" }).first()).toBeVisible();
});

test("el negocio ve en su panel lo que ha hecho el asistente", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("Email").fill("barberia-el-califa@demo.agendia.test");
  await page.getByLabel("Contraseña").fill("demo-1234");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByRole("link", { name: "Asistente" }).click();
  await expect(page.getByRole("heading", { name: "Asistente de IA" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Actividad reciente" })).toBeVisible();
});
