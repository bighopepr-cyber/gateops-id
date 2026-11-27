import { describe, expect, it } from "vitest";
import { parseActivityHistoryQuery } from "./activity-history-query.ts";

describe("parseActivityHistoryQuery", () => {
  it("applies defaults and normalizes supported filters", () => {
    const result = parseActivityHistoryQuery(new URLSearchParams({
      from: "2026-11-01T00:00:00.000+07:00",
      to: "2026-11-30T23:59:59.999+07:00",
      personnelName: "  Budi  ", nrp: "  123 ", gate: " Utama ",
      destination: " Markas ", status: "SELESAI", page: "2", pageSize: "25",
    }));
    expect(result).toEqual({
      success: true,
      data: {
        from: "2026-10-31T17:00:00.000Z", to: "2026-11-30T16:59:59.999Z",
        personnelName: "Budi", nrp: "123", gate: "Utama", destination: "Markas",
        status: "SELESAI", page: 2, pageSize: 25,
      },
    });
  });

  it("defaults page and page size when omitted", () => {
    expect(parseActivityHistoryQuery(new URLSearchParams())).toEqual({
      success: true,
      data: { page: 1, pageSize: 20 },
    });
  });

  it("rejects invalid dates, reversed ranges, invalid status, and out-of-range pagination", () => {
    for (const params of [
      new URLSearchParams({ from: "2026-11-27" }),
      new URLSearchParams({ from: "2026-11-30T00:00:00Z", to: "2026-11-01T00:00:00Z" }),
      new URLSearchParams({ status: "PENDING" }),
      new URLSearchParams({ page: "0" }),
      new URLSearchParams({ pageSize: "51" }),
      new URLSearchParams({ page: "1.5" }),
      new URLSearchParams({ personnelName: "x".repeat(161) }),
    ]) expect(parseActivityHistoryQuery(params).success).toBe(false);
  });
});
