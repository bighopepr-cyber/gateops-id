import { describe, expect, it } from "vitest";
import { getGpsStatus } from "./gps-status";

describe("getGpsStatus", () => {
  const now = new Date("2026-11-26T10:00:00.000Z");

  it("keeps GPS active at exactly 60 seconds", () => {
    expect(getGpsStatus(new Date(now.getTime() - 60_000), now)).toBe("AKTIF");
  });

  it("marks GPS offline after more than 60 seconds", () => {
    expect(getGpsStatus(new Date(now.getTime() - 60_001), now)).toBe("OFFLINE");
  });

  it("keeps a fresh location active", () => {
    expect(getGpsStatus(new Date(now.getTime() - 30_000), now)).toBe("AKTIF");
  });

  it("marks GPS offline immediately after permission revocation", () => {
    expect(getGpsStatus(new Date(now.getTime() - 1_000), now, now)).toBe("OFFLINE");
  });
});
