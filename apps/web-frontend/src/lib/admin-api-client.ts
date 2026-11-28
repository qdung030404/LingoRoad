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

const SESSION_KEY = 'lingoroad_admin_session';
const REFRESH_LOCK_NAME = 'lingoroad_admin_refresh';

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

export async function parseJsonSafe<T>(response: Response): Promise<ApiEnvelope<T> | null> {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return null;
  }
}

let refreshPromise: Promise<AdminAuthSession | null> | null = null;

async function performLockedRefresh(
  failedAccessToken?: string,
): Promise<AdminAuthSession | null> {
  const latest = getStoredAdminSession();
  if (!latest?.refreshToken) return null;
  if (failedAccessToken && latest.accessToken !== failedAccessToken) {
    return latest;
  }

  try {
    const response = await fetch(`${apiBaseUrl()}/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: latest.refreshToken }),
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
  }
}

export async function refreshAdminSession(
  failedAccessToken?: string,
): Promise<AdminAuthSession | null> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.locks &&
    typeof navigator.locks.request === 'function'
  ) {
    return (await navigator.locks.request(REFRESH_LOCK_NAME, () =>
      performLockedRefresh(failedAccessToken),
    )) as AdminAuthSession | null;
  }

  if (refreshPromise) return refreshPromise;
  refreshPromise = performLockedRefresh(failedAccessToken).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function adminFetch<T>(
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
    const refreshed = await refreshAdminSession(session.accessToken);
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
  if (!session?.refreshToken) {
    clearAdminSession();
    return;
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session.accessToken) {
    headers.Authorization = `Bearer ${session.accessToken}`;
  }
  const signal =
    typeof AbortSignal !== 'undefined' &&
    typeof AbortSignal.timeout === 'function'
      ? AbortSignal.timeout(4000)
      : undefined;
  try {
    await fetch(`${apiBaseUrl()}/admin/auth/logout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refreshToken: session.refreshToken }),
      ...(signal ? { signal } : {}),
    });
  } catch {
    // Bỏ qua lỗi mạng hoặc timeout khi đăng xuất cục bộ
  } finally {
    clearAdminSession();
  }
}

export async function adminChangePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<AdminAuthSession> {
  const session = await adminFetch<AdminAuthSession>(
    '/admin/auth/change-password',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  saveAdminSession(session);
  return session;
}

export async function adminLogoutAll(): Promise<{
  revokedSessionsCount: number;
}> {
  const result = await adminFetch<{ revokedSessionsCount: number }>(
    '/admin/auth/logout-all',
    { method: 'POST' },
  );
  clearAdminSession();
  return result;
}

export async function getAdminMe(): Promise<AdminUser> {
  return adminFetch<AdminUser>('/admin/auth/me');
}

export async function updateAdminMeProfile(input: {
  name?: string;
  avatarUrl?: string | null;
}): Promise<AdminUser> {
  const updated = await adminFetch<AdminUser>('/admin/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  const existing = getStoredAdminSession();
  if (existing && existing.user.id === updated.id) {
    saveAdminSession({
      ...existing,
      user: updated,
    });
  }
  return updated;
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

export async function scanAdminOrphanMedia(
  minAgeHours = 24,
): Promise<AdminOrphanMediaScanResult> {
  const qs = new URLSearchParams({
    minAgeHours: String(minAgeHours),
  });
  return adminFetch<AdminOrphanMediaScanResult>(
    `/admin/media/orphans?${qs.toString()}`,
  );
}

export async function cleanupAdminOrphanMedia(
  input: { keys?: string[]; minAgeHours?: number } = {},
): Promise<AdminOrphanMediaCleanupResult> {
  return adminFetch<AdminOrphanMediaCleanupResult>(
    '/admin/media/orphans/cleanup',
    {
      method: 'POST',
      body: JSON.stringify(input),
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

export async function downloadAuthorizedFile(
  path: string,
  fallbackFilename: string,
  retryOnUnauthorized = true,
): Promise<void> {
  const session = getStoredAdminSession();
  const headers = new Headers();
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: 'GET',
    headers,
  });
  if (response.status === 401 && retryOnUnauthorized && session?.refreshToken) {
    const refreshed = await refreshAdminSession(session.accessToken);
    if (refreshed) {
      return downloadAuthorizedFile(path, fallbackFilename, false);
    }
    clearAdminSession();
  }
  if (!response.ok) {
    const payload = await parseJsonSafe<unknown>(response);
    const errMessage =
      payload?.error?.message ||
      payload?.message ||
      `Xuất dữ liệu thất bại (HTTP ${response.status})`;
    throw new AdminApiError(errMessage, response.status, payload?.error?.code);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackFilename;
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
