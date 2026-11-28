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

// ===================== SPEAKING PROMPTS =====================

export async function listAdminSpeakingPrompts(params: {
  page: number;
  limit: number;
  search?: string;
  mode?: SpeakingMode | '';
  published?: '' | 'true' | 'false';
  difficulty?: number | '';
}): Promise<PaginatedData<AdminSpeakingPrompt, SpeakingPromptsSummary>> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.mode) qs.set('mode', params.mode);
  if (params.published) qs.set('published', params.published);
  if (params.difficulty) qs.set('difficulty', String(params.difficulty));
  return adminFetch<PaginatedData<AdminSpeakingPrompt, SpeakingPromptsSummary>>(
    `/admin/speaking-prompts?${qs.toString()}`,
  );
}

export async function createAdminSpeakingPrompt(input: {
  code: string;
  mode: SpeakingMode;
  title: string;
  text: string;
  difficulty?: number;
  maxDurationSeconds?: number;
  hints?: string[];
  sampleAsset?: string | null;
  imageUrl?: string | null;
  visualContext?: string | null;
  preparation?: SpeakingPreparationPayload | null;
  linkedReadAloudCodes?: string[];
  sortOrder?: number;
  published?: boolean;
}): Promise<AdminSpeakingPrompt> {
  return adminFetch<AdminSpeakingPrompt>('/admin/speaking-prompts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminSpeakingPrompt(
  id: string,
  input: {
    code?: string;
    mode?: SpeakingMode;
    title?: string;
    text?: string;
    difficulty?: number;
    maxDurationSeconds?: number;
    hints?: string[];
    sampleAsset?: string | null;
    imageUrl?: string | null;
    visualContext?: string | null;
    preparation?: SpeakingPreparationPayload | null;
    linkedReadAloudCodes?: string[];
    sortOrder?: number;
    published?: boolean;
  },
): Promise<AdminSpeakingPrompt> {
  return adminFetch<AdminSpeakingPrompt>(`/admin/speaking-prompts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteAdminSpeakingPrompt(
  id: string,
  force: boolean,
): Promise<{
  id: string;
  action: 'DELETED' | 'UNPUBLISHED';
  submissionsCount: number;
}> {
  return adminFetch<{
    id: string;
    action: 'DELETED' | 'UNPUBLISHED';
    submissionsCount: number;
  }>(`/admin/speaking-prompts/${id}?force=${force ? 'true' : 'false'}`, {
    method: 'DELETE',
  });
}

export async function bulkPublishAdminSpeakingPrompts(
  ids: string[],
  published: boolean,
): Promise<BulkPublishResult> {
  return adminFetch<BulkPublishResult>('/admin/speaking-prompts/bulk-publish', {
    method: 'PATCH',
    body: JSON.stringify({ ids, published }),
  });
}

// ===================== VOICE CONVERSATIONS & SPEAKING OPS =====================

export async function listAdminVoiceConversations(params: {
  page: number;
  limit: number;
  userId?: string;
  status?: string;
  assessmentStatus?: string;
  stuckOnly?: boolean | '' | 'true' | 'false';
  search?: string;
}): Promise<
  PaginatedData<AdminVoiceConversationItem, AdminVoiceConversationsSummary>
> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.userId?.trim()) qs.set('userId', params.userId.trim());
  if (params.status?.trim()) qs.set('status', params.status.trim());
  if (params.assessmentStatus?.trim()) {
    qs.set('assessmentStatus', params.assessmentStatus.trim());
  }
  if (params.stuckOnly === true || params.stuckOnly === 'true') {
    qs.set('stuckOnly', 'true');
  } else if (params.stuckOnly === 'false') {
    qs.set('stuckOnly', 'false');
  }
  if (params.search?.trim()) qs.set('search', params.search.trim());
  return adminFetch<
    PaginatedData<AdminVoiceConversationItem, AdminVoiceConversationsSummary>
  >(`/admin/voice-conversations?${qs.toString()}`);
}

export async function getAdminVoiceConversation(
  id: string,
): Promise<AdminVoiceConversationDetail> {
  return adminFetch<AdminVoiceConversationDetail>(
    `/admin/voice-conversations/${id}`,
  );
}

export async function releaseAdminVoiceConversationLock(
  id: string,
): Promise<ReleaseVoiceConversationLockResult> {
  return adminFetch<ReleaseVoiceConversationLockResult>(
    `/admin/voice-conversations/${id}/release-lock`,
    { method: 'POST' },
  );
}

export async function retryAdminVoiceConversationContent(
  id: string,
): Promise<unknown> {
  return adminFetch<unknown>(
    `/admin/voice-conversations/${id}/retry-content`,
    { method: 'POST' },
  );
}

export async function listAdminSpeakingSubmissions(params: {
  page: number;
  limit: number;
  status?: SpeakingStatus | '';
  mode?: SpeakingMode | '';
  errorCode?: string;
  userId?: string;
  search?: string;
}): Promise<
  PaginatedData<AdminSpeakingSubmissionItem, AdminSpeakingSubmissionsSummary>
> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.status) qs.set('status', params.status);
  if (params.mode) qs.set('mode', params.mode);
  if (params.errorCode?.trim()) qs.set('errorCode', params.errorCode.trim());
  if (params.userId?.trim()) qs.set('userId', params.userId.trim());
  if (params.search?.trim()) qs.set('search', params.search.trim());
  return adminFetch<
    PaginatedData<AdminSpeakingSubmissionItem, AdminSpeakingSubmissionsSummary>
  >(`/admin/speaking-submissions?${qs.toString()}`);
}

export async function getAdminSpeakingSubmission(
  id: string,
): Promise<AdminSpeakingSubmissionDetail> {
  return adminFetch<AdminSpeakingSubmissionDetail>(
    `/admin/speaking-submissions/${id}`,
  );
}

export async function retryAdminSpeakingSubmissionContent(
  id: string,
): Promise<unknown> {
  return adminFetch<unknown>(
    `/admin/speaking-submissions/${id}/retry-content`,
    { method: 'POST' },
  );
}

export async function expireAdminSpeakingSubmission(
  id: string,
): Promise<unknown> {
  return adminFetch<unknown>(`/admin/speaking-submissions/${id}/expire`, {
    method: 'POST',
  });
}

// ===================== SYSTEM & ML READINESS =====================

export async function getAdminSystemReadiness(): Promise<AdminSystemReadinessView> {
  return adminFetch<AdminSystemReadinessView>('/admin/system/readiness');
}

// ===================== AUDIT LOGS & EXPORTS =====================

export async function listAdminAuditLogs(params: {
  page: number;
  limit: number;
  adminEmail?: string;
  resourceType?: string;
  action?: string;
  from?: string;
  to?: string;
}): Promise<PaginatedData<AdminAuditLog>> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.adminEmail?.trim()) qs.set('adminEmail', params.adminEmail.trim());
  if (params.resourceType?.trim()) qs.set('resourceType', params.resourceType.trim());
  if (params.action?.trim()) qs.set('action', params.action.trim());
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  return adminFetch<PaginatedData<AdminAuditLog>>(
    `/admin/audit-logs?${qs.toString()}`,
  );
}

export async function downloadAdminExport(
  entity: AdminExportEntity,
  format: 'json' | 'csv' = 'json',
  retryOnUnauthorized = true,
): Promise<void> {
  return downloadAuthorizedFile(
    `/admin/exports/${entity}?format=${format}`,
    `lingoroad-${entity}-${new Date().toISOString().slice(0, 10)}.${format}`,
    retryOnUnauthorized,
  );
}

// ===================== IMPORT =====================

export async function validateAdminImport(
  bundle: unknown,
  topicWordsMode?: 'replace' | 'merge',
): Promise<ImportValidationResponse> {
  return adminFetch<ImportValidationResponse>('/admin/imports/validate', {
    method: 'POST',
    body: JSON.stringify(
      topicWordsMode ? { bundle, topicWordsMode } : { bundle },
    ),
  });
}

export async function applyAdminImport(
  bundle: unknown,
  topicWordsMode?: 'replace' | 'merge',
): Promise<ImportApplyResponse> {
  return adminFetch<ImportApplyResponse>('/admin/imports/apply', {
    method: 'POST',
    body: JSON.stringify(
      topicWordsMode ? { bundle, topicWordsMode } : { bundle },
    ),
  });
}
