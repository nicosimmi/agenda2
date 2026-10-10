// Demo pública (GitHub Pages): la web funciona entera en el navegador. Este módulo hace de API:
// responde a las mismas rutas con los mismos formatos, sobre los datos ficticios del seed guardados
// en memoria y en localStorage. Los huecos libres salen del mismo motor que usa la API de verdad
// (`packages/core`) y los datos de entrada se validan con los mismos esquemas de `packages/shared`.
// No hay servidor: nada sale del navegador, y el asistente es un guion fijo, no una IA.
import { computeAvailability, localDate, DAY_MS } from "@agendia/core";
import { uuid } from "../uuid.ts";
import {
  DEMO_BUSINESSES,
  DEMO_CATEGORIES,
  DEMO_CUSTOMER_EMAIL,
  DEMO_PASSWORD,
  PROPOSAL_TTL_MINUTES,
  availabilityQuerySchema,
  bookingStatusSchema,
  businessProfileUpdateSchema,
  customerBookingSchema,
  loginSchema,
  manualBookingSchema,
  registerSchema,
  rescheduleSchema,
  searchQuerySchema,
  serviceSchema,
  serviceUpdateSchema,
  staffSchema,
  staffUpdateSchema,
  timeOffSchema,
  weeklyHoursSchema,
  type Me,
  type UserRole,
} from "@agendia/shared";

type Status = "pending" | "confirmed" | "cancelled" | "completed" | "no_show" | "expired";

interface User extends Me {
  password: string; // solo demo: datos ficticios que no salen del navegador
}
interface Business {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  status: "draft" | "published" | "suspended";
  addressLine: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  timezone: string;
  slotStepMin: number;
  minNoticeMin: number;
  maxHorizonDays: number;
  cancelLimitHours: number;
}
interface Service {
  id: string;
  businessId: string;
  name: string;
  description: string;
  durationMin: number;
  bufferMin: number;
  priceCents: number;
  active: boolean;
}
interface Staff {
  id: string;
  businessId: string;
  name: string;
  active: boolean;
  serviceIds: string[];
}
interface Hours {
  businessId: string;
  staffId: string;
  weekday: number;
  startTime: string;
  endTime: string;
}
interface TimeOff {
  id: string;
  businessId: string;
  staffId: string | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}
interface Booking {
  id: string;
  businessId: string;
  code: string;
  staffId: string;
  serviceId: string;
  customerId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  startsAt: string;
  endsAt: string;
  status: Status;
  source: "web" | "agent" | "business";
  notes: string | null;
  expiresAt: string | null;
}
interface Faq {
  id: string;
  businessId: string;
  question: string;
  answer: string;
}
interface AgentEvent {
  id: string;
  businessId: string;
  type: string;
  toolName: string | null;
  bookingId: string | null;
  createdAt: string;
}
interface State {
  version: number;
  users: User[];
  businesses: Business[];
  services: Service[];
  staff: Staff[];
  hours: Hours[];
  timeOff: TimeOff[];
  bookings: Booking[];
  faq: Faq[];
  agentEvents: AgentEvent[];
  sessionUserId: string | null;
}

const STORAGE_KEY = "agendia-demo";
const VERSION = 1;

function seedState(): State {
  const s: State = {
    version: VERSION,
    users: [
      {
        id: uuid(),
        email: DEMO_CUSTOMER_EMAIL,
        name: "Clara Cliente (demo)",
        role: "customer",
        password: DEMO_PASSWORD,
      },
    ],
    businesses: [],
    services: [],
    staff: [],
    hours: [],
    timeOff: [],
    bookings: [],
    faq: [],
    agentEvents: [],
    sessionUserId: null,
  };
  // El negocio "malicioso" de las evals no forma parte de la demo pública.
  for (const b of DEMO_BUSINESSES.filter((x) => x.status !== "draft")) {
    const owner: User = {
      id: uuid(),
      email: `${b.slug}@demo.agendia.test`,
      name: `Propietario de ${b.name} (demo)`,
      role: "business_owner",
      password: DEMO_PASSWORD,
    };
    s.users.push(owner);
    const businessId = uuid();
    s.businesses.push({
      id: businessId,
      ownerId: owner.id,
      slug: b.slug,
      name: b.name,
      description: b.description,
      categorySlug: b.category,
      status: "published",
      addressLine: b.address,
      city: b.city,
      province: b.province,
      postalCode: b.postalCode,
      contactPhone: "600000000",
      contactEmail: owner.email,
      timezone: b.timezone ?? "Europe/Madrid",
      slotStepMin: 15,
      minNoticeMin: 120,
      maxHorizonDays: 60,
      cancelLimitHours: 12,
    });
    const serviceIds = b.services.map(([name, durationMin, bufferMin, priceCents]) => {
      const id = uuid();
      s.services.push({
        id,
        businessId,
        name,
        description: "",
        durationMin,
        bufferMin,
        priceCents,
        active: true,
      });
      return id;
    });
    for (const member of b.staff) {
      const staffId = uuid();
      s.staff.push({ id: staffId, businessId, name: member.name, active: true, serviceIds });
      for (const [weekdays, startTime, endTime] of member.shifts) {
        for (const weekday of weekdays) {
          s.hours.push({ businessId, staffId, weekday, startTime, endTime });
        }
      }
    }
    for (const [question, answer] of b.faq ?? []) {
      s.faq.push({ id: uuid(), businessId, question, answer });
    }
  }
  return s;
}

