import { describe, expect, it } from "vitest";
import { activityHistoryQuerySchema, formatActivityDuration } from "./activity-history";

describe("activity history query", () => {
  it("accepts supported filters and pagination", () => {
    const result = activityHistoryQuerySchema.safeParse({
      from: "2026-11-01T00:00:00.000Z",
      to: "2026-11-30T23:59:59.999Z",
      personnelName: "  Budi ",
      nrp: "123",
      gate: "Utama",
      destination: "Kantor",
      status: "SELESAI",
      page: "2",
      pageSize: "25"
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.personnelName).toBe("Budi");
      expect(result.data.page).toBe(2);
    }
  });

  it("rejects invalid status, oversized page size, and reversed date range", () => {
    expect(activityHistoryQuerySchema.safeParse({ status: "PENDING" }).success).toBe(false);
    expect(activityHistoryQuerySchema.safeParse({ pageSize: "100" }).success).toBe(false);
    expect(activityHistoryQuerySchema.safeParse({ from: "2026-11-30T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" }).success).toBe(false);
  });
});

describe("activity duration formatting", () => {
  it("does not calculate duration for active activities", () => {
    expect(formatActivityDuration(900, "AKTIF")).toBeNull();
  });

  it("formats completed duration", () => {
    expect(formatActivityDuration(93780, "SELESAI")).toBe("1 hari 2 jam 3 menit");
  });
});
