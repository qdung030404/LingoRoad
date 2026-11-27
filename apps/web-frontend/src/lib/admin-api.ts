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
  AdminSpeakingPrompt,
  AdminUser,
  AdminUserDetail,
  AdminUserListItem,
  AssessmentItemsSummary,
  AssessmentSkill,
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
  SpeakingMode,
  SpeakingPreparationPayload,
  SpeakingPromptsSummary,
  UserRole,
  UserStatus,
  UsersListSummary,
} from '../types/admin';

const SESSION_KEY = 'lingoroad_admin_session';

export function validateCloudApiBaseUrl(rawUrl?: string): string {
  const value = rawUrl?.trim() ?? '';
  if (!value) {
    throw new Error(
      'NEXT_PUBLIC_API_URL không được để trống trên bản phát hành cloud.',
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`NEXT_PUBLIC_API_URL không hợp lệ: "${value}".`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(
      `NEXT_PUBLIC_API_URL trên cloud bắt buộc dùng HTTPS (nhận được "${parsed.protocol}").`,
    );
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  ) {
    throw new Error(
      `NEXT_PUBLIC_API_URL trên cloud không được dùng localhost/nội bộ (nhận được "${host}").`,
    );
  }
  return value.replace(/\/+$/, '');
}

export function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!configured) {
    throw new Error('NEXT_PUBLIC_API_URL chưa được cấu hình.');
  }
  return configured.replace(/\/+$/, '');
}

export interface FrontendHealthPayload {
  success: true;
  data: {
    status: 'ok';
    service: 'web-frontend';
    version: string;
    timestamp: string;
  };
}

export function buildFrontendHealthPayload(
  env: NodeJS.ProcessEnv = process.env,
): FrontendHealthPayload {
  const version =
    env.APP_VERSION?.trim() ||
    env.NEXT_PUBLIC_APP_VERSION?.trim() ||
    '1.0.0';

  return {
    success: true,
    data: {
      status: 'ok',
      service: 'web-frontend',
      version,
      timestamp: new Date().toISOString(),
    },
  };
}

export function resolveAdminMediaUrl(mediaPathOrUrl: string): string {
  const trimmed = mediaPathOrUrl.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const normalizedPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${apiBaseUrl()}${normalizedPath}`;
}

export function getStoredAdminSession(): AdminAuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdminAuthSession>;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user) {
      return null;
    }
    return parsed as AdminAuthSession;
  } catch {
    return null;
  }
}

export function saveAdminSession(session: AdminAuthSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearAdminSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SESSION_KEY);
}

interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
}

export class AdminApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
  }
}

async function parseJsonSafe<T>(response: Response): Promise<ApiEnvelope<T> | null> {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return null;
  }
}

let refreshPromise: Promise<AdminAuthSession | null> | null = null;

async function refreshAdminSession(): Promise<AdminAuthSession | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const current = getStoredAdminSession();
    if (!current?.refreshToken) return null;

    try {
      const response = await fetch(`${apiBaseUrl()}/admin/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      const payload = await parseJsonSafe<AdminAuthSession>(response);
      if (!response.ok || !payload?.success || !payload.data) {
        clearAdminSession();
        return null;
      }
      saveAdminSession(payload.data);
      return payload.data;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function adminFetch<T>(
  path: string,
  options: RequestInit = {},
  retryOnUnauthorized = true,
): Promise<T> {
  const session = getStoredAdminSession();
  const headers = new Headers(options.headers);
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!headers.has('Content-Type') && options.body && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && retryOnUnauthorized && session?.refreshToken) {
    const refreshed = await refreshAdminSession();
    if (refreshed) {
      return adminFetch<T>(path, options, false);
    }
    clearAdminSession();
  }

  const payload = await parseJsonSafe<T>(response);
  if (!response.ok || !payload?.success) {
    const errMessage =
      payload?.error?.message ||
      payload?.message ||
      `Yêu cầu thất bại (HTTP ${response.status})`;
    throw new AdminApiError(errMessage, response.status, payload?.error?.code);
  }

  return payload.data as T;
}

// ===================== AUTH =====================

