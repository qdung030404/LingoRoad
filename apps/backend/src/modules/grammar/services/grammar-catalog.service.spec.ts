import { NotFoundException } from '@nestjs/common';
import { GrammarTopic } from '@prisma/client';
import { GrammarCatalogService } from './grammar-catalog.service';

describe('GrammarCatalogService', () => {
  const now = new Date('2026-11-25T00:00:00.000Z');
  const root: GrammarTopic = {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'grammar',
    parentId: null,
    cefrLevel: 'A1',
    isLeaf: false,
    titleEn: 'Grammar',
    titleVi: 'Ngữ pháp',
    summaryVi: 'Tổng quan',
    formulas: [],
    usageNotes: [],
    examples: [],
    orderIndex: 0,
    published: true,
    contentVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
  const tensesGroup: GrammarTopic = {
    ...root,
    id: '00000000-0000-4000-8000-000000000002',
    code: 'grammar.tenses',
    parentId: root.id,
    titleEn: 'Tenses',
    titleVi: 'Hệ thống Thì',
    orderIndex: 10,
  };
  const presentSimple: GrammarTopic = {
    ...root,
    id: '00000000-0000-4000-8000-000000000003',
    code: 'grammar.tenses.present_simple',
    parentId: tensesGroup.id,
    cefrLevel: 'A1',
    isLeaf: true,
    titleEn: 'Present Simple',
    titleVi: 'Thì Hiện tại đơn',
    summaryVi: 'Thói quen và sự thật hiển nhiên',
    formulas: [{ form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + V(s/es)' }],
    usageNotes: [{ useCaseVi: 'Thói quen hằng ngày', signalWords: ['always'] }],
    examples: [{ sentenceEn: 'She works here.', translationVi: 'Cô ấy làm việc ở đây.' }],
    orderIndex: 101,
  };
  const pastSimple: GrammarTopic = {
    ...presentSimple,
    id: '00000000-0000-4000-8000-000000000004',
    code: 'grammar.tenses.past_simple',
    cefrLevel: 'A2',
    titleEn: 'Past Simple',
    titleVi: 'Thì Quá khứ đơn',
    orderIndex: 102,
  };
  const ellipsisC2: GrammarTopic = {
    ...presentSimple,
    id: '00000000-0000-4000-8000-000000000005',
    code: 'grammar.ellipsis_substitution',
    parentId: root.id,
    cefrLevel: 'C2',
    titleEn: 'Advanced Ellipsis',
    titleVi: 'Tỉnh lược nâng cao',
    orderIndex: 901,
  };

  const createMockPrisma = () => ({
    grammarTopic: {
      findMany: jest.fn().mockResolvedValue([root, tensesGroup, presentSimple, pastSimple, ellipsisC2]),
      findFirst: jest.fn(),
    },
    grammarPrerequisite: {
      findMany: jest.fn().mockResolvedValue([
        { prerequisiteId: presentSimple.id, targetId: pastSimple.id },
      ]),
    },
    learningLesson: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: '00000000-0000-4000-8000-000000000099',
          code: 'grammar-present-simple-1',
          title: 'Present Simple Practice',
          description: 'Luyện tập Hiện tại đơn',
          estimatedMinutes: 10,
          grammarTopicId: presentSimple.id,
          unit: { cefrLevel: 'A1' },
        },
      ]),
    },
    assessmentItem: {
      groupBy: jest.fn().mockResolvedValue([
        { skillCode: 'grammar.tenses.present_simple', _count: { _all: 4 } },
      ]),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    learningAttempt: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    placementSession: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  });

  it('builds hierarchical tree, rolls up counts, and computes LOCKED vs COMPLETED learner status', async () => {
    const prisma = createMockPrisma();
    const service = new GrammarCatalogService(prisma as never);

    // User has NOT completed presentSimple lesson yet -> pastSimple should be LOCKED
    const unstartedTree = await service.getGrammarTree({ groupBy: 'hierarchy' }, 'user-1');
    expect(unstartedTree.groupBy).toBe('hierarchy');
    if (unstartedTree.groupBy === 'hierarchy') {
      expect(unstartedTree.tree).toHaveLength(1);
      expect(unstartedTree.tree[0].lessonCount).toBe(1);
      expect(unstartedTree.tree[0].practiceItemCount).toBe(4);
      const tensesNode = unstartedTree.tree[0].children.find((c) => c.code === 'grammar.tenses')!;
      const psNode = tensesNode.children.find((c) => c.code === 'grammar.tenses.present_simple')!;
      const pastNode = tensesNode.children.find((c) => c.code === 'grammar.tenses.past_simple')!;
      expect(psNode.learnerStatus).toBe('AVAILABLE');
      expect(pastNode.learnerStatus).toBe('LOCKED');
    }

    // Now user completes presentSimple lesson -> presentSimple is COMPLETED and pastSimple unlocks to AVAILABLE
    prisma.learningAttempt.findMany.mockResolvedValue([
      { lessonId: '00000000-0000-4000-8000-000000000099', status: 'COMPLETED' },
    ]);
    const completedTree = await service.getGrammarTree({ groupBy: 'cefr' }, 'user-1');
    expect(completedTree.groupBy).toBe('cefr');
    if (completedTree.groupBy === 'cefr') {
      const a1 = completedTree.levels.find((l) => l.cefrLevel === 'A1')!;
      const a2 = completedTree.levels.find((l) => l.cefrLevel === 'A2')!;
      expect(a1.topics[0].learnerStatus).toBe('COMPLETED');
      expect(a2.topics[0].learnerStatus).toBe('AVAILABLE');
    }
  });

  it('prunes empty branches when filtering hierarchical tree by cefrLevel', async () => {
    const prisma = createMockPrisma();
    const service = new GrammarCatalogService(prisma as never);

    const c2Tree = await service.getGrammarTree({ groupBy: 'hierarchy', cefrLevel: 'C2' });
    if (c2Tree.groupBy === 'hierarchy') {
      expect(c2Tree.tree[0].children.map((c) => c.code)).toEqual(['grammar.ellipsis_substitution']);
    }
  });

  it('returns levels overview, filtered topic list, and topic detail', async () => {
    const prisma = createMockPrisma();
    const service = new GrammarCatalogService(prisma as never);

    const overview = await service.getLevelsOverview();
    expect(overview.levels).toHaveLength(6);
    expect(overview.levels.find((l) => l.cefrLevel === 'A1')?.topicCount).toBe(1);
    expect(overview.levels.find((l) => l.cefrLevel === 'A1')?.completedCount).toBeUndefined();

    const searchRes = await service.listTopics({ search: 'quá khứ', page: 1, limit: 10 });
    expect(searchRes.items).toHaveLength(1);
    expect(searchRes.items[0].code).toBe('grammar.tenses.past_simple');

    const detail = await service.getTopicDetail('grammar.tenses.present_simple');
    expect(detail.dependents.map((d) => d.code)).toEqual(['grammar.tenses.past_simple']);
    expect(detail.lessons).toHaveLength(1);
    expect(detail.formulas).toHaveLength(1);

    await expect(service.getTopicDetail('grammar.unknown')).rejects.toThrow(NotFoundException);
  });

  it('sanitizes practice items via AssessmentSafeMapper without leaking answers', async () => {
    const prisma = createMockPrisma();
    prisma.grammarTopic.findFirst.mockResolvedValue({
      code: 'grammar.tenses.present_simple',
      cefrLevel: 'A1',
    });
    prisma.assessmentItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        groupId: null,
        itemOrder: 1,
        externalId: 'ext-1',
        bankVersion: 'v1',
        skill: null,
        passage: null,
        skillCode: 'grammar.tenses.present_simple',
        cefrLevel: 'A1',
        type: 'MULTIPLE_CHOICE',
        prompt: 'She ___ to school every day.',
        options: ['go', 'goes', 'going', 'gone'],
        correctOption: 'goes',
        explanation: 'Ngôi thứ 3 số ít dùng goes.',
        audioUrl: null,
        rubricCriteria: { targetGrammars: ['Present Simple'], timeLimitSeconds: 60 },
        usageScope: 'PRACTICE',
        irtA: 1.2,
        irtB: -1.5,
        irtC: 0.25,
        createdAt: now,
      },
    ]);
    prisma.assessmentItem.count.mockResolvedValue(1);

    const service = new GrammarCatalogService(prisma as never);
    const res = await service.getTopicPracticeItems('grammar.tenses.present_simple', {
      limit: 10,
      offset: 0,
    });

    expect(res.meta.total).toBe(1);
    const rawItem = res.items[0] as unknown as Record<string, unknown>;
    expect(rawItem.correctOption).toBeUndefined();
    expect(rawItem.explanation).toBeUndefined();
    expect(rawItem.irtA).toBeUndefined();
    expect(rawItem.rubricCriteria).toEqual({ timeLimitSeconds: 60 });
  });

  it('returns combined levels + hierarchy tree in one pass, caches static curriculum, and invalidates on mutation', async () => {
    const prisma = createMockPrisma();
    prisma.learningAttempt.findMany.mockResolvedValueOnce([
      { lessonId: '00000000-0000-4000-8000-000000000099', status: 'COMPLETED' },
    ]);

    const service = new GrammarCatalogService(prisma as never);
    const combined = await service.getGrammarTree(
      { groupBy: 'hierarchy', includeLevels: 'true' },
      'user-1',
    );

    expect(combined.groupBy).toBe('hierarchy');
    if (combined.groupBy === 'hierarchy') {
      expect(combined.tree).toHaveLength(1);
      expect(combined.levels).toHaveLength(6);
      const a1 = combined.levels?.find((l) => l.cefrLevel === 'A1');
      expect(a1).toMatchObject({
        cefrLevel: 'A1',
        topicCount: 1,
        lessonCount: 1,
        completedCount: 1,
      });
    }
    expect(prisma.grammarTopic.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.learningAttempt.findMany).toHaveBeenCalledTimes(1);

    // Second call for another learner reuses cached static curriculum while querying fresh learner attempts
    prisma.learningAttempt.findMany.mockResolvedValueOnce([]);
    const secondUser = await service.getGrammarTree(
      { groupBy: 'hierarchy', includeLevels: 'true' },
      'user-2',
    );
    expect(prisma.grammarTopic.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.learningAttempt.findMany).toHaveBeenCalledTimes(2);
    if (secondUser.groupBy === 'hierarchy') {
      expect(secondUser.levels?.find((l) => l.cefrLevel === 'A1')?.completedCount).toBe(0);
    }

    // Invalidating static cache forces static curriculum reload on next request
    service.invalidateStaticCache();
    await service.getLevelsOverview();
    expect(prisma.grammarTopic.findMany).toHaveBeenCalledTimes(2);
  });

  it('keeps root locks for A1 placement, unlocks A1-A2 as AVAILABLE for B1 placement while keeping B1->B1 and B2..C2 locks, and handles multi-prereq exemption for B2 placement', async () => {
    const b1RootTopic: GrammarTopic = {
      ...presentSimple,
      id: '00000000-0000-4000-8000-000000000011',
      code: 'grammar.tenses.present_perfect',
      cefrLevel: 'B1',
      titleEn: 'Present Perfect',
      titleVi: 'Thì Hiện tại hoàn thành',
      orderIndex: 201,
    };
    const b1DependentTopic: GrammarTopic = {
      ...presentSimple,
      id: '00000000-0000-4000-8000-000000000012',
      code: 'grammar.tenses.present_perfect_continuous',
      cefrLevel: 'B1',
      titleEn: 'Present Perfect Continuous',
      titleVi: 'Thì Hiện tại hoàn thành tiếp diễn',
      orderIndex: 202,
    };
    const b2LockedByB1: GrammarTopic = {
      ...presentSimple,
      id: '00000000-0000-4000-8000-000000000013',
      code: 'grammar.tenses.future_perfect',
      cefrLevel: 'B2',
      titleEn: 'Future Perfect',
      titleVi: 'Thì Tương lai hoàn thành',
      orderIndex: 301,
    };
    const b2MultiPrereqTopic: GrammarTopic = {
      ...presentSimple,
      id: '00000000-0000-4000-8000-000000000014',
      code: 'grammar.clauses.mixed_conditionals',
      cefrLevel: 'B2',
      titleEn: 'Mixed Conditionals',
      titleVi: 'Câu điều kiện hỗn hợp',
      orderIndex: 302,
    };

    const allTopics: GrammarTopic[] = [
      root,
      tensesGroup,
      presentSimple,
      pastSimple,
      b1RootTopic,
      b1DependentTopic,
      b2LockedByB1,
      b2MultiPrereqTopic,
      ellipsisC2,
    ];
    const allEdges = [
      { prerequisiteId: presentSimple.id, targetId: pastSimple.id },
      { prerequisiteId: pastSimple.id, targetId: b1RootTopic.id },
      { prerequisiteId: b1RootTopic.id, targetId: b1DependentTopic.id },
      { prerequisiteId: b1RootTopic.id, targetId: b2LockedByB1.id },
      { prerequisiteId: b1RootTopic.id, targetId: b2MultiPrereqTopic.id },
      { prerequisiteId: b2LockedByB1.id, targetId: b2MultiPrereqTopic.id },
      { prerequisiteId: b2MultiPrereqTopic.id, targetId: ellipsisC2.id },
    ];
    const allLessons = [
      { id: 'lesson-a1', grammarTopicId: presentSimple.id },
      { id: 'lesson-a2', grammarTopicId: pastSimple.id },
      { id: 'lesson-b1-1', grammarTopicId: b1RootTopic.id },
      { id: 'lesson-b1-2', grammarTopicId: b1DependentTopic.id },
      { id: 'lesson-b2-1', grammarTopicId: b2LockedByB1.id },
      { id: 'lesson-b2-2', grammarTopicId: b2MultiPrereqTopic.id },
      { id: 'lesson-c2', grammarTopicId: ellipsisC2.id },
    ];

    const buildServiceWithPlacement = (estimatedCefr: 'A1' | 'B1' | 'B2' | null) => {
      const prisma = createMockPrisma();
      prisma.grammarTopic.findMany.mockResolvedValue(allTopics);
      prisma.grammarPrerequisite.findMany.mockResolvedValue(allEdges);
      prisma.learningLesson.findMany.mockResolvedValue(allLessons);
      prisma.placementSession.findFirst.mockResolvedValue(
        estimatedCefr ? { estimatedCefr } : null,
      );
      return { prisma, service: new GrammarCatalogService(prisma as never) };
    };

    const statusByCode = (levels: Array<{ cefrLevel: string; topics: Array<{ code: string; learnerStatus?: string }> }>) => {
      const map = new Map<string, string | undefined>();
      for (const lvl of levels) {
        for (const t of lvl.topics) {
          map.set(t.code, t.learnerStatus);
        }
      }
      return map;
    };

    // 1. User A1 keeps root/prerequisite locks
    const a1Case = buildServiceWithPlacement('A1');
    const a1Tree = await a1Case.service.getGrammarTree({ groupBy: 'cefr' }, 'user-a1');
    if (a1Tree.groupBy === 'cefr') {
      const statuses = statusByCode(a1Tree.levels);
      expect(statuses.get(presentSimple.code)).toBe('AVAILABLE');
      expect(statuses.get(pastSimple.code)).toBe('LOCKED');
      expect(statuses.get(b1RootTopic.code)).toBe('LOCKED');
      expect(statuses.get(b1DependentTopic.code)).toBe('LOCKED');
      expect(statuses.get(b2LockedByB1.code)).toBe('LOCKED');
      expect(statuses.get(ellipsisC2.code)).toBe('LOCKED');
    }

    // 2. User B1 unlocks A1-A2 as AVAILABLE with completedCount === 0, unlocks B1 whose prereqs < B1, keeps B1->B1 & B2..C2 locked
    const b1Case = buildServiceWithPlacement('B1');
    const b1Tree = await b1Case.service.getGrammarTree({ groupBy: 'cefr' }, 'user-b1');
    if (b1Tree.groupBy === 'cefr') {
      const statuses = statusByCode(b1Tree.levels);
      expect(statuses.get(presentSimple.code)).toBe('AVAILABLE');
      expect(statuses.get(pastSimple.code)).toBe('AVAILABLE');
      expect(statuses.get(b1RootTopic.code)).toBe('AVAILABLE');
      expect(statuses.get(b1DependentTopic.code)).toBe('LOCKED');
      expect(statuses.get(b2LockedByB1.code)).toBe('LOCKED');
      expect(statuses.get(ellipsisC2.code)).toBe('LOCKED');
    }
    const b1Overview = await b1Case.service.getLevelsOverview('user-b1');
    expect(b1Overview.levels.find((l) => l.cefrLevel === 'A1')?.completedCount).toBe(0);
    expect(b1Overview.levels.find((l) => l.cefrLevel === 'A2')?.completedCount).toBe(0);
    expect(b1Overview.levels.find((l) => l.cefrLevel === 'B1')?.completedCount).toBe(0);

    // 3. User B2 on multi-prereq topic (B1 + B2 prereqs): exempts B1 prereq, only blocks on incomplete B2 prereq
    const b2Case = buildServiceWithPlacement('B2');
    const b2LockedTree = await b2Case.service.getGrammarTree({ groupBy: 'cefr' }, 'user-b2');
    if (b2LockedTree.groupBy === 'cefr') {
      const statuses = statusByCode(b2LockedTree.levels);
      expect(statuses.get(b1RootTopic.code)).toBe('AVAILABLE');
      expect(statuses.get(b2LockedByB1.code)).toBe('AVAILABLE');
      expect(statuses.get(b2MultiPrereqTopic.code)).toBe('LOCKED');
    }

    // Completing ONLY the B2 prereq (while B1 prereq remains uncompleted) unlocks the multi-prereq B2 topic
    b2Case.prisma.learningAttempt.findMany.mockResolvedValue([
      { lessonId: 'lesson-b2-1', status: 'COMPLETED' },
    ]);
    const b2UnlockedTree = await b2Case.service.getGrammarTree({ groupBy: 'cefr' }, 'user-b2');
    if (b2UnlockedTree.groupBy === 'cefr') {
      const statuses = statusByCode(b2UnlockedTree.levels);
      expect(statuses.get(b2LockedByB1.code)).toBe('COMPLETED');
      expect(statuses.get(b2MultiPrereqTopic.code)).toBe('AVAILABLE');
      expect(statuses.get(ellipsisC2.code)).toBe('LOCKED');
    }
  });
});
