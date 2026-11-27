import { describe, expect, it } from "vitest";
import { parseAuditLogQuery } from "./audit-log-query.ts";

describe("parseAuditLogQuery", () => {
  it("defaults to page 1 and 25 rows", () => {
    expect(parseAuditLogQuery(new URLSearchParams())).toEqual({
      success: true, data: { page: 1, pageSize: 25 },
    });
  });

  it("accepts bounded integer pagination", () => {
    expect(parseAuditLogQuery(new URLSearchParams({ page: "3", pageSize: "100" }))).toEqual({
      success: true, data: { page: 3, pageSize: 100 },
    });
  });

  it("rejects invalid, fractional, negative, unsafe, and out-of-range values", () => {
    for (const params of [
      new URLSearchParams({ page: "0" }),
      new URLSearchParams({ page: "-1" }),
      new URLSearchParams({ page: "1.2" }),
      new URLSearchParams({ page: "100001" }),
      new URLSearchParams({ pageSize: "0" }),
      new URLSearchParams({ pageSize: "101" }),
      new URLSearchParams({ pageSize: "2.5" }),
      new URLSearchParams({ pageSize: "abc" }),
    ]) expect(parseAuditLogQuery(params).success).toBe(false);
  });
});
