import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { CefrLevel, Prisma, PrismaClient } from '@prisma/client';
import { validateListeningAudio } from '../src/modules/learning/listening-media';
import { LearningContent, validateLearningContent } from '../src/modules/learning/learning.types';

const pilotDatabase = '/lingoroad_listening_pilot_test';
const contentDir = join(__dirname, 'listening-content', 'voa-pilot');
const extendedDir = join(__dirname, 'listening-content', 'a1-c2-pilot');
const voaLevels = [CefrLevel.A1, CefrLevel.A2, CefrLevel.B1] as const;

type PilotEntry = {
  code: string;
  title: string;
  description: string;
  level: CefrLevel;
};

export function assertListeningPilotDatabase(value = process.env.DATABASE_URL): void {
  const url = value ? new URL(value) : null;
  if (!url || !/^\/lingoroad_(demo|test|[a-z0-9_]+_test)$/.test(url.pathname)) {
    throw new Error(`Listening pilot requires a database named ${pilotDatabase.slice(1)} or lingoroad_demo.`);
  }
}

export function loadListeningPilot() {
  const extended = process.argv.includes('--a1-c2');
  const directory = extended ? extendedDir : (process.argv.includes('--wave-2') ? join(contentDir, 'wave-2') : contentDir);
  const levels: readonly CefrLevel[] = extended ? Object.values(CefrLevel) : voaLevels;
  const codePattern = extended
    ? /^listening-pilot-a1-c2-[a-z0-9]+(?:-[a-z0-9]+)*$/
    : /^listening-pilot-voa-[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const entries = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8')) as PilotEntry[];
  const codes = new Set<string>();
  return entries.map((entry) => {
    if (!codePattern.test(entry.code) ||
      !entry.title.trim() || !entry.description.trim() || !levels.includes(entry.level) || codes.has(entry.code)) {
      throw new Error(`Invalid Listening pilot metadata: ${entry.code}`);
    }
    codes.add(entry.code);
    const content = JSON.parse(readFileSync(join(directory, `${entry.code}-v1.json`), 'utf8')) as LearningContent;
    validateLearningContent(content, 'LISTENING');
    if (content.audioUrl !== `/media/learning/v1/${entry.code}-v1.wav`) {
      throw new Error(`Mismatched pilot audio for ${entry.code}`);
    }
    validateListeningAudio(content, join(__dirname, '../media/learning'));
    return { ...entry, content };
  });
}

export async function seedListeningPilot() {
  assertListeningPilotDatabase();
  const entries = loadListeningPilot();
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (tx) => {
      const unitIds = new Map<CefrLevel, string>();
      for (const level of new Set(entries.map((entry) => entry.level))) {
        const code = `listening-pilot-${level.toLowerCase()}`;
        const existingUnit = await tx.learningUnit.findFirst({
          where: { OR: [{ code }, { cefrLevel: level, orderIndex: 900 }] },
        });
        const unit = existingUnit ?? await tx.learningUnit.create({
          data: {
            code, cefrLevel: level, orderIndex: 900, title: `Listening pilot ${level}`,
            description: 'Học liệu thử nghiệm với cấp độ mục tiêu chưa hiệu chuẩn.',
          },
        });
        unitIds.set(level, unit.id);
      }
      for (const [index, entry] of entries.entries()) {
        const content = entry.content as unknown as Prisma.InputJsonValue;
        const saved = await tx.learningLesson.upsert({
          where: { code: entry.code }, update: { title: entry.title, description: entry.description, content }, create: {
            code: entry.code, kind: 'LISTENING', title: entry.title, description: entry.description,
            estimatedMinutes: 5, sortOrder: 900 + index, published: true, contentVersion: 1,
            unitId: unitIds.get(entry.level), content,
          },
        });
        if (saved.contentVersion !== 1 || !isDeepStrictEqual(saved.content, content)) {
          throw new Error(`Existing pilot revision differs for ${entry.code}. Preserve the previous attempt content.`);
        }
      }
    });
  } finally {
    await prisma.$disconnect();
  }
  return entries.length;
}

if (require.main === module) {
  const validateOnly = process.argv.includes('--validate');
  Promise.resolve().then(async () => {
    const count = validateOnly ? loadListeningPilot().length : await seedListeningPilot();
    console.log(`${validateOnly ? 'Validated' : 'Seeded'} ${count} Listening pilot lessons.`);
  }).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Listening pilot failed.');
    process.exitCode = 1;
  });
}
