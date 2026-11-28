import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LearningKind, Prisma } from '@prisma/client';
import { seedLearningContent } from '../../../prisma/seed-learning';
import { initialReadingLevel } from './skill-level.policy';
import {
  buildProgressUnits,
  computeScoreStats,
  DAY_MS,
  finishedOn,
  learningDate,
  learningDayStart,
} from './planning.helpers';
import { PlanningService } from './planning.service';
import { PrismaService } from '../prisma/prisma.service';

function resolveSafeTestDatabaseUrl(): string {
  const current = process.env.DATABASE_URL;
  if (current && new URL(current).pathname.endsWith('_test')) {
    return current;
  }
  const candidates = [
    join(process.cwd(), '../../.demo/settings.json'),
    join(process.cwd(), '.demo/settings.json'),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as { TestDatabaseUrl?: string };
    if (parsed.TestDatabaseUrl && new URL(parsed.TestDatabaseUrl).pathname.endsWith('_test')) {
      return parsed.TestDatabaseUrl;
    }
  }
  throw new Error('Missing *_test DATABASE_URL for planning-progress-equivalence.spec.ts');
}

/** Exact pre-rewrite reference implementation of progress() + homeActiveSeconds() for old-vs-new parity proof. */
async function legacyProgressReference(prisma: PrismaService, userId: string, now: Date) {
  const today = learningDate(now);
  const start = learningDayStart(today);
  const week = Array.from({ length: 7 }, (_, i) => {
    const from = new Date(start.getTime() - (6 - i) * DAY_MS);
    return {
      date: learningDate(from),
      from,
      to: new Date(Math.min(from.getTime() + DAY_MS, now.getTime())),
    };
  });

  const legacyWindows = [...week, { from: new Date(0), to: now }];
  const values = legacyWindows.map(
    ({ from, to }, index) => Prisma.sql`(${index}::int, ${from}::timestamptz, ${to}::timestamptz)`,
  );

  const [profile, plans, attempts, totalLessons, units, first, placement, skillLevel, secRows] =
    await Promise.all([
      prisma.userProfile.findUniqueOrThrow({ where: { userId } }),
      prisma.learningDayPlan.findMany({
        where: { userId, date: { gte: week[0].date, lte: today } },
        select: { date: true, dailyGoalMinutes: true },
      }),
      prisma.learningAttempt.findMany({
        where: { userId },
        select: {
          id: true,
          lessonId: true,
          status: true,
          lessonSnapshot: true,
          correctCount: true,
          totalQuestions: true,
          submittedAt: true,
          historyHiddenAt: true,
        },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      }),
      prisma.learningLesson.findMany({
        where: { published: true },
        select: { id: true, unitId: true },
      }),
      prisma.learningUnit.findMany({ orderBy: [{ cefrLevel: 'asc' }, { orderIndex: 'asc' }] }),
      prisma.learningActivitySession.findFirst({
        where: { userId },
        orderBy: { anchorAt: 'asc' },
        select: { anchorAt: true },
      }),
      prisma.placementSession.findFirst({
        where: { userId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { skillResults: true, completedAt: true },
      }),
      prisma.learningSkillLevel.findUnique({ where: { userId_kind: { userId, kind: 'READING' } } }),
      prisma.$queryRaw<{ idx: number; seconds: number }[]>`
        WITH windows(idx, starts, ends) AS (VALUES ${Prisma.join(values)}),
        merged AS (
          SELECT w.idx, range_agg(tstzrange(GREATEST(s.start_at AT TIME ZONE 'UTC', w.starts),
            LEAST(s.end_at AT TIME ZONE 'UTC', w.ends), '[)')) AS spans
          FROM learning_activity_segments s JOIN learning_activity_sessions a ON a.id = s.session_id
          JOIN windows w ON w.starts < w.ends
            AND s.end_at > (w.starts AT TIME ZONE 'UTC')
            AND s.start_at < (w.ends AT TIME ZONE 'UTC')
          WHERE a.user_id = ${userId}::uuid AND s.start_at IS NOT NULL
          GROUP BY w.idx
        )
        SELECT idx, FLOOR(SUM(EXTRACT(EPOCH FROM (upper(span) - lower(span)))))::double precision AS seconds
        FROM merged CROSS JOIN LATERAL unnest(spans) AS pieces(span) GROUP BY idx`,
    ]);

  const seconds = new Map((secRows ?? []).map((r) => [r.idx, Number(r.seconds ?? 0)]));
  const goalByDate = new Map(plans.map((p) => [p.date, p.dailyGoalMinutes]));
  const days = week.map((day, index) => {
    const comp = attempts.filter((a) => finishedOn(a, day.date));
    const activeSeconds = seconds.get(index) ?? 0;
    const target = goalByDate.get(day.date) ?? (day.date === today ? profile.dailyGoalMinutes : null);
    return {
      date: day.date,
      dailyGoalMinutes: target,
      activeSeconds,
      goalMet: target != null && activeSeconds >= target * 60,
      completedLessonCount: new Set(comp.map((a) => a.lessonId)).size,
      completedAttemptCount: comp.length,
      hasActivity: activeSeconds > 0 || comp.length > 0,
      timeMeasured: first != null && learningDate(first.anchorAt) <= day.date,
    };
  });

  const completed = attempts.filter((a) => a.status === 'COMPLETED');
  const publishedIds = new Set(totalLessons.map((l) => l.id));
  const completedPublishedIds = new Set(
    completed.filter((a) => publishedIds.has(a.lessonId)).map((a) => a.lessonId),
  );
  const measuredDays = days.filter((d) => d.timeMeasured);
  const averageActiveSeconds = measuredDays.length
    ? Math.round(measuredDays.reduce((sum, d) => sum + d.activeSeconds, 0) / measuredDays.length)
    : 0;
  const latestResults = Object.values(LearningKind).flatMap((kind) => {
    const a = completed.find(
      (row) => row.historyHiddenAt == null && (row.lessonSnapshot as { kind?: string })?.kind === kind,
    );
    return a
      ? [
          {
            kind,
            correctCount: a.correctCount!,
            totalQuestions: a.totalQuestions,
            scoreRatio: a.correctCount! / a.totalQuestions,
            submittedAt: a.submittedAt,
            lessonTitle: (a.lessonSnapshot as { title: string }).title,
          },
        ]
      : [];
  });
  const placementInit = initialReadingLevel(
    placement?.skillResults as Record<string, unknown> | undefined,
    placement?.completedAt,
  );
  const readingLevel = skillLevel
    ? {
        cefrLevel: skillLevel.cefrLevel,
        source: skillLevel.source,
        previousCefr: skillLevel.previousCefr,
        changedAt: skillLevel.changedAt,
      }
    : { ...placementInit, previousCefr: null };

  return {
    today: days[6],
    days,
    totals: {
      totalLessons: totalLessons.length,
      completedLessonCount: completedPublishedIds.size,
      completedAttemptCount: completed.length,
      activeAttemptCount: attempts.filter((a) => a.status === 'IN_PROGRESS').length,
      activeSeconds: seconds.get(week.length) ?? 0,
      averageActiveSeconds,
      averageStudyMinutes: Math.floor(averageActiveSeconds / 60),
    },
    units: buildProgressUnits(units, totalLessons, completedPublishedIds),
    scoreStats: computeScoreStats(completed, now),
    latestResults,
    placement: placement?.skillResults ?? null,
    recommendedLevels: { reading: readingLevel },
    trackingStartedAt: first?.anchorAt ?? null,
  };
}

describe('PlanningService.progress() old-vs-new exact equivalence on PostgreSQL', () => {
  const prevDbUrl = process.env.DATABASE_URL;
  let prisma: PrismaService;
  let service: PlanningService;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = resolveSafeTestDatabaseUrl();
    prisma = new PrismaService();
    await prisma.onModuleInit();
    await seedLearningContent(prisma);
    service = new PlanningService(prisma);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
    await prisma.onModuleDestroy();
    if (prevDbUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = prevDbUrl;
    }
  });

  it('matches legacy progress() across per-attempt score averages, multi-device overlap, Vietnam midnight offline split, hidden history, and 500 historical attempts', async () => {
    const fixedNow = new Date('2026-11-28T06:30:00.000Z'); // 13:30:00+07:00 Vietnam time
    const todayVn = learningDate(fixedNow); // '2026-11-28'
    const todayStartUtc = learningDayStart(todayVn); // '2026-11-27T17:00:00.000Z'
    const yesterdayMidnightUtc = new Date(todayStartUtc.getTime() - DAY_MS); // '2026-11-26T17:00:00.000Z'

    const publishedLessons = await prisma.learningLesson.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    expect(publishedLessons.length).toBeGreaterThanOrEqual(4);

    const user = await prisma.user.create({
      data: {
        email: `progress-eq-${randomUUID()}@example.com`,
        name: 'Equivalence Learner',
        profile: {
          create: {
            dailyGoalMinutes: 15,
            targetCefr: 'B1',
            preferredKinds: ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'],
            onboardingCompletedAt: new Date('2026-11-01T00:00:00.000Z'),
          },
        },
      },
    });
    createdUserIds.push(user.id);

    // 1. Edge case A: Per-attempt score average (4/4 = 100% and 1/6 = 16.67% -> per-attempt avg = 58, NOT 5/10 = 50!)
    //    plus Vietnam midnight exact millisecond boundary (16:59:59.999Z vs 17:00:00.000Z) + hidden latest attempt!
    const grammarLesson = publishedLessons.find((l) => l.kind === 'GRAMMAR')!;
    const readingLesson = publishedLessons.find((l) => l.kind === 'READING')!;
    const vocabLesson = publishedLessons.find((l) => l.kind === 'VOCABULARY')!;
    const listeningLesson = publishedLessons.find((l) => l.kind === 'LISTENING')!;

    const edgeAttempts = [
      // Current week: 4/4 (100%) right at exact Vietnam midnight start of today (17:00:00.000Z)
      {
        id: randomUUID(),
        userId: user.id,
        lessonId: grammarLesson.id,
        status: 'COMPLETED' as const,
        version: 1,
        phase: 'QUIZ',
        positionIndex: 0,
        contentVersion: 1,
        totalQuestions: 4,
        correctCount: 4,
        lessonSnapshot: { id: grammarLesson.id, kind: 'GRAMMAR', title: 'Visible Grammar Snapshot' },
        contentSnapshot: grammarLesson.content as Prisma.InputJsonValue,
        startedAt: new Date(todayStartUtc.getTime() - 120000),
        updatedAt: todayStartUtc,
        submittedAt: todayStartUtc,
        historyHiddenAt: null,
      },
      // Newer COMPLETED grammar attempt that is HIDDEN in history: counts in scoreStats & completedAttemptCount, NOT in latestResults!
      {
        id: randomUUID(),
        userId: user.id,
        lessonId: grammarLesson.id,
        status: 'COMPLETED' as const,
        version: 1,
        phase: 'QUIZ',
        positionIndex: 0,
        contentVersion: 1,
        totalQuestions: 6,
        correctCount: 1,
        lessonSnapshot: { id: grammarLesson.id, kind: 'GRAMMAR', title: 'Hidden Grammar Retake' },
        contentSnapshot: grammarLesson.content as Prisma.InputJsonValue,
        startedAt: new Date(todayStartUtc.getTime() + 60000),
        updatedAt: new Date(todayStartUtc.getTime() + 120000),
        submittedAt: new Date(todayStartUtc.getTime() + 120000),
        historyHiddenAt: new Date(todayStartUtc.getTime() + 180000),
      },
      // 1 millisecond BEFORE today's Vietnam midnight (16:59:59.999Z -> belongs to yesterday '2026-11-27'!)
      {
        id: randomUUID(),
        userId: user.id,
        lessonId: readingLesson.id,
        status: 'COMPLETED' as const,
        version: 1,
        phase: 'QUIZ',
        positionIndex: 0,
        contentVersion: 1,
        totalQuestions: 8,
        correctCount: 5,
        lessonSnapshot: { id: readingLesson.id, kind: 'READING', title: 'Pre-midnight Reading' },
        contentSnapshot: readingLesson.content as Prisma.InputJsonValue,
        startedAt: new Date(todayStartUtc.getTime() - 300000),
        updatedAt: new Date(todayStartUtc.getTime() - 1),
        submittedAt: new Date(todayStartUtc.getTime() - 1),
        historyHiddenAt: null,
      },
      // Active IN_PROGRESS attempt (must count in activeAttemptCount only)
      {
        id: randomUUID(),
        userId: user.id,
        lessonId: vocabLesson.id,
        status: 'IN_PROGRESS' as const,
        version: 0,
        phase: 'STUDY',
        positionIndex: 0,
        contentVersion: 1,
        totalQuestions: 5,
        correctCount: null,
        lessonSnapshot: { id: vocabLesson.id, kind: 'VOCABULARY', title: 'Active Vocab' },
        contentSnapshot: vocabLesson.content as Prisma.InputJsonValue,
        startedAt: new Date(fixedNow.getTime() - 60000),
        updatedAt: new Date(fixedNow.getTime() - 60000),
        submittedAt: null,
        historyHiddenAt: null,
      },
    ];

    // Add 500 historical attempts across previous week and older months with varied denominators (3, 4, 5, 7)
    const historicalAttempts = Array.from({ length: 500 }, (_, idx) => {
      const lesson = [grammarLesson, readingLesson, vocabLesson, listeningLesson][idx % 4];
      const daysAgo = 7 + (idx % 25); // spans previousWeek (7..13 days ago) and older (14..31 days ago)
      const ts = new Date(todayStartUtc.getTime() - daysAgo * DAY_MS + (idx % 500) * 1000);
      const totalQ = [3, 4, 5, 7][idx % 4];
      const correct = idx % (totalQ + 1);
      return {
        id: randomUUID(),
        userId: user.id,
        lessonId: lesson.id,
        status: 'COMPLETED' as const,
        version: 1,
        phase: 'QUIZ',
        positionIndex: 0,
        contentVersion: 1,
        totalQuestions: totalQ,
        correctCount: correct,
        lessonSnapshot: { id: lesson.id, kind: lesson.kind, title: `${lesson.title} #${idx}` },
        contentSnapshot: lesson.content as Prisma.InputJsonValue,
        startedAt: new Date(ts.getTime() - 180000),
        updatedAt: ts,
        submittedAt: ts,
        historyHiddenAt: idx % 11 === 0 ? ts : null,
      };
    });

    await prisma.learningAttempt.createMany({ data: [...edgeAttempts, ...historicalAttempts] });

    // 2. Edge case B & C: Multi-device overlapping segments + offline segment crossing Vietnam midnight + unmeasured earlier day!
    // First session anchored 4 days ago (so days[0], days[1] before anchorAt have timeMeasured === false!)
    const firstAnchor = new Date(todayStartUtc.getTime() - 4 * DAY_MS + 3600000);
    const sessEarly = await prisma.learningActivitySession.create({
      data: {
        userId: user.id,
        attemptId: historicalAttempts[0].id,
        clientRunId: randomUUID(),
        anchorAt: firstAnchor,
      },
    });
    // Offline session crossing yesterday's Vietnam midnight (yesterdayMidnightUtc - 10s -> +5s = 10s day before + 5s yesterday)
    const midnightAnchor = new Date(yesterdayMidnightUtc.getTime() - 10000);
    const sessMidnight = await prisma.learningActivitySession.create({
      data: {
        userId: user.id,
        attemptId: edgeAttempts[2].id,
        clientRunId: randomUUID(),
        anchorAt: midnightAnchor,
      },
    });
    // Two concurrent devices today with overlapping intervals: Device 1 [0..15s, 20..35s], Device 2 [10..25s] -> union = [0..35s] = 35s!
    const todayAnchor = new Date(todayStartUtc.getTime() + 600000);
    const sessDeviceA = await prisma.learningActivitySession.create({
      data: {
        userId: user.id,
        attemptId: edgeAttempts[3].id,
        clientRunId: randomUUID(),
        anchorAt: todayAnchor,
      },
    });
    const sessDeviceB = await prisma.learningActivitySession.create({
      data: {
        userId: user.id,
        attemptId: edgeAttempts[3].id,
        clientRunId: randomUUID(),
        anchorAt: todayAnchor,
      },
    });

    await prisma.learningActivitySegment.createMany({
      data: [
        {
          id: randomUUID(),
          sessionId: sessEarly.id,
          seq: 0,
          startOffsetMs: 0,
          endOffsetMs: 12000,
          startAt: firstAnchor,
          endAt: new Date(firstAnchor.getTime() + 12000),
        },
        {
          id: randomUUID(),
          sessionId: sessMidnight.id,
          seq: 0,
          startOffsetMs: 0,
          endOffsetMs: 15000,
          startAt: midnightAnchor,
          endAt: new Date(midnightAnchor.getTime() + 15000),
        },
        {
          id: randomUUID(),
          sessionId: sessDeviceA.id,
          seq: 0,
          startOffsetMs: 0,
          endOffsetMs: 15000,
          startAt: todayAnchor,
          endAt: new Date(todayAnchor.getTime() + 15000),
        },
        {
          id: randomUUID(),
          sessionId: sessDeviceA.id,
          seq: 1,
          startOffsetMs: 20000,
          endOffsetMs: 35000,
          startAt: new Date(todayAnchor.getTime() + 20000),
          endAt: new Date(todayAnchor.getTime() + 35000),
        },
        {
          id: randomUUID(),
          sessionId: sessDeviceB.id,
          seq: 0,
          startOffsetMs: 10000,
          endOffsetMs: 25000,
          startAt: new Date(todayAnchor.getTime() + 10000),
          endAt: new Date(todayAnchor.getTime() + 25000),
        },
      ],
    });

    const [legacyRes, optimizedRes] = await Promise.all([
      legacyProgressReference(prisma, user.id, fixedNow),
      service.progress(user.id, fixedNow),
    ]);

    // Sanity check key edge-case invariants explicitly AND full deep equality!
    expect(optimizedRes.today.activeSeconds).toBe(35);
    expect(optimizedRes.days[0].timeMeasured).toBe(false);
    expect(optimizedRes.days[6].timeMeasured).toBe(true);
    expect(
      optimizedRes.latestResults.find((r) => r.kind === 'GRAMMAR')?.lessonTitle,
    ).toBe('Visible Grammar Snapshot');
    expect(optimizedRes).toEqual(legacyRes);
  });

  it('preserves exact IEEE-754 summation order (submittedAt DESC, id DESC) on 0/3, 1/3, 3/3, 1/6 across all-time, currentWeek, previousWeek, and id tie-breaks', async () => {
    const fixedNow = new Date('2026-11-28T06:30:00.000Z');
    const todayVn = learningDate(fixedNow);
    const todayStartUtc = learningDayStart(todayVn); // 2026-11-27T17:00:00.000Z
    const prevWeekBaseUtc = new Date(todayStartUtc.getTime() - 10 * DAY_MS + 3600000);

    const lessonRow = await prisma.learningLesson.findFirstOrThrow({
      where: { published: true, kind: 'GRAMMAR' },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    const createLearner = async (tag: string) => {
      const created = await prisma.user.create({
        data: {
          email: `progress-fp-${tag}-${randomUUID()}@example.com`,
          name: `IEEE754 ${tag}`,
          profile: {
            create: {
              dailyGoalMinutes: 15,
              targetCefr: 'B1',
              preferredKinds: ['GRAMMAR'],
              onboardingCompletedAt: new Date('2026-11-01T00:00:00.000Z'),
            },
          },
        },
      });
      createdUserIds.push(created.id);
      return created;
    };

    // Learner A:
    // - currentWeek inserted in ASCENDING submittedAt order [1/6, 3/3, 1/3, 0/3]:
    //   heap order sums to 150 / 4 = 37.5 -> 38, whereas submittedAt DESC [0/3, 1/3, 3/3, 1/6] sums to 149.99999999999997 / 4 = 37.49999999999999 -> 37!
    // - previousWeek inserted in ASCENDING submittedAt order [0/3, 1/3, 3/3, 1/6]:
    //   heap order sums to 37.49999999999999 -> 37, whereas submittedAt DESC [1/6, 3/3, 1/3, 0/3] sums to 150 / 4 = 37.5 -> 38!
    const learnerA = await createLearner('window-order');
    const makeAttempt = (
      userId: string,
      id: string,
      correctCount: number,
      totalQuestions: number,
      submittedAt: Date,
    ) => ({
      id,
      userId,
      lessonId: lessonRow.id,
      status: 'COMPLETED' as const,
      version: 1,
      phase: 'QUIZ',
      positionIndex: 0,
      contentVersion: 1,
      totalQuestions,
      correctCount,
      lessonSnapshot: { id: lessonRow.id, kind: 'GRAMMAR', title: lessonRow.title },
      contentSnapshot: lessonRow.content as Prisma.InputJsonValue,
      startedAt: new Date(submittedAt.getTime() - 60000),
      updatedAt: submittedAt,
      submittedAt,
      historyHiddenAt: null,
    });

    await prisma.learningAttempt.createMany({
      data: [
        // currentWeek physical heap order: oldest -> newest ([1/6, 3/3, 1/3, 0/3])
        makeAttempt(learnerA.id, randomUUID(), 1, 6, new Date(todayStartUtc.getTime() + 1000)),
        makeAttempt(learnerA.id, randomUUID(), 3, 3, new Date(todayStartUtc.getTime() + 2000)),
        makeAttempt(learnerA.id, randomUUID(), 1, 3, new Date(todayStartUtc.getTime() + 3000)),
        makeAttempt(learnerA.id, randomUUID(), 0, 3, new Date(todayStartUtc.getTime() + 4000)),
        // previousWeek physical heap order: oldest -> newest ([0/3, 1/3, 3/3, 1/6])
        makeAttempt(learnerA.id, randomUUID(), 0, 3, new Date(prevWeekBaseUtc.getTime() + 1000)),
        makeAttempt(learnerA.id, randomUUID(), 1, 3, new Date(prevWeekBaseUtc.getTime() + 2000)),
        makeAttempt(learnerA.id, randomUUID(), 3, 3, new Date(prevWeekBaseUtc.getTime() + 3000)),
        makeAttempt(learnerA.id, randomUUID(), 1, 6, new Date(prevWeekBaseUtc.getTime() + 4000)),
      ],
    });

    const [legacyA, optimizedA] = await Promise.all([
      legacyProgressReference(prisma, learnerA.id, fixedNow),
      service.progress(learnerA.id, fixedNow),
    ]);
    expect(legacyA.scoreStats.currentWeekAverage).toBe(37);
    expect(legacyA.scoreStats.previousWeekAverage).toBe(38);
    expect(legacyA.scoreStats.deltaPercent).toBe(-1);
    expect(optimizedA).toEqual(legacyA);

    // Learner B & C: Identical submittedAt timestamp where `id DESC` tie-breaker alone flips 37 vs 38!
    const sameTs = new Date(todayStartUtc.getTime() + 3600000);
    const prefixB = randomUUID().slice(0, 24);
    const learnerB = await createLearner('tie-37');
    await prisma.learningAttempt.createMany({
      data: [
        // Physical heap order: 0001..0004 ([1/6, 3/3, 1/3, 0/3]); id DESC order is [0/3, 1/3, 3/3, 1/6] -> 37!
        makeAttempt(learnerB.id, `${prefixB}000000000001`, 1, 6, sameTs),
        makeAttempt(learnerB.id, `${prefixB}000000000002`, 3, 3, sameTs),
        makeAttempt(learnerB.id, `${prefixB}000000000003`, 1, 3, sameTs),
        makeAttempt(learnerB.id, `${prefixB}000000000004`, 0, 3, sameTs),
      ],
    });

    const prefixC = randomUUID().slice(0, 24);
    const learnerC = await createLearner('tie-38');
    await prisma.learningAttempt.createMany({
      data: [
        // Physical heap order: 0001..0004 ([0/3, 1/3, 3/3, 1/6]); id DESC order is [1/6, 3/3, 1/3, 0/3] -> 38!
        makeAttempt(learnerC.id, `${prefixC}000000000001`, 0, 3, sameTs),
        makeAttempt(learnerC.id, `${prefixC}000000000002`, 1, 3, sameTs),
        makeAttempt(learnerC.id, `${prefixC}000000000003`, 3, 3, sameTs),
        makeAttempt(learnerC.id, `${prefixC}000000000004`, 1, 6, sameTs),
      ],
    });

    const [legacyB, optimizedB, legacyC, optimizedC] = await Promise.all([
      legacyProgressReference(prisma, learnerB.id, fixedNow),
      service.progress(learnerB.id, fixedNow),
      legacyProgressReference(prisma, learnerC.id, fixedNow),
      service.progress(learnerC.id, fixedNow),
    ]);
    expect(legacyB.scoreStats.averageScore).toBe(37);
    expect(optimizedB).toEqual(legacyB);
    expect(legacyC.scoreStats.averageScore).toBe(38);
    expect(optimizedC).toEqual(legacyC);
  });
});
