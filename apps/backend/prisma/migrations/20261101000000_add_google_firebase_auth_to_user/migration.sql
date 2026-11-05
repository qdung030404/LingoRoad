-- AlterTable: Make password_hash nullable, add avatar_url, provider, and firebase_uid
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE', 'APPLE');

ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN "avatar_url" VARCHAR(500),
ADD COLUMN "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN "firebase_uid" VARCHAR(128);

-- CreateIndex
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");
