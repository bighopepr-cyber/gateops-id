import { describe, expect, it } from "vitest";
import { canReadAuditLogs } from "./audit-log-access.ts";

describe("canReadAuditLogs", () => {
  it("allows only Super Admin with audit-read permission", () => {
    expect(canReadAuditLogs("SUPER_ADMIN")).toBe(true);
    expect(canReadAuditLogs("KOMANDAN")).toBe(false);
    expect(canReadAuditLogs("PERSONEL")).toBe(false);
    expect(canReadAuditLogs("PERSIT")).toBe(false);
  });
});
