ALTER TABLE "vocabulary_decks" ADD COLUMN "system_key" VARCHAR(40);

CREATE INDEX "vocabulary_decks_user_id_system_key_deleted_at_idx"
  ON "vocabulary_decks"("user_id", "system_key", "deleted_at");

CREATE UNIQUE INDEX "vocabulary_decks_user_system_key_active_key"
  ON "vocabulary_decks"("user_id", "system_key")
  WHERE "deleted_at" IS NULL AND "system_key" IS NOT NULL;
