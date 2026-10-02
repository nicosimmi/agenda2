// Esquema de la base de datos (SPEC §5) con Drizzle.
// Multitenencia: toda tabla de un negocio lleva business_id NOT NULL y UNIQUE (id, business_id),
// para que las demás tablas la referencien con claves foráneas compuestas (id, business_id).
// Así la base de datos impide, por ejemplo, una reserva con un profesional de un negocio
// y un servicio de otro. Lo que Drizzle no sabe expresar (restricción de exclusión,
// trigger de search_vector, índices pg_trgm) está en la migración SQL 0001_custom.sql.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const instant = (name: string) => timestamp(name, { withTimezone: true });

export const userRole = pgEnum("user_role", ["customer", "business_owner", "platform_admin"]);
export const memberRole = pgEnum("member_role", ["owner"]);
export const businessStatus = pgEnum("business_status", ["draft", "published", "suspended"]);
export const bookingStatus = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
  "expired",
]);
export const bookingSource = pgEnum("booking_source", ["web", "agent", "business"]);

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRole("role").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  emailVerifiedAt: instant("email_verified_at"),
  createdAt: createdAt(),
});

export const categories = pgTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const businesses = pgTable(
  "businesses",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    status: businessStatus("status").notNull().default("draft"),
    addressLine: text("address_line"),
    city: text("city"),
    province: text("province"),
    postalCode: text("postal_code"),
    country: text("country").notNull().default("ES"),
    lat: doublePrecision("lat"), // preparadas para la versión B (mapa); hoy no se usan
    lng: doublePrecision("lng"),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    timezone: text("timezone").notNull().default("Europe/Madrid"),
    slotStepMin: integer("slot_step_min").notNull().default(15),
    minNoticeMin: integer("min_notice_min").notNull().default(120),
    maxHorizonDays: integer("max_horizon_days").notNull().default(60),
    cancelLimitHours: integer("cancel_limit_hours").notNull().default(12),
    searchVector: tsvector("search_vector"), // lo rellena un trigger (0001_custom.sql)
    createdAt: createdAt(),
  },
  (t) => [
    index("businesses_status_idx").on(t.status),
    check("businesses_slot_step_positive", sql`${t.slotStepMin} > 0`),
  ],
);

export const businessMembers = pgTable(
  "business_members",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("owner"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.businessId] })],
);

// --- Tablas de negocio ---

const businessId = () =>
  uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" });

