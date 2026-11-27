import 'dotenv/config';
import { CefrLevel, LearningKind, Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CEFR_ORDER, validateGrammarTopicPayload } from '../src/modules/grammar/grammar.types';
import { LearningContent, validateLearningContent } from '../src/modules/learning/learning.types';
import {
  GRAMMAR_GROUPS,
  GRAMMAR_PREREQUISITE_EDGES,
  GrammarPrerequisiteEdgeSeed,
  GrammarTopicSeed,
} from './grammar-content/groups-and-edges';
import { buildQuizQuestions, GRAMMAR_QUIZZES_A1_A2, RawQuizItem } from './grammar-content/quizzes-a1-a2';
import { GRAMMAR_QUIZZES_B1 } from './grammar-content/quizzes-b1';
import { GRAMMAR_QUIZZES_B2_C2 } from './grammar-content/quizzes-b2-c2';
import { GRAMMAR_TOPICS_A1_A2 } from './grammar-content/topics-a1-a2';
import { GRAMMAR_TOPICS_B1 } from './grammar-content/topics-b1';
import { GRAMMAR_TOPICS_B2_C2 } from './grammar-content/topics-b2-c2';

export interface GrammarUnitSeed {
  code: string;
  cefrLevel: CefrLevel;
  orderIndex: number;
  title: string;
  description: string;
}

export interface GrammarLessonSeed {
  code: string;
  topicCode: string;
  unitCode: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  sortOrder: number;
  content: LearningContent;
}

