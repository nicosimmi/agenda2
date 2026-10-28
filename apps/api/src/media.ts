// Fotos del negocio y de sus profesionales. Mismas reglas que el resto del panel: el negocio sale
// del TenantContext y un id de otro negocio no encuentra nada (404).
import { MAX_GALLERY_PHOTOS, MAX_PHOTO_BYTES, type MediaUpload } from "@agendia/shared";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Db } from "./db/client.ts";
import { businessMedia, businesses, staff } from "./db/schema.ts";
import { AppError, notFound } from "./errors.ts";
import type { TenantContext } from "./tenant.ts";

type ContentType = "image/jpeg" | "image/png" | "image/webp";

/** Tipo real según los primeros bytes: lo que diga la cabecera o la extensión no cuenta. */
export function sniffImage(data: Buffer): ContentType | null {
  if (data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (
    data.subarray(0, 4).toString("latin1") === "RIFF" &&
    data.subarray(8, 12).toString("latin1") === "WEBP"
  )
    return "image/webp";
  return null;
}

const invalid = (message: string) => new AppError(400, "VALIDATION_ERROR", message);

function decode(image: string) {
  const data = Buffer.from(image.slice(image.indexOf(",") + 1), "base64");
  if (data.length > MAX_PHOTO_BYTES) throw invalid("La imagen pesa demasiado");
  const contentType = sniffImage(data);
  if (!contentType) throw invalid("El archivo no es una imagen JPEG, PNG o WebP");
  return { data, contentType };
}

export const listMedia = (db: Db, t: TenantContext) =>
  db
    .select({ id: businessMedia.id, staffId: businessMedia.staffId })
    .from(businessMedia)
    .where(eq(businessMedia.businessId, t.businessId))
    .orderBy(asc(businessMedia.createdAt));

export async function addMedia(db: Db, t: TenantContext, input: MediaUpload) {
  const { data, contentType } = decode(input.image);
  return db.transaction(async (tx) => {
    if (input.staffId) {
      const [member] = await tx
        .select({ id: staff.id })
        .from(staff)
        .where(and(eq(staff.id, input.staffId), eq(staff.businessId, t.businessId)));
      if (!member) throw notFound("Profesional");
      // Una foto por profesional: la nueva sustituye a la anterior.
      await tx
        .delete(businessMedia)
        .where(
          and(eq(businessMedia.staffId, member.id), eq(businessMedia.businessId, t.businessId)),
        );
    } else {
      // El negocio se bloquea para que dos subidas a la vez no sobrepasen el límite.
      await tx
        .select({ id: businesses.id })
        .from(businesses)
        .where(eq(businesses.id, t.businessId))
        .for("update");
      const current = await tx
        .select({ id: businessMedia.id })
        .from(businessMedia)
        .where(and(eq(businessMedia.businessId, t.businessId), isNull(businessMedia.staffId)));
      if (current.length >= MAX_GALLERY_PHOTOS)
        throw new AppError(409, "CONFLICT", `Máximo ${MAX_GALLERY_PHOTOS} fotos en la galería`);
    }
    const [row] = await tx
      .insert(businessMedia)
      .values({ businessId: t.businessId, staffId: input.staffId ?? null, contentType, data })
      .returning({ id: businessMedia.id, staffId: businessMedia.staffId });
    return row!;
  });
}

export async function deleteMedia(db: Db, t: TenantContext, id: string) {
  const rows = await db
    .delete(businessMedia)
    .where(and(eq(businessMedia.id, id), eq(businessMedia.businessId, t.businessId)))
    .returning({ id: businessMedia.id });
  if (rows.length === 0) throw notFound("Foto");
}
