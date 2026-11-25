CREATE TABLE "grammar_topics" (
  "id" UUID NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "parent_id" UUID,
  "cefr_level" "CefrLevel" NOT NULL,
  "is_leaf" BOOLEAN NOT NULL DEFAULT true,
  "title_en" VARCHAR(150) NOT NULL,
  "title_vi" VARCHAR(150) NOT NULL,
  "summary_vi" TEXT NOT NULL DEFAULT '',
  "formulas" JSONB NOT NULL DEFAULT '[]',
  "usage_notes" JSONB NOT NULL DEFAULT '[]',
  "examples" JSONB NOT NULL DEFAULT '[]',
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "published" BOOLEAN NOT NULL DEFAULT true,
  "content_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "grammar_topics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "grammar_topics_code_key" ON "grammar_topics"("code");
CREATE INDEX "grammar_topics_cefr_level_published_order_index_idx" ON "grammar_topics"("cefr_level", "published", "order_index");
CREATE INDEX "grammar_topics_parent_id_order_index_idx" ON "grammar_topics"("parent_id", "order_index");
CREATE INDEX "grammar_topics_published_is_leaf_order_index_idx" ON "grammar_topics"("published", "is_leaf", "order_index");

ALTER TABLE "grammar_topics"
  ADD CONSTRAINT "grammar_topics_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "grammar_topics"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "grammar_prerequisites" (
  "prerequisite_id" UUID NOT NULL,
  "target_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "grammar_prerequisites_pkey" PRIMARY KEY ("prerequisite_id", "target_id")
);

CREATE INDEX "grammar_prerequisites_target_id_idx" ON "grammar_prerequisites"("target_id");

ALTER TABLE "grammar_prerequisites"
  ADD CONSTRAINT "grammar_prerequisites_prerequisite_id_fkey"
  FOREIGN KEY ("prerequisite_id") REFERENCES "grammar_topics"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "grammar_prerequisites"
  ADD CONSTRAINT "grammar_prerequisites_target_id_fkey"
  FOREIGN KEY ("target_id") REFERENCES "grammar_topics"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "learning_lessons" ADD COLUMN "grammar_topic_id" UUID;
CREATE INDEX "learning_lessons_grammar_topic_id_idx" ON "learning_lessons"("grammar_topic_id");

ALTER TABLE "learning_lessons"
  ADD CONSTRAINT "learning_lessons_grammar_topic_id_fkey"
  FOREIGN KEY ("grammar_topic_id") REFERENCES "grammar_topics"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
