ALTER TABLE "voice_conversations"
ADD COLUMN "assessment_status" VARCHAR(30) NOT NULL DEFAULT 'UNASSESSED',
ADD COLUMN "assessment" JSONB,
ADD COLUMN "assessment_audio_hash" VARCHAR(64),
ADD COLUMN "assessment_started_at" TIMESTAMP(3);
