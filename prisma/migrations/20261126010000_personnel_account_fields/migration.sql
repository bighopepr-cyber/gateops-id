ALTER TABLE "users"
  ADD COLUMN "nrp" VARCHAR(40),
  ADD COLUMN "rank" VARCHAR(100),
  ADD COLUMN "position" VARCHAR(160);

CREATE INDEX "users_nrp_idx" ON "users"("nrp");