function load(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as State | null;
    if (saved?.version === VERSION) return saved;
  } catch {
    // datos corruptos o almacenamiento bloqueado: se empieza de cero
  }
  return seedState();
}

let db = load();
const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // sin almacenamiento (modo privado): la demo sigue en memoria
  }
};

/** Vuelve a los datos iniciales (la demo es de cada visitante). */
export function resetDemo() {
  db = seedState();
  save();
}

// --- Errores con el mismo formato que la API ---

class DemoError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
const notFound = (what: string) => new DemoError(404, "NOT_FOUND", `${what} no encontrado`);
const conflict = (message: string) => new DemoError(409, "CONFLICT", message);
const taken = () => conflict("Ese hueco ya no está disponible. Elige otro");

function me(): User {
  const user = db.users.find((u) => u.id === db.sessionUserId);
  if (!user) throw new DemoError(401, "UNAUTHORIZED", "Inicia sesión para continuar");
  return user;
}
function requireRole(role: UserRole): User {
  const user = me();
  if (user.role !== role) throw new DemoError(403, "FORBIDDEN", "No tienes permiso para esto");
  return user;
}
const publicMe = (u: User): Me => ({ id: u.id, email: u.email, name: u.name, role: u.role });

function ownBusiness(): Business {
  const user = requireRole("business_owner");
  const business = db.businesses.find((b) => b.ownerId === user.id);
  if (!business) throw new DemoError(403, "FORBIDDEN", "No tienes permiso para esto");
  return business;
}
function published(slug: string): Business {
  const b = db.businesses.find((x) => x.slug === slug && x.status === "published");
  if (!b) throw notFound("Negocio");
  return b;
}
const categoryName = (slug: string) => DEMO_CATEGORIES.find(([s]) => s === slug)?.[1] ?? slug;
const fold = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const isLive = (b: Booking, now = Date.now()) =>
  b.status === "confirmed" ||
  (b.status === "pending" && (!b.expiresAt || Date.parse(b.expiresAt) > now));
const shownStatus = (b: Booking): Status =>
  b.status === "pending" && b.expiresAt && Date.parse(b.expiresAt) <= Date.now()
    ? "expired"
    : b.status;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(10)), (n) => CODE_ALPHABET[n % 32]).join("");

// --- Disponibilidad: el mismo motor puro que usa la API ---

