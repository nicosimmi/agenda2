import { describe, expect, it } from "vitest";
import { computeAvailability, type AvailabilityInput } from "./availability.ts";
import { isoWeekday, localToUtc } from "./time.ts";

// Lunes 2 de noviembre de 2026: Madrid en horario de invierno (UTC+1).
const MONDAY = "2026-11-02";
const ANA = "staff-ana";
const LUIS = "staff-luis";

function input(overrides: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    service: { durationMin: 30, bufferMin: 0 },
    staffCandidates: [ANA],
    workingHours: [{ staffId: ANA, weekday: 1, startTime: "10:00", endTime: "12:00" }],
    timeOff: [],
    existingBookings: [],
    range: { from: MONDAY, to: MONDAY },
    now: new Date("2026-10-01T00:00:00Z"),
    businessSettings: {
      timezone: "Europe/Madrid",
      slotStepMin: 15,
      minNoticeMin: 120,
      maxHorizonDays: 60,
    },
    ...overrides,
  };
}

const starts = (i: AvailabilityInput) =>
  computeAvailability(i).map((slot) => slot.startsAt.toISOString());

const utc = (iso: string) => new Date(iso);

describe("computeAvailability", () => {
  it("genera huecos cada slot_step dentro del horario (10:00 Madrid = 09:00Z)", () => {
    expect(starts(input())).toEqual([
      "2026-11-02T09:00:00.000Z",
      "2026-11-02T09:15:00.000Z",
      "2026-11-02T09:30:00.000Z",
      "2026-11-02T09:45:00.000Z",
      "2026-11-02T10:00:00.000Z",
      "2026-11-02T10:15:00.000Z",
      "2026-11-02T10:30:00.000Z",
    ]);
  });

  it("respeta las franjas partidas sin cruzar la pausa", () => {
    const result = starts(
      input({
        service: { durationMin: 60, bufferMin: 0 },
        workingHours: [
          { staffId: ANA, weekday: 1, startTime: "10:00", endTime: "12:00" },
          { staffId: ANA, weekday: 1, startTime: "16:00", endTime: "18:00" },
        ],
      }),
    );
    expect(result.at(4)).toBe("2026-11-02T10:00:00.000Z"); // 11:00, último de la mañana
    expect(result.at(5)).toBe("2026-11-02T15:00:00.000Z"); // 16:00, primero de la tarde
    expect(result).toHaveLength(10);
  });

  it("incluye el buffer en el bloque y exige que quepa en la franja", () => {
    const slots = computeAvailability(
      input({
        service: { durationMin: 30, bufferMin: 10 },
        workingHours: [{ staffId: ANA, weekday: 1, startTime: "10:00", endTime: "11:00" }],
      }),
    );
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual([
      "2026-11-02T09:00:00.000Z",
      "2026-11-02T09:15:00.000Z",
    ]);
    expect(slots[0]?.endsAt.toISOString()).toBe("2026-11-02T09:40:00.000Z");
  });

  it("permite huecos pegados a una reserva pero no solapados", () => {
    const result = starts(
      input({
        existingBookings: [
          {
            staffId: ANA,
            startsAt: utc("2026-11-02T09:30:00Z"),
            endsAt: utc("2026-11-02T10:00:00Z"),
          },
        ],
      }),
    );
    expect(result).toContain("2026-11-02T09:00:00.000Z"); // termina justo cuando empieza la reserva
    expect(result).not.toContain("2026-11-02T09:15:00.000Z");
    expect(result).not.toContain("2026-11-02T09:45:00.000Z");
    expect(result).toContain("2026-11-02T10:00:00.000Z"); // empieza justo cuando acaba
  });

  it("ignora las reservas de otros profesionales", () => {
    const result = starts(
      input({
        existingBookings: [
          {
            staffId: LUIS,
            startsAt: utc("2026-11-02T09:00:00Z"),
            endsAt: utc("2026-11-02T11:00:00Z"),
          },
        ],
      }),
    );
    expect(result).toHaveLength(7);
  });

  it("bloquea las ausencias del profesional y los cierres del negocio", () => {
    const staffOff = starts(
      input({
        timeOff: [
          {
            staffId: ANA,
            startsAt: utc("2026-11-02T09:00:00Z"),
            endsAt: utc("2026-11-02T10:00:00Z"),
          },
        ],
      }),
    );
    expect(staffOff[0]).toBe("2026-11-02T10:00:00.000Z");

    const businessClosed = starts(
      input({
        timeOff: [
          {
            staffId: null,
            startsAt: utc("2026-11-02T00:00:00Z"),
            endsAt: utc("2026-11-03T00:00:00Z"),
          },
        ],
      }),
    );
    expect(businessClosed).toEqual([]);
  });

  it("respeta el preaviso mínimo", () => {
    // Son las 09:00 en Madrid (08:00Z) y el preaviso es de 120 min: primer hueco a las 11:00.
    const result = starts(input({ now: utc("2026-11-02T08:00:00Z") }));
    expect(result[0]).toBe("2026-11-02T10:00:00.000Z");
  });

  it("no ofrece huecos más allá del horizonte máximo", () => {
    const result = starts(
      input({
        range: { from: MONDAY, to: "2026-11-09" },
        now: utc("2026-11-01T12:00:00Z"),
        businessSettings: { ...input().businessSettings, maxHorizonDays: 2 },
      }),
    );
    expect(result.every((iso) => iso.startsWith("2026-11-02"))).toBe(true);
    expect(result).toHaveLength(7);
  });

  it("devuelve vacío un día sin horario", () => {
    expect(starts(input({ range: { from: "2026-11-03", to: "2026-11-03" } }))).toEqual([]);
  });

  it("sin profesional elegido devuelve huecos de todos los candidatos", () => {
    const slots = computeAvailability(
      input({
        staffCandidates: [ANA, LUIS],
        workingHours: [
          { staffId: ANA, weekday: 1, startTime: "10:00", endTime: "10:30" },
          { staffId: LUIS, weekday: 1, startTime: "10:00", endTime: "10:30" },
        ],
      }),
    );
    expect(slots.map((s) => s.staffId)).toEqual([ANA, LUIS]);
  });

  it("no lanza con un servicio que nadie hace (sin candidatos)", () => {
    expect(computeAvailability(input({ staffCandidates: [] }))).toEqual([]);
  });
});

