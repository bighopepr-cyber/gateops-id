import { describe, expect, it } from "vitest";
import { constantTimeEqual, hasValidServiceCredential } from "./service-auth";

describe("GATEOPS Edge Function service credential", () => {
  it("compares credentials and fails closed when the secret is missing", () => {
    expect(constantTimeEqual("same-value", "same-value")).toBe(true);
    expect(constantTimeEqual("same-value", "different")).toBe(false);
    expect(hasValidServiceCredential(new Request("http://localhost"), undefined)).toBe(false);
    const request = new Request("http://localhost/functions/v1/gateops-api/whoami", {
      headers: { "x-gateops-service-key": "expected-service-key-value-with-more-than-32-characters" },
    });
    expect(hasValidServiceCredential(request, "expected-service-key-value-with-more-than-32-characters")).toBe(true);
    expect(hasValidServiceCredential(request, "wrong-service-key-value-with-more-than-32-characters")).toBe(false);
  });
});
