import { LearningKind, UserRole, UserStatus } from '@prisma/client';

export type DashboardTimeframe = '7_DAYS' | '30_DAYS' | '90_DAYS' | 'ALL_TIME';

export interface SkillMasteryStat {
  group:
    | 'listening'
    | 'grammar'
    | 'vocabulary'
    | 'writing'
    | 'reading'
    | 'speaking';
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

export const DASHBOARD_CACHE_TTL_SECONDS = 900;
export const FORCE_REFRESH_COOLDOWN_MS = 15_000;
export const DASHBOARD_TIMEFRAMES: readonly DashboardTimeframe[] = [
  '7_DAYS',
  '30_DAYS',
  '90_DAYS',
  'ALL_TIME',
];

export function normalizeTimeframe(raw?: string): DashboardTimeframe {
  if (
    raw === '7_DAYS' ||
    raw === '30_DAYS' ||
    raw === '90_DAYS' ||
    raw === 'ALL_TIME'
  ) {
    return raw;
  }
  return '30_DAYS';
}

export function getTimeframeStartDate(
  timeframe: DashboardTimeframe,
): Date | null {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (timeframe === '7_DAYS') return new Date(now - 7 * dayMs);
  if (timeframe === '30_DAYS') return new Date(now - 30 * dayMs);
  if (timeframe === '90_DAYS') return new Date(now - 90 * dayMs);
  return null;
}
