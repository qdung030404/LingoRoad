import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MediaStorageService } from '../../../media/media-storage.service';
import {
  assertReferencedItemUnchanged,
  lockAssessmentItem,
  resolveAdminPlacementBankVersion,
} from '../assessment-item-integrity';
import {
  NormalizedAssessmentGroupInput,
  NormalizedAssessmentItemInput,
  NormalizedGrammarTopicInput,
  NormalizedLessonInput,
  NormalizedSpeakingPromptInput,
  NormalizedTopicInput,
  NormalizedTopicWordInput,
  NormalizedUnitInput,
  ParsedImportBundle,
} from './admin-import.types';

export async function applyImportBundleInTransaction(
  tx: Prisma.TransactionClient,
  parsed: ParsedImportBundle,
  topicWordsMode: 'replace' | 'merge',
  mediaStorage?: MediaStorageService,
): Promise<void> {
  const unitIdByCode = await applyUnitsTx(tx, parsed.units);
  const grammarIdByCode = await applyGrammarTopicsTx(tx, parsed.grammarTopics);
  await applyAssessmentGroupsTx(tx, parsed.assessmentGroups);
  await applyLessonsTx(tx, parsed.lessons, unitIdByCode, grammarIdByCode);
  await applyAssessmentItemsTx(tx, parsed.items, mediaStorage);
  await applyTopicsTx(tx, parsed.topics, topicWordsMode);
  await applySpeakingPromptsTx(tx, parsed.speakingPrompts);
}

async function applyUnitsTx(
  tx: Prisma.TransactionClient,
  units: NormalizedUnitInput[],
): Promise<Map<string, string>> {
  const unitIdByCode = new Map<string, string>();
  for (const unit of units) {
    const saved = await tx.learningUnit.upsert({
      where: { code: unit.code },
      create: {
        code: unit.code,
        cefrLevel: unit.cefrLevel,
        orderIndex: unit.orderIndex,
        title: unit.title,
        description: unit.description,
      },
      update: {
        cefrLevel: unit.cefrLevel,
        orderIndex: unit.orderIndex,
        title: unit.title,
        description: unit.description,
      },
      select: { id: true, code: true },
    });
    unitIdByCode.set(saved.code, saved.id);
  }
  return unitIdByCode;
}

