import 'dotenv/config';
import { CefrLevel, LearningKind, Prisma, PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LearningContent, LearningQuestion, LISTENING_SKILL_CODES, READING_SKILL_CODES, validateLearningContent } from '../src/modules/learning/learning.types';
import { validateListeningAudio } from '../src/modules/learning/listening-media';
import { loadListeningLesson } from './listening-content/load-listening';
import { loadAdvancedLearningContent } from './seed-learning-advanced.data';
import { loadCoreLearningContent } from './seed-learning-core.data';
import { LearningSeed } from './seed-learning-helpers';
import { loadLearningUnits } from './seed-learning-units';

export type { LearningSeed, LearningUnitSeed } from './seed-learning-helpers';
export { loadLearningUnits };

export function loadLearningContent(): LearningSeed[] {
  return [...loadCoreLearningContent(), ...loadAdvancedLearningContent()];
}

export function validateLearningSeeds(seeds = loadLearningContent()): void {
  const skillsPath = [
    join(__dirname, '../../ml/data/skills.json'),
    join(__dirname, '../../../ml/data/skills.json'),
  ].find((candidate) => existsSync(candidate));
  if (!skillsPath) throw new Error('Missing canonical skills.json catalog.');
  const rawSkills = JSON.parse(readFileSync(skillsPath, 'utf8')) as {
    skills?: Array<{ code?: string; category?: string }>;
  };
  const canonicalReadingCodes = new Set(
    (rawSkills.skills ?? [])
      .filter((item) => item.category === 'reading' && typeof item.code === 'string' && item.code.startsWith('reading.'))
      .map((item) => item.code as string),
  );
  if (
    canonicalReadingCodes.size !== READING_SKILL_CODES.length ||
    READING_SKILL_CODES.some((code) => !canonicalReadingCodes.has(code))
  ) {
    throw new Error('READING_SKILL_CODES is out of sync with apps/ml/data/skills.json.');
  }
  const canonicalListeningCodes = new Set((rawSkills.skills ?? [])
    .filter((item) => item.category === 'listening' && typeof item.code === 'string' && item.code.startsWith('listening.'))
    .map((item) => item.code as string));
  if (canonicalListeningCodes.size !== LISTENING_SKILL_CODES.length
    || LISTENING_SKILL_CODES.some((code) => !canonicalListeningCodes.has(code))) {
    throw new Error('LISTENING_SKILL_CODES is out of sync with apps/ml/data/skills.json.');
  }
  const units = loadLearningUnits();
  const unitCodes = new Set(units.map((unit) => unit.code));
  if (unitCodes.size !== units.length) throw new Error('Unit codes must be unique.');
  if (new Set(seeds.map((seed) => seed.code)).size !== seeds.length) throw new Error('Lesson codes must be unique.');
  for (const seed of seeds) {
    validateLearningContent(seed.content, seed.kind);
    validateListeningAudio(seed.content, join(__dirname, '../media/learning'));
    if (!seed.code.trim() || !seed.title.trim() || !seed.description.trim() || seed.contentVersion < 1 || seed.estimatedMinutes < 1 || !seed.unitCode?.trim() || !unitCodes.has(seed.unitCode)) throw new Error('Invalid lesson metadata.');
    if (seed.kind === 'LISTENING' && (!seed.content.audioUrl || !seed.content.transcript)) throw new Error('Listening audio and transcript are required.');
    if (seed.kind === 'READING') {
      if (!seed.unitCode?.trim() || !unitCodes.has(seed.unitCode)) throw new Error('Every reading lesson must declare a valid unitCode.');
      if (!seed.content.passage?.trim()) throw new Error('Reading passage is required.');
      if (seed.content.questions.some((q) => !q.skillCode || !canonicalReadingCodes.has(q.skillCode))) {
        throw new Error('Every reading question must declare a valid reading skillCode from skills.json.');
      }
      validateReadingPrepNoAnswerLeak(seed);
    }
    const urls = [seed.content.audioUrl, ...seed.content.steps.map((step) => step.audioUrl)].filter((url): url is string => !!url);
    for (const url of urls) {
      if (!/^\/media\/learning\/v1\/[a-z0-9]+(?:-[a-z0-9]+)*\.wav$/.test(url)) throw new Error('Invalid curriculum audio path.');
      const file = join(__dirname, '..', url.replace(/^\/media\//, 'media/'));
      if (!existsSync(file) || readFileSync(file).toString('ascii', 0, 4) !== 'RIFF') throw new Error(`Missing or invalid learning audio: ${url}`);
    }
  }
}

export function validateReadingPrepNoAnswerLeak(seed: LearningSeed): void {
  const stepFields = seed.content.steps.flatMap((s) => [s.word, s.body, s.example]).filter((v): v is string => !!v?.trim());
  const vocabFields = (seed.content.keyVocabulary ?? []).flatMap((v) => [v.word, v.meaning, v.example, v.translation]).filter((v): v is string => !!v?.trim());
  const allPrepTexts = [...stepFields, ...vocabFields];
  const prepWords = [
    ...seed.content.steps.map((s) => s.word?.trim().toLowerCase()).filter((w): w is string => !!w),
    ...(seed.content.keyVocabulary ?? []).map((v) => v.word.trim().toLowerCase()),
  ];

  for (const q of seed.content.questions) {
    if (q.skillCode === 'reading.context_clues') {
      const quoted = [...q.prompt.matchAll(/[“"']([A-Za-z][A-Za-z\s-]{1,40})[”"']/g)]
        .map((m) => m[1].trim().toLowerCase());
      for (const target of quoted) {
        const tokens = target.split(/\s+/).filter((t) => t.length >= 3);
        if (prepWords.some((w) => w === target || tokens.includes(w)) || allPrepTexts.some((f) => new RegExp(`\\b${escapeRegExp(target)}\\b`, 'i').test(f))) {
          throw new Error(`Reading preparation reveals context-clues target "${target}" in ${seed.code} (${q.id}).`);
        }
      }
    }
    const qType = q.type ?? 'MULTIPLE_CHOICE';
    if (qType === 'TRUE_FALSE_NOT_GIVEN') continue;
    const answerText = q.options.find((o) => o.id === q.correctOptionId)?.text.trim();
    if (!answerText || answerText.length < 4) continue;
    const pattern = answerMatchPattern(answerText);
    if (allPrepTexts.some((text) => pattern.test(text))) {
      throw new Error(`Reading preparation example reveals ${qType} answer "${answerText}" in ${seed.code} (${q.id}).`);
    }
  }
}

function answerMatchPattern(phrase: string): RegExp {
  const escaped = escapeRegExp(phrase);
  const startBoundary = /^[A-Za-z0-9]/.test(phrase) ? '\\b' : '';
  const endBoundary = /[A-Za-z0-9]$/.test(phrase) ? '\\b' : '';
  return new RegExp(`${startBoundary}${escaped}${endBoundary}`, 'i');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function seedLearningContent(prisma: PrismaClient): Promise<number> {
  const units = loadLearningUnits();
  const seeds = loadLearningContent();
  validateLearningSeeds(seeds);
  await prisma.$transaction(async (tx) => {
    const unitIds = new Map<string, string>();
    for (const unit of units) {
      const saved = await tx.learningUnit.upsert({ where: { code: unit.code }, create: unit, update: unit });
      unitIds.set(unit.code, saved.id);
    }
    for (const seed of seeds) {
      const { unitCode, ...rest } = seed;
      const data = {
        ...rest,
        unitId: unitIds.get(unitCode) ?? null,
        published: true,
        content: seed.content as unknown as Prisma.InputJsonValue,
      };
      await tx.learningLesson.upsert({ where: { code: seed.code }, create: data, update: data });
    }
  }, { maxWait: 15_000, timeout: 60_000 });
  return seeds.length;
}

async function main(): Promise<void> {
  if (process.argv.includes('--validate')) {
    const seeds = loadLearningContent();
    validateLearningSeeds(seeds);
    const questions = seeds.reduce((count, seed) => count + seed.content.questions.length, 0);
    console.log(`Validated ${seeds.length} lessons and ${questions} questions, including curriculum audio references.`);
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !/^lingoroad_(demo|test|[a-z0-9_]+_test)$/.test(new URL(databaseUrl).pathname.slice(1))) {
    throw new Error('Seed CLI requires an isolated lingoroad_demo or lingoroad_*test database.');
  }
  const prisma = new PrismaClient();
  try { console.log(`Seeded ${await seedLearningContent(prisma)} learning lessons (upsert by stable code).`); }
  finally { await prisma.$disconnect(); }
}

if (require.main === module) main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Learning seed failed.'); process.exitCode = 1; });
