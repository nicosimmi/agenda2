// Rutas para n8n (SPEC §12): recordatorios de 24 h. No hay sesión ni negocio: son tareas del
// sistema que recorren todos los negocios, así que se autentican con la firma HMAC (ver
// signing.ts) y no aceptan ningún business_id del cliente. Cada fila trae el suyo en su payload.
import { and, asc, eq, gt, isNotNull, isNull, lte, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { bookings } from "../db/schema.ts";
import { AppError, notFound } from "../errors.ts";
import { bookingEmailData } from "../outbox.ts";
import { verifySignature } from "../signing.ts";

const params = z.object({ id: z.uuid() });
const REMINDER_HOURS = 24;
const MAX_PER_CALL = 100;

export async function internalRoutes(app: FastifyInstance) {
  const { db } = app;

  app.addHook("onRequest", async (req) => {
    // Ninguna de estas rutas lleva cuerpo, así que lo firmado es "MÉTODO ruta\n".
    const data = `${req.method} ${req.url}\n`;
    if (!verifySignature(app.config.automationSecret ?? "", req.headers, data)) {
      throw new AppError(401, "UNAUTHORIZED", "Firma no válida");
    }
  });

  // Reservas confirmadas que empiezan en las próximas 24 h y no tienen recordatorio. Las que se
  // reservaron, confirmaron o movieron con menos de 24 h de antelación no lo llevan: el aviso de
  // confirmación o de cambio se envió hace poco (por eso se mira updated_at y no created_at).
  app.get("/reminders", async () => {
    const limit = new Date(Date.now() + REMINDER_HOURS * 3_600_000);
    const due = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "confirmed"),
          isNotNull(bookings.customerId),
          isNull(bookings.reminderSentAt),
          gt(bookings.startsAt, new Date()),
          lte(bookings.startsAt, limit),
          sql`${bookings.updatedAt} < ${bookings.startsAt} - interval '24 hours'`,
        ),
      )
      .orderBy(asc(bookings.startsAt))
      .limit(MAX_PER_CALL);
    const reminders = [];
    for (const { id } of due) reminders.push((await bookingEmailData(db, id)).payload);
    return reminders;
  });

  // n8n lo llama tras enviar el email; repetirlo no cambia nada.
  app.post("/reminders/:id/sent", async (req, reply) => {
    const { id } = params.parse(req.params);
    const [row] = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, id));
    if (!row) throw notFound("Reserva");
    await db
      .update(bookings)
      .set({ reminderSentAt: new Date() })
      .where(and(eq(bookings.id, id), isNull(bookings.reminderSentAt)));
    return reply.status(204).send();
  });
}