async function applyGrammarTopicsTx(
  tx: Prisma.TransactionClient,
  grammarTopics: NormalizedGrammarTopicInput[],
): Promise<Map<string, string>> {
  const grammarIdByCode = new Map<string, string>();
  if (grammarTopics.length === 0) return grammarIdByCode;

  const bundleCodes = new Set(grammarTopics.map((g) => g.code));
  const inDegree = new Map<string, number>();
  const childrenByParent = new Map<string, NormalizedGrammarTopicInput[]>();

  for (const g of grammarTopics) {
    const hasBundleParent = Boolean(g.parentCode && bundleCodes.has(g.parentCode));
    inDegree.set(g.code, hasBundleParent ? 1 : 0);
    if (hasBundleParent && g.parentCode) {
      const list = childrenByParent.get(g.parentCode) ?? [];
      list.push(g);
      childrenByParent.set(g.parentCode, list);
    }
  }

  const queue: NormalizedGrammarTopicInput[] = grammarTopics.filter(
    (g) => (inDegree.get(g.code) ?? 0) === 0,
  );
  const orderedGrammar: NormalizedGrammarTopicInput[] = [];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    orderedGrammar.push(current);
    for (const child of childrenByParent.get(current.code) ?? []) {
      const nextDeg = (inDegree.get(child.code) ?? 0) - 1;
      inDegree.set(child.code, nextDeg);
      if (nextDeg === 0) {
        queue.push(child);
      }
    }
  }

  if (orderedGrammar.length !== grammarTopics.length) {
    throw new BadRequestException({
      code: 'ADMIN_IMPORT_GRAMMAR_HIERARCHY_CYCLE',
      message: 'Phát hiện vòng lặp phân cấp Cha – Con trong cây ngữ pháp.',
    });
  }

  const neededExternalParentCodes = [
    ...new Set(
      orderedGrammar
        .map((g) => g.parentCode)
        .filter((c): c is string => Boolean(c) && !bundleCodes.has(c as string)),
    ),
  ];
  if (neededExternalParentCodes.length > 0) {
    const existingParents = await tx.grammarTopic.findMany({
      where: { code: { in: neededExternalParentCodes } },
      select: { id: true, code: true },
    });
    for (const p of existingParents) {
      grammarIdByCode.set(p.code, p.id);
    }
  }

  for (const g of orderedGrammar) {
    const parentId = g.parentCode
      ? (grammarIdByCode.get(g.parentCode) ?? null)
      : null;
    const saved = await tx.grammarTopic.upsert({
      where: { code: g.code },
      create: {
        code: g.code,
        parentId,
        cefrLevel: g.cefrLevel,
        isLeaf: g.isLeaf,
        titleEn: g.titleEn,
        titleVi: g.titleVi,
        summaryVi: g.summaryVi,
        formulas: g.formulas as unknown as Prisma.InputJsonValue,
        usageNotes: g.usageNotes as unknown as Prisma.InputJsonValue,
        examples: g.examples as unknown as Prisma.InputJsonValue,
        orderIndex: g.orderIndex,
        published: g.published,
      },
      update: {
        parentId,
        cefrLevel: g.cefrLevel,
        titleEn: g.titleEn,
        titleVi: g.titleVi,
        summaryVi: g.summaryVi,
        formulas: g.formulas as unknown as Prisma.InputJsonValue,
        usageNotes: g.usageNotes as unknown as Prisma.InputJsonValue,
        examples: g.examples as unknown as Prisma.InputJsonValue,
        orderIndex: g.orderIndex,
        published: g.published,
        contentVersion: { increment: 1 },
      },
      select: { id: true, code: true },
    });
    grammarIdByCode.set(saved.code, saved.id);
  }

  const topicsWithPrereqs = orderedGrammar.filter(
    (g) => g.prerequisiteCodes !== undefined,
  );
  if (topicsWithPrereqs.length > 0) {
    const missingPrereqCodes = [
      ...new Set(
        topicsWithPrereqs
          .flatMap((g) => g.prerequisiteCodes ?? [])
          .filter((code) => !grammarIdByCode.has(code)),
      ),
    ];
    if (missingPrereqCodes.length > 0) {
      const existingPrereqs = await tx.grammarTopic.findMany({
        where: { code: { in: missingPrereqCodes } },
        select: { id: true, code: true },
      });
      for (const p of existingPrereqs) {
        grammarIdByCode.set(p.code, p.id);
      }
    }

    for (const g of topicsWithPrereqs) {
      const targetId = grammarIdByCode.get(g.code);
      if (!targetId) continue;
      await tx.grammarPrerequisite.deleteMany({
        where: { targetId },
      });
      const edgeRows = (g.prerequisiteCodes ?? [])
        .map((prereqCode) => grammarIdByCode.get(prereqCode))
        .filter((prereqId): prereqId is string => Boolean(prereqId))
        .map((prerequisiteId) => ({ prerequisiteId, targetId }));
      if (edgeRows.length > 0) {
        await tx.grammarPrerequisite.createMany({
          data: edgeRows,
          skipDuplicates: true,
        });
      }
    }
  }

  return grammarIdByCode;
}

async function applyAssessmentGroupsTx(
  tx: Prisma.TransactionClient,
  groups: NormalizedAssessmentGroupInput[],
): Promise<void> {
  for (const group of groups) {
    if (group.id) {
      await tx.assessmentItemGroup.upsert({
        where: { id: group.id },
        create: {
          id: group.id,
          skill: group.skill,
          title: group.title,
          cefrLevel: group.cefrLevel,
          partNumber: group.partNumber,
          passage: group.passage,
          audioUrl: group.audioUrl,
          transcript: group.transcript,
          usageScope: group.usageScope,
        },
        update: {
          skill: group.skill,
          title: group.title,
          cefrLevel: group.cefrLevel,
          partNumber: group.partNumber,
          passage: group.passage,
          audioUrl: group.audioUrl,
          transcript: group.transcript,
          usageScope: group.usageScope,
        },
      });
    } else {
      await tx.assessmentItemGroup.create({
        data: {
          skill: group.skill,
          title: group.title,
          cefrLevel: group.cefrLevel,
          partNumber: group.partNumber,
          passage: group.passage,
          audioUrl: group.audioUrl,
          transcript: group.transcript,
          usageScope: group.usageScope,
        },
      });
    }
  }
}

