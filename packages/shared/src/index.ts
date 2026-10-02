// Esquemas Zod y tipos compartidos entre web, API y MCP.
import { z } from "zod";

/** Códigos del formato de error uniforme de la API: { error: { code, message } }. */
export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CSRF"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

export interface ApiError {
  error: { code: ErrorCode; message: string };
}

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));
// Máximo 128: argon2 con entradas enormes es una vía de denegación de servicio.
const password = z.string().min(8).max(128);
const name = z.string().trim().min(1).max(100);

export const registerSchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("customer"), email, password, name }),
  z.object({
    role: z.literal("business_owner"),
    email,
    password,
    name,
    businessName: name,
    categorySlug: z.string().min(1).max(50),
  }),
]);
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export type LoginInput = z.infer<typeof loginSchema>;

export type UserRole = "customer" | "business_owner" | "platform_admin";

export interface Me {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
