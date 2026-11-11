CREATE TYPE "LearningKind" AS ENUM ('GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING');
CREATE TYPE "LearningAttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

CREATE TABLE "learning_lessons" (
  "id" UUID NOT NULL, "code" VARCHAR(100) NOT NULL, "kind" "LearningKind" NOT NULL,
  "title" VARCHAR(200) NOT NULL, "description" TEXT NOT NULL, "estimated_minutes" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL, "published" BOOLEAN NOT NULL DEFAULT false,
  "content_version" INTEGER NOT NULL DEFAULT 1, "content" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_lessons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "learning_lessons_code_key" ON "learning_lessons"("code");
CREATE INDEX "learning_lessons_published_sort_order_idx" ON "learning_lessons"("published", "sort_order");

CREATE TABLE "learning_attempts" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "lesson_id" UUID NOT NULL,
  "status" "LearningAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS', "version" INTEGER NOT NULL DEFAULT 0,
  "phase" VARCHAR(10) NOT NULL DEFAULT 'STUDY', "position_index" INTEGER NOT NULL DEFAULT 0,
  "lesson_snapshot" JSONB NOT NULL, "content_snapshot" JSONB NOT NULL,
  "correct_count" INTEGER, "total_questions" INTEGER NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  "submitted_at" TIMESTAMP(3), CONSTRAINT "learning_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learning_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learning_attempts_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "learning_lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "learning_attempts_position_check" CHECK ("position_index" >= 0 AND "phase" IN ('STUDY', 'QUIZ')),
  CONSTRAINT "learning_attempts_score_check" CHECK ("total_questions" > 0 AND ("correct_count" IS NULL OR "correct_count" BETWEEN 0 AND "total_questions"))
);
CREATE INDEX "learning_attempts_user_id_status_updated_at_idx" ON "learning_attempts"("user_id", "status", "updated_at");
CREATE INDEX "learning_attempts_user_id_lesson_id_idx" ON "learning_attempts"("user_id", "lesson_id");
-- Prisma 5 cannot express partial unique indexes. Keep this database invariant in SQL.
CREATE UNIQUE INDEX "learning_attempts_one_active" ON "learning_attempts"("user_id", "lesson_id") WHERE "status" = 'IN_PROGRESS';

CREATE TABLE "learning_attempt_answers" (
  "id" UUID NOT NULL, "attempt_id" UUID NOT NULL, "question_id" VARCHAR(100) NOT NULL,
  "option_id" VARCHAR(100), "checked" BOOLEAN NOT NULL DEFAULT false, "is_correct" BOOLEAN,
  "checked_at" TIMESTAMP(3), CONSTRAINT "learning_attempt_answers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "learning_attempt_answers_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "learning_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "learning_attempt_answers_checked_check" CHECK (NOT "checked" OR ("option_id" IS NOT NULL AND "is_correct" IS NOT NULL AND "checked_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "learning_attempt_answers_attempt_id_question_id_key" ON "learning_attempt_answers"("attempt_id", "question_id");
