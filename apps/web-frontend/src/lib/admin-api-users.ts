import type {
  AdminAssessmentGroup,
  AdminAssessmentItem,
  AdminAuditLog,
  AdminAuthSession,
  AdminCuratedTopic,
  AdminCuratedWord,
  AdminExportEntity,
  AdminGrammarTopic,
  AdminLessonItem,
  AdminMediaAudioUploadResult,
  AdminMediaImageUploadResult,
  AdminOrphanMediaCleanupResult,
  AdminOrphanMediaScanResult,
  AdminPlacementSessionDetail,
  AdminSpeakingPrompt,
  AdminSpeakingSubmissionDetail,
  AdminSpeakingSubmissionItem,
  AdminSpeakingSubmissionsSummary,
  AdminSystemReadinessView,
  AdminUser,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserSessionView,
  AdminUserSkillLevelOverrideResult,
  AdminVoiceConversationDetail,
  AdminVoiceConversationItem,
  AdminVoiceConversationsSummary,
  AssessmentItemsSummary,
  AssessmentSkill,
  BulkPublishResult,
  CefrDescriptorItem,
  CefrLevel,
  DashboardOverview,
  DashboardTimeframe,
  GrammarExampleItem,
  GrammarFormulaItem,
  GrammarUsageItem,
  ImportApplyResponse,
  ImportValidationResponse,
  ItemType,
  ItemUsageScope,
  LearningContentPayload,
  LearningKind,
  LearningPurpose,
  LearningUnitItem,
  LessonsListSummary,
  PaginatedData,
  ReleaseVoiceConversationLockResult,
  ResetPlacementRetakeResult,
  SpeakingMode,
  SpeakingPreparationPayload,
  SpeakingPromptsSummary,
  SpeakingStatus,
  UserRole,
  UserStatus,
  UsersListSummary,
} from '../types/admin';
import { adminFetch, downloadAuthorizedFile } from './admin-api-client';

// ===================== USERS =====================

export async function listAdminUsers(params: {
  page: number;
  limit: number;
  search?: string;
  role?: UserRole | '';
  status?: UserStatus | '';
}): Promise<PaginatedData<AdminUserListItem, UsersListSummary>> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.role) qs.set('role', params.role);
  if (params.status) qs.set('status', params.status);
  return adminFetch<PaginatedData<AdminUserListItem, UsersListSummary>>(
    `/admin/users?${qs.toString()}`,
  );
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail> {
  return adminFetch<AdminUserDetail>(`/admin/users/${userId}`);
}

export async function createAdminUser(input: {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  targetCefr: CefrLevel;
}): Promise<AdminUserListItem> {
  return adminFetch<AdminUserListItem>('/admin/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminUser(
  userId: string,
  input: {
    name?: string;
    role?: UserRole;
    status?: UserStatus;
    password?: string;
    targetCefr?: CefrLevel;
    dailyGoalMinutes?: number;
    learningPurpose?: LearningPurpose | null;
    preferredKinds?: LearningKind[];
    selfAssessedCefr?: CefrLevel | null;
    reminderEnabled?: boolean;
    reminderTime?: string;
  },
): Promise<AdminUserListItem> {
  return adminFetch<AdminUserListItem>(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function overrideAdminUserSkillLevel(
  userId: string,
  kind: LearningKind,
  input: {
    cefrLevel: CefrLevel;
    resetExposures?: boolean;
  },
): Promise<AdminUserSkillLevelOverrideResult> {
  return adminFetch<AdminUserSkillLevelOverrideResult>(
    `/admin/users/${userId}/skill-levels/${kind}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export async function getAdminUserPlacementDetail(
  userId: string,
  sessionId: string,
): Promise<AdminPlacementSessionDetail> {
  return adminFetch<AdminPlacementSessionDetail>(
    `/admin/users/${userId}/placements/${sessionId}`,
  );
}

export async function resetAdminUserPlacementRetake(
  userId: string,
  input: { resetSkillLevels?: boolean } = {},
): Promise<ResetPlacementRetakeResult> {
  return adminFetch<ResetPlacementRetakeResult>(
    `/admin/users/${userId}/placements/reset-retake`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function listAdminUserSessions(
  userId: string,
): Promise<AdminUserSessionView[]> {
  return adminFetch<AdminUserSessionView[]>(`/admin/users/${userId}/sessions`);
}

export async function revokeAdminUserSession(
  userId: string,
  sessionId: string,
): Promise<{ id: string; revoked: boolean }> {
  return adminFetch<{ id: string; revoked: boolean }>(
    `/admin/users/${userId}/sessions/${sessionId}`,
    { method: 'DELETE' },
  );
}

export async function revokeAllAdminUserSessions(
  userId: string,
): Promise<{ userId: string; revokedSessionsCount: number }> {
  return adminFetch<{ userId: string; revokedSessionsCount: number }>(
    `/admin/users/${userId}/sessions/revoke-all`,
    { method: 'POST' },
  );
}

export async function downloadAdminUserExport(
  userId: string,
  retryOnUnauthorized = true,
): Promise<void> {
  const fallbackName = `lingoroad-user-${userId}-${new Date().toISOString().slice(0, 10)}.json`;
  return downloadAuthorizedFile(
    `/admin/users/${userId}/export`,
    fallbackName,
    retryOnUnauthorized,
  );
}

export async function deleteAdminUser(
  userId: string,
  hard: boolean,
): Promise<{ id: string; action: 'HARD_DELETED' | 'SOFT_DELETED' }> {
  return adminFetch<{ id: string; action: 'HARD_DELETED' | 'SOFT_DELETED' }>(
    `/admin/users/${userId}?hard=${hard ? 'true' : 'false'}`,
    { method: 'DELETE' },
  );
}
