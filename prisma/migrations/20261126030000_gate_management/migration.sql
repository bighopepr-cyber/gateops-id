CREATE TYPE "GateStatus" AS ENUM ('AKTIF', 'NONAKTIF');

CREATE TABLE "gates" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "location" VARCHAR(240) NOT NULL,
  "status" "GateStatus" NOT NULL DEFAULT 'AKTIF',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "gates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "gates_status_idx" ON "gates"("status");
CREATE INDEX "gates_name_idx" ON "gates"("name");
