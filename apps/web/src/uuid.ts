/**
 * UUID v4. `crypto.randomUUID` solo existe en contextos seguros (https o localhost), así que al
 * abrir la web por http desde otro dispositivo de la red (p. ej. el móvil) no está; `getRandomValues`
 * sí. Hace falta un UUID válido porque la API (y los esquemas de la demo) lo validan.
 */
export function uuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (n) => n.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
