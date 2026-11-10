CREATE TABLE "speaking_game_progress" (
 "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
 "prompt_id" UUID NOT NULL REFERENCES "speaking_prompts"("id") ON DELETE CASCADE,
 "content_version" INTEGER NOT NULL,
 "stars" INTEGER NOT NULL DEFAULT 0,
 "best_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
 "cleared" BOOLEAN NOT NULL DEFAULT false,
 "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("user_id", "prompt_id", "content_version")
);
