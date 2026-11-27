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
});
