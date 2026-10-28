// Rutas públicas (sin sesión): categorías, búsqueda, ficha del negocio y huecos libres.
// Solo exponen negocios publicados; un borrador o suspendido responde 404 como si no existiera.
import { availabilityQuerySchema, searchQuerySchema } from "@agendia/shared";
import { and, asc, eq, ne } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { findSlots } from "../availability.ts";
import {
  businessMedia,
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
const mediaParams = z.object({ id: z.uuid() });

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
    const [serviceRows, staffRows, links, hours, faq, media] = await Promise.all([
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
      db
        .select({ id: businessMedia.id, staffId: businessMedia.staffId })
        .from(businessMedia)
        .where(eq(businessMedia.businessId, b.id))
        .orderBy(asc(businessMedia.createdAt)),
    ]);
    const activeServices = new Set(serviceRows.map((s) => s.id));
    // Solo se muestran los profesionales que pueden hacer algún servicio activo.
    const team = staffRows
      .map((m) => ({
        ...m,
        photoId: media.find((p) => p.staffId === m.id)?.id ?? null,
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
      photos: media.filter((p) => p.staffId === null).map((p) => ({ id: p.id })),
    };
  });

  // Imagen de un negocio o de uno de sus profesionales. El id es un UUID aleatorio: no se puede
  // enumerar, y así el panel puede enseñar las fotos de un negocio aún en borrador. Un negocio
  // suspendido deja de servirlas.
  app.get("/media/:id", { config: limit }, async (req, reply) => {
    const [row] = await db
      .select({ contentType: businessMedia.contentType, data: businessMedia.data })
      .from(businessMedia)
      .innerJoin(businesses, eq(businesses.id, businessMedia.businessId))
      .where(
        and(
          eq(businessMedia.id, mediaParams.parse(req.params).id),
          ne(businesses.status, "suspended"),
        ),
      );
    if (!row) throw notFound("Foto");
    return (
      reply
        .header("content-type", row.contentType)
        .header("cache-control", "public, max-age=31536000, immutable")
        .header("content-security-policy", "default-src 'none'")
        // helmet pone same-origin por defecto: la imagen es pública y se puede incrustar.
        .header("cross-origin-resource-policy", "cross-origin")
        .send(row.data)
    );
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
