import { describe, expect, it } from "vitest";
import { canAccessRole, ROLE_PERMISSIONS } from "./role-permissions";

describe("GATEOPS shared role permissions", () => {
  it("preserves the established role permission matrix", () => {
    expect(canAccessRole("SUPER_ADMIN", "gate-manage")).toBe(true);
    expect(canAccessRole("KOMANDAN", "gate-manage")).toBe(false);
    expect(canAccessRole("KOMANDAN", "command-dashboard")).toBe(true);
    expect(canAccessRole("PERSONEL", "presence-transact")).toBe(true);
    expect(canAccessRole("PERSONEL", "command-dashboard")).toBe(false);
    expect(canAccessRole("PERSIT", "password-change-own")).toBe(true);
    expect(canAccessRole("SUPER_ADMIN", "gps-read")).toBe(true);
    expect(canAccessRole("KOMANDAN", "gps-read")).toBe(true);
    expect(canAccessRole("PERSONEL", "gps-read")).toBe(false);
    expect(canAccessRole("PERSIT", "gps-read")).toBe(false);
    expect(canAccessRole("SUPER_ADMIN", "command-dashboard")).toBe(true);
    expect(canAccessRole("KOMANDAN", "command-dashboard")).toBe(true);
    expect(canAccessRole("PERSONEL", "command-dashboard")).toBe(false);
    expect(canAccessRole("PERSIT", "command-dashboard")).toBe(false);
    expect(ROLE_PERMISSIONS.SUPER_ADMIN).toContain("audit-read");
  });
});
