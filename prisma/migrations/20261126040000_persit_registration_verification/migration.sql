CREATE TYPE "PresenceStatus" AS ENUM ('DI_DALAM', 'DI_LUAR');

ALTER TABLE "users"
ADD COLUMN "presence_status" "PresenceStatus" NOT NULL DEFAULT 'DI_DALAM';