export const services = pgTable(
  "services",
  {
    id: id(),
    businessId: businessId(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    durationMin: integer("duration_min").notNull(),
    bufferMin: integer("buffer_min").notNull().default(0),
    priceCents: integer("price_cents").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [
    unique("services_id_business_unique").on(t.id, t.businessId),
    check("services_duration_positive", sql`${t.durationMin} > 0`),
    check("services_buffer_non_negative", sql`${t.bufferMin} >= 0`),
    check("services_price_non_negative", sql`${t.priceCents} >= 0`),
  ],
);

export const staff = pgTable(
  "staff",
  {
    id: id(),
    businessId: businessId(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => [unique("staff_id_business_unique").on(t.id, t.businessId)],
);

export const staffServices = pgTable(
  "staff_services",
  {
    businessId: businessId(),
    staffId: uuid("staff_id").notNull(),
    serviceId: uuid("service_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.staffId, t.serviceId] }),
    foreignKey({
      name: "staff_services_staff_fk",
      columns: [t.staffId, t.businessId],
      foreignColumns: [staff.id, staff.businessId],
    }).onDelete("cascade"),
    foreignKey({
      name: "staff_services_service_fk",
      columns: [t.serviceId, t.businessId],
      foreignColumns: [services.id, services.businessId],
    }).onDelete("cascade"),
  ],
);

export const workingHours = pgTable(
  "working_hours",
  {
    id: id(),
    businessId: businessId(),
    staffId: uuid("staff_id").notNull(),
    weekday: smallint("weekday").notNull(), // 1 = lunes … 7 = domingo
    startTime: time("start_time").notNull(), // hora local del negocio
    endTime: time("end_time").notNull(),
  },
  (t) => [
    unique("working_hours_id_business_unique").on(t.id, t.businessId),
    foreignKey({
      name: "working_hours_staff_fk",
      columns: [t.staffId, t.businessId],
      foreignColumns: [staff.id, staff.businessId],
    }).onDelete("cascade"),
    check("working_hours_weekday_range", sql`${t.weekday} BETWEEN 1 AND 7`),
    check("working_hours_end_after_start", sql`${t.endTime} > ${t.startTime}`),
    index("working_hours_staff_idx").on(t.staffId),
  ],
);

export const timeOff = pgTable(
  "time_off",
  {
    id: id(),
    businessId: businessId(),
    staffId: uuid("staff_id"), // NULL = cierra todo el negocio (la FK compuesta no se comprueba)
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
    reason: text("reason"),
  },
  (t) => [
    unique("time_off_id_business_unique").on(t.id, t.businessId),
    foreignKey({
      name: "time_off_staff_fk",
      columns: [t.staffId, t.businessId],
      foreignColumns: [staff.id, staff.businessId],
    }).onDelete("cascade"),
    check("time_off_ends_after_starts", sql`${t.endsAt} > ${t.startsAt}`),
    index("time_off_business_starts_idx").on(t.businessId, t.startsAt),
  ],
);

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    businessId: businessId(),
    code: text("code").notNull().unique(), // aleatorio y no adivinable (newBookingCode)
    staffId: uuid("staff_id").notNull(),
    serviceId: uuid("service_id").notNull(),
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "set null" }),
    guestName: text("guest_name"),
    guestPhone: text("guest_phone"),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(), // inicio + duración + buffer (DECISIONS F1-3)
    status: bookingStatus("status").notNull().default("pending"),
    source: bookingSource("source").notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    expiresAt: instant("expires_at"), // solo en pending: retiene el hueco 10 min
  },
  (t) => [
    unique("bookings_id_business_unique").on(t.id, t.businessId),
    foreignKey({
      name: "bookings_staff_fk",
      columns: [t.staffId, t.businessId],
      foreignColumns: [staff.id, staff.businessId],
    }),
    foreignKey({
      name: "bookings_service_fk",
      columns: [t.serviceId, t.businessId],
      foreignColumns: [services.id, services.businessId],
    }),
    check("bookings_ends_after_starts", sql`${t.endsAt} > ${t.startsAt}`),
    index("bookings_business_starts_idx").on(t.businessId, t.startsAt),
    index("bookings_staff_idx").on(t.staffId),
    index("bookings_customer_idx").on(t.customerId),
    // + restricción de exclusión anti-solapamiento en 0001_custom.sql
  ],
);

export const faqEntries = pgTable(
  "faq_entries",
  {
    id: id(),
    businessId: businessId(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
  },
  (t) => [unique("faq_entries_id_business_unique").on(t.id, t.businessId)],
);

// --- Transversales ---

export const agentEvents = pgTable(
  "agent_events",
  {
    id: id(),
    sessionId: text("session_id").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "set null" }),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    type: text("type").notNull(),
    toolName: text("tool_name"),
    payload: jsonb("payload").notNull().default({}),
    latencyMs: integer("latency_ms"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    createdAt: createdAt(),
  },
  (t) => [index("agent_events_session_idx").on(t.sessionId)],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: id(),
    businessId: businessId(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: createdAt(),
    deliveredAt: instant("delivered_at"),
    attempts: integer("attempts").notNull().default(0),
  },
  (t) => [
    index("outbox_events_pending_idx")
      .on(t.createdAt)
      .where(sql`delivered_at IS NULL`),
  ],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: text("key").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    response: jsonb("response").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

// Sesiones de usuario (cookie HttpOnly). Solo se guarda el hash SHA-256 del token:
// si se filtra la base de datos, los tokens no sirven para entrar.
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: instant("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);
