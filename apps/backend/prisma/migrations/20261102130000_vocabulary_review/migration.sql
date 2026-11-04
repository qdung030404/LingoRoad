

-- CreateTable
CREATE TABLE "vocabulary_decks" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vocabulary_decks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_words" (
    "id" UUID NOT NULL,
    "deck_id" UUID NOT NULL,
    "english" VARCHAR(100) NOT NULL,
    "meaning" VARCHAR(500) NOT NULL,
    "phonetic" VARCHAR(100) NOT NULL DEFAULT '',
    "part_of_speech" VARCHAR(50) NOT NULL DEFAULT '',
    "example" VARCHAR(1000) NOT NULL DEFAULT '',
    "translation" VARCHAR(1000) NOT NULL DEFAULT '',
    "accepted_answers" TEXT[],
    "content_version" INTEGER NOT NULL DEFAULT 1,
    "version" INTEGER NOT NULL DEFAULT 0,
    "learning_state" VARCHAR(20) NOT NULL DEFAULT 'NEEDS_REVIEW',
    "last_presented_at" TIMESTAMP(3),
    "last_reviewed_at" TIMESTAMP(3),
    "last_review_item_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "vocabulary_words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_review_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "deck_id" UUID NOT NULL,
    "scope" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
    "version" INTEGER NOT NULL DEFAULT 0,
    "deck_snapshot" JSONB NOT NULL,
    "queue" UUID[],
    "phase" VARCHAR(20) NOT NULL DEFAULT 'FRONT',
    "remaining_eligible_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),

    CONSTRAINT "vocabulary_review_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_review_items" (
    "id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "word_id" UUID NOT NULL,
    "initial_ordinal" INTEGER NOT NULL,
    "word_content_version" INTEGER NOT NULL,
    "word_snapshot" JSONB NOT NULL,
    "state" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "draft" VARCHAR(1000) NOT NULL DEFAULT '',
    "checked_answer" VARCHAR(1000),
    "normalized_answer" VARCHAR(1000),
    "normalization_version" VARCHAR(10),
    "is_correct" BOOLEAN,
    "checked_at" TIMESTAMP(3),
    "rating" VARCHAR(10),
    "result_source" VARCHAR(30),
    "finalized_at" TIMESTAMP(3),

    CONSTRAINT "vocabulary_review_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabulary_command_receipts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "command_id" UUID NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "target_id" TEXT NOT NULL,
    "canonical_payload_hash" VARCHAR(64) NOT NULL,
    "applied_version" INTEGER,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vocabulary_command_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vocabulary_decks_user_id_deleted_at_created_at_id_idx" ON "vocabulary_decks"("user_id", "deleted_at", "created_at", "id");

-- CreateIndex
CREATE INDEX "vocabulary_words_deck_id_deleted_at_created_at_id_idx" ON "vocabulary_words"("deck_id", "deleted_at", "created_at", "id");

-- CreateIndex
CREATE INDEX "vocabulary_review_attempts_user_id_started_at_id_idx" ON "vocabulary_review_attempts"("user_id", "started_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_review_items_attempt_id_word_id_key" ON "vocabulary_review_items"("attempt_id", "word_id");

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_command_receipts_user_id_command_id_key" ON "vocabulary_command_receipts"("user_id", "command_id");

-- AddForeignKey
ALTER TABLE "vocabulary_decks" ADD CONSTRAINT "vocabulary_decks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_words" ADD CONSTRAINT "vocabulary_words_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "vocabulary_decks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_review_attempts" ADD CONSTRAINT "vocabulary_review_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_review_attempts" ADD CONSTRAINT "vocabulary_review_attempts_deck_id_fkey" FOREIGN KEY ("deck_id") REFERENCES "vocabulary_decks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_review_items" ADD CONSTRAINT "vocabulary_review_items_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "vocabulary_review_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_review_items" ADD CONSTRAINT "vocabulary_review_items_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "vocabulary_words"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabulary_command_receipts" ADD CONSTRAINT "vocabulary_command_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX vocabulary_review_one_active ON vocabulary_review_attempts(user_id, deck_id) WHERE status = 'IN_PROGRESS';
ALTER TABLE vocabulary_words ADD CONSTRAINT vocabulary_word_state CHECK (learning_state IN ('REMEMBERED','NEEDS_REVIEW') AND content_version >= 1 AND version >= 0);
ALTER TABLE vocabulary_review_attempts ADD CONSTRAINT vocabulary_review_state CHECK (status IN ('IN_PROGRESS','COMPLETED','ABANDONED') AND scope IN ('NEEDS_REVIEW','ALL') AND phase IN ('FRONT','MEANING','RECALL') AND version >= 0);
ALTER TABLE vocabulary_review_items ADD CONSTRAINT vocabulary_item_state CHECK (state IN ('PENDING','REVIEWED','SKIPPED') AND (rating IS NULL OR rating IN ('EASY','MEDIUM','HARD')) AND (result_source IS NULL OR result_source IN ('SELF_REPORT','RECALL_AFTER_REVEAL')));
ALTER TABLE vocabulary_words ALTER COLUMN accepted_answers SET NOT NULL;
ALTER TABLE vocabulary_review_attempts ALTER COLUMN queue SET NOT NULL;

