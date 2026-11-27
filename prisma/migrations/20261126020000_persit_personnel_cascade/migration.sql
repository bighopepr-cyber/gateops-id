ALTER TABLE "users"
  ADD COLUMN "linked_personnel_id" TEXT;

CREATE INDEX "users_linked_personnel_id_idx"
  ON "users"("linked_personnel_id");

ALTER TABLE "users"
  ADD CONSTRAINT "users_linked_personnel_id_fkey"
  FOREIGN KEY ("linked_personnel_id")
  REFERENCES "users"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
