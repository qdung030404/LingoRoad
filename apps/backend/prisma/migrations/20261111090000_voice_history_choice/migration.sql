CREATE TYPE "VoiceHistoryStatus" AS ENUM ('PENDING', 'SAVED', 'DISCARDED');

ALTER TABLE "voice_conversations"
ADD COLUMN "history_status" "VoiceHistoryStatus" NOT NULL DEFAULT 'SAVED';

CREATE INDEX "voice_conversations_history_status_ended_at_idx"
ON "voice_conversations" ("history_status", "ended_at");