function findSlots(
  business: Business,
  q: { serviceId: string; staffId?: string | undefined; from: string; to: string },
  excludeBookingId?: string,
) {
  const service = db.services.find(
    (s) => s.id === q.serviceId && s.businessId === business.id && s.active,
  );
  if (!service) return { slots: [], service: null };
  const staffIds = db.staff
    .filter(
      (m) =>
        m.businessId === business.id &&
        m.active &&
        m.serviceIds.includes(service.id) &&
        (!q.staffId || m.id === q.staffId),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((m) => m.id);
  const slots = computeAvailability({
    service: { durationMin: service.durationMin, bufferMin: service.bufferMin },
    staffCandidates: staffIds,
    workingHours: db.hours.filter((h) => staffIds.includes(h.staffId)),
    timeOff: db.timeOff
      .filter((t) => t.businessId === business.id)
      .map((t) => ({
        staffId: t.staffId,
        startsAt: new Date(t.startsAt),
        endsAt: new Date(t.endsAt),
      })),
    existingBookings: db.bookings
      .filter((b) => b.businessId === business.id && isLive(b) && b.id !== excludeBookingId)
      .map((b) => ({
        staffId: b.staffId,
        startsAt: new Date(b.startsAt),
        endsAt: new Date(b.endsAt),
      })),
    range: { from: q.from, to: q.to },
    now: new Date(),
    businessSettings: business,
  });
  return { slots, service };
}

function freeSlotAt(
  business: Business,
  serviceId: string,
  startsAt: Date,
  staffId?: string,
  exclude?: string,
) {
  const day = localDate(startsAt, business.timezone);
  const { slots, service } = findSlots(
    business,
    { serviceId, staffId, from: day, to: day },
    exclude,
  );
  if (!service) throw notFound("Servicio");
  const slot = slots.find((s) => s.startsAt.getTime() === startsAt.getTime());
  if (!slot) throw taken();
  return { slot, service };
}

// --- Vistas (mismo formato que la API) ---

function customerBookingView(b: Booking) {
  const biz = db.businesses.find((x) => x.id === b.businessId)!;
  const svc = db.services.find((x) => x.id === b.serviceId)!;
  return {
    id: b.id,
    code: b.code,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    status: shownStatus(b),
    expiresAt: b.expiresAt,
    notes: b.notes,
    businessName: biz.name,
    businessSlug: biz.slug,
    businessCity: biz.city,
    businessTimezone: biz.timezone,
    cancelLimitHours: biz.cancelLimitHours,
    serviceId: b.serviceId,
    serviceName: svc.name,
    priceCents: svc.priceCents,
    staffId: b.staffId,
    staffName: db.staff.find((m) => m.id === b.staffId)?.name ?? "",
  };
}

function ownCustomerBooking(id: string) {
  const user = requireRole("customer");
  const b = db.bookings.find((x) => x.id === id && x.customerId === user.id);
  if (!b) throw notFound("Reserva");
  const biz = db.businesses.find((x) => x.id === b.businessId)!;
  if (b.status !== "pending" && b.status !== "confirmed")
    throw conflict("Esta reserva ya no admite cambios");
  if (Date.parse(b.startsAt) - Date.now() < biz.cancelLimitHours * 3_600_000) {
    throw conflict(
      `Ya no se puede cambiar por la web (límite: ${biz.cancelLimitHours} h antes). Contacta con el negocio`,
    );
  }
  return { b, biz };
}

function checklist(business: Business) {
  const activeServices = db.services.filter((s) => s.businessId === business.id && s.active);
  const activeStaff = db.staff.filter(
    (m) =>
      m.businessId === business.id &&
      m.active &&
      m.serviceIds.some((id) => activeServices.some((s) => s.id === id)),
  );
  const items = [
    { key: "address", label: "Dirección y ciudad", ok: !!business.addressLine && !!business.city },
    { key: "service", label: "Al menos un servicio activo", ok: activeServices.length > 0 },
    {
      key: "staff",
      label: "Un profesional activo con servicios asignados",
      ok: activeStaff.length > 0,
    },
    {
      key: "hours",
      label: "Horario semanal del profesional",
      ok: activeStaff.some((m) => db.hours.some((h) => h.staffId === m.id)),
    },
  ];
  return { items, ready: items.every((i) => i.ok) };
}

function profileView(b: Business) {
  return {
    id: b.id,
    slug: b.slug,
    name: b.name,
    description: b.description,
    status: b.status,
    addressLine: b.addressLine,
    city: b.city,
    province: b.province,
    postalCode: b.postalCode,
    contactPhone: b.contactPhone,
    contactEmail: b.contactEmail,
    timezone: b.timezone,
    minNoticeMin: b.minNoticeMin,
    maxHorizonDays: b.maxHorizonDays,
    cancelLimitHours: b.cancelLimitHours,
  };
}

function staffHours(business: Business, staffId: string) {
  if (!db.staff.some((m) => m.id === staffId && m.businessId === business.id))
    throw notFound("Profesional");
  return db.hours
    .filter((h) => h.staffId === staffId)
    .sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime))
    .map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }));
}
function overlapWarnings(hours: { weekday: number; startTime: string; endTime: string }[]) {
  const names = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
  const out = new Set<string>();
  hours.forEach((h, i) => {
    const next = hours[i + 1];
    if (next && next.weekday === h.weekday && next.startTime < h.endTime) {
      out.add(`Las franjas del ${names[h.weekday - 1]} se solapan`);
    }
  });
  return [...out];
}

// --- Rutas ---

type Handler = (p: Record<string, string>, query: URLSearchParams, body: unknown) => unknown;
const routes: [string, RegExp, Handler][] = [];
const route = (method: string, path: string, handler: Handler) =>
  routes.push([method, new RegExp(`^${path.replace(/:(\w+)/g, "(?<$1>[^/]+)")}$`), handler]);
const queryObject = (q: URLSearchParams) => Object.fromEntries(q.entries());

route("GET", "/health", () => ({ status: "ok" }));

