-- Evidence-based indexes selected from EXPLAIN (ANALYZE, BUFFERS) measurements.

CREATE INDEX "vocabulary_words_deck_id_deleted_at_learning_state_last_rev_idx"
  ON "vocabulary_words"("deck_id", "deleted_at", "learning_state", "last_reviewed_at");

CREATE INDEX "vocabulary_review_attempts_user_id_status_idx"
  ON "vocabulary_review_attempts"("user_id", "status");

CREATE INDEX "learning_activity_segments_session_id_start_at_end_at_idx"
  ON "learning_activity_segments"("session_id", "start_at", "end_at");

CREATE INDEX "learning_attempts_user_id_submitted_at_id_idx"
  ON "learning_attempts"("user_id", "submitted_at", "id");

CREATE INDEX "voice_conversations_status_created_at_idx"
  ON "voice_conversations"("status", "created_at");
