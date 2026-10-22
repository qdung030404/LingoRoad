-- Baseline for NEW demo/test databases. Existing databases must not apply this blindly.
CREATE TYPE "UserRole" AS ENUM ('LEARNER', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');
CREATE TYPE "CefrLevel" AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
CREATE TYPE "LearningPurpose" AS ENUM ('EXAM', 'WORK', 'DAILY_COMMUNICATION', 'STUDY');
CREATE TYPE "AssessmentSkill" AS ENUM ('READING', 'LISTENING');
CREATE TYPE "SessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');
CREATE TYPE "ItemType" AS ENUM ('MULTIPLE_CHOICE', 'CLOZE', 'SENTENCE_REORDER', 'MATCHING');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" VARCHAR(255) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'LEARNER',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "user_profiles" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "target_cefr" "CefrLevel" NOT NULL DEFAULT 'B1',
  "daily_goal_minutes" INTEGER NOT NULL DEFAULT 10,
  "learning_purpose" "LearningPurpose",
  "self_assessed_cefr" "CefrLevel",
  "onboarding_completed_at" TIMESTAMP(3),
  "reminder_enabled" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_profiles_daily_goal_check" CHECK ("daily_goal_minutes" BETWEEN 5 AND 120)
);
CREATE TABLE "refresh_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(255) NOT NULL,
  "device_identifier" VARCHAR(150),
  "ip_address" VARCHAR(45),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "is_revoked" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "placement_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "SessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
  "current_item_index" INTEGER NOT NULL DEFAULT 0,
  "total_items" INTEGER NOT NULL DEFAULT 10,
  "test_version" TEXT NOT NULL DEFAULT 'READING_LISTENING_V1',
  "bank_version" TEXT NOT NULL DEFAULT 'demo-v1',
  "current_item_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 0,
  "skill_results" JSONB,
  "correct_count" INTEGER NOT NULL DEFAULT 0,
  "estimated_cefr" "CefrLevel",
  "confidence_score" DOUBLE PRECISION,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "placement_sessions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "assessment_items" (
  "id" UUID NOT NULL,
  "external_id" VARCHAR(100),
  "bank_version" VARCHAR(100),
  "skill" "AssessmentSkill",
  "passage" TEXT,
  "skill_code" VARCHAR(100) NOT NULL,
  "cefr_level" "CefrLevel" NOT NULL,
  "type" "ItemType" NOT NULL DEFAULT 'MULTIPLE_CHOICE',
  "prompt" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "correct_option" TEXT NOT NULL,
  "explanation" TEXT,
  "audio_url" VARCHAR(500),
  "irt_a" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "irt_b" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "irt_c" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assessment_items_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "assessment_responses" (
  "id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "item_index" INTEGER NOT NULL,
  "selected_option" VARCHAR(500) NOT NULL,
  "is_correct" BOOLEAN NOT NULL,
  "response_time_ms" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assessment_responses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");
CREATE INDEX "refresh_sessions_user_id_is_revoked_idx" ON "refresh_sessions"("user_id", "is_revoked");
CREATE INDEX "refresh_sessions_token_hash_idx" ON "refresh_sessions"("token_hash");
CREATE INDEX "placement_sessions_user_id_status_idx" ON "placement_sessions"("user_id", "status");
-- Partial index is intentionally maintained in SQL: Prisma 5 cannot express it.
CREATE UNIQUE INDEX "placement_sessions_one_active_per_user" ON "placement_sessions"("user_id") WHERE "status" = 'IN_PROGRESS';
CREATE UNIQUE INDEX "assessment_items_external_id_key" ON "assessment_items"("external_id");
CREATE INDEX "assessment_items_skill_code_cefr_level_idx" ON "assessment_items"("skill_code", "cefr_level");
CREATE INDEX "assessment_items_cefr_level_idx" ON "assessment_items"("cefr_level");
CREATE INDEX "assessment_items_bank_version_skill_idx" ON "assessment_items"("bank_version", "skill");
CREATE UNIQUE INDEX "assessment_responses_session_id_item_index_key" ON "assessment_responses"("session_id", "item_index");
CREATE UNIQUE INDEX "assessment_responses_session_id_item_id_key" ON "assessment_responses"("session_id", "item_id");
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_sessions" ADD CONSTRAINT "placement_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "placement_sessions" ADD CONSTRAINT "placement_sessions_current_item_id_fkey" FOREIGN KEY ("current_item_id") REFERENCES "assessment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "placement_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "assessment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
