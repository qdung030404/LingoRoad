-- AlterTable
ALTER TABLE "speaking_prompts" ADD COLUMN "preparation" JSONB,
ADD COLUMN "linked_read_aloud_codes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID,
    "admin_email" VARCHAR(255) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(300) NOT NULL,
    "resource_type" VARCHAR(60) NOT NULL,
    "resource_id" VARCHAR(100),
    "status_code" INTEGER NOT NULL,
    "ip_address" VARCHAR(64),
    "payload_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_admin_user_id_created_at_idx" ON "audit_logs"("admin_user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_created_at_idx" ON "audit_logs"("resource_type", "created_at");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