async function applyLessonsTx(
  tx: Prisma.TransactionClient,
  lessons: NormalizedLessonInput[],
  unitIdByCode: Map<string, string>,
  grammarIdByCode: Map<string, string>,
): Promise<void> {
  const missingUnitCodes = lessons
    .map((l) => l.unitCode)
    .filter(
      (code): code is string => Boolean(code) && !unitIdByCode.has(code as string),
    );
  if (missingUnitCodes.length > 0) {
    const dbUnits = await tx.learningUnit.findMany({
      where: { code: { in: [...new Set(missingUnitCodes)] } },
      select: { id: true, code: true },
    });
    for (const u of dbUnits) {
      unitIdByCode.set(u.code, u.id);
    }
  }

  const missingGrammarCodes = lessons
    .map((l) => l.grammarTopicCode)
    .filter(
      (code): code is string =>
        Boolean(code) && !grammarIdByCode.has(code as string),
    );
  if (missingGrammarCodes.length > 0) {
    const dbTopics = await tx.grammarTopic.findMany({
      where: { code: { in: [...new Set(missingGrammarCodes)] } },
      select: { id: true, code: true },
    });
    for (const t of dbTopics) {
      grammarIdByCode.set(t.code, t.id);
    }
  }

  let nextSortOrder =
    lessons.length > 0
      ? ((
          await tx.learningLesson.aggregate({
            _max: { sortOrder: true },
          })
        )._max.sortOrder ?? 0) + 1
      : 1;

  for (const lesson of lessons) {
    const unitId = lesson.unitCode
      ? (unitIdByCode.get(lesson.unitCode) ?? null)
      : undefined;
    const grammarTopicId = lesson.grammarTopicCode
      ? (grammarIdByCode.get(lesson.grammarTopicCode) ?? null)
      : undefined;
    const sortOrder = lesson.sortOrder ?? nextSortOrder++;

    await tx.learningLesson.upsert({
      where: { code: lesson.code },
      create: {
        code: lesson.code,
        kind: lesson.kind,
        title: lesson.title,
        description: lesson.description,
        estimatedMinutes: lesson.estimatedMinutes,
        sortOrder,
        published: lesson.published,
        ...(unitId !== undefined ? { unitId } : {}),
        ...(grammarTopicId !== undefined ? { grammarTopicId } : {}),
        content: lesson.content as Prisma.InputJsonValue,
      },
      update: {
        kind: lesson.kind,
        title: lesson.title,
        description: lesson.description,
        estimatedMinutes: lesson.estimatedMinutes,
        ...(lesson.sortOrder !== undefined ? { sortOrder: lesson.sortOrder } : {}),
        published: lesson.published,
        ...(unitId !== undefined ? { unitId } : {}),
        ...(grammarTopicId !== undefined ? { grammarTopicId } : {}),
        content: lesson.content as Prisma.InputJsonValue,
        contentVersion: { increment: 1 },
      },
    });
  }
}

