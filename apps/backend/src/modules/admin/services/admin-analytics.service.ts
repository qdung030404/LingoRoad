import { Injectable } from '@nestjs/common';
import {
  AssessmentSkill,
  LearningKind,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { CEFR_CAN_DO_DESCRIPTORS } from '../../assessment/constants/cefr-can-do-matrix.constant';
import {
  LISTENING_SKILL_CODES,
  READING_SKILL_CODES,
} from '../../learning/learning.types';
import { PrismaService } from '../../prisma/prisma.service';

export interface SkillMasteryStat {
  group: 'listening' | 'grammar' | 'vocabulary' | 'writing' | 'reading';
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

export interface DashboardOverviewResponse {
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

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(): Promise<DashboardOverviewResponse> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

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
      learningAttemptsTotal,
      learningAttemptsCompleted,
      placementSessionsTotal,
      lessonsByKindRaw,
      distinctItemSkillCodes,
      completedAttempts,
      assessmentResponses,
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
      this.prisma.learningAttempt.count(),
      this.prisma.learningAttempt.count({ where: { status: 'COMPLETED' } }),
      this.prisma.placementSession.count(),
      this.prisma.learningLesson.groupBy({
        by: ['kind'],
        _count: { id: true },
      }),
      this.prisma.assessmentItem.groupBy({
        by: ['skillCode'],
      }),
      this.prisma.learningAttempt.findMany({
        where: { status: 'COMPLETED', correctCount: { not: null } },
        select: {
          correctCount: true,
          totalQuestions: true,
          lesson: { select: { kind: true } },
        },
      }),
      this.prisma.assessmentResponse.findMany({
        select: {
          isCorrect: true,
          item: { select: { skill: true } },
        },
      }),
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
      SkillMasteryStat['group'],
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

    for (const attempt of completedAttempts) {
      const correct = attempt.correctCount ?? 0;
      const total = attempt.totalQuestions;
      if (total <= 0) continue;
      overallCorrect += correct;
      overallTotal += total;

      const kind = attempt.lesson?.kind;
      if (kind === LearningKind.LISTENING) {
        masteryBuckets.listening.correct += correct;
        masteryBuckets.listening.total += total;
      } else if (kind === LearningKind.GRAMMAR) {
        masteryBuckets.grammar.correct += correct;
        masteryBuckets.grammar.total += total;
      } else if (kind === LearningKind.VOCABULARY) {
        masteryBuckets.vocabulary.correct += correct;
        masteryBuckets.vocabulary.total += total;
      } else if (kind === LearningKind.READING) {
        masteryBuckets.reading.correct += correct;
        masteryBuckets.reading.total += total;
      }
    }

    for (const resp of assessmentResponses) {
      overallTotal += 1;
      if (resp.isCorrect) overallCorrect += 1;
      const skill = resp.item?.skill;
      if (skill === AssessmentSkill.LISTENING) {
        masteryBuckets.listening.total += 1;
        if (resp.isCorrect) masteryBuckets.listening.correct += 1;
      } else if (skill === AssessmentSkill.READING) {
        masteryBuckets.reading.total += 1;
        if (resp.isCorrect) masteryBuckets.reading.correct += 1;
      } else if (skill === AssessmentSkill.WRITING) {
        masteryBuckets.writing.total += 1;
        if (resp.isCorrect) masteryBuckets.writing.correct += 1;
      }
    }

    const masteryOrder: SkillMasteryStat['group'][] = [
      'listening',
      'grammar',
      'vocabulary',
      'writing',
      'reading',
    ];
    const masteryBySkill: SkillMasteryStat[] = masteryOrder.map((group) => {
      const bucket = masteryBuckets[group];
      return {
        group,
        sampleCount: bucket.total,
        accuracyPercent:
          bucket.total > 0
            ? Math.round((bucket.correct / bucket.total) * 100)
            : 0,
      };
    });

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

    return {
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
      recentActivities: mergedActivities,
      recentUsers,
    };
  }
}
