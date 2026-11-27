import { describe, expect, it } from "vitest";
import { calculateDurationSeconds } from "./activity-duration";

describe("activity duration", () => {
  it("calculates whole elapsed seconds", () => {
    expect(calculateDurationSeconds(new Date("2026-11-26T08:00:00.000Z"), new Date("2026-11-26T08:01:42.900Z"))).toBe(102);
  });

  it("never returns a negative duration for clock skew", () => {
    expect(calculateDurationSeconds(new Date("2026-11-26T08:01:00.000Z"), new Date("2026-11-26T08:00:00.000Z"))).toBe(0);
  });
});
