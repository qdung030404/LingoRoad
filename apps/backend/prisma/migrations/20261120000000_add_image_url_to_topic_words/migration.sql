-- AlterTable
ALTER TABLE "topic_words" ADD COLUMN IF NOT EXISTS "image_url" VARCHAR(500);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "topic_words_topic_id_idx" ON "topic_words"("topic_id");

-- AlterTable
ALTER TABLE "vocabulary_decks" ADD COLUMN IF NOT EXISTS "source_topic_id" UUID;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vocabulary_decks_user_id_source_topic_id_idx" ON "vocabulary_decks"("user_id", "source_topic_id");
