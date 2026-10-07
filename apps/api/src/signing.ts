// Firma HMAC-SHA256 de las peticiones entre la API y n8n (SPEC §12), en los dos sentidos.
// Se firma `${marca de tiempo}.${datos}`; quien recibe recalcula la firma y rechaza las marcas
// de más de 5 minutos, para que una petición capturada no se pueda reutilizar más tarde.
// En los webhooks los datos son el cuerpo; en las llamadas de n8n a la API, "MÉTODO ruta\ncuerpo".
import { createHmac, timingSafeEqual } from "node:crypto";

export const TIMESTAMP_HEADER = "x-agendia-timestamp";
export const SIGNATURE_HEADER = "x-agendia-signature";
const TOLERANCE_S = 300;

const mac = (secret: string, timestamp: string, data: string) =>
  createHmac("sha256", secret).update(`${timestamp}.${data}`).digest("hex");

/** Cabeceras que lleva una petición firmada. */
export function signHeaders(secret: string, data: string, now = Date.now()) {
  const timestamp = String(Math.floor(now / 1000));
  return {
    [TIMESTAMP_HEADER]: timestamp,
    [SIGNATURE_HEADER]: `sha256=${mac(secret, timestamp, data)}`,
  };
}

export function verifySignature(
  secret: string,
  headers: Record<string, string | string[] | undefined>,
  data: string,
  now = Date.now(),
): boolean {
  const timestamp = headers[TIMESTAMP_HEADER];
  const signature = headers[SIGNATURE_HEADER];
  if (!secret || typeof timestamp !== "string" || typeof signature !== "string") return false;
  if (!/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > TOLERANCE_S) {
    return false;
  }
  const expected = Buffer.from(`sha256=${mac(secret, timestamp, data)}`);
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
