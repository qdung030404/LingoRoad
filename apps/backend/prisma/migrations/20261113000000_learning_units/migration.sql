CREATE TABLE "learning_units" (
  "id" UUID NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "cefr_level" "CefrLevel" NOT NULL DEFAULT 'A1',
  "order_index" INTEGER NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "learning_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "learning_units_code_key" ON "learning_units"("code");
CREATE UNIQUE INDEX "learning_units_cefr_level_order_index_key" ON "learning_units"("cefr_level", "order_index");

ALTER TABLE "learning_lessons" ADD COLUMN "unit_id" UUID;
CREATE INDEX "learning_lessons_unit_id_sort_order_idx" ON "learning_lessons"("unit_id", "sort_order");

ALTER TABLE "learning_lessons"
  ADD CONSTRAINT "learning_lessons_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "learning_units"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

