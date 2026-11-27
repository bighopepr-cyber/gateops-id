import { z } from "zod";

const dateTime = z.string().datetime({ offset: true });
export const activityHistoryQuerySchema = z.object({
  from: dateTime.optional(),
  to: dateTime.optional(),
  personnelName: z.string().trim().max(160).optional(),
  nrp: z.string().trim().max(40).optional(),
  gate: z.string().trim().max(120).optional(),
  destination: z.string().trim().max(240).optional(),
  status: z.enum(["AKTIF", "SELESAI"]).optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20)
}).refine((value) => !value.from || !value.to || new Date(value.from) <= new Date(value.to), {
  message: "Rentang tanggal tidak valid.",
  path: ["to"]
});

export type ActivityHistoryQuery = z.infer<typeof activityHistoryQuerySchema>;

export function formatActivityDuration(seconds: number | null, status: "AKTIF" | "SELESAI") {
  if (status === "AKTIF" || seconds === null) return null;
  const totalMinutes = Math.floor(seconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return [days ? `${days} hari` : "", hours ? `${hours} jam` : "", `${minutes} menit`].filter(Boolean).join(" ");
}
