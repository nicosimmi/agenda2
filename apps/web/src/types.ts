// Formas de las respuestas de /business/*. ponytail: escritas a mano; si crecen, moverlas a packages/shared.
export interface Profile {
  name: string;
  description: string;
  status: "draft" | "published" | "suspended";
  addressLine: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
}
export interface Service {
  id: string;
  name: string;
  durationMin: number;
  bufferMin: number;
  priceCents: number;
  active: boolean;
}
export interface Staff {
  id: string;
  name: string;
  active: boolean;
  serviceIds: string[];
}
export interface Shift {
  weekday: number;
  startTime: string;
  endTime: string;
}
export interface Checklist {
  items: { key: string; label: string; ok: boolean }[];
  ready: boolean;
}
export interface Booking {
  id: string;
  code: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show" | "expired";
  staffName: string;
  serviceName: string;
  customerName: string | null;
}

// --- Zona pública y de cliente ---
export interface Category {
  slug: string;
  name: string;
}
export interface BusinessSummary {
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  city: string | null;
  addressLine: string | null;
  minPriceCents: number | null;
}
export interface SearchPage {
  items: BusinessSummary[];
  total: number;
  page: number;
  pageSize: number;
}
export interface PublicService {
  id: string;
  name: string;
  description: string;
  durationMin: number;
  priceCents: number;
}
export interface PublicStaff {
  id: string;
  name: string;
  serviceIds: string[];
}
export interface BusinessDetail {
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  addressLine: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  timezone: string;
  cancelLimitHours: number;
  services: PublicService[];
  staff: PublicStaff[];
  hours: { staffId: string; weekday: number; startTime: string; endTime: string }[];
  faq: { id: string; question: string; answer: string }[];
}
export interface Slot {
  staffId: string;
  startsAt: string;
  endsAt: string;
}
export interface MyBooking {
  id: string;
  code: string;
  startsAt: string;
  endsAt: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show" | "expired";
  notes: string | null;
  businessName: string;
  businessSlug: string;
  businessCity: string | null;
  businessTimezone: string;
  cancelLimitHours: number;
  serviceId: string;
  serviceName: string;
  priceCents: number;
  staffId: string;
  staffName: string;
}