export async function adminLogin(
  email: string,
  password: string,
): Promise<AdminAuthSession> {
  const response = await fetch(`${apiBaseUrl()}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const payload = await parseJsonSafe<AdminAuthSession>(response);
  if (!response.ok || !payload?.success || !payload.data) {
    throw new AdminApiError(
      payload?.error?.message || 'Đăng nhập quản trị thất bại.',
      response.status,
      payload?.error?.code,
    );
  }
  saveAdminSession(payload.data);
  return payload.data;
}

export async function adminLogout(): Promise<void> {
  const session = getStoredAdminSession();
  clearAdminSession();
  if (!session?.refreshToken) return;
  try {
    await fetch(`${apiBaseUrl()}/admin/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
  } catch {
    // Bỏ qua lỗi mạng khi đăng xuất cục bộ
  }
}

export async function getAdminMe(): Promise<AdminUser> {
  return adminFetch<AdminUser>('/admin/auth/me');
}

// ===================== MEDIA UPLOAD =====================

export async function uploadAdminImage(
  file: File,
  slug?: string,
): Promise<AdminMediaImageUploadResult> {
  const form = new FormData();
  form.append('file', file);
  const qs = new URLSearchParams();
  if (slug?.trim()) qs.set('slug', slug.trim());
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return adminFetch<AdminMediaImageUploadResult>(`/admin/media/images${suffix}`, {
    method: 'POST',
    body: form,
  });
}

export async function uploadAdminAudio(
  file: File,
  scope: 'learning' | 'placement' = 'learning',
  slug?: string,
): Promise<AdminMediaAudioUploadResult> {
  const form = new FormData();
  form.append('file', file);
  const qs = new URLSearchParams({ scope });
  if (slug?.trim()) qs.set('slug', slug.trim());
  return adminFetch<AdminMediaAudioUploadResult>(
    `/admin/media/audio?${qs.toString()}`,
    {
      method: 'POST',
      body: form,
    },
  );
}

// ===================== DASHBOARD =====================

