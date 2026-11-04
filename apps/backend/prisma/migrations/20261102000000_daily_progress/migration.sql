ALTER TABLE "user_profiles" ADD COLUMN "preferred_kinds" "LearningKind"[] NOT NULL DEFAULT ARRAY['GRAMMAR','VOCABULARY','READING','LISTENING']::"LearningKind"[], ADD COLUMN "preferences_version" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "learning_day_plans" (
  "id" UUID PRIMARY KEY, "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "date" VARCHAR(10) NOT NULL, "version" INTEGER NOT NULL DEFAULT 0, "preferences_version" INTEGER NOT NULL,
  "daily_goal_minutes" INTEGER NOT NULL CHECK ("daily_goal_minutes" BETWEEN 5 AND 120), "items" JSONB NOT NULL,
  "policy_version" TEXT NOT NULL DEFAULT 'baseline-v1', "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL, UNIQUE ("user_id", "date")
);
CREATE TABLE "learning_activity_sessions" (
  "id" UUID PRIMARY KEY, "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "attempt_id" UUID NOT NULL REFERENCES "learning_attempts"("id") ON DELETE CASCADE,
  "client_run_id" UUID NOT NULL, "anchor_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("user_id", "attempt_id", "client_run_id")
);
CREATE INDEX "learning_activity_sessions_user_id_anchor_at_idx" ON "learning_activity_sessions"("user_id", "anchor_at");
CREATE TABLE "learning_activity_segments" (
  "id" UUID PRIMARY KEY, "session_id" UUID NOT NULL REFERENCES "learning_activity_sessions"("id") ON DELETE CASCADE,
  "seq" INTEGER NOT NULL CHECK ("seq" >= 0), "start_offset_ms" INTEGER NOT NULL,
  "end_offset_ms" INTEGER NOT NULL, "start_at" TIMESTAMP(3), "end_at" TIMESTAMP(3),
  UNIQUE ("session_id", "seq"),
  CHECK ("start_offset_ms" >= 0 AND "end_offset_ms" > "start_offset_ms" AND "end_offset_ms" - "start_offset_ms" <= 15000 AND "end_offset_ms" <= 86400000),
  CHECK (("start_at" IS NULL AND "end_at" IS NULL) OR ("start_at" IS NOT NULL AND "end_at" > "start_at"))
);
CREATE INDEX "learning_activity_segments_start_at_end_at_idx" ON "learning_activity_segments"("start_at", "end_at");
