import { MAX_PHOTO_BYTES } from "@agendia/shared";

/** Dirección de una foto: en la demo viene en la propia respuesta; con la API, de /public/media. */
export const photoSrc = (id: string, src?: string | null) => src ?? `/api/public/media/${id}`;

/**
 * Reduce la foto en el navegador (máx. 1000 px por lado, JPEG) antes de subirla: así pesa poco,
 * se guarda con un formato conocido y no se sube el original (con su ubicación EXIF, por ejemplo).
 */
export async function imageToDataUrl(file: File): Promise<string> {
  // En la demo la foto acaba en Firestore, que admite menos de 1 MB por documento: se reduce más.
  const demo = import.meta.env.VITE_DEMO === "1";
  const maxSide = demo ? 800 : 1000;
  const maxBytes = demo ? 110_000 : MAX_PHOTO_BYTES;
  if (!file.type.startsWith("image/")) throw new Error("Elige una imagen (JPG, PNG o WebP)");
  if (file.size > 20_000_000) throw new Error("La imagen es demasiado grande");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("No se pudo leer la imagen. Prueba con un JPG, PNG o WebP");
  });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // los PNG con transparencia no se quedan en negro al pasar a JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if ((url.length - url.indexOf(",") - 1) * 0.75 <= maxBytes) return url;
  }
  throw new Error("La imagen pesa demasiado");
}
