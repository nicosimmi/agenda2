import { describe, expect, it } from "vitest";
import {
  fromFields,
  mediaFromFields,
  mediaToFields,
  toFields,
  type SharedBooking,
  type SharedMedia,
} from "./shared.ts";

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

describe("fotos compartidas de la demo", () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  const photo: SharedMedia = {
    id: "m1",
    businessSlug: "barberia-el-califa",
    staffName: "",
    image: png,
    removed: "",
  };

  it("ida y vuelta a campos de Firestore", () => {
    expect(mediaFromFields(mediaToFields(photo))).toEqual(photo);
  });

  it("descarta lo que no sea una imagen (cualquiera puede escribir en la colección)", () => {
    for (const image of [
      "javascript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "data:image/svg+xml;base64,PHN2Zy8+",
      "https://otra.web/foto.png",
    ])
      expect(mediaFromFields(mediaToFields({ ...photo, image }))).toBeNull();
  });
});
