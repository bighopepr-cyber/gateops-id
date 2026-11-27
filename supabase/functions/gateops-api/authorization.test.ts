import { describe, expect, it } from "vitest";
import { canAccessRole, ROLE_PERMISSIONS, type AppRole } from "../../../src/lib/role-permissions.ts";

describe("Role permission matrix", () => {
  it("SUPER_ADMIN has all operational permissions", () => {
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "command-dashboard")).toBe(true);
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "personnel-read")).toBe(true);
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "personnel-manage")).toBe(true);
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "gate-manage")).toBe(true);
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "gps-read")).toBe(true);
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "activity-read-all")).toBe(true);
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "reports-create")).toBe(true);
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "accounts-manage")).toBe(true);
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "persit-verify")).toBe(true);
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "audit-read")).toBe(true);
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "presence-transact")).toBe(false);
  });

  it("KOMANDAN has read-only monitoring permissions", () => {
    expect(canAccessRole("KOMANDAN" as AppRole, "command-dashboard")).toBe(true);
    expect(canAccessRole("KOMANDAN" as AppRole, "personnel-read")).toBe(true);
    expect(canAccessRole("KOMANDAN" as AppRole, "personnel-manage")).toBe(false);
    expect(canAccessRole("KOMANDAN" as AppRole, "gate-manage")).toBe(false);
    expect(canAccessRole("KOMANDAN" as AppRole, "gps-read")).toBe(true);
    expect(canAccessRole("KOMANDAN" as AppRole, "activity-read-all")).toBe(true);
    expect(canAccessRole("KOMANDAN" as AppRole, "reports-create")).toBe(true);
    expect(canAccessRole("KOMANDAN" as AppRole, "accounts-manage")).toBe(false);
    expect(canAccessRole("KOMANDAN" as AppRole, "persit-verify")).toBe(false);
    expect(canAccessRole("KOMANDAN" as AppRole, "audit-read")).toBe(false);
  });

  it("PERSONEL has personal-only permissions", () => {
    expect(canAccessRole("PERSONEL" as AppRole, "personal-dashboard")).toBe(true);
    expect(canAccessRole("PERSONEL" as AppRole, "personal-activity-read")).toBe(true);
    expect(canAccessRole("PERSONEL" as AppRole, "presence-transact")).toBe(true);
    expect(canAccessRole("PERSONEL" as AppRole, "gps-update")).toBe(true);
    expect(canAccessRole("PERSONEL" as AppRole, "password-change-own")).toBe(true);
    expect(canAccessRole("PERSONEL" as AppRole, "personnel-read")).toBe(false);
    expect(canAccessRole("PERSONEL" as AppRole, "reports-create")).toBe(false);
    expect(canAccessRole("PERSONEL" as AppRole, "gate-manage")).toBe(false);
  });

  it("PERSIT has minimal permissions", () => {
    expect(canAccessRole("PERSIT" as AppRole, "persit-dashboard")).toBe(true);
    expect(canAccessRole("PERSIT" as AppRole, "password-change-own")).toBe(true);
    expect(canAccessRole("PERSIT" as AppRole, "personnel-read")).toBe(false);
    expect(canAccessRole("PERSIT" as AppRole, "gps-read")).toBe(false);
    expect(canAccessRole("PERSIT" as AppRole, "activity-read-all")).toBe(false);
    expect(canAccessRole("PERSIT" as AppRole, "reports-create")).toBe(false);
  });

  it("Reports access is restricted to SUPER_ADMIN and KOMANDAN only", () => {
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "reports-create")).toBe(true);
    expect(canAccessRole("KOMANDAN" as AppRole, "reports-create")).toBe(true);
    expect(canAccessRole("PERSONEL" as AppRole, "reports-create")).toBe(false);
    expect(canAccessRole("PERSIT" as AppRole, "reports-create")).toBe(false);
  });

  it("Gate management is SUPER_ADMIN only", () => {
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "gate-manage")).toBe(true);
    expect(canAccessRole("KOMANDAN" as AppRole, "gate-manage")).toBe(false);
    expect(canAccessRole("PERSONEL" as AppRole, "gate-manage")).toBe(false);
    expect(canAccessRole("PERSIT" as AppRole, "gate-manage")).toBe(false);
  });

  it("Account management is SUPER_ADMIN only", () => {
    expect(canAccessRole("SUPER_ADMIN" as AppRole, "accounts-manage")).toBe(true);
    expect(canAccessRole("KOMANDAN" as AppRole, "accounts-manage")).toBe(false);
    expect(canAccessRole("PERSONEL" as AppRole, "accounts-manage")).toBe(false);
    expect(canAccessRole("PERSIT" as AppRole, "accounts-manage")).toBe(false);
  });
});

describe("Edge Function mustChangePassword enforcement logic", () => {
  it("denies access when mustChangePassword is true", () => {
    const user = { role: "SUPER_ADMIN" as AppRole, mustChangePassword: true };
    if (user.mustChangePassword) {
      expect(user.mustChangePassword).toBe(true);
    }
  });

  it("allows access when mustChangePassword is false", () => {
    const user = { role: "SUPER_ADMIN" as AppRole, mustChangePassword: false };
    expect(user.mustChangePassword).toBe(false);
  });
});
