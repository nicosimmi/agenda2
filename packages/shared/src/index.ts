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

// --- Panel del negocio (/business/*) ---

/** Texto opcional: la cadena vacía borra el valor (se guarda NULL). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

export const businessProfileUpdateSchema = z
  .object({
    name,
    description: z.string().trim().max(2000),
    addressLine: optionalText(200),
    city: optionalText(100),
    province: optionalText(100),
    postalCode: optionalText(10),
    contactPhone: optionalText(30),
    contactEmail: optionalText(254),
    minNoticeMin: z
      .int()
      .min(0)
      .max(14 * 24 * 60),
    maxHorizonDays: z.int().min(0).max(365),
    cancelLimitHours: z
      .int()
      .min(0)
      .max(24 * 30),
  })
  .partial();
export type BusinessProfileUpdate = z.infer<typeof businessProfileUpdateSchema>;

// Los esquemas de actualización parten de los campos sin `default`: en Zod 4 un `.partial()`
// con valores por defecto los aplicaría en cada PATCH y pisaría lo guardado.
const serviceFields = {
  name,
  description: z.string().trim().max(1000),
  durationMin: z.int().min(1).max(480),
  bufferMin: z.int().min(0).max(240),
  priceCents: z.int().min(0).max(1_000_000),
  active: z.boolean(),
};
export const serviceSchema = z.object({
  ...serviceFields,
  description: serviceFields.description.default(""),
  bufferMin: serviceFields.bufferMin.default(0),
  active: serviceFields.active.default(true),
});
export const serviceUpdateSchema = z.object(serviceFields).partial();

const staffFields = { name, active: z.boolean(), serviceIds: z.array(z.uuid()).max(100) };
export const staffSchema = z.object({
  ...staffFields,
  active: staffFields.active.default(true),
  serviceIds: staffFields.serviceIds.default([]),
});
export const staffUpdateSchema = z.object(staffFields).partial();

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida (HH:MM)");
export const weeklyHoursSchema = z.object({
  hours: z
    .array(
      z
        .object({ weekday: z.int().min(1).max(7), startTime: hhmm, endTime: hhmm })
        .refine((h) => h.endTime > h.startTime, {
          message: "La hora de fin debe ser posterior a la de inicio",
        }),
    )
    .max(42),
});

export const timeOffSchema = z
  .object({
    staffId: z.uuid().nullable().default(null), // null = cierra todo el negocio
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    reason: optionalText(200).default(null),
  })
  .refine((t) => t.endsAt > t.startsAt, { message: "El fin debe ser posterior al inicio" });

export const manualBookingSchema = z.object({
  staffId: z.uuid(),
  serviceId: z.uuid(),
  startsAt: z.coerce.date(),
  guestName: name,
  guestPhone: optionalText(30).default(null),
  notes: optionalText(500).default(null),
});

export const bookingStatusSchema = z.object({
  status: z.enum(["cancelled", "completed", "no_show"]),
});

// --- Búsqueda y reservas del cliente (/public/* y /me/*) ---

/** Parámetro de URL opcional: la cadena vacía cuenta como ausente. */
const queryText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

export const searchQuerySchema = z.object({
  q: queryText(100),
  city: queryText(100),
  category: queryText(50),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida (AAAA-MM-DD)");
const MAX_AVAILABILITY_DAYS = 31;

export const availabilityQuerySchema = z
  .object({
    serviceId: z.uuid(),
    staffId: z.uuid().optional(),
    from: isoDate,
    to: isoDate,
  })
  .refine(
    (r) => {
      const days = (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000;
      return days >= 0 && days < MAX_AVAILABILITY_DAYS;
    },
    { message: `Rango de fechas no válido (máximo ${MAX_AVAILABILITY_DAYS} días)` },
  );

export const customerBookingSchema = z.object({
  businessSlug: z.string().min(1).max(100),
  serviceId: z.uuid(),
  staffId: z.uuid().optional(), // sin profesional: la API elige uno libre
  startsAt: z.coerce.date(),
  notes: optionalText(500).default(null),
});

export const rescheduleSchema = z.object({
  startsAt: z.coerce.date(),
  staffId: z.uuid().optional(),
});

export type UserRole = "customer" | "business_owner" | "platform_admin";

export interface Me {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}
