import { PrismaClient, CefrLevel, ItemType } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface RawItem {
  skillCode: string;
  cefrLevel: string;
  type?: string;
  stem: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
  audioUrl?: string;
  a?: number;
  b?: number;
  c?: number;
}

function mapItemType(typeStr?: string): ItemType {
  switch (typeStr?.toLowerCase()) {
    case 'cloze':
      return ItemType.CLOZE;
    case 'sentence_reorder':
      return ItemType.SENTENCE_REORDER;
    case 'matching':
      return ItemType.MATCHING;
    case 'mcq':
    default:
      return ItemType.MULTIPLE_CHOICE;
  }
}

function mapCefrLevel(levelStr: string): CefrLevel {
  const normalized = levelStr.toUpperCase();
  if (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(normalized)) {
    return normalized as CefrLevel;
  }
  return CefrLevel.A2;
}

async function main() {
  const itemsPath = path.resolve(__dirname, '../../ml/data/items.json');
  console.log(`Loading items from: ${itemsPath}`);

  if (!fs.existsSync(itemsPath)) {
    throw new Error(`File not found: ${itemsPath}`);
  }

  const rawData: RawItem[] = JSON.parse(fs.readFileSync(itemsPath, 'utf-8'));
  console.log(`Found ${rawData.length} items in JSON.`);

  const existingCount = await prisma.assessmentItem.count();
  console.log(`Current items in DB: ${existingCount}`);

  if (existingCount > 0) {
    console.log('Database already has assessment items. Upserting / ensuring all items exist...');
  }

  let createdCount = 0;
  for (const item of rawData) {
    await prisma.assessmentItem.create({
      data: {
        skillCode: item.skillCode,
        cefrLevel: mapCefrLevel(item.cefrLevel),
        type: mapItemType(item.type),
        prompt: item.stem,
        options: item.options,
        correctOption: item.correctAnswer,
        explanation: item.explanation || null,
        audioUrl: item.audioUrl || null,
        irtA: item.a ?? 1.0,
        irtB: item.b ?? 0.0,
        irtC: item.c ?? 0.25,
      },
    });
    createdCount++;
  }

  const finalCount = await prisma.assessmentItem.count();
  console.log(`Seeding completed: ${createdCount} items inserted. Total items in DB: ${finalCount}`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
