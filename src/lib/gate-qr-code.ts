import qrcode from "qrcode-generator";

export function createGateQrSvg(credential: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(credential)) {
    throw new Error("Kredensial QR Gate tidak valid.");
  }

  const code = qrcode(0, "M");
  code.addData(credential, "Byte");
  code.make();
  return code.createSvgTag({ cellSize: 8, margin: 4, scalable: true });
}
