CREATE TABLE "voice_conversations" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "client_request_id" UUID NOT NULL,
  "active_user_id" UUID, "topic_id" UUID NOT NULL, "topic_snapshot" JSONB NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'CREATED', "end_reason" VARCHAR(50),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMP(3), "ended_at" TIMESTAMP(3),
  CONSTRAINT "voice_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "voice_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "voice_conversations_active_user_id_key" ON "voice_conversations"("active_user_id");
CREATE UNIQUE INDEX "voice_conversations_user_id_client_request_id_key" ON "voice_conversations"("user_id", "client_request_id");
CREATE INDEX "voice_conversations_user_id_created_at_id_idx" ON "voice_conversations"("user_id", "created_at", "id");
CREATE TABLE "voice_conversation_turns" (
  "id" UUID NOT NULL, "conversation_id" UUID NOT NULL, "provider_item_id" VARCHAR(200) NOT NULL,
  "sequence" INTEGER NOT NULL, "role" VARCHAR(20) NOT NULL, "transcript" TEXT NOT NULL,
  "interrupted" BOOLEAN NOT NULL DEFAULT false, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "voice_conversation_turns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "voice_conversation_turns_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "voice_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "voice_conversation_turns_conversation_id_provider_item_id_key" ON "voice_conversation_turns"("conversation_id", "provider_item_id");
CREATE INDEX "voice_conversation_turns_conversation_id_sequence_idx" ON "voice_conversation_turns"("conversation_id", "sequence");
