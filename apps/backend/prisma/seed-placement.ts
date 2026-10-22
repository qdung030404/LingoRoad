import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateDemoContent, DemoContentItem } from './demo-content/validate';

export const DEMO_BANK_VERSION = 'demo-v1';
const DIFFICULTY = { A1: -1.8, A2: -0.8, B1: 0.2, B2: 1.2 } as const;

/** Offline fixture: never serve this JSON because it includes answers and transcripts. */
export function loadDemoContent(): DemoContentItem[] {
  return JSON.parse(readFileSync(join(__dirname, 'demo-content/items.json'), 'utf8'));
}

export async function seedDemoContent(prisma: PrismaClient): Promise<number> {
  const items = loadDemoContent();
  validateDemoContent(items);
  const writes = items.map((item) => {
    // Explicit allowlist deliberately excludes the listening transcript from storage.
    const data: Prisma.AssessmentItemCreateInput = {
      externalId: item.externalId,
      bankVersion: DEMO_BANK_VERSION,
      skill: item.skill,
      skillCode: `${item.skill.toLowerCase()}.general`,
      cefrLevel: item.cefrLevel,
      type: 'MULTIPLE_CHOICE',
      prompt: item.prompt,
      options: item.options,
      correctOption: item.correctOption,
      explanation: item.explanation,
      passage: item.skill === 'READING' ? item.passage : null,
      audioUrl: item.skill === 'LISTENING' ? `/media/placement/${item.externalId}.wav` : null,
      irtA: 1,
      irtB: DIFFICULTY[item.cefrLevel],
      irtC: 0.25,
    };
    return prisma.assessmentItem.upsert({
      where: { externalId: item.externalId },
      create: data,
      update: data,
    });
  });
  await prisma.$transaction(writes);
  return items.length;
}

async function main(): Promise<void> {
  // Keep the CLI away from the existing application database by default.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Set DATABASE_URL to the isolated demo or test database.');
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  if (!/^lingoroad_(demo|test)$/.test(databaseName)) {
    throw new Error('Seed CLI only accepts databases named lingoroad_demo or lingoroad_test.');
  }
  const prisma = new PrismaClient();
  try {
    const count = await seedDemoContent(prisma);
    console.log(`Seeded ${count} placement items in ${DEMO_BANK_VERSION} (upsert by externalId).`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Placement seed failed.');
    process.exitCode = 1;
  });
}