describe("cambios de hora (DST)", () => {
  const sunday = (startTime: string, endTime: string) => [
    { staffId: ANA, weekday: 7, startTime, endTime },
    { staffId: ANA, weekday: 6, startTime, endTime },
  ];

  it("Madrid, último domingo de marzo: las 10:00 pasan de 09:00Z a 08:00Z", () => {
    const result = starts(
      input({
        workingHours: sunday("10:00", "10:30"),
        range: { from: "2026-03-28", to: "2026-03-29" },
        now: utc("2026-03-01T00:00:00Z"),
      }),
    );
    expect(result).toEqual(["2026-03-28T09:00:00.000Z", "2026-03-29T08:00:00.000Z"]);
  });

  it("Madrid, último domingo de octubre: las 10:00 pasan de 08:00Z a 09:00Z", () => {
    const result = starts(
      input({
        workingHours: sunday("10:00", "10:30"),
        range: { from: "2026-10-24", to: "2026-10-25" },
        now: utc("2026-10-01T00:00:00Z"),
      }),
    );
    expect(result).toEqual(["2026-10-24T08:00:00.000Z", "2026-10-25T09:00:00.000Z"]);
  });

  it("una franja que cruza el salto de primavera dura una hora menos", () => {
    // 01:00–04:00 locales el 29/03/2026 son solo 2 horas reales.
    const result = starts(
      input({
        service: { durationMin: 60, bufferMin: 0 },
        workingHours: [{ staffId: ANA, weekday: 7, startTime: "01:00", endTime: "04:00" }],
        range: { from: "2026-03-29", to: "2026-03-29" },
        now: utc("2026-03-01T00:00:00Z"),
        businessSettings: { ...input().businessSettings, slotStepMin: 60 },
      }),
    );
    expect(result).toEqual(["2026-03-29T00:00:00.000Z", "2026-03-29T01:00:00.000Z"]);
  });

  it("Atlantic/Canary va una hora por detrás de Madrid y también cambia de hora", () => {
    const canary = (from: string, weekday: number) =>
      starts(
        input({
          workingHours: [{ staffId: ANA, weekday, startTime: "10:00", endTime: "10:30" }],
          range: { from, to: from },
          now: utc("2026-03-01T00:00:00Z"),
          businessSettings: { ...input().businessSettings, timezone: "Atlantic/Canary" },
        }),
      );
    expect(canary("2026-03-28", 6)).toEqual(["2026-03-28T10:00:00.000Z"]); // WET, UTC+0
    expect(canary("2026-03-29", 7)).toEqual(["2026-03-29T09:00:00.000Z"]); // WEST, UTC+1
  });
});

describe("utilidades de tiempo", () => {
  it("una hora inexistente en primavera se desplaza hacia delante", () => {
    expect(localToUtc("2026-03-29", "02:30", "Europe/Madrid").toISOString()).toBe(
      "2026-03-29T01:30:00.000Z", // 03:30 CEST
    );
  });

  it("una hora repetida en otoño se resuelve como la segunda", () => {
    expect(localToUtc("2026-10-25", "02:30", "Europe/Madrid").toISOString()).toBe(
      "2026-10-25T01:30:00.000Z", // 02:30 CET
    );
  });

  it("acepta horas con segundos (formato time de Postgres)", () => {
    expect(localToUtc(MONDAY, "10:00:00", "Europe/Madrid").toISOString()).toBe(
      "2026-11-02T09:00:00.000Z",
    );
  });

  it("calcula el día de la semana ISO", () => {
    expect(isoWeekday(MONDAY)).toBe(1);
    expect(isoWeekday("2026-11-08")).toBe(7);
  });
});
