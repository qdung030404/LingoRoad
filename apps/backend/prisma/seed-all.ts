import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedCefrBank } from './seed-cefr-bank';
import { seedGrammarCatalog, validateGrammarSeeds } from './seed-grammar';
import { seedLearningContent, validateLearningSeeds } from './seed-learning';
import { loadDemoContent, seedDemoContent } from './seed-placement';
import { validateDemoContent } from './demo-content/validate';
import { seedSpeakingContent } from './seed-speaking';
import { seedTopicToDatabase, TopicVocabularyResult } from './seed-topic-vocabulary';

export interface SeedSummary {
  placementItems: number;
  grammarTopics: number;
  grammarPrerequisites: number;
  grammarLessons: number;
  learningLessons: number;
  vocabularyTopics: number;
  cefrGroups: number;
  cefrItems: number;
}

/** Validates all offline seed payloads without mutating the database. */
export function validateAllSeeds(): void {
  validateDemoContent(loadDemoContent());
  validateGrammarSeeds();
  validateLearningSeeds();
}

/** Seeds grammar, vocabulary, placement, listening, reading, speaking, and writing via idempotent upserts. */
export async function seedAllDatabase(prisma: PrismaClient): Promise<SeedSummary> {
  const placementItems = await seedDemoContent(prisma);
  const grammar = await seedGrammarCatalog(prisma);
  const learningLessons = await seedLearningContent(prisma);

  let vocabularyTopics = 0;
  const vocabPath = join(__dirname, 'demo-content', 'topic-vocabulary.json');
  if (existsSync(vocabPath)) {
    const parsed: unknown = JSON.parse(readFileSync(vocabPath, 'utf8'));
    if (!Array.isArray(parsed)) {
      throw new Error('topic-vocabulary.json must contain a JSON array.');
    }
    const topics = parsed as TopicVocabularyResult[];
    for (const topic of topics) {
      await prisma.$transaction(
        (tx) => seedTopicToDatabase(tx, topic),
        { maxWait: 15_000, timeout: 60_000 },
      );
    }
    vocabularyTopics = topics.length;
  }

  await seedSpeakingContent(prisma);
  const cefrBank = await seedCefrBank(prisma);

  return {
    placementItems,
    grammarTopics: grammar.topicsCount,
    grammarPrerequisites: grammar.prerequisitesCount,
    grammarLessons: grammar.lessonsCount,
    learningLessons,
    vocabularyTopics,
    cefrGroups: cefrBank.groupsCount,
    cefrItems: cefrBank.itemsCount,
  };
}

/** Queries live database counts across all 6 curriculum areas for verification. */
async function printDatabaseSummary(prisma: PrismaClient): Promise<void> {
  const [
    grammarLeaves,
    lessonsByKind,
    vocabTopics,
    vocabWords,
    speakingByMode,
    assessmentBySkillScope,
    assessmentGroups,
  ] = await Promise.all([
    prisma.grammarTopic.count({ where: { isLeaf: true, published: true } }),
    prisma.learningLesson.groupBy({
      by: ['kind'],
      where: { published: true },
      _count: { _all: true },
    }),
    prisma.curatedTopic.count(),
    prisma.curatedTopicWord.count(),
    prisma.speakingPrompt.groupBy({
      by: ['mode'],
      where: { published: true },
      _count: { _all: true },
    }),
    prisma.assessmentItem.groupBy({
      by: ['skill', 'usageScope'],
      _count: { _all: true },
    }),
    prisma.assessmentItemGroup.groupBy({
      by: ['skill'],
      _count: { _all: true },
    }),
  ]);

  console.log('\n=== TỔNG HỢP DATABASE HIỆN TẠI ===');
  console.log(`- Ngữ pháp (GrammarTopic lá): ${grammarLeaves}`);
  console.log(
    `- Bài học (LearningLesson): ${lessonsByKind.map((r) => `${r.kind}=${r._count._all}`).join(', ') || '0'}`,
  );
  console.log(`- Từ vựng theo chủ đề: ${vocabTopics} chủ đề, ${vocabWords} từ`);
  console.log(
    `- Nói (SpeakingPrompt): ${speakingByMode.map((r) => `${r.mode}=${r._count._all}`).join(', ') || '0'}`,
  );
  console.log(
    `- Nhóm đề CEFR (AssessmentItemGroup): ${assessmentGroups.map((r) => `${r.skill}=${r._count._all}`).join(', ') || '0'}`,
  );
  console.log(
    `- Câu hỏi/Đề (AssessmentItem): ${assessmentBySkillScope.map((r) => `${r.skill}[${r.usageScope}]=${r._count._all}`).join(', ') || '0'}`,
  );
}

/** Uses Transaction Mode (port 6543 + pgbouncer=true) on Supabase pooler so Session Mode's 15-client cap is avoided. */
function buildSeedDatasourceUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (parsed.hostname.endsWith('.pooler.supabase.com')) {
    if (parsed.port === '5432' || parsed.port === '') {
      parsed.port = '6543';
      parsed.searchParams.set('pgbouncer', 'true');
    } else if (parsed.port === '6543' && !parsed.searchParams.has('pgbouncer')) {
      parsed.searchParams.set('pgbouncer', 'true');
    }
  }
  parsed.searchParams.set('connection_limit', '1');
  parsed.searchParams.set('pool_timeout', '30');
  return parsed.toString();
}

async function main(): Promise<void> {
  if (process.argv.includes('--validate')) {
    validateAllSeeds();
    console.log('Validated all placement, grammar, and learning seed payloads.');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Set DATABASE_URL to the target database.');
  }
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  if (!/^(lingoroad(_(demo|test|[a-z0-9_]+_test))?|postgres)$/.test(databaseName)) {
    throw new Error(
      'Seed CLI only accepts databases named lingoroad, lingoroad_demo, lingoroad_test, lingoroad_*_test or postgres.',
    );
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: buildSeedDatasourceUrl(databaseUrl) } },
    transactionOptions: { maxWait: 15_000, timeout: 60_000 },
  });
  try {
    const summary = await seedAllDatabase(prisma);
    console.log('Seeded all curriculum & practice data:', summary);
    await printDatabaseSummary(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Seed all failed.');
    process.exitCode = 1;
  });
}
