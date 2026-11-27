import { Injectable, Optional } from '@nestjs/common';
import {
  AssessmentSkill,
  LearningKind,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { CEFR_CAN_DO_DESCRIPTORS } from '../../assessment/constants/cefr-can-do-matrix.constant';
import { AssessmentCacheService } from '../../assessment/services/assessment-cache.service';
import {
  LISTENING_SKILL_CODES,
  READING_SKILL_CODES,
} from '../../learning/learning.types';
import { PrismaService } from '../../prisma/prisma.service';

export type DashboardTimeframe = '7_DAYS' | '30_DAYS' | '90_DAYS' | 'ALL_TIME';

export interface SkillMasteryStat {
  group: 'listening' | 'grammar' | 'vocabulary' | 'writing' | 'reading' | 'speaking';
  accuracyPercent: number;
  sampleCount: number;
}

export interface RecentActivityItem {
  id: string;
  action: string;
  target: string;
  actorEmail: string;
  createdAt: Date;
}

export interface CefrAttemptStat {
  cefrLevel: string;
  count: number;
}

export interface LearningTrendPoint {
  bucket: string;
  attempts: number;
  activeUsers: number;
}

export interface HardAssessmentItemAlert {
  id: string;
  externalId: string | null;
  skillCode: string;
  cefrLevel: string;
  prompt: string;
  totalResponses: number;
  wrongRatePercent: number;
}

export interface DashboardOverviewResponse {
  timeframe: DashboardTimeframe;
  generatedAt: string;
  users: {
    total: number;
    learners: number;
    admins: number;
    active: number;
    suspended: number;
    active30d: number;
  };
  content: {
    skillsTotal: number;
    unitsTotal: number;
    lessonsTotal: number;
    lessonsPublished: number;
    assessmentItemsTotal: number;
    speakingPromptsTotal: number;
    curatedTopicsTotal: number;
    grammarTopicsTotal: number;
  };
  activity: {
    learningAttemptsTotal: number;
    learningAttemptsCompleted: number;
    placementSessionsTotal: number;
    totalAnsweredQuestions: number;
    accuracyPercent: number;
  };
  lessonsByKind: Array<{ kind: LearningKind; count: number }>;
  masteryBySkill: SkillMasteryStat[];
  attemptsByCefr: CefrAttemptStat[];
  learningTrend: LearningTrendPoint[];
  hardItems: HardAssessmentItemAlert[];
  recentActivities: RecentActivityItem[];
  recentUsers: Array<{
    id: string;
    email: string;
    name: string;
    role: UserRole;
    status: UserStatus;
    createdAt: Date;
  }>;
}

const DASHBOARD_CACHE_TTL_SECONDS = 900;

function normalizeTimeframe(raw?: string): DashboardTimeframe {
  if (raw === '7_DAYS' || raw === '30_DAYS' || raw === '90_DAYS' || raw === 'ALL_TIME') {
    return raw;
  }
  return '30_DAYS';
}

function getTimeframeStartDate(timeframe: DashboardTimeframe): Date | null {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (timeframe === '7_DAYS') return new Date(now - 7 * dayMs);
  if (timeframe === '30_DAYS') return new Date(now - 30 * dayMs);
  if (timeframe === '90_DAYS') return new Date(now - 90 * dayMs);
  return null;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly cacheService?: AssessmentCacheService,
  ) {}

  async getDashboard(
    rawTimeframe?: string,
    forceRefresh = false,
  ): Promise<DashboardOverviewResponse> {
    const timeframe = normalizeTimeframe(rawTimeframe);
    const cacheKey = `lingoroad:admin:dashboard:${timeframe}`;

    if (!forceRefresh && this.cacheService) {
      const cached = await this.cacheService.get<DashboardOverviewResponse>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sinceDate = getTimeframeStartDate(timeframe);
    const bucketUnit =
      timeframe === '7_DAYS' || timeframe === '30_DAYS' ? 'day' : 'week';

    const attemptDateWhere = sinceDate ? { startedAt: { gte: sinceDate } } : {};
    const placementDateWhere = sinceDate ? { startedAt: { gte: sinceDate } } : {};

    const [
      totalUsers,
      learnerUsers,
      adminUsers,
      activeUsers,
      suspendedUsers,
      active30dCount,
      lessonsTotal,
      lessonsPublished,
      unitsTotal,
      assessmentItemsTotal,
      speakingPromptsTotal,
      curatedTopicsTotal,
      grammarTopicsTotal,
      learningAttemptsTotal,
      learningAttemptsCompleted,
      placementSessionsTotal,
      lessonsByKindRaw,
      distinctItemSkillCodes,
      lessonMasteryRows,
      assessmentMasteryRows,
      speakingMasteryRows,
      attemptsByCefrRows,
      learningTrendRows,
      hardItemRows,
      recentUsers,
      recentCompletedAttempts,
      recentCompletedPlacements,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.LEARNER } }),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.user.count({
        where: {
          role: UserRole.LEARNER,
          OR: [
            { learningAttempts: { some: { startedAt: { gte: thirtyDaysAgo } } } },
            { placementSessions: { some: { startedAt: { gte: thirtyDaysAgo } } } },
            { vocabularyReviews: { some: { startedAt: { gte: thirtyDaysAgo } } } },
            { speakingSubmissions: { some: { createdAt: { gte: thirtyDaysAgo } } } },
          ],
        },
      }),
      this.prisma.learningLesson.count(),
      this.prisma.learningLesson.count({ where: { published: true } }),
      this.prisma.learningUnit.count(),
      this.prisma.assessmentItem.count(),
      this.prisma.speakingPrompt.count(),
      this.prisma.curatedTopic.count(),
      this.prisma.grammarTopic.count(),
      this.prisma.learningAttempt.count({ where: attemptDateWhere }),
      this.prisma.learningAttempt.count({
        where: { ...attemptDateWhere, status: 'COMPLETED' },
      }),
      this.prisma.placementSession.count({ where: placementDateWhere }),
      this.prisma.learningLesson.groupBy({
        by: ['kind'],
        _count: { id: true },
      }),
      this.prisma.assessmentItem.groupBy({
        by: ['skillCode'],
      }),
      this.prisma.$queryRaw<
        Array<{ kind: LearningKind; correct_sum: bigint | number; total_sum: bigint | number }>
      >(
        sinceDate
          ? Prisma.sql`
              SELECT ll.kind AS kind,
                     COALESCE(SUM(la.correct_count), 0) AS correct_sum,
                     COALESCE(SUM(la.total_questions), 0) AS total_sum
              FROM learning_attempts la
              INNER JOIN learning_lessons ll ON ll.id = la.lesson_id
              WHERE la.status = 'COMPLETED'
                AND la.correct_count IS NOT NULL
                AND la.total_questions > 0
                AND la.started_at >= ${sinceDate}
              GROUP BY ll.kind
            `
          : Prisma.sql`
              SELECT ll.kind AS kind,
                     COALESCE(SUM(la.correct_count), 0) AS correct_sum,
                     COALESCE(SUM(la.total_questions), 0) AS total_sum
              FROM learning_attempts la
              INNER JOIN learning_lessons ll ON ll.id = la.lesson_id
              WHERE la.status = 'COMPLETED'
                AND la.correct_count IS NOT NULL
                AND la.total_questions > 0
              GROUP BY ll.kind
            `,
      ),
      this.prisma.$queryRaw<
        Array<{ skill: AssessmentSkill | null; correct_count: bigint | number; total_count: bigint | number }>
      >(
        sinceDate
          ? Prisma.sql`
              SELECT ai.skill AS skill,
                     SUM(CASE WHEN ar.is_correct THEN 1 ELSE 0 END) AS correct_count,
                     COUNT(*) AS total_count
              FROM assessment_responses ar
              INNER JOIN assessment_items ai ON ai.id = ar.item_id
              WHERE ar.created_at >= ${sinceDate}
              GROUP BY ai.skill
            `
          : Prisma.sql`
              SELECT ai.skill AS skill,
                     SUM(CASE WHEN ar.is_correct THEN 1 ELSE 0 END) AS correct_count,
                     COUNT(*) AS total_count
              FROM assessment_responses ar
              INNER JOIN assessment_items ai ON ai.id = ar.item_id
              GROUP BY ai.skill
            `,
      ),
      this.prisma.$queryRaw<
        Array<{ avg_score: number | null; sample_count: bigint | number }>
      >(
        sinceDate
          ? Prisma.sql`
              SELECT AVG(
                       CASE
                         WHEN (ss.result->>'overallScore') ~ '^[0-9]+(\.[0-9]+)?$' THEN (ss.result->>'overallScore')::numeric
                         WHEN (ss.result->>'score') ~ '^[0-9]+(\.[0-9]+)?$' THEN (ss.result->>'score')::numeric
                         ELSE NULL
                       END
                     )::double precision AS avg_score,
                     COUNT(*) AS sample_count
              FROM speaking_submissions ss
              WHERE ss.status = 'SUCCEEDED'
                AND ss.created_at >= ${sinceDate}
            `
          : Prisma.sql`
              SELECT AVG(
                       CASE
                         WHEN (ss.result->>'overallScore') ~ '^[0-9]+(\.[0-9]+)?$' THEN (ss.result->>'overallScore')::numeric
                         WHEN (ss.result->>'score') ~ '^[0-9]+(\.[0-9]+)?$' THEN (ss.result->>'score')::numeric
                         ELSE NULL
                       END
                     )::double precision AS avg_score,
                     COUNT(*) AS sample_count
              FROM speaking_submissions ss
              WHERE ss.status = 'SUCCEEDED'
            `,
      ),
      this.prisma.$queryRaw<Array<{ cefr_level: string; attempt_count: bigint | number }>>(
        sinceDate
          ? Prisma.sql`
              SELECT COALESCE(lu.cefr_level::text, 'UNASSIGNED') AS cefr_level,
                     COUNT(*) AS attempt_count
              FROM learning_attempts la
              INNER JOIN learning_lessons ll ON ll.id = la.lesson_id
              LEFT JOIN learning_units lu ON lu.id = ll.unit_id
              WHERE la.started_at >= ${sinceDate}
              GROUP BY COALESCE(lu.cefr_level::text, 'UNASSIGNED')
              ORDER BY cefr_level ASC
            `
          : Prisma.sql`
              SELECT COALESCE(lu.cefr_level::text, 'UNASSIGNED') AS cefr_level,
                     COUNT(*) AS attempt_count
              FROM learning_attempts la
              INNER JOIN learning_lessons ll ON ll.id = la.lesson_id
              LEFT JOIN learning_units lu ON lu.id = ll.unit_id
              GROUP BY COALESCE(lu.cefr_level::text, 'UNASSIGNED')
              ORDER BY cefr_level ASC
            `,
      ),
      this.prisma.$queryRaw<
        Array<{ bucket: Date; attempts: bigint | number; active_users: bigint | number }>
      >(
        sinceDate
          ? Prisma.sql`
              SELECT DATE_TRUNC(${bucketUnit}, la.started_at) AS bucket,
                     COUNT(*) AS attempts,
                     COUNT(DISTINCT la.user_id) AS active_users
              FROM learning_attempts la
              WHERE la.started_at >= ${sinceDate}
              GROUP BY DATE_TRUNC(${bucketUnit}, la.started_at)
              ORDER BY bucket ASC
            `
          : Prisma.sql`
              SELECT DATE_TRUNC(${bucketUnit}, la.started_at) AS bucket,
                     COUNT(*) AS attempts,
                     COUNT(DISTINCT la.user_id) AS active_users
              FROM learning_attempts la
              GROUP BY DATE_TRUNC(${bucketUnit}, la.started_at)
              ORDER BY bucket ASC
            `,
      ),
      this.prisma.$queryRaw<
        Array<{
          id: string;
          external_id: string | null;
          skill_code: string;
          cefr_level: string;
          prompt: string;
          total_responses: bigint | number;
          wrong_rate_percent: number;
        }>
      >(Prisma.sql`
        SELECT ai.id,
               ai.external_id,
               ai.skill_code,
               ai.cefr_level::text AS cefr_level,
               ai.prompt,
               COUNT(ar.id) AS total_responses,
               ROUND((SUM(CASE WHEN ar.is_correct THEN 0 ELSE 1 END)::numeric / COUNT(ar.id)::numeric) * 100)::int AS wrong_rate_percent
        FROM assessment_items ai
        INNER JOIN assessment_responses ar ON ar.item_id = ai.id
        GROUP BY ai.id, ai.external_id, ai.skill_code, ai.cefr_level, ai.prompt
        HAVING COUNT(ar.id) >= 5
           AND (SUM(CASE WHEN ar.is_correct THEN 0 ELSE 1 END)::numeric / COUNT(ar.id)::numeric) > 0.75
        ORDER BY wrong_rate_percent DESC, total_responses DESC
        LIMIT 10
      `),
      this.prisma.user.findMany({
        take: 5,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.learningAttempt.findMany({
        where: { status: 'COMPLETED', submittedAt: { not: null } },
        take: 5,
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          submittedAt: true,
          lessonSnapshot: true,
          user: { select: { email: true } },
        },
      }),
      this.prisma.placementSession.findMany({
        where: { status: 'COMPLETED', completedAt: { not: null } },
        take: 5,
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          estimatedCefr: true,
          completedAt: true,
          user: { select: { email: true } },
        },
      }),
    ]);

    const skillSet = new Set<string>([
      ...CEFR_CAN_DO_DESCRIPTORS.map((d) => d.skillCode),
      ...READING_SKILL_CODES,
      ...LISTENING_SKILL_CODES,
      ...distinctItemSkillCodes.map((row) => row.skillCode),
    ]);

    const masteryBuckets: Record<
      Exclude<SkillMasteryStat['group'], 'speaking'>,
      { correct: number; total: number }
    > = {
      listening: { correct: 0, total: 0 },
      grammar: { correct: 0, total: 0 },
      vocabulary: { correct: 0, total: 0 },
      writing: { correct: 0, total: 0 },
      reading: { correct: 0, total: 0 },
    };

    let overallCorrect = 0;
    let overallTotal = 0;

    for (const row of lessonMasteryRows) {
      const correct = Number(row.correct_sum ?? 0);
      const total = Number(row.total_sum ?? 0);
      if (total <= 0) continue;
      overallCorrect += correct;
      overallTotal += total;

      if (row.kind === LearningKind.LISTENING) {
        masteryBuckets.listening.correct += correct;
        masteryBuckets.listening.total += total;
      } else if (row.kind === LearningKind.GRAMMAR) {
        masteryBuckets.grammar.correct += correct;
        masteryBuckets.grammar.total += total;
      } else if (row.kind === LearningKind.VOCABULARY) {
        masteryBuckets.vocabulary.correct += correct;
        masteryBuckets.vocabulary.total += total;
      } else if (row.kind === LearningKind.READING) {
        masteryBuckets.reading.correct += correct;
        masteryBuckets.reading.total += total;
      }
    }

    for (const row of assessmentMasteryRows) {
      const correct = Number(row.correct_count ?? 0);
      const total = Number(row.total_count ?? 0);
      if (total <= 0) continue;
      overallCorrect += correct;
      overallTotal += total;

      if (row.skill === AssessmentSkill.LISTENING) {
        masteryBuckets.listening.correct += correct;
        masteryBuckets.listening.total += total;
      } else if (row.skill === AssessmentSkill.READING) {
        masteryBuckets.reading.correct += correct;
        masteryBuckets.reading.total += total;
      } else if (row.skill === AssessmentSkill.WRITING) {
        masteryBuckets.writing.correct += correct;
        masteryBuckets.writing.total += total;
      }
    }

    const speakingRow = speakingMasteryRows[0];
    const speakingSampleCount = Number(speakingRow?.sample_count ?? 0);
    const speakingAvg =
      typeof speakingRow?.avg_score === 'number' && Number.isFinite(speakingRow.avg_score)
        ? Math.min(100, Math.max(0, Math.round(speakingRow.avg_score)))
        : 0;

    const masteryOrder: Array<Exclude<SkillMasteryStat['group'], 'speaking'>> = [
      'listening',
      'grammar',
      'vocabulary',
      'writing',
      'reading',
    ];
    const masteryBySkill: SkillMasteryStat[] = [
      ...masteryOrder.map((group) => {
        const bucket = masteryBuckets[group];
        return {
          group,
          sampleCount: bucket.total,
          accuracyPercent:
            bucket.total > 0
              ? Math.round((bucket.correct / bucket.total) * 100)
              : 0,
        };
      }),
      {
        group: 'speaking',
        sampleCount: speakingSampleCount,
        accuracyPercent: speakingAvg,
      },
    ];

    const kindMap = new Map<LearningKind, number>(
      lessonsByKindRaw.map((row) => [row.kind, row._count.id]),
    );
    const orderedKinds: LearningKind[] = [
      LearningKind.GRAMMAR,
      LearningKind.VOCABULARY,
      LearningKind.READING,
      LearningKind.LISTENING,
    ];

    const mergedActivities: RecentActivityItem[] = [
      ...recentCompletedAttempts.map((item) => {
        const title =
          (item.lessonSnapshot as { title?: string })?.title || 'bài học';
        return {
          id: `attempt-${item.id}`,
          action: 'complete · learning_lesson',
          target: title,
          actorEmail: item.user.email,
          createdAt: item.submittedAt!,
        };
      }),
      ...recentCompletedPlacements.map((item) => ({
        id: `placement-${item.id}`,
        action: 'complete · placement_test',
        target: item.estimatedCefr ? `CEFR ${item.estimatedCefr}` : 'Đánh giá đầu vào',
        actorEmail: item.user.email,
        createdAt: item.completedAt!,
      })),
      ...recentUsers.map((user) => ({
        id: `user-${user.id}`,
        action: 'register · user_account',
        target: user.name,
        actorEmail: user.email,
        createdAt: user.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5);

    const response: DashboardOverviewResponse = {
      timeframe,
      generatedAt: new Date().toISOString(),
      users: {
        total: totalUsers,
        learners: learnerUsers,
        admins: adminUsers,
        active: activeUsers,
        suspended: suspendedUsers,
        active30d: active30dCount,
      },
      content: {
        skillsTotal: skillSet.size,
        unitsTotal,
        lessonsTotal,
        lessonsPublished,
        assessmentItemsTotal,
        speakingPromptsTotal,
        curatedTopicsTotal,
        grammarTopicsTotal,
      },
      activity: {
        learningAttemptsTotal,
        learningAttemptsCompleted,
        placementSessionsTotal,
        totalAnsweredQuestions: overallTotal,
        accuracyPercent:
          overallTotal > 0
            ? Math.round((overallCorrect / overallTotal) * 100)
            : 0,
      },
      lessonsByKind: orderedKinds.map((kind) => ({
        kind,
        count: kindMap.get(kind) ?? 0,
      })),
      masteryBySkill,
      attemptsByCefr: attemptsByCefrRows.map((r) => ({
        cefrLevel: r.cefr_level,
        count: Number(r.attempt_count ?? 0),
      })),
      learningTrend: learningTrendRows.map((r) => ({
        bucket:
          r.bucket instanceof Date
            ? r.bucket.toISOString().slice(0, 10)
            : String(r.bucket).slice(0, 10),
        attempts: Number(r.attempts ?? 0),
        activeUsers: Number(r.active_users ?? 0),
      })),
      hardItems: hardItemRows.map((r) => ({
        id: r.id,
        externalId: r.external_id,
        skillCode: r.skill_code,
        cefrLevel: r.cefr_level,
        prompt: r.prompt.slice(0, 140),
        totalResponses: Number(r.total_responses ?? 0),
        wrongRatePercent: Number(r.wrong_rate_percent ?? 0),
      })),
      recentActivities: mergedActivities,
      recentUsers,
    };

    if (this.cacheService) {
      await this.cacheService.set(cacheKey, response, DASHBOARD_CACHE_TTL_SECONDS);
    }

    return response;
  }
}
