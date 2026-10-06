import { expect, test } from "@playwright/test";

// Flujo completo del propietario: alta → configurar → publicar → reserva manual en la agenda.
test("alta, configuración, publicación y reserva manual", async ({ page }) => {
  const email = `e2e-${Date.now()}@demo.agendia.test`;

  // Alta en dos pasos
  await page.goto("/alta");
  await page.getByLabel("Tu nombre").fill("Ana Prueba");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel(/Contraseña/).fill("clave-segura-123");
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByLabel("Nombre del negocio").fill("Peluquería E2E");
  await page.getByLabel("Categoría").selectOption("peluqueria");
  await page.getByRole("button", { name: "Crear negocio" }).click();

  // Un negocio nuevo es un borrador y no se puede publicar todavía
  await expect(page.getByText("borrador")).toBeVisible();
  await expect(page.getByRole("button", { name: "Publicar negocio" })).toBeDisabled();

  // Perfil: dirección y ciudad
  await page.getByRole("link", { name: "Perfil" }).click();
  await expect(page.getByRole("heading", { name: "Perfil del negocio" })).toBeVisible();
  await page.getByLabel("Dirección").fill("Calle Mayor 1");
  await page.getByLabel("Ciudad").fill("Córdoba");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("status")).toHaveText("Guardado");

  // Servicio
  await page.getByRole("link", { name: "Servicios" }).click();
  await expect(page.getByRole("heading", { name: "Añadir servicio" })).toBeVisible();
  await page.getByLabel("Nombre").fill("Corte");
  await page.getByLabel("Duración (min)").fill("30");
  await page.getByLabel("Precio (€)").fill("15");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Corte" })).toContainText("30 min");

  // Profesional con su servicio y su horario
  await page.getByRole("link", { name: "Equipo" }).click();
  await expect(page.getByRole("heading", { name: "Añadir profesional" })).toBeVisible();
  await page.getByLabel("Nombre").fill("Lola");
  await page.getByRole("button", { name: "Añadir", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Lola" })).toBeVisible();
  // El checkbox se actualiza al volver la API, por eso clic + espera en vez de check().
  await page.getByLabel("Corte").click();
  await expect(page.getByLabel("Corte")).toBeChecked();
  await page.getByRole("button", { name: "Añadir franja" }).click();
  await page.getByRole("button", { name: "Guardar horario" }).click();
  await expect(page.getByText("Guardado")).toBeVisible();

  // Con la lista completa, ya se puede publicar
  await page.getByRole("link", { name: "Inicio" }).click();
  await page.getByRole("button", { name: "Publicar negocio" }).click();
  await expect(page.getByText("publicado")).toBeVisible();

  // Reserva manual y comprobación en la agenda de hoy
  await page.getByRole("link", { name: "Agenda" }).click();
  await expect(page.getByRole("heading", { name: "Reserva manual" })).toBeVisible();
  await page.getByLabel(/^Hora/).fill("10:00");
  await page.getByLabel("Nombre del cliente").fill("Marta Cliente");
  await page.getByRole("button", { name: "Reservar" }).click();
  await expect(page.getByText("Marta Cliente")).toBeVisible();
});