function deterministicUuid(namespace: string): string {
  const hex = createHash('sha256').update(`lingoroad.grammar.${namespace}`).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `a${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

const GRAMMAR_UNITS: readonly GrammarUnitSeed[] = [
  { code: 'grammar-unit-a1', cefrLevel: 'A1', orderIndex: 100, title: 'Ngữ pháp Nền tảng A1', description: 'Các cấu trúc ngữ pháp câu đơn cơ bản bậc A1.' },
  { code: 'grammar-unit-a2', cefrLevel: 'A2', orderIndex: 100, title: 'Ngữ pháp Sơ cấp A2', description: 'Các thì quá khứ, tương lai, so sánh và liên từ bậc A2.' },
  { code: 'grammar-unit-b1', cefrLevel: 'B1', orderIndex: 100, title: 'Ngữ pháp Trung cấp B1', description: 'Thì hoàn thành, câu điều kiện, bị động và mệnh đề quan hệ bậc B1.' },
  { code: 'grammar-unit-b2', cefrLevel: 'B2', orderIndex: 100, title: 'Ngữ pháp Trung cao cấp B2', description: 'Mệnh đề phân từ, thể sai khiến, câu ước và tường thuật nâng cao bậc B2.' },
  { code: 'grammar-unit-c1', cefrLevel: 'C1', orderIndex: 100, title: 'Ngữ pháp Học thuật C1', description: 'Đảo ngữ, câu chẻ, thức giả định và điều kiện hỗn hợp bậc C1.' },
  { code: 'grammar-unit-c2', cefrLevel: 'C2', orderIndex: 100, title: 'Ngữ pháp Tinh thông C2', description: 'Tỉnh lược nâng cao, đảo trật tự tu từ và sắc thái khuyết thiếu bậc C2.' },
];

const ALL_QUIZZES: Readonly<Record<string, readonly RawQuizItem[]>> = {
  ...GRAMMAR_QUIZZES_A1_A2,
  ...GRAMMAR_QUIZZES_B1,
  ...GRAMMAR_QUIZZES_B2_C2,
};

function buildGrammarLessonSeed(topic: GrammarTopicSeed): GrammarLessonSeed {
  const rawQuiz = ALL_QUIZZES[topic.code];
  if (!rawQuiz) {
    throw new Error(`Missing quiz questions for leaf grammar topic "${topic.code}".`);
  }

  return {
    code: `qz-${topic.code.replace(/\./g, '-')}`,
    topicCode: topic.code,
    unitCode: `grammar-unit-${topic.cefrLevel.toLowerCase()}`,
    title: `Luyện tập: ${topic.titleVi}`,
    description: topic.summaryVi,
    estimatedMinutes: 5,
    sortOrder: 1000 + topic.orderIndex,
    content: {
      steps: [],
      questions: buildQuizQuestions(topic.code, rawQuiz),
    },
  };
}

export function loadGrammarCatalogSeeds(): {
  units: GrammarUnitSeed[];
  topics: GrammarTopicSeed[];
  edges: GrammarPrerequisiteEdgeSeed[];
  lessons: GrammarLessonSeed[];
} {
  const topics: GrammarTopicSeed[] = [
    ...GRAMMAR_GROUPS,
    ...GRAMMAR_TOPICS_A1_A2,
    ...GRAMMAR_TOPICS_B1,
    ...GRAMMAR_TOPICS_B2_C2,
  ];
  const lessons = topics.filter((t) => t.isLeaf).map(buildGrammarLessonSeed);
  return {
    units: [...GRAMMAR_UNITS],
    topics,
    edges: [...GRAMMAR_PREREQUISITE_EDGES],
    lessons,
  };
}

function assertAcyclicDirectedGraph(edges: ReadonlyArray<readonly [string, string]>, label: string): void {
  const adj = new Map<string, string[]>();
  for (const [from, to] of edges) {
    if (from === to) {
      throw new Error(`Self-loop detected in ${label}: "${from}".`);
    }
    const list = adj.get(from) ?? [];
    list.push(to);
    adj.set(from, list);
  }
  const state = new Map<string, 0 | 1 | 2>();
  const dfs = (node: string): void => {
    state.set(node, 1);
    for (const next of adj.get(node) ?? []) {
      const nextState = state.get(next) ?? 0;
      if (nextState === 1) {
        throw new Error(`Cycle detected in ${label} involving "${node}" -> "${next}".`);
      }
      if (nextState === 0) {
        dfs(next);
      }
    }
    state.set(node, 2);
  };
  for (const node of adj.keys()) {
    if ((state.get(node) ?? 0) === 0) {
      dfs(node);
    }
  }
}

export function validateGrammarSeeds(data = loadGrammarCatalogSeeds()): void {
  const { units, topics, edges, lessons } = data;
  const unitCodes = new Set(units.map((u) => u.code));
  if (unitCodes.size !== CEFR_ORDER.length) {
    throw new Error('Every CEFR level A1..C2 must have a unique grammar unit.');
  }

  const byCode = new Map<string, GrammarTopicSeed>();
  for (const topic of topics) {
    if (!topic.code.trim() || !/^grammar(\.[a-z_]+)*$/.test(topic.code)) {
      throw new Error(`Invalid grammar code "${topic.code}".`);
    }
    if (byCode.has(topic.code)) {
      throw new Error(`Duplicate grammar code "${topic.code}".`);
    }
    if (!CEFR_ORDER.includes(topic.cefrLevel)) {
      throw new Error(`Invalid CEFR level on "${topic.code}".`);
    }
    if (!topic.titleEn.trim() || !topic.titleVi.trim()) {
      throw new Error(`Missing titles on "${topic.code}".`);
    }
    validateGrammarTopicPayload(
      { formulas: topic.formulas, usageNotes: topic.usageNotes, examples: topic.examples },
      topic.isLeaf,
      topic.code,
    );
    byCode.set(topic.code, topic);
  }

  for (const level of CEFR_ORDER) {
    if (!topics.some((t) => t.isLeaf && t.cefrLevel === level)) {
      throw new Error(`Missing leaf grammar topics for CEFR level ${level}.`);
    }
  }

  const parentEdges: Array<[string, string]> = [];
  for (const topic of topics) {
    if (topic.parentCode !== null) {
      const parent = byCode.get(topic.parentCode);
      if (!parent || parent.isLeaf) {
        throw new Error(`Topic "${topic.code}" references invalid or leaf parent "${topic.parentCode}".`);
      }
      parentEdges.push([topic.parentCode, topic.code]);
    } else if (topic.code !== 'grammar') {
      throw new Error(`Only root "grammar" may have null parentCode, got "${topic.code}".`);
    }
  }
  assertAcyclicDirectedGraph(parentEdges, 'grammar hierarchy');

  const seenPrereqPairs = new Set<string>();
  const dagEdges: Array<[string, string]> = [];
  for (const edge of edges) {
    const prereq = byCode.get(edge.prerequisiteCode);
    const target = byCode.get(edge.targetCode);
    if (!prereq || !prereq.isLeaf || !target || !target.isLeaf) {
      throw new Error(`Invalid prerequisite edge "${edge.prerequisiteCode}" -> "${edge.targetCode}".`);
    }
    const key = `${edge.prerequisiteCode}->${edge.targetCode}`;
    if (seenPrereqPairs.has(key)) {
      throw new Error(`Duplicate prerequisite edge "${key}".`);
    }
    seenPrereqPairs.add(key);
    dagEdges.push([edge.prerequisiteCode, edge.targetCode]);
  }
  assertAcyclicDirectedGraph(dagEdges, 'grammar prerequisite DAG');

  const leafCount = topics.filter((t) => t.isLeaf).length;
  if (lessons.length !== leafCount) {
    throw new Error(`Expected ${leafCount} grammar lessons, got ${lessons.length}.`);
  }
  const lessonCodes = new Set<string>();
  for (const lesson of lessons) {
    if (lessonCodes.has(lesson.code) || !unitCodes.has(lesson.unitCode)) {
      throw new Error(`Invalid or duplicate grammar lesson "${lesson.code}".`);
    }
    validateLearningContent(lesson.content, LearningKind.GRAMMAR);
    lessonCodes.add(lesson.code);
  }

  const skillsPath = [
    join(__dirname, '../../ml/data/skills.json'),
    join(__dirname, '../../../ml/data/skills.json'),
  ].find((candidate) => existsSync(candidate));
  if (skillsPath) {
    const rawSkills = JSON.parse(readFileSync(skillsPath, 'utf8')) as {
      skills?: Array<{ code?: string; category?: string }>;
    };
    const canonicalGrammarCodes = (rawSkills.skills ?? [])
      .filter((item) => item.category === 'grammar' && typeof item.code === 'string')
      .map((item) => item.code as string);
    for (const code of canonicalGrammarCodes) {
      if (!byCode.has(code)) {
        throw new Error(`Grammar seed is missing canonical skill code "${code}" from skills.json.`);
      }
    }
  }
}

export async function seedGrammarCatalog(
  prisma: PrismaClient,
): Promise<{ topicsCount: number; prerequisitesCount: number; lessonsCount: number }> {
  const data = loadGrammarCatalogSeeds();
  validateGrammarSeeds(data);

  const [existingTopics, existingUnits, existingLessons] = await Promise.all([
    prisma.grammarTopic.findMany({
      where: { code: { in: data.topics.map((t) => t.code) } },
      select: { id: true, code: true },
    }),
    prisma.learningUnit.findMany({
      where: { code: { in: data.units.map((u) => u.code) } },
      select: { id: true, code: true },
    }),
    prisma.learningLesson.findMany({
      where: { code: { in: data.lessons.map((l) => l.code) } },
      select: { id: true, code: true },
    }),
  ]);

  const existingTopicIdByCode = new Map<string, string>(existingTopics.map((r) => [r.code, r.id]));
  const existingUnitIdByCode = new Map<string, string>(existingUnits.map((r) => [r.code, r.id]));
  const existingLessonIdByCode = new Map<string, string>(existingLessons.map((r) => [r.code, r.id]));

  const topicIdByCode = new Map<string, string>();
  for (const topic of data.topics) {
    topicIdByCode.set(topic.code, existingTopicIdByCode.get(topic.code) ?? deterministicUuid(`topic.${topic.code}`));
  }

  const unitIdByCode = new Map<string, string>();
  for (const unit of data.units) {
    unitIdByCode.set(unit.code, existingUnitIdByCode.get(unit.code) ?? deterministicUuid(`unit.${unit.code}`));
  }

  const operations: Prisma.PrismaPromise<unknown>[] = [];

  // 1. Units (batch create new + update existing)
  const newUnits: Prisma.LearningUnitCreateManyInput[] = [];
  for (const unit of data.units) {
    const id = unitIdByCode.get(unit.code)!;
    if (existingUnitIdByCode.has(unit.code)) {
      operations.push(prisma.learningUnit.update({ where: { id }, data: unit }));
    } else {
      newUnits.push({ id, ...unit });
    }
  }
  if (newUnits.length > 0) {
    operations.push(prisma.learningUnit.createMany({ data: newUnits }));
  }

  // 2. Grammar topics by depth (batch create new + update existing)
  const topicByCode = new Map<string, GrammarTopicSeed>(data.topics.map((t) => [t.code, t]));
  const depthOf = (code: string): number => {
    const node = topicByCode.get(code);
    return !node || node.parentCode === null ? 0 : 1 + depthOf(node.parentCode);
  };

  const newTopicsByDepth = new Map<number, Prisma.GrammarTopicCreateManyInput[]>();
  const topicUpdates: Prisma.PrismaPromise<unknown>[] = [];
  const sortedTopics = [...data.topics].sort((a, b) => depthOf(a.code) - depthOf(b.code));

  for (const topic of sortedTopics) {
    const id = topicIdByCode.get(topic.code)!;
    const parentId = topic.parentCode ? (topicIdByCode.get(topic.parentCode) ?? null) : null;
    const record = {
      code: topic.code,
      parentId,
      cefrLevel: topic.cefrLevel,
      isLeaf: topic.isLeaf,
      titleEn: topic.titleEn,
      titleVi: topic.titleVi,
      summaryVi: topic.summaryVi,
      formulas: topic.formulas as unknown as Prisma.InputJsonValue,
      usageNotes: topic.usageNotes as unknown as Prisma.InputJsonValue,
      examples: topic.examples as unknown as Prisma.InputJsonValue,
      orderIndex: topic.orderIndex,
      published: true,
      contentVersion: 1,
    };

    if (existingTopicIdByCode.has(topic.code)) {
      topicUpdates.push(prisma.grammarTopic.update({ where: { id }, data: record }));
    } else {
      const depth = depthOf(topic.code);
      const bucket = newTopicsByDepth.get(depth) ?? [];
      bucket.push({ id, ...record });
      newTopicsByDepth.set(depth, bucket);
    }
  }

  for (const depth of [...newTopicsByDepth.keys()].sort((a, b) => a - b)) {
    const batch = newTopicsByDepth.get(depth)!;
    if (batch.length > 0) {
      operations.push(prisma.grammarTopic.createMany({ data: batch }));
    }
  }
  operations.push(...topicUpdates);

  // 3. Prerequisite edges
  if (data.edges.length > 0) {
    operations.push(
      prisma.grammarPrerequisite.createMany({
        data: data.edges.map((edge) => ({
          prerequisiteId: topicIdByCode.get(edge.prerequisiteCode)!,
          targetId: topicIdByCode.get(edge.targetCode)!,
        })),
        skipDuplicates: true,
      }),
    );
  }

  // 4. Grammar quiz lessons (57 lessons linked via grammarTopicId & unitId)
  const newLessons: Prisma.LearningLessonCreateManyInput[] = [];
  for (const lesson of data.lessons) {
    const record = {
      code: lesson.code,
      kind: LearningKind.GRAMMAR,
      title: lesson.title,
      description: lesson.description,
      estimatedMinutes: lesson.estimatedMinutes,
      sortOrder: lesson.sortOrder,
      published: true,
      contentVersion: 1,
      unitId: unitIdByCode.get(lesson.unitCode)!,
      grammarTopicId: topicIdByCode.get(lesson.topicCode)!,
      content: lesson.content as unknown as Prisma.InputJsonValue,
    };
    const existingLessonId = existingLessonIdByCode.get(lesson.code);
    if (existingLessonId) {
      operations.push(prisma.learningLesson.update({ where: { id: existingLessonId }, data: record }));
    } else {
      newLessons.push({ id: deterministicUuid(`lesson.${lesson.code}`), ...record });
    }
  }
  if (newLessons.length > 0) {
    operations.push(prisma.learningLesson.createMany({ data: newLessons }));
  }

  await prisma.$transaction(operations);

  return {
    topicsCount: data.topics.length,
    prerequisitesCount: data.edges.length,
    lessonsCount: data.lessons.length,
  };
}

async function main(): Promise<void> {
  if (process.argv.includes('--validate')) {
    const data = loadGrammarCatalogSeeds();
    validateGrammarSeeds(data);
    console.log(
      `Validated ${data.topics.length} grammar topics, ${data.edges.length} prerequisite edges, and ${data.lessons.length} quiz lessons.`,
    );
    return;
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || !/^(lingoroad(_(demo|test|[a-z0-9_]+_test))?|postgres)$/.test(new URL(databaseUrl).pathname.slice(1))) {
    throw new Error('Seed CLI only accepts isolated lingoroad, lingoroad_demo, lingoroad_*test, or postgres databases.');
  }
  const prisma = new PrismaClient();
  try {
    const res = await seedGrammarCatalog(prisma);
    console.log(
      `Seeded ${res.topicsCount} grammar topics, ${res.prerequisitesCount} prerequisite edges, and ${res.lessonsCount} grammar quiz lessons.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Grammar seed failed.');
    process.exitCode = 1;
  });
}