async function applyAssessmentItemsTx(
  tx: Prisma.TransactionClient,
  items: NormalizedAssessmentItemInput[],
  mediaStorage?: MediaStorageService,
): Promise<void> {
  for (const item of items) {
    const itemData = {
      skill: item.skill,
      skillCode: item.skillCode,
      cefrLevel: item.cefrLevel,
      type: item.type,
      usageScope: item.usageScope,
      passage: item.passage ?? null,
      prompt: item.prompt,
      options:
        item.options !== undefined
          ? (item.options as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      correctOption: item.correctOption ?? null,
      explanation: item.explanation ?? null,
      audioUrl: item.audioUrl ?? null,
      ...(item.rubricCriteria !== undefined
        ? {
            rubricCriteria: item.rubricCriteria
              ? (item.rubricCriteria as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          }
        : {}),
      ...(item.groupId !== undefined && item.groupId !== null
        ? { groupId: item.groupId }
        : {}),
      ...(item.itemOrder !== undefined ? { itemOrder: item.itemOrder } : {}),
      irtA: item.irtA,
      irtB: item.irtB,
      irtC: item.irtC,
    };

    if (item.externalId) {
      let existing = await tx.assessmentItem.findUnique({
        where: { externalId: item.externalId },
        include: {
          _count: { select: { responses: true, currentSessions: true } },
        },
      });
      if (existing) {
        await lockAssessmentItem(tx, existing.id);
        existing = await tx.assessmentItem.findUnique({
          where: { externalId: item.externalId },
          include: {
            _count: { select: { responses: true, currentSessions: true } },
          },
        });
      }
      const bankVersion = await resolveAdminPlacementBankVersion(
        {
          ...item,
          options: (item.options ?? null) as Prisma.JsonValue,
          correctOption: item.correctOption ?? null,
          passage: item.passage ?? null,
          audioUrl: item.audioUrl ?? null,
          groupId: item.groupId ?? existing?.groupId,
        },
        mediaStorage,
      );
      if (existing) {
        assertReferencedItemUnchanged(existing, { ...itemData, bankVersion });
      }
      await tx.assessmentItem.upsert({
        where: { externalId: item.externalId },
        create: {
          externalId: item.externalId,
          ...itemData,
          bankVersion,
        },
        update: { ...itemData, bankVersion },
      });
    } else {
      const bankVersion = await resolveAdminPlacementBankVersion(
        {
          ...item,
          options: (item.options ?? null) as Prisma.JsonValue,
          correctOption: item.correctOption ?? null,
          passage: item.passage ?? null,
          audioUrl: item.audioUrl ?? null,
          groupId: item.groupId ?? null,
        },
        mediaStorage,
      );
      await tx.assessmentItem.create({
        data: {
          ...itemData,
          bankVersion,
        },
      });
    }
  }
}

async function applyTopicsTx(
  tx: Prisma.TransactionClient,
  topics: NormalizedTopicInput[],
  topicWordsMode: 'replace' | 'merge',
): Promise<void> {
  for (const topic of topics) {
    const savedTopic = await tx.curatedTopic.upsert({
      where: { slug: topic.slug },
      create: {
        slug: topic.slug,
        titleEn: topic.titleEn,
        titleVi: topic.titleVi,
        description: topic.description,
        icon: topic.icon,
        displayOrder: topic.displayOrder,
      },
      update: {
        titleEn: topic.titleEn,
        titleVi: topic.titleVi,
        description: topic.description,
        icon: topic.icon,
        displayOrder: topic.displayOrder,
      },
      select: { id: true },
    });

    if (topic.words !== undefined) {
      const seen = new Set<string>();
      if (topicWordsMode === 'merge') {
        const existingWords = await tx.curatedTopicWord.findMany({
          where: { topicId: savedTopic.id },
          select: { word: true, partOfSpeech: true },
        });
        for (const ew of existingWords) {
          seen.add(`${ew.word.toLowerCase()}:::${ew.partOfSpeech.toLowerCase()}`);
        }
      } else {
        await tx.curatedTopicWord.deleteMany({
          where: { topicId: savedTopic.id },
        });
      }

      const uniqueWords: NormalizedTopicWordInput[] = [];
      for (const w of topic.words) {
        const key = `${w.word.toLowerCase()}:::${w.partOfSpeech.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueWords.push(w);
        }
      }

      if (uniqueWords.length > 0) {
        await tx.curatedTopicWord.createMany({
          data: uniqueWords.map((w) => ({
            topicId: savedTopic.id,
            word: w.word,
            phonetic: w.phonetic,
            partOfSpeech: w.partOfSpeech,
            meaningVi: w.meaningVi,
            exampleEn: w.exampleEn,
            exampleVi: w.exampleVi,
            imageUrl: w.imageUrl,
            audioUrl: w.audioUrl,
          })),
        });
      }
    }
  }
}

async function applySpeakingPromptsTx(
  tx: Prisma.TransactionClient,
  speakingPrompts: NormalizedSpeakingPromptInput[],
): Promise<void> {
  if (speakingPrompts.length === 0) return;

  let nextSpeakingOrder =
    ((
      await tx.speakingPrompt.aggregate({
        _max: { sortOrder: true },
      })
    )._max.sortOrder ?? 0) + 1;

  for (const prompt of speakingPrompts) {
    const sortOrder = prompt.sortOrder ?? nextSpeakingOrder++;
    await tx.speakingPrompt.upsert({
      where: { code: prompt.code },
      create: {
        code: prompt.code,
        mode: prompt.mode,
        title: prompt.title,
        text: prompt.text,
        difficulty: prompt.difficulty,
        maxDurationSeconds: prompt.maxDurationSeconds,
        hints: prompt.hints,
        sampleAsset: prompt.sampleAsset,
        imageUrl: prompt.imageUrl,
        visualContext: prompt.visualContext,
        preparation: prompt.preparation
          ? (prompt.preparation as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        linkedReadAloudCodes: prompt.linkedReadAloudCodes,
        sortOrder,
        published: prompt.published,
      },
      update: {
        mode: prompt.mode,
        title: prompt.title,
        text: prompt.text,
        difficulty: prompt.difficulty,
        maxDurationSeconds: prompt.maxDurationSeconds,
        hints: prompt.hints,
        sampleAsset: prompt.sampleAsset,
        imageUrl: prompt.imageUrl,
        visualContext: prompt.visualContext,
        preparation: prompt.preparation
          ? (prompt.preparation as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        linkedReadAloudCodes: prompt.linkedReadAloudCodes,
        ...(prompt.sortOrder !== undefined ? { sortOrder: prompt.sortOrder } : {}),
        published: prompt.published,
        contentVersion: { increment: 1 },
      },
    });
  }
}
