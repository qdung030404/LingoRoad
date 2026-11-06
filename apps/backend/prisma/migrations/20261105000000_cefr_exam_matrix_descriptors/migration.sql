-- AlterEnum
ALTER TYPE "AssessmentSkill" ADD VALUE IF NOT EXISTS 'WRITING';
ALTER TYPE "AssessmentSkill" ADD VALUE IF NOT EXISTS 'SPEAKING';

-- AlterEnum
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'GAP_FILL';
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'ESSAY';
ALTER TYPE "ItemType" ADD VALUE IF NOT EXISTS 'SPEAKING_PROMPT';

-- CreateEnum
CREATE TYPE "ItemUsageScope" AS ENUM ('PLACEMENT', 'MOCK_EXAM', 'PRACTICE', 'ALL');

-- CreateTable
CREATE TABLE "assessment_item_groups" (
    "id" UUID NOT NULL,
    "skill" "AssessmentSkill" NOT NULL,
    "title" VARCHAR(200),
    "cefr_level" "CefrLevel" NOT NULL,
    "part_number" INTEGER NOT NULL,
    "passage" TEXT,
    "audio_url" VARCHAR(500),
    "transcript" TEXT,
    "usage_scope" "ItemUsageScope" NOT NULL DEFAULT 'ALL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessment_item_groups_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "assessment_items" ALTER COLUMN "options" DROP NOT NULL;
ALTER TABLE "assessment_items" ALTER COLUMN "correct_option" DROP NOT NULL;
ALTER TABLE "assessment_items" ADD COLUMN "group_id" UUID;
ALTER TABLE "assessment_items" ADD COLUMN "item_order" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "assessment_items" ADD COLUMN "rubric_criteria" JSONB;
ALTER TABLE "assessment_items" ADD COLUMN "usage_scope" "ItemUsageScope" NOT NULL DEFAULT 'ALL';

-- CreateIndex
CREATE INDEX "assessment_item_groups_skill_cefr_level_idx" ON "assessment_item_groups"("skill", "cefr_level");
CREATE INDEX "assessment_item_groups_usage_scope_skill_cefr_level_idx" ON "assessment_item_groups"("usage_scope", "skill", "cefr_level");
CREATE INDEX "assessment_items_group_id_idx" ON "assessment_items"("group_id");
CREATE INDEX "assessment_items_usage_scope_skill_cefr_level_idx" ON "assessment_items"("usage_scope", "skill", "cefr_level");
CREATE INDEX "assessment_items_skill_cefr_level_idx" ON "assessment_items"("skill", "cefr_level");

-- AddForeignKey
ALTER TABLE "assessment_items" ADD CONSTRAINT "assessment_items_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "assessment_item_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

