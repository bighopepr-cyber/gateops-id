ALTER TABLE "gates"
ADD COLUMN "qr_token_hash" CHAR(64);

CREATE UNIQUE INDEX "gates_qr_token_hash_key"
ON "gates"("qr_token_hash");
