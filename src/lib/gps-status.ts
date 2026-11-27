export const GPS_OFFLINE_AFTER_MS = 60_000;

export type GpsStatus = "AKTIF" | "OFFLINE";

export function getGpsStatus(
  updatedAt: Date,
  now: Date = new Date(),
  permissionRevokedAt: Date | null = null
): GpsStatus {
  if (permissionRevokedAt) return "OFFLINE";
  return now.getTime() - updatedAt.getTime() > GPS_OFFLINE_AFTER_MS ? "OFFLINE" : "AKTIF";
}
