ALTER TABLE "users"
  ADD COLUMN "gps_latitude" DOUBLE PRECISION,
  ADD COLUMN "gps_longitude" DOUBLE PRECISION,
  ADD COLUMN "gps_updated_at" TIMESTAMP(3);

ALTER TABLE "users"
  ADD CONSTRAINT "users_gps_coordinates_pair_check"
  CHECK (
    ("gps_latitude" IS NULL AND "gps_longitude" IS NULL AND "gps_updated_at" IS NULL)
    OR
    ("gps_latitude" IS NOT NULL AND "gps_longitude" IS NOT NULL AND "gps_updated_at" IS NOT NULL
      AND "gps_latitude" BETWEEN -90 AND 90
      AND "gps_longitude" BETWEEN -180 AND 180)
  );

CREATE INDEX "users_presence_gps_updated_idx"
  ON "users"("presence_status", "gps_updated_at")
  WHERE "role" = 'PERSONEL' AND "presence_status" = 'DI_LUAR';
