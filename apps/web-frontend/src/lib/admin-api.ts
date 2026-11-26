import type {
  AdminAssessmentItem,
  AdminAuthSession,
  AdminLessonItem,
  AdminUser,
  AdminUserListItem,
  AssessmentItemsSummary,
  AssessmentSkill,
  CefrDescriptorItem,
  CefrLevel,
  DashboardOverview,
  ImportApplyResponse,
  ImportValidationResponse,
  ItemType,
  ItemUsageScope,
  LearningContentPayload,
  LearningKind,
  LearningUnitItem,
  LessonsListSummary,
  PaginatedData,
  UserRole,
  UserStatus,
  UsersListSummary,
} from '../types/admin';

const SESSION_KEY = 'lingoroad_admin_session';

function apiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  return (configured || 'http://localhost:3000').replace(/\/+$/, '');
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
  if (!headers.has('Content-Type') && options.body) {
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

export async function getDashboardOverview(): Promise<DashboardOverview> {
  return adminFetch<DashboardOverview>('/admin/analytics/dashboard');
}

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
  skill: AssessmentSkill;
  skillCode: string;
  cefrLevel: CefrLevel;
  type: ItemType;
  usageScope: ItemUsageScope;
  passage?: string;
  prompt: string;
  options?: string[];
  correctOption?: string;
  explanation?: string;
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
    skill?: AssessmentSkill;
    skillCode?: string;
    cefrLevel?: CefrLevel;
    type?: ItemType;
    usageScope?: ItemUsageScope;
    passage?: string;
    prompt?: string;
    options?: string[];
    correctOption?: string;
    explanation?: string;
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

export async function validateAdminImport(
  bundle: unknown,
): Promise<ImportValidationResponse> {
  return adminFetch<ImportValidationResponse>('/admin/imports/validate', {
    method: 'POST',
    body: JSON.stringify({ bundle }),
  });
}

export async function applyAdminImport(
  bundle: unknown,
): Promise<ImportApplyResponse> {
  return adminFetch<ImportApplyResponse>('/admin/imports/apply', {
    method: 'POST',
    body: JSON.stringify({ bundle }),
  });
}
