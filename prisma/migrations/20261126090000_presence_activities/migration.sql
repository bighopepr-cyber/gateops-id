CREATE TYPE "ActivityStatus" AS ENUM ('AKTIF', 'SELESAI');

CREATE TABLE "activities" (
  "id" TEXT NOT NULL,
  "personnel_id" TEXT NOT NULL,
  "exit_gate_id" TEXT NOT NULL,
  "return_gate_id" TEXT,
  "destination" VARCHAR(240) NOT NULL,
  "purpose" VARCHAR(500) NOT NULL,
  "status" "ActivityStatus" NOT NULL DEFAULT 'AKTIF',
  "exit_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "return_at" TIMESTAMP(3),
  "duration_seconds" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activities_duration_nonnegative" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0),
  CONSTRAINT "activities_status_consistency" CHECK (
    ("status" = 'AKTIF' AND "return_at" IS NULL AND "return_gate_id" IS NULL AND "duration_seconds" IS NULL)
    OR ("status" = 'SELESAI' AND "return_at" IS NOT NULL AND "return_gate_id" IS NOT NULL AND "duration_seconds" IS NOT NULL)
  )
);

CREATE INDEX "activities_personnel_id_status_exit_at_idx" ON "activities"("personnel_id", "status", "exit_at");
CREATE INDEX "activities_exit_gate_id_idx" ON "activities"("exit_gate_id");
CREATE INDEX "activities_return_gate_id_idx" ON "activities"("return_gate_id");
CREATE UNIQUE INDEX "activities_one_active_per_personnel" ON "activities"("personnel_id") WHERE "status" = 'AKTIF';

ALTER TABLE "activities" ADD CONSTRAINT "activities_personnel_id_fkey"
  FOREIGN KEY ("personnel_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_exit_gate_id_fkey"
  FOREIGN KEY ("exit_gate_id") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_return_gate_id_fkey"
  FOREIGN KEY ("return_gate_id") REFERENCES "gates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
