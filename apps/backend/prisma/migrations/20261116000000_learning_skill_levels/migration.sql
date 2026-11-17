CREATE TYPE "SkillLevelSource" AS ENUM ('PLACEMENT', 'ADAPTIVE', 'DEFAULT');

ALTER TABLE "learning_attempts"
  ADD COLUMN "content_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "eligible_for_level_eval" BOOLEAN NOT NULL DEFAULT true;

UPDATE "learning_attempts"
SET "content_version" = ("lesson_snapshot"->>'contentVersion')::INTEGER
WHERE "lesson_snapshot"->>'contentVersion' ~ '^\d+$';

CREATE TABLE "learning_skill_levels" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "kind" "LearningKind" NOT NULL,
  "cefr_level" "CefrLevel" NOT NULL,
  "source" "SkillLevelSource" NOT NULL,
  "previous_cefr" "CefrLevel",
  "changed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_skill_levels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_skill_levels_user_id_kind_key"
  ON "learning_skill_levels"("user_id", "kind");

ALTER TABLE "learning_skill_levels"
  ADD CONSTRAINT "learning_skill_levels_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "learning_skill_level_events" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "attempt_id" UUID NOT NULL,
  "kind" "LearningKind" NOT NULL,
  "from_cefr" "CefrLevel" NOT NULL,
  "to_cefr" "CefrLevel" NOT NULL,
  "direction" VARCHAR(8) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_skill_level_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_skill_level_events_attempt_id_key"
  ON "learning_skill_level_events"("attempt_id");

CREATE INDEX "learning_skill_level_events_user_id_kind_created_at_idx"
  ON "learning_skill_level_events"("user_id", "kind", "created_at");

ALTER TABLE "learning_skill_level_events"
  ADD CONSTRAINT "learning_skill_level_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_skill_level_events"
  ADD CONSTRAINT "learning_skill_level_events_attempt_id_fkey"
  FOREIGN KEY ("attempt_id") REFERENCES "learning_attempts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "learning_answer_exposures" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "lesson_id" UUID NOT NULL,
  "content_version" INTEGER NOT NULL DEFAULT 1,
  "first_attempt_id" UUID NOT NULL,
  "exposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_answer_exposures_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_answer_exposures_user_id_lesson_id_key"
  ON "learning_answer_exposures"("user_id", "lesson_id");

ALTER TABLE "learning_answer_exposures"
  ADD CONSTRAINT "learning_answer_exposures_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_answer_exposures"
  ADD CONSTRAINT "learning_answer_exposures_lesson_id_fkey"
  FOREIGN KEY ("lesson_id") REFERENCES "learning_lessons"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Restore answer exposures only for remaining checked attempts;
-- attempts cancelled and deleted under Wave E before this migration cannot be recovered retroactively.
INSERT INTO "learning_answer_exposures" (
  "id", "user_id", "lesson_id", "content_version", "first_attempt_id", "exposed_at"
)
SELECT DISTINCT ON (la."user_id", la."lesson_id")
  gen_random_uuid(),
  la."user_id",
  la."lesson_id",
  COALESCE(NULLIF(la."lesson_snapshot"->>'contentVersion', '')::INTEGER, la."content_version", 1),
  la."id",
  COALESCE(MIN(laa."checked_at"), la."started_at", CURRENT_TIMESTAMP)
FROM "learning_attempts" la
JOIN "learning_attempt_answers" laa
  ON laa."attempt_id" = la."id" AND laa."checked" = true
GROUP BY la."user_id", la."lesson_id", la."id", la."lesson_snapshot", la."content_version", la."started_at"
ORDER BY la."user_id", la."lesson_id", COALESCE(MIN(laa."checked_at"), la."started_at") ASC, la."id" ASC
ON CONFLICT ("user_id", "lesson_id") DO NOTHING;

UPDATE "learning_attempts" la
SET "eligible_for_level_eval" = false
FROM "learning_answer_exposures" e
WHERE e."user_id" = la."user_id"
  AND e."lesson_id" = la."lesson_id"
  AND la."id" <> e."first_attempt_id";
