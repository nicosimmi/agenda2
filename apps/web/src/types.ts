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