// Público
route("GET", "/public/categories", () =>
  DEMO_CATEGORIES.map(([slug, name]) => ({ slug, name })).sort((a, b) =>
    a.name.localeCompare(b.name),
  ),
);
route("GET", "/public/businesses", (_, q) => {
  const input = searchQuerySchema.parse(queryObject(q));
  const words = fold(input.q).split(/\s+/).filter(Boolean);
  const items = db.businesses
    .filter((b) => b.status === "published")
    .filter((b) => !input.category || b.categorySlug === input.category)
    .filter((b) => !input.city || fold(b.city).includes(fold(input.city)))
    .filter((b) => {
      const text = fold(
        [
          b.name,
          b.description,
          categoryName(b.categorySlug),
          b.city,
          ...db.services.filter((s) => s.businessId === b.id).map((s) => s.name),
        ].join(" "),
      );
      // ponytail: búsqueda por subcadena; la API real usa texto completo y trigramas en Postgres.
      return words.every(
        (w) => text.includes(w) || text.includes(w.slice(0, Math.max(4, w.length - 2))),
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((b) => {
      const prices = db.services
        .filter((s) => s.businessId === b.id && s.active)
        .map((s) => s.priceCents);
      return {
        slug: b.slug,
        name: b.name,
        description: b.description.slice(0, 180),
        categorySlug: b.categorySlug,
        categoryName: categoryName(b.categorySlug),
        city: b.city,
        addressLine: b.addressLine,
        minPriceCents: prices.length ? Math.min(...prices) : null,
      };
    });
  const start = (input.page - 1) * input.pageSize;
  return {
    items: items.slice(start, start + input.pageSize),
    total: items.length,
    page: input.page,
    pageSize: input.pageSize,
  };
});
route("GET", "/public/businesses/:slug", (p) => {
  const b = published(decodeURIComponent(p.slug!));
  const services = db.services
    .filter((s) => s.businessId === b.id && s.active)
    .sort((x, y) => x.name.localeCompare(y.name))
    .map(({ id, name, description, durationMin, priceCents }) => ({
      id,
      name,
      description,
      durationMin,
      priceCents,
    }));
  const active = new Set(services.map((s) => s.id));
  const staff = db.staff
    .filter((m) => m.businessId === b.id && m.active)
    .sort((x, y) => x.name.localeCompare(y.name))
    .map((m) => ({
      id: m.id,
      name: m.name,
      serviceIds: m.serviceIds.filter((id) => active.has(id)),
    }))
    .filter((m) => m.serviceIds.length > 0);
  const visible = new Set(staff.map((m) => m.id));
  return {
    slug: b.slug,
    name: b.name,
    description: b.description,
    categorySlug: b.categorySlug,
    categoryName: categoryName(b.categorySlug),
    addressLine: b.addressLine,
    city: b.city,
    province: b.province,
    postalCode: b.postalCode,
    contactPhone: b.contactPhone,
    contactEmail: b.contactEmail,
    timezone: b.timezone,
    cancelLimitHours: b.cancelLimitHours,
    services,
    staff,
    hours: db.hours
      .filter((h) => visible.has(h.staffId))
      .sort((x, y) => x.weekday - y.weekday || x.startTime.localeCompare(y.startTime))
      .map(({ staffId, weekday, startTime, endTime }) => ({
        staffId,
        weekday,
        startTime,
        endTime,
      })),
    faq: db.faq
      .filter((f) => f.businessId === b.id)
      .map(({ id, question, answer }) => ({ id, question, answer })),
  };
});
route("GET", "/public/businesses/:slug/availability", (p, q) => {
  const b = published(decodeURIComponent(p.slug!));
  const { slots, service } = findSlots(b, availabilityQuerySchema.parse(queryObject(q)));
  if (!service) throw notFound("Servicio");
  return { timezone: b.timezone, slots };
});

// Cuenta
route("POST", "/auth/register", (_, __, body) => {
  const input = registerSchema.parse(body);
  if (db.users.some((u) => u.email === input.email))
    throw conflict("Ya existe una cuenta con ese email");
  const user: User = {
    id: uuid(),
    email: input.email,
    name: input.name,
    role: input.role,
    password: input.password,
  };
  db.users.push(user);
  if (input.role === "business_owner") {
    const base = fold(input.businessName)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    db.businesses.push({
      id: uuid(),
      ownerId: user.id,
      slug: `${base || "negocio"}-${uuid().slice(0, 6)}`,
      name: input.businessName,
      description: "",
      categorySlug: input.categorySlug,
      status: "draft",
      addressLine: null,
      city: null,
      province: null,
      postalCode: null,
      contactPhone: null,
      contactEmail: input.email,
      timezone: "Europe/Madrid",
      slotStepMin: 15,
      minNoticeMin: 120,
      maxHorizonDays: 60,
      cancelLimitHours: 12,
    });
  }
  db.sessionUserId = user.id;
  return [201, publicMe(user)];
});
route("POST", "/auth/login", (_, __, body) => {
  const input = loginSchema.parse(body);
  const user = db.users.find((u) => u.email === input.email && u.password === input.password);
  if (!user) throw new DemoError(401, "UNAUTHORIZED", "Email o contraseña incorrectos");
  db.sessionUserId = user.id;
  return publicMe(user);
});
route("POST", "/auth/logout", () => {
  db.sessionUserId = null;
  return [204, null];
});
route("GET", "/auth/me", () => publicMe(me()));

// Cliente
route("GET", "/me/bookings", () => {
  const user = requireRole("customer");
  return db.bookings
    .filter((b) => b.customerId === user.id)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .map(customerBookingView);
});
route("POST", "/me/bookings", (_, __, body) => {
  const user = requireRole("customer");
  const input = customerBookingSchema.parse(body);
  const business = published(input.businessSlug);
  const { slot, service } = freeSlotAt(business, input.serviceId, input.startsAt, input.staffId);
  const b: Booking = {
    id: uuid(),
    businessId: business.id,
    code: newCode(),
    staffId: slot.staffId,
    serviceId: service.id,
    customerId: user.id,
    guestName: null,
    guestPhone: null,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    status: "confirmed",
    source: "web",
    notes: input.notes,
    expiresAt: null,
  };
  db.bookings.push(b);
  return [
    201,
    {
      id: b.id,
      code: b.code,
      status: b.status,
      startsAt: b.startsAt,
      businessName: business.name,
      businessSlug: business.slug,
      serviceName: service.name,
      staffName: db.staff.find((m) => m.id === b.staffId)?.name ?? "",
    },
  ];
});
route("POST", "/me/bookings/:id/cancel", (p) => {
  const { b } = ownCustomerBooking(p.id!);
  b.status = "cancelled";
  return { id: b.id, status: b.status };
});
route("POST", "/me/bookings/:id/reschedule", (p, _, body) => {
  const { b, biz } = ownCustomerBooking(p.id!);
  const input = rescheduleSchema.parse(body);
  const { slot } = freeSlotAt(biz, b.serviceId, input.startsAt, input.staffId ?? b.staffId, b.id);
  Object.assign(b, {
    staffId: slot.staffId,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
  });
  return { id: b.id, status: b.status, startsAt: b.startsAt };
});
route("POST", "/me/bookings/:id/confirm", (p) => {
  const user = requireRole("customer");
  const b = db.bookings.find((x) => x.id === p.id && x.customerId === user.id);
  if (!b) throw notFound("Reserva");
  if (b.status === "pending" && shownStatus(b) === "pending") {
    b.status = "confirmed";
    b.expiresAt = null;
  } else if (b.status !== "confirmed") {
    throw conflict("La propuesta ha caducado o ya no se puede confirmar. Pide una nueva");
  }
  return customerBookingView(b);
});
// Tokens para clientes MCP: en la demo no hay servidor MCP.
route("GET", "/me/tokens", () => {
  requireRole("customer");
  return [];
});
route("POST", "/me/tokens", () => {
  throw new DemoError(
    400,
    "BAD_REQUEST",
    "En la demo pública no hay servidor MCP: los tokens solo funcionan en la instalación local",
  );
});

// Negocio
route("GET", "/business/profile", () => profileView(ownBusiness()));
route("PATCH", "/business/profile", (_, __, body) => {
  const b = ownBusiness();
  Object.assign(b, businessProfileUpdateSchema.parse(body ?? {}));
  return profileView(b);
});
route("GET", "/business/checklist", () => checklist(ownBusiness()));
route("POST", "/business/publish", () => {
  const b = ownBusiness();
  if (!checklist(b).ready) throw conflict("Completa la lista de comprobación antes de publicar");
  if (b.status === "draft") b.status = "published";
  return { status: b.status };
});
route("POST", "/business/unpublish", () => {
  const b = ownBusiness();
  if (b.status === "published") b.status = "draft";
  return { status: b.status };
});
route("GET", "/business/services", () => {
  const b = ownBusiness();
  return db.services
    .filter((s) => s.businessId === b.id)
    .sort((x, y) => x.name.localeCompare(y.name));
});
route("POST", "/business/services", (_, __, body) => {
  const service: Service = {
    id: uuid(),
    businessId: ownBusiness().id,
    ...serviceSchema.parse(body),
  };
  db.services.push(service);
  return [201, service];
});
const ownService = (id: string) => {
  const s = db.services.find((x) => x.id === id && x.businessId === ownBusiness().id);
  if (!s) throw notFound("Servicio");
  return s;
};
route("PATCH", "/business/services/:id", (p, _, body) =>
  Object.assign(ownService(p.id!), serviceUpdateSchema.parse(body ?? {})),
);
route("DELETE", "/business/services/:id", (p) => {
  const s = ownService(p.id!);
  if (db.bookings.some((b) => b.serviceId === s.id)) {
    s.active = false;
    return { id: s.id, archived: true };
  }
  db.services = db.services.filter((x) => x.id !== s.id);
  return { id: s.id, archived: false };
});
const staffView = ({ id, name, active, serviceIds }: Staff) => ({ id, name, active, serviceIds });
const ownStaff = (id: string) => {
  const m = db.staff.find((x) => x.id === id && x.businessId === ownBusiness().id);
  if (!m) throw notFound("Profesional");
  return m;
};
route("GET", "/business/staff", () => {
  const b = ownBusiness();
  return db.staff
    .filter((m) => m.businessId === b.id)
    .sort((x, y) => x.name.localeCompare(y.name))
    .map(staffView);
});
route("POST", "/business/staff", (_, __, body) => {
  const member: Staff = { id: uuid(), businessId: ownBusiness().id, ...staffSchema.parse(body) };
  db.staff.push(member);
  return [201, staffView(member)];
});
route("PATCH", "/business/staff/:id", (p, _, body) =>
  staffView(Object.assign(ownStaff(p.id!), staffUpdateSchema.parse(body ?? {}))),
);
route("DELETE", "/business/staff/:id", (p) => {
  const m = ownStaff(p.id!);
  if (db.bookings.some((b) => b.staffId === m.id)) {
    m.active = false;
    return { id: m.id, archived: true };
  }
  db.staff = db.staff.filter((x) => x.id !== m.id);
  db.hours = db.hours.filter((h) => h.staffId !== m.id);
  return { id: m.id, archived: false };
});
route("GET", "/business/staff/:id/hours", (p) => {
  const hours = staffHours(ownBusiness(), p.id!);
  return { hours, warnings: overlapWarnings(hours) };
});
route("PUT", "/business/staff/:id/hours", (p, _, body) => {
  const business = ownBusiness();
  const member = ownStaff(p.id!);
  const { hours } = weeklyHoursSchema.parse(body);
  db.hours = db.hours
    .filter((h) => h.staffId !== member.id)
    .concat(hours.map((h) => ({ ...h, businessId: business.id, staffId: member.id })));
  const saved = staffHours(business, member.id);
  return { hours: saved, warnings: overlapWarnings(saved) };
});
route("GET", "/business/time-off", () => {
  const b = ownBusiness();
  return db.timeOff
    .filter((t) => t.businessId === b.id)
    .sort((x, y) => x.startsAt.localeCompare(y.startsAt));
});
route("POST", "/business/time-off", (_, __, body) => {
  const b = ownBusiness();
  const input = timeOffSchema.parse(body);
  if (input.staffId) ownStaff(input.staffId);
  const row: TimeOff = {
    id: uuid(),
    businessId: b.id,
    staffId: input.staffId,
    startsAt: input.startsAt.toISOString(),
    endsAt: input.endsAt.toISOString(),
    reason: input.reason,
  };
  db.timeOff.push(row);
  return [201, row];
});
route("DELETE", "/business/time-off/:id", (p) => {
  const b = ownBusiness();
  if (!db.timeOff.some((t) => t.id === p.id && t.businessId === b.id)) throw notFound("Ausencia");
  db.timeOff = db.timeOff.filter((t) => t.id !== p.id);
  return [204, null];
});
route("GET", "/business/agent-events", () => {
  const b = ownBusiness();
  return db.agentEvents
    .filter((e) => e.businessId === b.id)
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
    .slice(0, 100)
    .map(({ id, type, toolName, bookingId, createdAt }) => ({
      id,
      type,
      toolName,
      bookingId,
      createdAt,
    }));
});
route("GET", "/business/bookings", (_, q) => {
  const b = ownBusiness();
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  const staffId = q.get("staffId");
  return db.bookings
    .filter(
      (x) =>
        x.businessId === b.id &&
        x.startsAt >= new Date(from).toISOString() &&
        x.startsAt < new Date(to).toISOString(),
    )
    .filter((x) => !staffId || x.staffId === staffId)
    .sort((x, y) => x.startsAt.localeCompare(y.startsAt))
    .map((x) => ({
      id: x.id,
      code: x.code,
      startsAt: x.startsAt,
      endsAt: x.endsAt,
      status: shownStatus(x),
      source: x.source,
      staffId: x.staffId,
      serviceName: db.services.find((s) => s.id === x.serviceId)?.name ?? "",
      staffName: db.staff.find((m) => m.id === x.staffId)?.name ?? "",
      customerName: db.users.find((u) => u.id === x.customerId)?.name ?? x.guestName,
    }));
});
route("POST", "/business/bookings", (_, __, body) => {
  const b = ownBusiness();
  const input = manualBookingSchema.parse(body);
  const service = ownService(input.serviceId);
  const member = ownStaff(input.staffId);
  if (!member.serviceIds.includes(service.id))
    throw new DemoError(400, "VALIDATION_ERROR", "Ese profesional no hace ese servicio");
  const endsAt = new Date(
    input.startsAt.getTime() + (service.durationMin + service.bufferMin) * 60_000,
  );
  const clash = db.bookings.some(
    (x) =>
      x.staffId === member.id &&
      isLive(x) &&
      Date.parse(x.startsAt) < endsAt.getTime() &&
      Date.parse(x.endsAt) > input.startsAt.getTime(),
  );
  if (clash) throw conflict("Ese hueco ya está ocupado");
  const row: Booking = {
    id: uuid(),
    businessId: b.id,
    code: newCode(),
    staffId: member.id,
    serviceId: service.id,
    customerId: null,
    guestName: input.guestName,
    guestPhone: input.guestPhone,
    startsAt: input.startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    status: "confirmed",
    source: "business",
    notes: input.notes,
    expiresAt: null,
  };
  db.bookings.push(row);
  return [201, { id: row.id, code: row.code, startsAt: row.startsAt }];
});
route("POST", "/business/bookings/:id/status", (p, _, body) => {
  const biz = ownBusiness();
  const { status } = bookingStatusSchema.parse(body);
  const b = db.bookings.find((x) => x.id === p.id && x.businessId === biz.id);
  if (!b) throw notFound("Reserva");
  const s = shownStatus(b);
  if (s !== "pending" && s !== "confirmed")
    throw conflict("La reserva ya no admite cambios de estado");
  if (status !== "cancelled" && Date.parse(b.startsAt) > Date.now())
    throw conflict("La reserva todavía no ha empezado");
  b.status = status;
  return { id: b.id, status };
});

// --- Asistente: guion fijo, como LLM_PROVIDER=demo en la API (no es una IA) ---

const actions = new Map<string, { bookingId: string; userId: string }>();

const when = (iso: string, tz: string) =>
  new Date(iso).toLocaleString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  });
const euros = (cents: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cents / 100);

function logEvent(
  businessId: string,
  type: string,
  toolName: string | null,
  bookingId: string | null = null,
) {
  db.agentEvents.push({
    id: uuid(),
    businessId,
    type,
    toolName,
    bookingId,
    createdAt: new Date().toISOString(),
  });
}

type ChatEvent = Record<string, unknown> & { type: string };

function chatScript(sessionId: string, message: string): ChatEvent[] {
  const events: ChatEvent[] = [{ type: "start", sessionId }];
  const say = (text: string) => {
    for (const word of text.split(/(?<=\s)/)) events.push({ type: "text", delta: word });
  };
  const tool = (name: string, label: string) => {
    events.push({ type: "tool", name, status: "running", label });
    events.push({ type: "tool", name, status: "done", label });
  };
  const text = fold(message);
  if (!/reserv|cita|hueco|quiero|corte|busco|pista|consulta/.test(text)) {
    say(
      "Hola, soy el asistente de la demo de AgendIA (un guion fijo, no una IA). Dime qué negocio buscas, por ejemplo: «Quiero reservar un corte en una barbería de Córdoba».",
    );
    return [...events, { type: "done" }];
  }

  tool("search_businesses", "Buscando negocios");
  const category = DEMO_CATEGORIES.find(
    ([slug, name]) => text.includes(fold(name).slice(0, 5)) || text.includes(slug.slice(0, 5)),
  )?.[0];
  const candidates = db.businesses.filter(
    (b) =>
      b.status === "published" &&
      (!category || b.categorySlug === category) &&
      (!b.city ||
        !db.businesses.some((x) => x.city && text.includes(fold(x.city))) ||
        text.includes(fold(b.city))),
  );
  const business = candidates[0];
  if (!business) {
    say("No he encontrado ningún negocio con eso. ¿Probamos con otra categoría o ciudad?");
    return [...events, { type: "done" }];
  }
  logEvent(business.id, "tool_call", "search_businesses");

  tool("list_services", "Consultando servicios");
  const services = db.services.filter((s) => s.businessId === business.id && s.active);
  const service =
    services.find((s) =>
      fold(s.name)
        .split(" ")
        .some((w) => w.length > 3 && text.includes(w)),
    ) ?? services[0]!;
  logEvent(business.id, "tool_call", "list_services");

  tool("check_availability", "Mirando huecos libres");
  const from = localDate(new Date(Date.now() + DAY_MS), business.timezone);
  const to = localDate(new Date(Date.now() + 7 * DAY_MS), business.timezone);
  const slot = findSlots(business, { serviceId: service.id, from, to }).slots[0];
  logEvent(business.id, "tool_call", "check_availability");
  if (!slot) {
    say(
      `${business.name} no tiene huecos libres para ${service.name} en los próximos días. ¿Miramos otro negocio?`,
    );
    return [...events, { type: "done" }];
  }
  const user = db.users.find((u) => u.id === db.sessionUserId && u.role === "customer");
  const whenText = when(slot.startsAt.toISOString(), business.timezone);
  if (!user) {
    say(
      `Hay hueco en ${business.name} para ${service.name} el ${whenText}. Para prepararte la reserva necesito que inicies sesión; mientras tanto puedo seguir buscando contigo.`,
    );
    return [...events, { type: "done" }];
  }

  tool("propose_booking", "Preparando la propuesta");
  const booking: Booking = {
    id: uuid(),
    businessId: business.id,
    code: newCode(),
    staffId: slot.staffId,
    serviceId: service.id,
    customerId: user.id,
    guestName: null,
    guestPhone: null,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
    status: "pending",
    source: "agent",
    notes: null,
    expiresAt: new Date(Date.now() + PROPOSAL_TTL_MINUTES * 60_000).toISOString(),
  };
  db.bookings.push(booking);
  logEvent(business.id, "proposal", "propose_booking", booking.id);
  const actionId = uuid();
  actions.set(actionId, { bookingId: booking.id, userId: user.id });
  events.push({
    type: "proposal",
    actionId,
    kind: "book",
    card: {
      title: "Reserva propuesta",
      business: business.name,
      service: service.name,
      professional: db.staff.find((m) => m.id === slot.staffId)?.name ?? "",
      when: whenText,
      price: euros(service.priceCents),
      holdsSlotForMinutes: PROPOSAL_TTL_MINUTES,
    },
  });
  say(
    "Te he preparado la reserva: revisa la tarjeta y pulsa «Confirmar» si todo está bien. La propuesta retiene el hueco unos minutos.",
  );
  return [...events, { type: "done" }];
}

route("GET", "/public/chat", () => ({ enabled: true, maxMessageChars: 1000 }));
route("POST", "/me/agent/actions/:id/confirm", (p) => {
  const user = requireRole("customer");
  const action = actions.get(p.id!);
  const b =
    action && action.userId === user.id
      ? db.bookings.find((x) => x.id === action.bookingId)
      : undefined;
  if (!b || shownStatus(b) !== "pending")
    throw conflict("La propuesta ha caducado o ya no se puede confirmar. Pide una nueva");
  b.status = "confirmed";
  b.expiresAt = null;
  actions.delete(p.id!);
  logEvent(b.businessId, "confirmation", "confirm_booking", b.id);
  return { ok: true };
});
route("POST", "/me/agent/actions/:id/discard", (p) => {
  const user = requireRole("customer");
  const action = actions.get(p.id!);
  const b =
    action && action.userId === user.id
      ? db.bookings.find((x) => x.id === action.bookingId)
      : undefined;
  if (b && b.status === "pending") b.status = "expired";
  actions.delete(p.id!);
  return [204, null];
});

/** Respuesta del chat como Server-Sent Events, palabra a palabra, como la API real. */
function chatStream(body: unknown): Response {
  const { sessionId, message } = (body ?? {}) as { sessionId?: string; message?: string };
  const events = chatScript(String(sessionId ?? uuid()), String(message ?? "").slice(0, 1000));
  save();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const event of events) {
        controller.enqueue(
          encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
        );
        await new Promise((r) =>
          setTimeout(r, event.type === "tool" ? 350 : event.type === "text" ? 25 : 0),
        );
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8" } });
}

const json = (status: number, body: unknown) =>
  status === 204
    ? new Response(null, { status })
    : new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });

/** Atiende una petición a /api/…; devuelve la misma respuesta que daría la API. */
export async function handle(method: string, url: URL, rawBody: string | null): Promise<Response> {
  const path = url.pathname.replace(/^.*?\/api(?=\/)/, "");
  let body: unknown;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return json(400, { error: { code: "BAD_REQUEST", message: "JSON no válido" } });
  }
  if (method === "POST" && path === "/public/chat") return chatStream(body);
  for (const [m, pattern, handler] of routes) {
    const match = m === method ? pattern.exec(path) : null;
    if (!match) continue;
    try {
      const result = handler(match.groups ?? {}, url.searchParams, body);
      if (method !== "GET") save();
      return Array.isArray(result) && typeof result[0] === "number" && result.length === 2
        ? json(result[0], result[1])
        : json(200, result);
    } catch (error) {
      if (error instanceof DemoError)
        return json(error.status, { error: { code: error.code, message: error.message } });
      const issues = (error as { issues?: { path: PropertyKey[]; message: string }[] }).issues;
      if (issues) {
        const issue = issues[0];
        const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
        return json(400, {
          error: {
            code: "VALIDATION_ERROR",
            message: `${where}${issue?.message ?? "Datos no válidos"}`,
          },
        });
      }
      console.error(error);
      return json(500, { error: { code: "INTERNAL", message: "Error interno" } });
    }
  }
  return json(404, { error: { code: "NOT_FOUND", message: "Ruta no encontrada" } });
}
