import {
  AuthProvider,
  CefrLevel,
  LearningKind,
  LearningPurpose,
  Prisma,
  SkillLevelSource,
  UserRole,
  UserStatus,
} from '@prisma/client';

export const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  firebaseUid: true,
  provider: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  profile: {
    select: {
      targetCefr: true,
      dailyGoalMinutes: true,
      learningPurpose: true,
      preferredKinds: true,
      selfAssessedCefr: true,
      onboardingCompletedAt: true,
      reminderEnabled: true,
      reminderTime: true,
      preferencesVersion: true,
      reminderVersion: true,
    },
  },
  _count: {
    select: {
      learningAttempts: true,
      placementSessions: true,
      vocabularyDecks: true,
      speakingSubmissions: true,
      voiceConversations: true,
    },
  },
} as const;

export type SelectedAdminUser = Prisma.UserGetPayload<{
  select: typeof ADMIN_USER_SELECT;
}>;

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  hasFirebaseIdentity: boolean;
  provider: AuthProvider;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  profile: {
    targetCefr: CefrLevel;
    dailyGoalMinutes: number;
    learningPurpose?: LearningPurpose | null;
    preferredKinds?: LearningKind[];
    selfAssessedCefr?: CefrLevel | null;
    onboardingCompletedAt?: Date | null;
    reminderEnabled?: boolean;
    reminderTime?: string;
    preferencesVersion?: number;
    reminderVersion?: number;
  } | null;
  stats: {
    learningAttempts: number;
    placementSessions: number;
    vocabularyDecks: number;
    speakingSubmissions: number;
    voiceConversations: number;
  };
}

export interface AdminUserDetail extends AdminUserListItem {
  skillLevels: Array<{
    id: string;
    kind: LearningKind;
    cefrLevel: CefrLevel;
    source: SkillLevelSource;
    previousCefr: CefrLevel | null;
    changedAt: Date | null;
    updatedAt: Date;
  }>;
  skillLevelEvents: Array<{
    id: string;
    attemptId: string;
    kind: LearningKind;
    fromCefr: CefrLevel;
    toCefr: CefrLevel;
    direction: string;
    createdAt: Date;
  }>;
  todayDayPlan: {
    id: string;
    date: string;
    version: number;
    preferencesVersion: number;
    dailyGoalMinutes: number;
    policyVersion: string;
    items: Prisma.JsonValue;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  answerExposuresCount: number;
  recentVoiceConversations: Array<{
    id: string;
    topicId: string;
    topicTitle: string;
    status: string;
    endReason: string | null;
    assessmentStatus: string;
    hasActiveLock: boolean;
    turnsCount: number;
    createdAt: Date;
    startedAt: Date | null;
    endedAt: Date | null;
  }>;
  recentAttempts: Array<{
    id: string;
    lessonTitle: string;
    status: string;
    correctCount: number | null;
    totalQuestions: number;
    startedAt: Date;
    submittedAt: Date | null;
  }>;
  recentPlacements: Array<{
    id: string;
    status: string;
    estimatedCefr: CefrLevel | null;
    correctCount: number;
    totalItems: number;
    startedAt: Date;
    completedAt: Date | null;
  }>;
  recentSpeaking: Array<{
    id: string;
    promptTitle: string;
    status: string;
    overallScore: number | null;
    createdAt: Date;
  }>;
}

export interface AdminUserSessionView {
  id: string;
  deviceIdentifier: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export interface UsersListSummary {
  total: number;
  activeLearners30d: number;
  learners: number;
  admins: number;
}

export interface PaginatedResult<T, S = undefined> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary?: S;
}

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function extractSpeakingOverallScore(result: unknown): number | null {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    return null;
  }
  const resObj = result as Record<string, unknown>;
  for (const key of ['overall', 'pronunciation', 'overallScore', 'score'] as const) {
    const raw = resObj[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.length > 0) {
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
    }
  }
  return null;
}

export function mapUserItem(user: SelectedAdminUser): AdminUserListItem {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    hasFirebaseIdentity: Boolean(user.firebaseUid),
    provider: user.provider,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    profile: user.profile
      ? {
          targetCefr: user.profile.targetCefr,
          dailyGoalMinutes: user.profile.dailyGoalMinutes,
          ...(user.profile.learningPurpose !== undefined
            ? { learningPurpose: user.profile.learningPurpose }
            : {}),
          ...(user.profile.preferredKinds !== undefined
            ? { preferredKinds: user.profile.preferredKinds }
            : {}),
          ...(user.profile.selfAssessedCefr !== undefined
            ? { selfAssessedCefr: user.profile.selfAssessedCefr }
            : {}),
          ...(user.profile.onboardingCompletedAt !== undefined
            ? { onboardingCompletedAt: user.profile.onboardingCompletedAt }
            : {}),
          ...(user.profile.reminderEnabled !== undefined
            ? { reminderEnabled: user.profile.reminderEnabled }
            : {}),
          ...(user.profile.reminderTime !== undefined
            ? { reminderTime: user.profile.reminderTime }
            : {}),
          ...(user.profile.preferencesVersion !== undefined
            ? { preferencesVersion: user.profile.preferencesVersion }
            : {}),
          ...(user.profile.reminderVersion !== undefined
            ? { reminderVersion: user.profile.reminderVersion }
            : {}),
        }
      : null,
    stats: {
      learningAttempts: user._count.learningAttempts,
      placementSessions: user._count.placementSessions,
      vocabularyDecks: user._count.vocabularyDecks,
      speakingSubmissions: user._count.speakingSubmissions,
      voiceConversations: user._count.voiceConversations ?? 0,
    },
  };
}
