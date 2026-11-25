-- Reconcile foreign-key ON UPDATE drift between historical hand-written migrations and Prisma schema.
-- Wrapped in an explicit transaction with single-statement ALTER TABLE per table so no FK is ever left dropped.

BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "learning_day_plans"
  DROP CONSTRAINT IF EXISTS "learning_day_plans_user_id_fkey",
  ADD CONSTRAINT "learning_day_plans_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_activity_sessions"
  DROP CONSTRAINT IF EXISTS "learning_activity_sessions_user_id_fkey",
  ADD CONSTRAINT "learning_activity_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  DROP CONSTRAINT IF EXISTS "learning_activity_sessions_attempt_id_fkey",
  ADD CONSTRAINT "learning_activity_sessions_attempt_id_fkey"
    FOREIGN KEY ("attempt_id") REFERENCES "learning_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_activity_segments"
  DROP CONSTRAINT IF EXISTS "learning_activity_segments_session_id_fkey",
  ADD CONSTRAINT "learning_activity_segments_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "learning_activity_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "speaking_submissions"
  DROP CONSTRAINT IF EXISTS "speaking_submissions_user_id_fkey",
  ADD CONSTRAINT "speaking_submissions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  DROP CONSTRAINT IF EXISTS "speaking_submissions_prompt_id_fkey",
  ADD CONSTRAINT "speaking_submissions_prompt_id_fkey"
    FOREIGN KEY ("prompt_id") REFERENCES "speaking_prompts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "speaking_game_progress"
  DROP CONSTRAINT IF EXISTS "speaking_game_progress_user_id_fkey",
  ADD CONSTRAINT "speaking_game_progress_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  DROP CONSTRAINT IF EXISTS "speaking_game_progress_prompt_id_fkey",
  ADD CONSTRAINT "speaking_game_progress_prompt_id_fkey"
    FOREIGN KEY ("prompt_id") REFERENCES "speaking_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
