import { describe, expect, it } from "vitest";
import { createGateQrCredential, hashGateQrCredential, verifyGateQrCredential } from "./gate-qr";

describe("gate QR credentials", () => {
  it("creates a unique high-entropy token and stores only its SHA-256 hash", () => {
    const first = createGateQrCredential();
    const second = createGateQrCredential();
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.tokenHash).toBe(hashGateQrCredential(first.token));
    expect(first.tokenHash).not.toBe(first.token);
  });

  it("verifies only the exact token using the stored hash", () => {
    const credential = createGateQrCredential();
    expect(verifyGateQrCredential(credential.token, credential.tokenHash)).toBe(true);
    expect(verifyGateQrCredential(credential.token + "x", credential.tokenHash)).toBe(false);
    expect(verifyGateQrCredential("not-a-token", credential.tokenHash)).toBe(false);
    expect(verifyGateQrCredential(credential.token, "invalid-hash")).toBe(false);
  });
});
