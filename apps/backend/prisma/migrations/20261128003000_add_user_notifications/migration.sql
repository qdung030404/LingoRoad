-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('DAILY_PLAN_READY', 'DAILY_GOAL_MET', 'SKILL_LEVEL_CHANGED', 'PLACEMENT_COMPLETED', 'VOCABULARY_REVIEW_DUE', 'SPEAKING_RESULT_READY');

-- CreateEnum
CREATE TYPE "NotificationTargetType" AS ENUM ('DAILY_PLAN', 'LESSON', 'VOCABULARY_REVIEW', 'PROFILE', 'SPEAKING', 'NONE');

-- CreateTable
CREATE TABLE "user_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "target_type" "NotificationTargetType" NOT NULL DEFAULT 'NONE',
    "target_payload" JSONB,
    "dedupe_key" VARCHAR(160) NOT NULL,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_notifications_user_id_created_at_id_idx" ON "user_notifications"("user_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "user_notifications_user_id_read_at_idx" ON "user_notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_notifications_user_id_dedupe_key_key" ON "user_notifications"("user_id", "dedupe_key");

-- AddForeignKey
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
