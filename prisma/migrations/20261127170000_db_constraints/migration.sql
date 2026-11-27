-- Enforce exactly one active (AKTIF) activity per personnel at the database level.
CREATE UNIQUE INDEX activities_one_active_per_personnel
  ON activities (personnel_id)
  WHERE status = 'AKTIF';

-- Database-level CHECK constraint for presence_status as a defense-in-depth measure
-- alongside the Prisma enum.
ALTER TABLE users
  ADD CONSTRAINT users_presence_status_check
  CHECK (presence_status IN ('DI_DALAM', 'DI_LUAR'));

-- Database-level CHECK constraint for activity_status as a defense-in-depth measure
-- alongside the Prisma enum.
ALTER TABLE activities
  ADD CONSTRAINT activities_activity_status_check
  CHECK (status IN ('AKTIF', 'SELESAI'));
