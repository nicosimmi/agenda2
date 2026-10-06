// Rutas públicas (sin sesión): categorías, búsqueda, ficha del negocio y huecos libres.
// Solo exponen negocios publicados; un borrador o suspendido responde 404 como si no existiera.
import { availabilityQuerySchema, searchQuerySchema } from "@agendia/shared";
import { and, asc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { findSlots } from "../availability.ts";
import {
  businesses,
  categories,
  faqEntries,
  services,
  staff,
  staffServices,
  workingHours,
} from "../db/schema.ts";
import { notFound } from "../errors.ts";
import { searchBusinesses } from "../search.ts";

const slugParams = z.object({ slug: z.string().min(1).max(100) });
const limit = { rateLimit: { max: 120, timeWindow: "1 minute" } };

export async function publicRoutes(app: FastifyInstance) {
  const { db } = app;

  async function publishedBySlug(slug: string) {
    const [row] = await db
      .select({
        business: businesses,
        categorySlug: categories.slug,
        categoryName: categories.name,
      })
      .from(businesses)
      .innerJoin(categories, eq(categories.id, businesses.categoryId))
      .where(and(eq(businesses.slug, slug), eq(businesses.status, "published")));
    if (!row) throw notFound("Negocio");
    return row;
  }

  app.get("/categories", { config: limit }, async () =>
    db
      .select({ slug: categories.slug, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.name)),
  );

  app.get("/businesses", { config: limit }, async (req) =>
    searchBusinesses(db, searchQuerySchema.parse(req.query)),
  );

  app.get("/businesses/:slug", { config: limit }, async (req) => {
    const {
      business: b,
      categorySlug,
      categoryName,
    } = await publishedBySlug(slugParams.parse(req.params).slug);
    const [serviceRows, staffRows, links, hours, faq] = await Promise.all([
      db
        .select({
          id: services.id,
          name: services.name,
          description: services.description,
          durationMin: services.durationMin,
          priceCents: services.priceCents,
        })
        .from(services)
        .where(and(eq(services.businessId, b.id), eq(services.active, true)))
        .orderBy(asc(services.name)),
      db
        .select({ id: staff.id, name: staff.name })
        .from(staff)
        .where(and(eq(staff.businessId, b.id), eq(staff.active, true)))
        .orderBy(asc(staff.name)),
      db.select().from(staffServices).where(eq(staffServices.businessId, b.id)),
      db
        .select({
          staffId: workingHours.staffId,
          weekday: workingHours.weekday,
          startTime: workingHours.startTime,
          endTime: workingHours.endTime,
        })
        .from(workingHours)
        .where(eq(workingHours.businessId, b.id))
        .orderBy(asc(workingHours.weekday), asc(workingHours.startTime)),
      db
        .select({ id: faqEntries.id, question: faqEntries.question, answer: faqEntries.answer })
        .from(faqEntries)
        .where(eq(faqEntries.businessId, b.id)),
    ]);
    const activeServices = new Set(serviceRows.map((s) => s.id));
    // Solo se muestran los profesionales que pueden hacer algún servicio activo.
    const team = staffRows
      .map((m) => ({
        ...m,
        serviceIds: links
          .filter((l) => l.staffId === m.id && activeServices.has(l.serviceId))
          .map((l) => l.serviceId),
      }))
      .filter((m) => m.serviceIds.length > 0);
    const visible = new Set(team.map((m) => m.id));
    return {
      slug: b.slug,
      name: b.name,
      description: b.description,
      categorySlug,
      categoryName,
      addressLine: b.addressLine,
      city: b.city,
      province: b.province,
      postalCode: b.postalCode,
      contactPhone: b.contactPhone,
      contactEmail: b.contactEmail,
      timezone: b.timezone,
      cancelLimitHours: b.cancelLimitHours,
      services: serviceRows,
      staff: team,
      hours: hours.filter((h) => visible.has(h.staffId)),
      faq,
    };
  });

  app.get("/businesses/:slug/availability", { config: limit }, async (req) => {
    const { business } = await publishedBySlug(slugParams.parse(req.params).slug);
    const query = availabilityQuerySchema.parse(req.query);
    const { slots, service } = await findSlots(db, business, query);
    if (!service) throw notFound("Servicio");
    return {
      timezone: business.timezone,
      slots: slots.map((s) => ({ staffId: s.staffId, startsAt: s.startsAt, endsAt: s.endsAt })),
    };
  });
}
