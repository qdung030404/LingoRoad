CREATE TYPE "SpeakingMode" AS ENUM ('READ_ALOUD', 'TOPIC', 'TONGUE_TWISTER');
ALTER TABLE "speaking_prompts"
ADD COLUMN "mode" "SpeakingMode" NOT NULL DEFAULT 'READ_ALOUD',
ADD COLUMN "title" TEXT NOT NULL DEFAULT '',
ADD COLUMN "difficulty" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "max_duration_seconds" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "hints" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "sample_asset" TEXT;
CREATE INDEX "speaking_prompts_mode_sort_order_idx" ON "speaking_prompts"("mode", "sort_order");
