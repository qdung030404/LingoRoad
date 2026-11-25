import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  loadGrammarCatalogSeeds,
  seedGrammarCatalog,
  validateGrammarSeeds,
} from '../../../../prisma/seed-grammar';
import { GrammarDagService } from './grammar-dag.service';

describe('GrammarDagService & Seed Catalog Validation', () => {
  const createMockPrisma = () => {
    const mock = {
      grammarTopic: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      grammarPrerequisite: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    mock.$transaction.mockImplementation((cb: (tx: typeof mock) => Promise<unknown>) => cb(mock));
    return mock;
  };

  it('validates the canonical A1 -> C2 grammar seed catalog and skills.json sync', () => {
    const data = loadGrammarCatalogSeeds();
    expect(() => validateGrammarSeeds(data)).not.toThrow();
    const leaves = data.topics.filter((t) => t.isLeaf);
    expect(leaves.length).toBeGreaterThanOrEqual(52);
    for (const level of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const) {
      expect(leaves.some((t) => t.cefrLevel === level)).toBe(true);
    }
  });

  it('seeds grammar catalog via batched non-interactive $transaction + createMany without N+1 roundtrips', async () => {
    const mockPrisma = {
      grammarTopic: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockImplementation((args) => ({ op: 'createManyTopics', args })),
        update: jest.fn(),
      },
      learningUnit: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockImplementation((args) => ({ op: 'createManyUnits', args })),
        update: jest.fn(),
      },
      grammarPrerequisite: {
        createMany: jest.fn().mockImplementation((args) => ({ op: 'createManyEdges', args })),
      },
      learningLesson: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn().mockImplementation((args) => ({ op: 'createManyLessons', args })),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    const result = await seedGrammarCatalog(mockPrisma as never);
    expect(result).toEqual({ topicsCount: 67, prerequisitesCount: 54, lessonsCount: 57 });
    expect(mockPrisma.grammarTopic.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.learningUnit.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.grammarTopic.createMany).toHaveBeenCalledTimes(3); // Depth 0, Depth 1, Depth 2
    expect(mockPrisma.grammarPrerequisite.createMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.learningLesson.createMany).toHaveBeenCalledTimes(1);
    expect(Array.isArray(mockPrisma.$transaction.mock.calls[0][0])).toBe(true);
  });

  it('rejects self-loop prerequisite edges (A -> A)', async () => {
    const prisma = createMockPrisma();
    const service = new GrammarDagService(prisma as never);
    const id = '11111111-1111-4111-8111-111111111111';

    await expect(service.assertNoPrerequisiteCycle(id, id)).rejects.toThrow(BadRequestException);
  });

  it('rejects direct and multi-hop cycles (A -> B -> C -> A) via DFS', async () => {
    const prisma = createMockPrisma();
    const service = new GrammarDagService(prisma as never);
    const A = '11111111-1111-4111-8111-111111111111';
    const B = '22222222-2222-4222-8222-222222222222';
    const C = '33333333-3333-4333-8333-333333333333';

    prisma.grammarTopic.findMany.mockResolvedValue([
      { id: C, isLeaf: true, code: 'grammar.c' },
      { id: A, isLeaf: true, code: 'grammar.a' },
    ]);
    prisma.grammarPrerequisite.findMany.mockResolvedValue([
      { prerequisiteId: A, targetId: B },
      { prerequisiteId: B, targetId: C },
    ]);

    await expect(service.assertNoPrerequisiteCycle(C, A)).rejects.toThrow(BadRequestException);
  });

  it('allows valid diamond DAGs without false-positive cycle errors', async () => {
    const prisma = createMockPrisma();
    const service = new GrammarDagService(prisma as never);
    const A = '11111111-1111-4111-8111-111111111111';
    const B = '22222222-2222-4222-8222-222222222222';
    const C = '33333333-3333-4333-8333-333333333333';
    const D = '44444444-4444-4444-8444-444444444444';

    prisma.grammarTopic.findMany.mockResolvedValue([
      { id: C, isLeaf: true, code: 'grammar.c' },
      { id: D, isLeaf: true, code: 'grammar.d' },
    ]);
    prisma.grammarPrerequisite.findMany.mockResolvedValue([
      { prerequisiteId: A, targetId: B },
      { prerequisiteId: A, targetId: C },
      { prerequisiteId: B, targetId: D },
    ]);

    await expect(service.assertNoPrerequisiteCycle(C, D)).resolves.toBeUndefined();
  });

  it('rejects non-leaf group nodes in prerequisite edges', async () => {
    const prisma = createMockPrisma();
    const service = new GrammarDagService(prisma as never);
    const group = '11111111-1111-4111-8111-111111111111';
    const leaf = '22222222-2222-4222-8222-222222222222';

    prisma.grammarTopic.findMany.mockResolvedValue([
      { id: group, isLeaf: false, code: 'grammar.tenses' },
      { id: leaf, isLeaf: true, code: 'grammar.tenses.past_simple' },
    ]);
    prisma.grammarPrerequisite.findMany.mockResolvedValue([]);

    await expect(service.assertNoPrerequisiteCycle(group, leaf)).rejects.toThrow(BadRequestException);
  });

  it('prevents parent-child hierarchy cycles and deleting non-empty groups', async () => {
    const prisma = createMockPrisma();
    const service = new GrammarDagService(prisma as never);
    const g1 = '11111111-1111-4111-8111-111111111111';
    const g2 = '22222222-2222-4222-8222-222222222222';

    prisma.grammarTopic.findMany.mockResolvedValue([
      { id: g1, parentId: null, isLeaf: false },
      { id: g2, parentId: g1, isLeaf: false },
    ]);

    await expect(service.assertValidHierarchyParent(g1, g2)).rejects.toThrow(BadRequestException);

    prisma.grammarTopic.findUnique.mockResolvedValue({
      id: g1,
      _count: { children: 3 },
    });
    await expect(service.deleteTopic(g1)).rejects.toThrow(BadRequestException);
  });

  it('enforces unique code and non-empty formulas/examples when creating leaf topics', async () => {
    const prisma = createMockPrisma();
    const service = new GrammarDagService(prisma as never);

    prisma.grammarTopic.findUnique.mockResolvedValueOnce({ id: 'existing' });
    await expect(
      service.createTopic({
        code: 'grammar.articles',
        cefrLevel: 'A1',
        isLeaf: true,
        titleEn: 'Articles',
        titleVi: 'Mạo từ',
      }),
    ).rejects.toThrow(ConflictException);

    prisma.grammarTopic.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.createTopic({
        code: 'grammar.new_leaf',
        cefrLevel: 'B1',
        isLeaf: true,
        titleEn: 'New Leaf',
        titleVi: 'Chủ điểm mới',
        formulas: [],
        usageNotes: [],
        examples: [],
      }),
    ).rejects.toThrow(BadRequestException);

    prisma.grammarTopic.findUnique.mockResolvedValueOnce(null);
    await expect(service.deleteTopic('99999999-9999-4999-8999-999999999999')).rejects.toThrow(
      NotFoundException,
    );
  });
});
