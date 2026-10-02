import { randomInt } from "node:crypto";

// Sin 0/O ni 1/I/L para que se pueda dictar por teléfono sin confusiones.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Código de reserva aleatorio (CSPRNG): 31^10 ≈ 8·10^14 combinaciones, no adivinable. */
export function newBookingCode(length = 10): string {
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}
