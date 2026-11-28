import { LearningKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlanningService } from './planning.service';

describe('PlanningService home() vs preferences() preferredKinds parity', () => {
  function createFixture(options: {
    profilePreferredKinds: LearningKind[];
    receiptResult?: unknown;
  }) {
    const db = {
      userProfile: {
        findUnique: jest.fn(async () => ({
          userId: 'user-legacy',
          learningPurpose: 'COMMUNICATION',
          targetCefr: 'B1',
          dailyGoalMinutes: 15,
          preferredKinds: options.profilePreferredKinds,
          preferencesVersion: 2,
        })),
      },
      vocabularyCommandReceipt: {
        findUnique: jest.fn(async () =>
          options.receiptResult === undefined ? null : { result: options.receiptResult },
        ),
      },
      learningDayPlan: {
        findMany: jest.fn(async () => []),
      },
      learningAttempt: {
        findMany: jest.fn(async () => []),
      },
      learningLesson: {
        count: jest.fn(async () => 0),
        findFirst: jest.fn(async () => null),
      },
      learningActivitySession: {
        findFirst: jest.fn(async () => null),
      },
      placementSession: {
        findFirst: jest.fn(async () => null),
      },
      learningSkillLevel: {
        findUnique: jest.fn(async () => null),
      },
      $queryRaw: jest.fn(async () => []),
    };
    return {
      db,
      service: new PlanningService(db as unknown as PrismaService),
    };
  }

  it('returns [READING] on both /learning/home and /learning/preferences when legacy profile selected only READING and has no receipt', async () => {
    const { service } = createFixture({
      profilePreferredKinds: [LearningKind.READING],
    });

    const [homeRes, prefsRes] = await Promise.all([
      service.home('user-legacy'),
      service.preferences('user-legacy'),
    ]);

    expect(prefsRes.preferredKinds).toEqual(['READING']);
    expect(homeRes.preferences.preferredKinds).toEqual(['READING']);
  });

  it('expands full 4-kind legacy default to all 6 skills identically on both /learning/home and /learning/preferences', async () => {
    const { service } = createFixture({
      profilePreferredKinds: [
        LearningKind.GRAMMAR,
        LearningKind.VOCABULARY,
        LearningKind.READING,
        LearningKind.LISTENING,
      ],
    });

    const [homeRes, prefsRes] = await Promise.all([
      service.home('user-legacy'),
      service.preferences('user-legacy'),
    ]);

    const expected = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING', 'SPEAKING', 'WRITING'];
    expect(prefsRes.preferredKinds).toEqual(expected);
    expect(homeRes.preferences.preferredKinds).toEqual(expected);
  });

  it('prefers stored preferredSkills receipt over legacy profile.preferredKinds on both endpoints', async () => {
    const { service } = createFixture({
      profilePreferredKinds: [LearningKind.READING],
      receiptResult: {
        preferredKinds: ['LISTENING', 'SPEAKING'],
        schemaVersion: 2,
      },
    });

    const [homeRes, prefsRes] = await Promise.all([
      service.home('user-legacy'),
      service.preferences('user-legacy'),
    ]);

    expect(prefsRes.preferredKinds).toEqual(['LISTENING', 'SPEAKING']);
    expect(homeRes.preferences.preferredKinds).toEqual(['LISTENING', 'SPEAKING']);
  });
});
