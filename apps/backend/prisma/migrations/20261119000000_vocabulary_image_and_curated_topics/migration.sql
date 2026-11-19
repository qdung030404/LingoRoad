-- AlterTable
ALTER TABLE "vocabulary_words" ADD COLUMN "image_url" VARCHAR(500);

-- CreateTable
CREATE TABLE "vocabulary_topics" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "name_vi" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "icon_url" VARCHAR(50),
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vocabulary_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_words" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "english" VARCHAR(100) NOT NULL,
    "phonetic" VARCHAR(100) NOT NULL DEFAULT '',
    "part_of_speech" VARCHAR(50) NOT NULL DEFAULT '',
    "meaning" VARCHAR(500) NOT NULL,
    "example" VARCHAR(1000) NOT NULL DEFAULT '',
    "translation" VARCHAR(1000) NOT NULL DEFAULT '',
    "audio_url" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_words_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vocabulary_topics_slug_key" ON "vocabulary_topics"("slug");

-- AddForeignKey
ALTER TABLE "topic_words" ADD CONSTRAINT "topic_words_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "vocabulary_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
