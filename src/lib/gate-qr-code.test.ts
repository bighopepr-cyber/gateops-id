import { describe, expect, it } from "vitest";
import { createGateQrCredential } from "./gate-qr";
import { createGateQrSvg } from "./gate-qr-code";

describe("gate QR payload rendering", () => {
  it("encodes only the raw credential into a printable SVG QR symbol", () => {
    const { token } = createGateQrCredential();
    const svg = createGateQrSvg(token);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).not.toContain(token);
    expect(svg).not.toContain("https://");
    expect(svg).not.toContain("gateId");
  });

  it("rejects malformed credentials before generating a QR symbol", () => {
    expect(() => createGateQrSvg("invalid")).toThrow("Kredensial QR Gate tidak valid.");
  });
});
