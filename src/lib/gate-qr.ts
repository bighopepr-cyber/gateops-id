import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createGateQrCredential() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashGateQrCredential(token) };
}

export function hashGateQrCredential(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function verifyGateQrCredential(token: string, expectedHash: string): boolean {
  if (!TOKEN_PATTERN.test(token) || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashGateQrCredential(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
