CREATE TYPE "SpeakingStatus" AS ENUM ('CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'UNKNOWN');
CREATE TABLE "speaking_prompts" (
 "id" UUID PRIMARY KEY, "code" VARCHAR(100) NOT NULL UNIQUE, "text" TEXT NOT NULL,
 "content_version" INTEGER NOT NULL DEFAULT 1, "sort_order" INTEGER NOT NULL,
 "published" BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE "speaking_submissions" (
 "id" UUID PRIMARY KEY, "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "prompt_id" UUID NOT NULL REFERENCES "speaking_prompts"("id") ON DELETE RESTRICT,
 "client_request_id" UUID NOT NULL, "prompt_snapshot" JSONB NOT NULL,
 "audio_hash" VARCHAR(64), "status" "SpeakingStatus" NOT NULL DEFAULT 'CREATED',
 "result" JSONB, "error_code" VARCHAR(100), "adapter_version" VARCHAR(100),
 "processing_at" TIMESTAMP(3), "completed_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE ("user_id", "client_request_id")
);
CREATE INDEX "speaking_submissions_user_id_created_at_id_idx" ON "speaking_submissions"("user_id", "created_at", "id");
CREATE INDEX "speaking_submissions_status_processing_at_idx" ON "speaking_submissions"("status", "processing_at");
INSERT INTO "speaking_prompts" ("id", "code", "text", "sort_order") VALUES
 ('ab000000-0000-4000-8000-000000000001', 'read-aloud-1', 'I have lived here for five years', 1),
 ('ab000000-0000-4000-8000-000000000002', 'read-aloud-2', 'My name is Anna', 2),
 ('ab000000-0000-4000-8000-000000000003', 'read-aloud-3', 'I am a student from Hanoi', 3)
 ON CONFLICT ("code") DO NOTHING;