export async function getDashboardOverview(
  timeframe?: DashboardTimeframe,
  forceRefresh = false,
): Promise<DashboardOverview> {
  const qs = new URLSearchParams();
  if (timeframe) qs.set('timeframe', timeframe);
  if (forceRefresh) qs.set('forceRefresh', 'true');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return adminFetch<DashboardOverview>(`/admin/analytics/dashboard${suffix}`);
}

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
  },
): Promise<AdminUserListItem> {
  return adminFetch<AdminUserListItem>(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
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

// ===================== UNITS =====================

export async function listLearningUnits(): Promise<LearningUnitItem[]> {
  return adminFetch<LearningUnitItem[]>('/admin/units');
}

export async function createLearningUnit(input: {
  code: string;
  cefrLevel: CefrLevel;
  orderIndex: number;
  title: string;
  description: string;
}): Promise<LearningUnitItem> {
  return adminFetch<LearningUnitItem>('/admin/units', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateLearningUnit(
  id: string,
  input: {
    code?: string;
    cefrLevel?: CefrLevel;
    orderIndex?: number;
    title?: string;
    description?: string;
  },
): Promise<LearningUnitItem> {
  return adminFetch<LearningUnitItem>(`/admin/units/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteLearningUnit(
  id: string,
  detach: boolean,
): Promise<{ id: string; action: 'DELETED'; detachedLessonsCount: number }> {
  return adminFetch<{ id: string; action: 'DELETED'; detachedLessonsCount: number }>(
    `/admin/units/${id}?detach=${detach ? 'true' : 'false'}`,
    { method: 'DELETE' },
  );
}

// ===================== LESSONS =====================

export async function listAdminLessons(params: {
  page: number;
  limit: number;
  search?: string;
  kind?: LearningKind | '';
  published?: '' | 'true' | 'false';
  cefrLevel?: CefrLevel | '';
}): Promise<PaginatedData<AdminLessonItem, LessonsListSummary>> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.kind) qs.set('kind', params.kind);
  if (params.published) qs.set('published', params.published);
  if (params.cefrLevel) qs.set('cefrLevel', params.cefrLevel);
  return adminFetch<PaginatedData<AdminLessonItem, LessonsListSummary>>(
    `/admin/lessons?${qs.toString()}`,
  );
}

export async function getAdminLesson(id: string): Promise<AdminLessonItem> {
  return adminFetch<AdminLessonItem>(`/admin/lessons/${id}`);
}

export async function createAdminLesson(input: {
  code: string;
  kind: LearningKind;
  title: string;
  description: string;
  estimatedMinutes: number;
  sortOrder?: number;
  published?: boolean;
  unitId?: string | null;
  grammarTopicId?: string | null;
  content: LearningContentPayload;
}): Promise<AdminLessonItem> {
  return adminFetch<AdminLessonItem>('/admin/lessons', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminLesson(
  id: string,
  input: {
    code?: string;
    kind?: LearningKind;
    title?: string;
    description?: string;
    estimatedMinutes?: number;
    sortOrder?: number;
    published?: boolean;
    unitId?: string | null;
    grammarTopicId?: string | null;
    content?: LearningContentPayload;
  },
): Promise<AdminLessonItem> {
  return adminFetch<AdminLessonItem>(`/admin/lessons/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteAdminLesson(
  id: string,
  force: boolean,
): Promise<{
  id: string;
  action: 'DELETED' | 'UNPUBLISHED';
  attemptsCount: number;
}> {
  return adminFetch<{
    id: string;
    action: 'DELETED' | 'UNPUBLISHED';
    attemptsCount: number;
  }>(`/admin/lessons/${id}?force=${force ? 'true' : 'false'}`, {
    method: 'DELETE',
  });
}

// ===================== ITEMS & GROUPS =====================

export async function listDescriptors(): Promise<CefrDescriptorItem[]> {
  return adminFetch<CefrDescriptorItem[]>('/admin/descriptors');
}

export async function listAdminAssessmentItems(params: {
  page: number;
  limit: number;
  search?: string;
  skill?: AssessmentSkill | '';
  cefrLevel?: CefrLevel | '';
  usageScope?: ItemUsageScope | '';
  type?: ItemType | '';
}): Promise<PaginatedData<AdminAssessmentItem, AssessmentItemsSummary>> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.skill) qs.set('skill', params.skill);
  if (params.cefrLevel) qs.set('cefrLevel', params.cefrLevel);
  if (params.usageScope) qs.set('usageScope', params.usageScope);
  if (params.type) qs.set('type', params.type);
  return adminFetch<PaginatedData<AdminAssessmentItem, AssessmentItemsSummary>>(
    `/admin/assessment-items?${qs.toString()}`,
  );
}

export async function createAdminAssessmentItem(input: {
  externalId?: string;
  groupId?: string | null;
  itemOrder?: number;
  skill: AssessmentSkill;
  skillCode: string;
  cefrLevel: CefrLevel;
  type: ItemType;
  usageScope: ItemUsageScope;
  passage?: string;
  prompt: string;
  options?: unknown;
  correctOption?: string;
  explanation?: string;
  audioUrl?: string;
  rubricCriteria?: Record<string, unknown> | null;
  irtA?: number;
  irtB?: number;
  irtC?: number;
}): Promise<AdminAssessmentItem> {
  return adminFetch<AdminAssessmentItem>('/admin/assessment-items', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminAssessmentItem(
  id: string,
  input: {
    externalId?: string | null;
    groupId?: string | null;
    itemOrder?: number;
    skill?: AssessmentSkill;
    skillCode?: string;
    cefrLevel?: CefrLevel;
    type?: ItemType;
    usageScope?: ItemUsageScope;
    passage?: string;
    prompt?: string;
    options?: unknown;
    correctOption?: string;
    explanation?: string;
    audioUrl?: string | null;
    rubricCriteria?: Record<string, unknown> | null;
    irtA?: number;
    irtB?: number;
    irtC?: number;
  },
): Promise<AdminAssessmentItem> {
  return adminFetch<AdminAssessmentItem>(`/admin/assessment-items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteAdminAssessmentItem(
  id: string,
  force: boolean,
): Promise<{ id: string; action: 'DELETED' }> {
  return adminFetch<{ id: string; action: 'DELETED' }>(
    `/admin/assessment-items/${id}?force=${force ? 'true' : 'false'}`,
    { method: 'DELETE' },
  );
}

export async function listAdminAssessmentGroups(params: {
  page: number;
  limit: number;
  search?: string;
  skill?: AssessmentSkill | '';
  cefrLevel?: CefrLevel | '';
  usageScope?: ItemUsageScope | '';
}): Promise<PaginatedData<AdminAssessmentGroup>> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.skill) qs.set('skill', params.skill);
  if (params.cefrLevel) qs.set('cefrLevel', params.cefrLevel);
  if (params.usageScope) qs.set('usageScope', params.usageScope);
  return adminFetch<PaginatedData<AdminAssessmentGroup>>(
    `/admin/assessment-groups?${qs.toString()}`,
  );
}

export async function createAdminAssessmentGroup(input: {
  skill: AssessmentSkill;
  title?: string;
  cefrLevel: CefrLevel;
  partNumber: number;
  passage?: string;
  audioUrl?: string;
  transcript?: string;
  usageScope?: ItemUsageScope;
  itemIds?: string[];
}): Promise<AdminAssessmentGroup> {
  return adminFetch<AdminAssessmentGroup>('/admin/assessment-groups', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminAssessmentGroup(
  id: string,
  input: {
    skill?: AssessmentSkill;
    title?: string | null;
    cefrLevel?: CefrLevel;
    partNumber?: number;
    passage?: string | null;
    audioUrl?: string | null;
    transcript?: string | null;
    usageScope?: ItemUsageScope;
    itemIds?: string[];
  },
): Promise<AdminAssessmentGroup> {
  return adminFetch<AdminAssessmentGroup>(`/admin/assessment-groups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteAdminAssessmentGroup(
  id: string,
): Promise<{ id: string; action: 'DELETED'; detachedItemsCount: number }> {
  return adminFetch<{ id: string; action: 'DELETED'; detachedItemsCount: number }>(
    `/admin/assessment-groups/${id}`,
    { method: 'DELETE' },
  );
}

// ===================== VOCABULARY TOPICS & WORDS =====================

export async function listAdminVocabTopics(
  search?: string,
): Promise<AdminCuratedTopic[]> {
  const qs = new URLSearchParams();
  if (search?.trim()) qs.set('search', search.trim());
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return adminFetch<AdminCuratedTopic[]>(`/admin/vocabulary/topics${suffix}`);
}

export async function createAdminVocabTopic(input: {
  slug: string;
  titleEn: string;
  titleVi: string;
  description?: string | null;
  icon?: string | null;
  displayOrder?: number;
}): Promise<AdminCuratedTopic> {
  return adminFetch<AdminCuratedTopic>('/admin/vocabulary/topics', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminVocabTopic(
  id: string,
  input: {
    slug?: string;
    titleEn?: string;
    titleVi?: string;
    description?: string | null;
    icon?: string | null;
    displayOrder?: number;
  },
): Promise<AdminCuratedTopic> {
  return adminFetch<AdminCuratedTopic>(`/admin/vocabulary/topics/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteAdminVocabTopic(
  id: string,
): Promise<{ id: string; action: 'DELETED'; deletedWordsCount: number }> {
  return adminFetch<{ id: string; action: 'DELETED'; deletedWordsCount: number }>(
    `/admin/vocabulary/topics/${id}`,
    { method: 'DELETE' },
  );
}

export async function listAdminVocabWords(
  topicId: string,
  params: { page: number; limit: number; search?: string },
): Promise<PaginatedData<AdminCuratedWord>> {
  const qs = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search?.trim()) qs.set('search', params.search.trim());
  return adminFetch<PaginatedData<AdminCuratedWord>>(
    `/admin/vocabulary/topics/${topicId}/words?${qs.toString()}`,
  );
}

export async function createAdminVocabWord(
  topicId: string,
  input: {
    word: string;
    phonetic?: string;
    partOfSpeech?: string;
    meaningVi: string;
    exampleEn?: string;
    exampleVi?: string;
    imageUrl?: string | null;
    audioUrl?: string | null;
  },
): Promise<AdminCuratedWord> {
  return adminFetch<AdminCuratedWord>(`/admin/vocabulary/topics/${topicId}/words`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminVocabWord(
  topicId: string,
  wordId: string,
  input: {
    word?: string;
    phonetic?: string;
    partOfSpeech?: string;
    meaningVi?: string;
    exampleEn?: string;
    exampleVi?: string;
    imageUrl?: string | null;
    audioUrl?: string | null;
  },
): Promise<AdminCuratedWord> {
  return adminFetch<AdminCuratedWord>(
    `/admin/vocabulary/topics/${topicId}/words/${wordId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export async function deleteAdminVocabWord(
  topicId: string,
  wordId: string,
): Promise<{ id: string; action: 'DELETED' }> {
  return adminFetch<{ id: string; action: 'DELETED' }>(
    `/admin/vocabulary/topics/${topicId}/words/${wordId}`,
    { method: 'DELETE' },
  );
}

// ===================== GRAMMAR DAG =====================

export async function listAdminGrammarTopics(params?: {
  cefrLevel?: CefrLevel | '';
  search?: string;
  published?: '' | 'true' | 'false';
  isLeaf?: '' | 'true' | 'false';
}): Promise<AdminGrammarTopic[]> {
  const qs = new URLSearchParams();
  if (params?.cefrLevel) qs.set('cefrLevel', params.cefrLevel);
  if (params?.search?.trim()) qs.set('search', params.search.trim());
  if (params?.published) qs.set('published', params.published);
  if (params?.isLeaf) qs.set('isLeaf', params.isLeaf);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return adminFetch<AdminGrammarTopic[]>(`/admin/grammar/topics${suffix}`);
}

export async function createAdminGrammarTopic(input: {
  code: string;
  parentId?: string | null;
  cefrLevel: CefrLevel;
  isLeaf: boolean;
  titleEn: string;
  titleVi: string;
  summaryVi?: string;
  formulas?: GrammarFormulaItem[];
  usageNotes?: GrammarUsageItem[];
  examples?: GrammarExampleItem[];
  orderIndex?: number;
  published?: boolean;
}): Promise<AdminGrammarTopic> {
  return adminFetch<AdminGrammarTopic>('/admin/grammar/topics', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminGrammarTopic(
  id: string,
  input: {
    parentId?: string | null;
    cefrLevel?: CefrLevel;
    titleEn?: string;
    titleVi?: string;
    summaryVi?: string;
    formulas?: GrammarFormulaItem[];
    usageNotes?: GrammarUsageItem[];
    examples?: GrammarExampleItem[];
    orderIndex?: number;
    published?: boolean;
  },
): Promise<AdminGrammarTopic> {
  return adminFetch<AdminGrammarTopic>(`/admin/grammar/topics/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteAdminGrammarTopic(
  id: string,
): Promise<{ deleted: true; id: string }> {
  return adminFetch<{ deleted: true; id: string }>(`/admin/grammar/topics/${id}`, {
    method: 'DELETE',
  });
}

export async function addAdminGrammarPrerequisite(
  prerequisiteId: string,
  targetId: string,
): Promise<{ prerequisiteId: string; targetId: string }> {
  return adminFetch<{ prerequisiteId: string; targetId: string }>(
    '/admin/grammar/prerequisites',
    {
      method: 'POST',
      body: JSON.stringify({ prerequisiteId, targetId }),
    },
  );
}

export async function removeAdminGrammarPrerequisite(
  prerequisiteId: string,
  targetId: string,
): Promise<{ deleted: boolean }> {
  return adminFetch<{ deleted: boolean }>('/admin/grammar/prerequisites', {
    method: 'DELETE',
    body: JSON.stringify({ prerequisiteId, targetId }),
  });
}

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
  const session = getStoredAdminSession();
  const headers = new Headers();
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }
  const response = await fetch(
    `${apiBaseUrl()}/admin/exports/${entity}?format=${format}`,
    { method: 'GET', headers },
  );
  if (response.status === 401 && retryOnUnauthorized && session?.refreshToken) {
    const refreshed = await refreshAdminSession();
    if (refreshed) {
      return downloadAdminExport(entity, format, false);
    }
    clearAdminSession();
  }
  if (!response.ok) {
    throw new AdminApiError(
      `Xuất dữ liệu thất bại (HTTP ${response.status})`,
      response.status,
    );
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename =
    match?.[1] ??
    `lingoroad-${entity}-${new Date().toISOString().slice(0, 10)}.${format}`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
