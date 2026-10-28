import { describe, expect, it } from "vitest";
import { fromFields, toFields, type SharedBooking } from "./shared.ts";

const booking: SharedBooking = {
  id: "b1",
  businessSlug: "barberia-el-califa",
  staffName: "Mateo",
  serviceName: "Corte de pelo",
  code: "ABCD234567",
  startsAt: "2026-11-02T09:00:00.000Z",
  endsAt: "2026-11-02T09:30:00.000Z",
  status: "confirmed",
  source: "web",
  customerName: "Clara",
  expiresAt: "",
};

describe("reservas compartidas de la demo", () => {
  it("ida y vuelta a campos de Firestore", () => {
    expect(fromFields(toFields(booking))).toEqual(booking);
  });

  it("descarta documentos incompletos o con tipos raros", () => {
    const sinId: Record<string, { stringValue: string }> = toFields(booking);
    delete sinId.id;
    expect(fromFields(sinId)).toBeNull();
    expect(fromFields({ ...toFields(booking), status: {} })).toBeNull();
    expect(fromFields(undefined)).toBeNull();
  });
});
