import { describe, expect, it } from "vitest";
import { CORE_PACKAGE } from "./index.js";

describe("@agendia/core", () => {
  it("se importa correctamente (test de humo de la Fase 0)", () => {
    expect(CORE_PACKAGE).toBe("@agendia/core");
  });
});
