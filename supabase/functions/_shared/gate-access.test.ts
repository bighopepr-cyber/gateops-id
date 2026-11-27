import { describe, expect, it } from "vitest";
import { canManageGates } from "./gate-access.ts";
describe("Gate management authorization", () => {
  it("allows only Super Admin", () => {
    expect(canManageGates("SUPER_ADMIN")).toBe(true);
    expect(canManageGates("KOMANDAN")).toBe(false);
    expect(canManageGates("PERSONEL")).toBe(false);
    expect(canManageGates("PERSIT")).toBe(false);
  });
});
