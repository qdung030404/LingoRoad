'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  AudioLines,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  FileAudio,
  Image as ImageIcon,
  Info,
  Lock,
  MessageSquare,
  Mic,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Unlock,
  X,
  XCircle,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  NOOP_ADMIN_TOAST,
  useAdminToast,
  type AdminToastApi,
} from '@/components/admin/AdminToast';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import { SpeakingPromptModal } from '@/components/admin/SpeakingPromptModal';
import {
  bulkPublishAdminSpeakingPrompts,
  deleteAdminSpeakingPrompt,
  downloadAdminExport,
  expireAdminSpeakingSubmission,
  getAdminSpeakingSubmission,
  getAdminVoiceConversation,
  listAdminSpeakingPrompts,
  listAdminSpeakingSubmissions,
  listAdminVoiceConversations,
  releaseAdminVoiceConversationLock,
  resolveAdminMediaUrl,
  retryAdminSpeakingSubmissionContent,
  retryAdminVoiceConversationContent,
  updateAdminSpeakingPrompt,
} from '@/lib/admin-api';
import {
  buildQueryString,
  normalizeQueryString,
  parseEnumParam,
  parsePositiveIntParam,
  useAdminQueryParams,
  useSyncAdminQueryParams,
  type QueryParamValue,
  type UseAdminQueryParamsResult,
} from '@/lib/use-admin-query-params';
import type {
  AdminSpeakingPrompt,
  AdminSpeakingSubmissionDetail,
  AdminSpeakingSubmissionItem,
  AdminSpeakingSubmissionsSummary,
  AdminVoiceConversationDetail,
  AdminVoiceConversationItem,
  AdminVoiceConversationsSummary,
  PaginationMeta,
  SpeakingMode,
  SpeakingPromptsSummary,
  SpeakingStatus,
} from '@/types/admin';

type SpeakingAdminTab = 'prompts' | 'submissions' | 'voice';
const SPEAKING_TABS: readonly SpeakingAdminTab[] = [
  'prompts',
  'submissions',
  'voice',
];
const SPEAKING_MODES: readonly SpeakingMode[] = [
  'READ_ALOUD',
  'TOPIC',
  'PICTURE_DESCRIPTION',
  'TONGUE_TWISTER',
];
const SPEAKING_STATUSES: readonly SpeakingStatus[] = [
  'CREATED',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'UNKNOWN',
];
const VOICE_STATUSES = ['CREATED', 'ACTIVE', 'ENDED', 'INTERRUPTED'] as const;
type VoiceSessionStatus = (typeof VOICE_STATUSES)[number];
const VOICE_ASSESSMENT_STATUSES = [
  'UNASSESSED',
  'PROCESSING',
  'READY',
  'PARTIAL',
  'FAILED',
  'UNKNOWN',
] as const;
type VoiceAssessmentStatus = (typeof VOICE_ASSESSMENT_STATUSES)[number];
const PUBLISHED_OPTIONS = ['true', 'false'] as const;
const PAGE_LIMITS = [10, 20, 50] as const;
const MAX_BULK_SELECTION = 100;

const SPEAKING_QUERY_DEFAULTS: Record<string, QueryParamValue> = {
  tab: 'prompts',
  page: 1,
  limit: 10,
};

const MODE_TABS: Array<{ value: SpeakingMode | ''; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'READ_ALOUD', label: 'Đọc to' },
  { value: 'TOPIC', label: 'Chủ đề / Voice AI' },
  { value: 'PICTURE_DESCRIPTION', label: 'Mô tả tranh' },
  { value: 'TONGUE_TWISTER', label: 'Xoắn lưỡi' },
];

interface ParsedInitialSpeakingState {
  tab: SpeakingAdminTab;
  page: number;
  limit: number;
  search: string;
  mode: SpeakingMode | '';
  published: '' | 'true' | 'false';
  subStatus: SpeakingStatus | '';
  errorCode: string;
  voiceStatus: VoiceSessionStatus | '';
  assessmentStatus: VoiceAssessmentStatus | '';
  stuckOnly: boolean;
}

function parseLimitParam(raw: string | null | undefined): number {
  const parsed = parsePositiveIntParam(raw, 10);
  return (PAGE_LIMITS as readonly number[]).includes(parsed) ? parsed : 10;
}

function parseSpeakingFilters(
  getRaw: (key: string) => string | null | undefined,
): ParsedInitialSpeakingState {
  const tab =
    parseEnumParam(getRaw('tab'), SPEAKING_TABS, 'prompts') || 'prompts';
  const page = parsePositiveIntParam(getRaw('page'), 1);
  const limit = parseLimitParam(getRaw('limit'));
  const search = getRaw('search')?.trim() ?? '';
  const mode = parseEnumParam(getRaw('mode'), SPEAKING_MODES);
  const published = parseEnumParam(getRaw('published'), PUBLISHED_OPTIONS);
  const subStatus =
    tab === 'submissions'
      ? parseEnumParam(getRaw('status'), SPEAKING_STATUSES)
      : '';
  const errorCode =
    tab === 'submissions' ? (getRaw('errorCode')?.trim() ?? '') : '';
  const voiceStatus =
    tab === 'voice' ? parseEnumParam(getRaw('status'), VOICE_STATUSES) : '';
  const assessmentStatus =
    tab === 'voice'
      ? parseEnumParam(getRaw('assessmentStatus'), VOICE_ASSESSMENT_STATUSES)
      : '';
  const stuckOnly = tab === 'voice' && getRaw('stuckOnly')?.trim() === 'true';

  return {
    tab,
    page,
    limit,
    search,
    mode,
    published,
    subStatus,
    errorCode,
    voiceStatus,
    assessmentStatus,
    stuckOnly,
  };
}

function readInitialSpeakingFilters(): ParsedInitialSpeakingState {
  const sp =
    typeof window !== 'undefined' && typeof window.location?.search === 'string'
      ? new URLSearchParams(window.location.search)
      : null;
  return parseSpeakingFilters((key) => sp?.get(key));
}

function AdminToastBridge({
  toastRef,
}: {
  toastRef: React.MutableRefObject<AdminToastApi>;
}): null {
  const toast = useAdminToast();
  useEffect(() => {
    toastRef.current = toast;
  }, [toast, toastRef]);
  return null;
}

function SpeakingQuerySync({
  params,
  onExternalQueryChange,
}: {
  params: Record<string, QueryParamValue>;
  onExternalQueryChange: (api: UseAdminQueryParamsResult) => void;
}): null {
  const queryApi = useAdminQueryParams();
  const rawSearch = queryApi.searchParams?.toString() ?? '';
  const lastSeenRawRef = useRef(rawSearch);
  const expectedQuery = buildQueryString(params, SPEAKING_QUERY_DEFAULTS);

  useSyncAdminQueryParams(params, SPEAKING_QUERY_DEFAULTS);

  useEffect(() => {
    if (rawSearch === lastSeenRawRef.current) return;
    lastSeenRawRef.current = rawSearch;
    if (normalizeQueryString(rawSearch) === expectedQuery) return;
    onExternalQueryChange(queryApi);
  }, [rawSearch, expectedQuery, queryApi, onExternalQueryChange]);

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function submissionStatusBadgeClass(status: SpeakingStatus | string): string {
  switch (status) {
    case 'SUCCEEDED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'FAILED':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'UNKNOWN':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'PROCESSING':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-slateDark-50 text-slateDark-700 border-slateDark-200';
  }
}

function voiceAssessmentBadgeClass(status: string): string {
  switch (status) {
    case 'READY':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'PARTIAL':
    case 'UNKNOWN':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'FAILED':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'PROCESSING':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-slateDark-50 text-slateDark-700 border-slateDark-200';
  }
}

function voiceSessionBadgeClass(status: string): string {
  switch (status) {
    case 'ENDED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'ACTIVE':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'INTERRUPTED':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    default:
      return 'bg-slateDark-50 text-slateDark-700 border-slateDark-200';
  }
}

interface ParsedSubmissionWord {
  word: string;
  accuracy: number | null;
  errorType: string;
  phonemes: Array<{ phoneme: string; accuracy: number | null }>;
}

interface ParsedSubmissionContentFeedback {
  status: string | null;
  errorCode: string | null;
  rubricVersion: string | null;
  vocabulary: number | null;
  grammar: number | null;
  topic: number | null;
  overall: number | null;
  strengths: string[];
  improvements: Array<{
    quote: string;
    explanationVi: string;
    suggestion: string;
  }>;
}

interface ParsedSubmissionResult {
  transcript: string | null;
  overall: number | null;
  accuracy: number | null;
  fluency: number | null;
  prosody: number | null;
  completeness: number | null;
  pronunciation: number | null;
  durationSeconds: number | null;
  feedbackVi: string | null;
  words: ParsedSubmissionWord[];
  content: ParsedSubmissionContentFeedback | null;
}

function parseSpeakingSubmissionResult(
  raw: unknown,
): ParsedSubmissionResult | null {
  const rec = asRecord(raw);
  if (!rec) return null;

  const rawWords = Array.isArray(rec.words) ? rec.words : [];
  const words: ParsedSubmissionWord[] = rawWords
    .map((entry) => {
      const w = asRecord(entry);
      if (!w) return null;
      const word = asNonEmptyString(w.word);
      if (!word) return null;
      const rawPhonemes = Array.isArray(w.phonemes) ? w.phonemes : [];
      const phonemes = rawPhonemes
        .map((p) => {
          const pr = asRecord(p);
          if (!pr) return null;
          const phoneme = asNonEmptyString(pr.phoneme);
          if (!phoneme) return null;
          return { phoneme, accuracy: asFiniteNumber(pr.accuracy) };
        })
        .filter(
          (item): item is { phoneme: string; accuracy: number | null } =>
            item !== null,
        );
      return {
        word,
        accuracy: asFiniteNumber(w.accuracy),
        errorType: asNonEmptyString(w.errorType) ?? 'None',
        phonemes,
      };
    })
    .filter((item): item is ParsedSubmissionWord => item !== null);

  const rawContent = asRecord(rec.content);
  let content: ParsedSubmissionContentFeedback | null = null;
  if (rawContent) {
    const strengths = Array.isArray(rawContent.strengths)
      ? rawContent.strengths.filter(
          (s): s is string => typeof s === 'string' && s.trim().length > 0,
        )
      : [];
    const improvements = Array.isArray(rawContent.improvements)
      ? rawContent.improvements
          .map((item) => {
            const ir = asRecord(item);
            if (!ir) return null;
            const quote = asNonEmptyString(ir.quote) ?? '';
            const explanationVi = asNonEmptyString(ir.explanationVi) ?? '';
            const suggestion = asNonEmptyString(ir.suggestion) ?? '';
            if (!quote && !explanationVi && !suggestion) return null;
            return { quote, explanationVi, suggestion };
          })
          .filter(
            (
              item,
            ): item is {
              quote: string;
              explanationVi: string;
              suggestion: string;
            } => item !== null,
          )
      : [];

    content = {
      status: asNonEmptyString(rawContent.status),
      errorCode: asNonEmptyString(rawContent.errorCode),
      rubricVersion: asNonEmptyString(rawContent.rubricVersion),
      vocabulary: asFiniteNumber(rawContent.vocabulary),
      grammar: asFiniteNumber(rawContent.grammar),
      topic: asFiniteNumber(rawContent.topic),
      overall: asFiniteNumber(rawContent.overall),
      strengths,
      improvements,
    };
  }

  return {
    transcript: asNonEmptyString(rec.transcript),
    overall: asFiniteNumber(rec.overall),
    accuracy: asFiniteNumber(rec.accuracy),
    fluency: asFiniteNumber(rec.fluency),
    prosody: asFiniteNumber(rec.prosody),
    completeness: asFiniteNumber(rec.completeness),
    pronunciation: asFiniteNumber(rec.pronunciation),
    durationSeconds: asFiniteNumber(rec.durationSeconds),
    feedbackVi: asNonEmptyString(rec.feedbackVi),
    words,
    content,
  };
}

interface ParsedPromptSnapshot {
  title: string | null;
  mode: string | null;
  text: string | null;
  difficulty: number | null;
  maxDurationSeconds: number | null;
  hints: string[];
  imageUrl: string | null;
  visualContext: string | null;
  assessmentProfile: string | null;
  contentVersion: number | null;
}

function parsePromptSnapshot(raw: unknown): ParsedPromptSnapshot | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const hints = Array.isArray(rec.hints)
    ? rec.hints.filter(
        (h): h is string => typeof h === 'string' && h.trim().length > 0,
      )
    : [];
  return {
    title: asNonEmptyString(rec.title),
    mode: asNonEmptyString(rec.mode),
    text: asNonEmptyString(rec.text),
    difficulty: asFiniteNumber(rec.difficulty),
    maxDurationSeconds: asFiniteNumber(rec.maxDurationSeconds),
    hints,
    imageUrl: asNonEmptyString(rec.imageUrl),
    visualContext: asNonEmptyString(rec.visualContext),
    assessmentProfile: asNonEmptyString(rec.assessmentProfile),
    contentVersion: asFiniteNumber(rec.contentVersion),
  };
}

interface ParsedVoiceAssessmentSummary {
  pronunciationScope: string | null;
  assessedAt: string | null;
  pronunciation: {
    overall: number | null;
    accuracy: number | null;
    fluency: number | null;
    prosody: number | null;
  } | null;
  content: {
    status: string | null;
    errorCode: string | null;
    overall: number | null;
    vocabulary: number | null;
    grammar: number | null;
    topic: number | null;
  } | null;
}

function parseVoiceAssessment(
  raw: unknown,
): ParsedVoiceAssessmentSummary | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const pron = asRecord(rec.pronunciation);
  const content = asRecord(rec.content);
  return {
    pronunciationScope: asNonEmptyString(rec.pronunciationScope),
    assessedAt: asNonEmptyString(rec.assessedAt),
    pronunciation: pron
      ? {
          overall: asFiniteNumber(pron.overall),
          accuracy: asFiniteNumber(pron.accuracy),
          fluency: asFiniteNumber(pron.fluency),
          prosody: asFiniteNumber(pron.prosody),
        }
      : null,
    content: content
      ? {
          status: asNonEmptyString(content.status),
          errorCode: asNonEmptyString(content.errorCode),
          overall: asFiniteNumber(content.overall),
          vocabulary: asFiniteNumber(content.vocabulary),
          grammar: asFiniteNumber(content.grammar),
          topic: asFiniteNumber(content.topic),
        }
      : null,
  };
}

export default function AdminSpeakingPage(): React.ReactElement {
  const toastRef = useRef<AdminToastApi>(NOOP_ADMIN_TOAST);
  const [initialFilters] = useState(readInitialSpeakingFilters);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<SpeakingAdminTab>(
    initialFilters.tab,
  );
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // ================= TAB 1: SPEAKING PROMPTS =================
  const [prompts, setPrompts] = useState<AdminSpeakingPrompt[]>([]);
  const [promptsSummary, setPromptsSummary] = useState<SpeakingPromptsSummary>({
    total: 0,
    published: 0,
    readAloud: 0,
    topic: 0,
    pictureDescription: 0,
    tongueTwister: 0,
  });
  const [promptsPagination, setPromptsPagination] = useState<PaginationMeta>({
    page: initialFilters.tab === 'prompts' ? initialFilters.page : 1,
    limit: initialFilters.tab === 'prompts' ? initialFilters.limit : 10,
    total: 0,
    totalPages: 0,
  });
  const [promptsPage, setPromptsPage] = useState(
    initialFilters.tab === 'prompts' ? initialFilters.page : 1,
  );
  const [promptsLimit, setPromptsLimit] = useState(
    initialFilters.tab === 'prompts' ? initialFilters.limit : 10,
  );
  const [promptModeFilter, setPromptModeFilter] = useState<SpeakingMode | ''>(
    initialFilters.tab === 'prompts' ? initialFilters.mode : '',
  );
  const [promptPublishedFilter, setPromptPublishedFilter] = useState<
    '' | 'true' | 'false'
  >(initialFilters.tab === 'prompts' ? initialFilters.published : '');
  const [promptSearchInput, setPromptSearchInput] = useState(
    initialFilters.tab === 'prompts' ? initialFilters.search : '',
  );
  const [promptSearchQuery, setPromptSearchQuery] = useState(
    initialFilters.tab === 'prompts' ? initialFilters.search : '',
  );
  const [promptsLoading, setPromptsLoading] = useState(true);
  const promptsReqRef = useRef(0);

  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingPrompt, setEditingPrompt] =
    useState<AdminSpeakingPrompt | null>(null);
  const [cloningPrompt, setCloningPrompt] =
    useState<AdminSpeakingPrompt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminSpeakingPrompt | null>(
    null,
  );
  const [forceDelete, setForceDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ================= TAB 2: SPEAKING SUBMISSIONS =================
  const [submissions, setSubmissions] = useState<AdminSpeakingSubmissionItem[]>(
    [],
  );
  const [subSummary, setSubSummary] = useState<AdminSpeakingSubmissionsSummary>(
    {
      failed: 0,
      unknown: 0,
      stuckProcessing: 0,
      contentUnavailable: 0,
    },
  );
  const [subPagination, setSubPagination] = useState<PaginationMeta>({
    page: initialFilters.tab === 'submissions' ? initialFilters.page : 1,
    limit: initialFilters.tab === 'submissions' ? initialFilters.limit : 10,
    total: 0,
    totalPages: 0,
  });
  const [subPage, setSubPage] = useState(
    initialFilters.tab === 'submissions' ? initialFilters.page : 1,
  );
  const [subLimit, setSubLimit] = useState(
    initialFilters.tab === 'submissions' ? initialFilters.limit : 10,
  );
  const [subStatusFilter, setSubStatusFilter] = useState<SpeakingStatus | ''>(
    initialFilters.subStatus,
  );
  const [subModeFilter, setSubModeFilter] = useState<SpeakingMode | ''>(
    initialFilters.tab === 'submissions' ? initialFilters.mode : '',
  );
  const [subErrorCodeInput, setSubErrorCodeInput] = useState(
    initialFilters.errorCode,
  );
  const [subErrorCodeQuery, setSubErrorCodeQuery] = useState(
    initialFilters.errorCode,
  );
  const [subSearchInput, setSubSearchInput] = useState(
    initialFilters.tab === 'submissions' ? initialFilters.search : '',
  );
  const [subSearchQuery, setSubSearchQuery] = useState(
    initialFilters.tab === 'submissions' ? initialFilters.search : '',
  );
  const [subsLoading, setSubsLoading] = useState(false);
  const subsReqRef = useRef(0);

  // Submission Drawer
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [subDetail, setSubDetail] =
    useState<AdminSpeakingSubmissionDetail | null>(null);
  const [subDetailLoading, setSubDetailLoading] = useState(false);
  const [subDetailError, setSubDetailError] = useState<string | null>(null);
  const subDetailReqRef = useRef(0);
  const [retryingSubContent, setRetryingSubContent] = useState(false);
  const [expireSubTarget, setExpireSubTarget] =
    useState<AdminSpeakingSubmissionDetail | null>(null);
  const [expiringSub, setExpiringSub] = useState(false);

  // ================= TAB 3: VOICE CONVERSATIONS =================
  const [voiceRows, setVoiceRows] = useState<AdminVoiceConversationItem[]>([]);
  const [voiceSummary, setVoiceSummary] =
    useState<AdminVoiceConversationsSummary>({
      activeLocks: 0,
      failedAssessments: 0,
      stuckProcessing: 0,
    });
  const [voicePagination, setVoicePagination] = useState<PaginationMeta>({
    page: initialFilters.tab === 'voice' ? initialFilters.page : 1,
    limit: initialFilters.tab === 'voice' ? initialFilters.limit : 10,
    total: 0,
    totalPages: 0,
  });
  const [voicePage, setVoicePage] = useState(
    initialFilters.tab === 'voice' ? initialFilters.page : 1,
  );
  const [voiceLimit, setVoiceLimit] = useState(
    initialFilters.tab === 'voice' ? initialFilters.limit : 10,
  );
  const [voiceStatusFilter, setVoiceStatusFilter] = useState<
    VoiceSessionStatus | ''
  >(initialFilters.voiceStatus);
  const [voiceAssessmentFilter, setVoiceAssessmentFilter] = useState<
    VoiceAssessmentStatus | ''
  >(initialFilters.assessmentStatus);
  const [voiceStuckOnly, setVoiceStuckOnly] = useState<boolean>(
    initialFilters.stuckOnly,
  );
  const [voiceSearchInput, setVoiceSearchInput] = useState(
    initialFilters.tab === 'voice' ? initialFilters.search : '',
  );
  const [voiceSearchQuery, setVoiceSearchQuery] = useState(
    initialFilters.tab === 'voice' ? initialFilters.search : '',
  );
  const [voiceLoading, setVoiceLoading] = useState(false);
  const voiceReqRef = useRef(0);

  // Voice Drawer
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);
  const [voiceDetail, setVoiceDetail] =
    useState<AdminVoiceConversationDetail | null>(null);
  const [voiceDetailLoading, setVoiceDetailLoading] = useState(false);
  const [voiceDetailError, setVoiceDetailError] = useState<string | null>(null);
  const voiceDetailReqRef = useRef(0);
  const [releaseLockTarget, setReleaseLockTarget] =
    useState<AdminVoiceConversationDetail | null>(null);
  const [releasingLock, setReleasingLock] = useState(false);
  const [retryingVoiceContent, setRetryingVoiceContent] = useState(false);

  // ================= URL QUERY SYNC =================
  const activeQueryParams = useMemo<Record<string, QueryParamValue>>(() => {
    if (activeTab === 'submissions') {
      return {
        tab: 'submissions',
        page: subPage,
        limit: subLimit,
        status: subStatusFilter,
        mode: subModeFilter,
        errorCode: subErrorCodeQuery,
        search: subSearchQuery,
      };
    }
    if (activeTab === 'voice') {
      return {
        tab: 'voice',
        page: voicePage,
        limit: voiceLimit,
        status: voiceStatusFilter,
        assessmentStatus: voiceAssessmentFilter,
        stuckOnly: voiceStuckOnly ? 'true' : '',
        search: voiceSearchQuery,
      };
    }
    return {
      tab: 'prompts',
      page: promptsPage,
      limit: promptsLimit,
      mode: promptModeFilter,
      published: promptPublishedFilter,
      search: promptSearchQuery,
    };
  }, [
    activeTab,
    subPage,
    subLimit,
    subStatusFilter,
    subModeFilter,
    subErrorCodeQuery,
    subSearchQuery,
    voicePage,
    voiceLimit,
    voiceStatusFilter,
    voiceAssessmentFilter,
    voiceStuckOnly,
    voiceSearchQuery,
    promptsPage,
    promptsLimit,
    promptModeFilter,
    promptPublishedFilter,
    promptSearchQuery,
  ]);

  const handleExternalQueryChange = useCallback(
    (api: UseAdminQueryParamsResult): void => {
      const next = parseSpeakingFilters((key) => api.getParam(key) || null);
      setActiveTab(next.tab);
      if (next.tab === 'prompts') {
        setPromptsPage(next.page);
        setPromptsLimit(next.limit);
        setPromptModeFilter(next.mode);
        setPromptPublishedFilter(next.published);
        setPromptSearchInput(next.search);
        setPromptSearchQuery(next.search);
      } else if (next.tab === 'submissions') {
        setSubPage(next.page);
        setSubLimit(next.limit);
        setSubStatusFilter(next.subStatus);
        setSubModeFilter(next.mode);
        setSubErrorCodeInput(next.errorCode);
        setSubErrorCodeQuery(next.errorCode);
        setSubSearchInput(next.search);
        setSubSearchQuery(next.search);
      } else {
        setVoicePage(next.page);
        setVoiceLimit(next.limit);
        setVoiceStatusFilter(next.voiceStatus);
        setVoiceAssessmentFilter(next.assessmentStatus);
        setVoiceStuckOnly(next.stuckOnly);
        setVoiceSearchInput(next.search);
        setVoiceSearchQuery(next.search);
      }
    },
    [],
  );

  // ================= LOADERS =================
  const loadPrompts = useCallback(async () => {
    const reqId = ++promptsReqRef.current;
    setPromptsLoading(true);
    setBannerError(null);
    setSelectedPromptIds([]);
    try {
      const res = await listAdminSpeakingPrompts({
        page: promptsPage,
        limit: promptsLimit,
        search: promptSearchQuery,
        mode: promptModeFilter,
        published: promptPublishedFilter,
      });
      if (reqId !== promptsReqRef.current) return;
      setPrompts(res.items);
      setPromptsPagination(res.pagination);
      if (res.summary) setPromptsSummary(res.summary);
    } catch (err) {
      if (reqId !== promptsReqRef.current) return;
      setBannerError(
        err instanceof Error
          ? err.message
          : 'Không thể tải danh sách đề luyện nói.',
      );
    } finally {
      if (reqId === promptsReqRef.current) {
        setPromptsLoading(false);
      }
    }
  }, [
    promptsPage,
    promptsLimit,
    promptSearchQuery,
    promptModeFilter,
    promptPublishedFilter,
  ]);

  const loadSubmissions = useCallback(async () => {
    const reqId = ++subsReqRef.current;
    setSubsLoading(true);
    setBannerError(null);
    try {
      const res = await listAdminSpeakingSubmissions({
        page: subPage,
        limit: subLimit,
        status: subStatusFilter,
        mode: subModeFilter,
        errorCode: subErrorCodeQuery,
        search: subSearchQuery,
      });
      if (reqId !== subsReqRef.current) return;
      setSubmissions(res.items);
      setSubPagination(res.pagination);
      if (res.summary) setSubSummary(res.summary);
    } catch (err) {
      if (reqId !== subsReqRef.current) return;
      setBannerError(
        err instanceof Error
          ? err.message
          : 'Không thể tải danh sách bài nộp Speaking.',
      );
    } finally {
      if (reqId === subsReqRef.current) {
        setSubsLoading(false);
      }
    }
  }, [
    subPage,
    subLimit,
    subStatusFilter,
    subModeFilter,
    subErrorCodeQuery,
    subSearchQuery,
  ]);

  const loadVoiceConversations = useCallback(async () => {
    const reqId = ++voiceReqRef.current;
    setVoiceLoading(true);
    setBannerError(null);
    try {
      const res = await listAdminVoiceConversations({
        page: voicePage,
        limit: voiceLimit,
        status: voiceStatusFilter,
        assessmentStatus: voiceAssessmentFilter,
        stuckOnly: voiceStuckOnly ? 'true' : '',
        search: voiceSearchQuery,
      });
      if (reqId !== voiceReqRef.current) return;
      setVoiceRows(res.items);
      setVoicePagination(res.pagination);
      if (res.summary) setVoiceSummary(res.summary);
    } catch (err) {
      if (reqId !== voiceReqRef.current) return;
      setBannerError(
        err instanceof Error
          ? err.message
          : 'Không thể tải danh sách hội thoại Voice AI.',
      );
    } finally {
      if (reqId === voiceReqRef.current) {
        setVoiceLoading(false);
      }
    }
  }, [
    voicePage,
    voiceLimit,
    voiceStatusFilter,
    voiceAssessmentFilter,
    voiceStuckOnly,
    voiceSearchQuery,
  ]);

  useEffect(() => {
    if (!authReady) return;
    if (activeTab === 'prompts') {
      void loadPrompts();
    } else if (activeTab === 'submissions') {
      void loadSubmissions();
    } else {
      void loadVoiceConversations();
    }
  }, [authReady, activeTab, loadPrompts, loadSubmissions, loadVoiceConversations]);

  // Escape closes drawers when no ConfirmDialog is open
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!selectedSubId && !selectedVoiceId) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (expireSubTarget || releaseLockTarget || deleteTarget) return;
      if (selectedSubId) {
        setSelectedSubId(null);
        setSubDetail(null);
      }
      if (selectedVoiceId) {
        setSelectedVoiceId(null);
        setVoiceDetail(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedSubId,
    selectedVoiceId,
    expireSubTarget,
    releaseLockTarget,
    deleteTarget,
  ]);

  // ================= TAB 1 HANDLERS =================
  const hasActivePromptFilters = Boolean(
    promptModeFilter ||
      promptPublishedFilter ||
      promptSearchInput.trim() ||
      promptSearchQuery.trim(),
  );

  const handleResetPromptFilters = (): void => {
    setPromptsPage(1);
    setPromptModeFilter('');
    setPromptPublishedFilter('');
    setPromptSearchInput('');
    setPromptSearchQuery('');
  };

  const allPromptsSelected =
    prompts.length > 0 &&
    prompts.every((p) => selectedPromptIds.includes(p.id));

  const handleToggleSelectAllPrompts = (): void => {
    if (allPromptsSelected) {
      setSelectedPromptIds([]);
      return;
    }
    setSelectedPromptIds(prompts.slice(0, MAX_BULK_SELECTION).map((p) => p.id));
  };

  const handleToggleSelectPrompt = (id: string): void => {
    setSelectedPromptIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= MAX_BULK_SELECTION) {
        toastRef.current.error(
          `Chỉ có thể chọn tối đa ${MAX_BULK_SELECTION} đề luyện nói mỗi lần.`,
        );
        return prev;
      }
      return [...prev, id];
    });
  };

  const handleBulkPublishPrompts = async (
    published: boolean,
  ): Promise<void> => {
    if (selectedPromptIds.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBannerError(null);
    try {
      const ids = selectedPromptIds.slice(0, MAX_BULK_SELECTION);
      const res = await bulkPublishAdminSpeakingPrompts(ids, published);
      toastRef.current.success(
        published
          ? `Đã xuất bản hàng loạt ${res.updatedCount} đề luyện nói.`
          : `Đã chuyển ${res.updatedCount} đề luyện nói về bản nháp.`,
      );
      setSelectedPromptIds([]);
      await loadPrompts();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể cập nhật trạng thái hàng loạt.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleTogglePublish = async (
    prompt: AdminSpeakingPrompt,
  ): Promise<void> => {
    setBannerError(null);
    try {
      await updateAdminSpeakingPrompt(prompt.id, {
        published: !prompt.published,
      });
      toastRef.current.success(
        !prompt.published
          ? `Đã xuất bản đề "${prompt.title}".`
          : `Đã chuyển đề "${prompt.title}" về bản nháp.`,
      );
      await loadPrompts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cập nhật thất bại.';
      setBannerError(msg);
      toastRef.current.error(msg);
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setBannerError(null);
    try {
      const res = await deleteAdminSpeakingPrompt(deleteTarget.id, forceDelete);
      toastRef.current.success(
        res.action === 'DELETED'
          ? `Đã xoá đề luyện nói "${deleteTarget.title}".`
          : `Đề "${deleteTarget.title}" đã có ${res.submissionsCount} bài nộp nên đã chuyển sang Bản nháp.`,
      );
      setDeleteTarget(null);
      setForceDelete(false);
      await loadPrompts();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Xoá đề thất bại.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    setBannerError(null);
    try {
      await downloadAdminExport('speaking', 'json');
      toastRef.current.success('Đã xuất dữ liệu đề luyện nói (JSON).');
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Xuất dữ liệu đề luyện nói thất bại.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setExporting(false);
    }
  };

  // ================= TAB 2 HANDLERS =================
  const hasActiveSubFilters = Boolean(
    subStatusFilter ||
      subModeFilter ||
      subErrorCodeInput.trim() ||
      subErrorCodeQuery.trim() ||
      subSearchInput.trim() ||
      subSearchQuery.trim(),
  );

  const handleResetSubFilters = (): void => {
    setSubPage(1);
    setSubStatusFilter('');
    setSubModeFilter('');
    setSubErrorCodeInput('');
    setSubErrorCodeQuery('');
    setSubSearchInput('');
    setSubSearchQuery('');
  };

  const openSubmissionDrawer = useCallback(async (id: string): Promise<void> => {
    const reqId = ++subDetailReqRef.current;
    setSelectedSubId(id);
    setSubDetail(null);
    setSubDetailError(null);
    setSubDetailLoading(true);
    try {
      const detail = await getAdminSpeakingSubmission(id);
      if (reqId !== subDetailReqRef.current) return;
      setSubDetail(detail);
    } catch (err) {
      if (reqId !== subDetailReqRef.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể tải chi tiết bài nộp Speaking.';
      setSubDetailError(msg);
      toastRef.current.error(msg);
    } finally {
      if (reqId === subDetailReqRef.current) {
        setSubDetailLoading(false);
      }
    }
  }, []);

  const handleRetrySubmissionContent = async (): Promise<void> => {
    if (!subDetail || !subDetail.canRetryContent || retryingSubContent) return;
    setRetryingSubContent(true);
    try {
      await retryAdminSpeakingSubmissionContent(subDetail.id);
      toastRef.current.success('Đã chấm lại nội dung bài nộp Speaking.');
      await Promise.all([
        openSubmissionDrawer(subDetail.id),
        loadSubmissions(),
      ]);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể chấm lại nội dung bài nộp.';
      toastRef.current.error(msg);
    } finally {
      setRetryingSubContent(false);
    }
  };

  const handleConfirmExpireSubmission = async (): Promise<void> => {
    if (!expireSubTarget || expiringSub) return;
    setExpiringSub(true);
    try {
      await expireAdminSpeakingSubmission(expireSubTarget.id);
      toastRef.current.success(
        'Đã đóng job bị kẹt và chuyển trạng thái bài nộp sang UNKNOWN.',
      );
      const targetId = expireSubTarget.id;
      setExpireSubTarget(null);
      await Promise.all([openSubmissionDrawer(targetId), loadSubmissions()]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể đóng job bị kẹt.';
      toastRef.current.error(msg);
    } finally {
      setExpiringSub(false);
    }
  };

  // ================= TAB 3 HANDLERS =================
  const hasActiveVoiceFilters = Boolean(
    voiceStatusFilter ||
      voiceAssessmentFilter ||
      voiceStuckOnly ||
      voiceSearchInput.trim() ||
      voiceSearchQuery.trim(),
  );

  const handleResetVoiceFilters = (): void => {
    setVoicePage(1);
    setVoiceStatusFilter('');
    setVoiceAssessmentFilter('');
    setVoiceStuckOnly(false);
    setVoiceSearchInput('');
    setVoiceSearchQuery('');
  };

  const openVoiceDrawer = useCallback(async (id: string): Promise<void> => {
    const reqId = ++voiceDetailReqRef.current;
    setSelectedVoiceId(id);
    setVoiceDetail(null);
    setVoiceDetailError(null);
    setVoiceDetailLoading(true);
    try {
      const detail = await getAdminVoiceConversation(id);
      if (reqId !== voiceDetailReqRef.current) return;
      setVoiceDetail(detail);
    } catch (err) {
      if (reqId !== voiceDetailReqRef.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể tải chi tiết phiên hội thoại Voice AI.';
      setVoiceDetailError(msg);
      toastRef.current.error(msg);
    } finally {
      if (reqId === voiceDetailReqRef.current) {
        setVoiceDetailLoading(false);
      }
    }
  }, []);

  const handleConfirmReleaseVoiceLock = async (): Promise<void> => {
    if (!releaseLockTarget || releasingLock) return;
    setReleasingLock(true);
    try {
      const res = await releaseAdminVoiceConversationLock(releaseLockTarget.id);
      toastRef.current.success(
        res.hadLiveCall
          ? 'Đã ngắt kết nối phiên live và giải phóng khóa thành công.'
          : 'Đã giải phóng khóa phiên hội thoại thành công.',
      );
      const targetId = releaseLockTarget.id;
      setReleaseLockTarget(null);
      await Promise.all([
        openVoiceDrawer(targetId),
        loadVoiceConversations(),
      ]);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Không thể giải phóng khóa.';
      toastRef.current.error(msg);
    } finally {
      setReleasingLock(false);
    }
  };

  const canRetryVoiceContent = Boolean(
    voiceDetail &&
      ['FAILED', 'PARTIAL', 'UNKNOWN'].includes(voiceDetail.assessmentStatus) &&
      voiceDetail.turnsCount > 0,
  );

  const handleRetryVoiceContent = async (): Promise<void> => {
    if (!voiceDetail || !canRetryVoiceContent || retryingVoiceContent) return;
    setRetryingVoiceContent(true);
    try {
      await retryAdminVoiceConversationContent(voiceDetail.id);
      toastRef.current.success(
        'Đã gửi yêu cầu chấm lại nội dung hội thoại Voice AI.',
      );
      await Promise.all([
        openVoiceDrawer(voiceDetail.id),
        loadVoiceConversations(),
      ]);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể chấm lại nội dung hội thoại.';
      toastRef.current.error(msg);
    } finally {
      setRetryingVoiceContent(false);
    }
  };

  // Parsed drawer payloads
  const parsedSubSnapshot = useMemo(
    () => (subDetail ? parsePromptSnapshot(subDetail.promptSnapshot) : null),
    [subDetail],
  );
  const parsedSubResult = useMemo(
    () => (subDetail ? parseSpeakingSubmissionResult(subDetail.result) : null),
    [subDetail],
  );
  const sortedVoiceTurns = useMemo(
    () =>
      voiceDetail
        ? [...voiceDetail.turns].sort((a, b) => a.sequence - b.sequence)
        : [],
    [voiceDetail],
  );
  const parsedVoiceAssessment = useMemo(
    () => (voiceDetail ? parseVoiceAssessment(voiceDetail.assessment) : null),
    [voiceDetail],
  );

  return (
    <AdminShell
      breadcrumbTitle="Luyện nói"
      title="Speaking Prompts & Voice AI Ops"
      subtitle="Quản lý đề luyện nói, giám sát bài nộp Speaking lỗi/treo và điều phối phiên hội thoại Voice AI."
      onAuthenticated={() => setAuthReady(true)}
      actions={
        <>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{exporting ? 'Đang xuất...' : 'JSON'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingPrompt(null);
              setCloningPrompt(null);
              setShowModal(true);
            }}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo đề nói</span>
          </button>
        </>
      }
    >
      {() => (
        <div className="space-y-5">
          <AdminToastBridge toastRef={toastRef} />
          <SpeakingQuerySync
            params={activeQueryParams}
            onExternalQueryChange={handleExternalQueryChange}
          />

          {/* 3 Tab Điều hướng đồng bộ URL */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap rounded-xl border border-slateDark-100 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveTab('prompts')}
                className={
                  activeTab === 'prompts'
                    ? 'inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm'
                    : 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50'
                }
              >
                <Mic className="h-3.5 w-3.5" />
                <span>Đề luyện nói</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('submissions')}
                className={
                  activeTab === 'submissions'
                    ? 'inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm'
                    : 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50'
                }
              >
                <FileAudio className="h-3.5 w-3.5" />
                <span>Bài nộp Speaking</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('voice')}
                className={
                  activeTab === 'voice'
                    ? 'inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm'
                    : 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50'
                }
              >
                <AudioLines className="h-3.5 w-3.5" />
                <span>Hội thoại Voice AI</span>
              </button>
            </div>
          </div>

          {bannerError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700">
              {bannerError}
            </div>
          )}

          {/* ===================== TAB 1: ĐỀ LUYỆN NÓI ===================== */}
          {activeTab === 'prompts' && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <LegacyStatCard
                  label="Tổng đề luyện nói"
                  value={promptsSummary.total}
                  subtitle={`${promptsSummary.readAloud} Read Aloud · ${promptsSummary.tongueTwister} Twister`}
                  icon={<Mic className="h-4 w-4" />}
                  tone="green"
                />
                <LegacyStatCard
                  label="Đã xuất bản"
                  value={promptsSummary.published}
                  subtitle="Hiển thị trên ứng dụng"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  tone="emerald"
                />
                <LegacyStatCard
                  label="Chủ đề / Voice AI"
                  value={promptsSummary.topic}
                  subtitle="Hỗ trợ Preparation DB"
                  icon={<MessageSquare className="h-4 w-4" />}
                  tone="amber"
                />
                <LegacyStatCard
                  label="Mô tả tranh"
                  value={promptsSummary.pictureDescription}
                  subtitle="Kèm ảnh & visualContext"
                  icon={<ImageIcon className="h-4 w-4" />}
                  tone="slate"
                />
              </div>

              {/* Mode Tabs & Filters */}
              <div className="space-y-3 rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap gap-1.5">
                  {MODE_TABS.map((item) => (
                    <button
                      key={item.value || 'all'}
                      type="button"
                      onClick={() => {
                        setPromptModeFilter(item.value);
                        setPromptsPage(1);
                      }}
                      className={
                        promptModeFilter === item.value
                          ? 'rounded-xl bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white'
                          : 'rounded-xl bg-slateDark-50 px-3.5 py-1.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-100'
                      }
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPromptsPage(1);
                    setPromptSearchQuery(promptSearchInput.trim());
                  }}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-12"
                >
                  <div className="relative sm:col-span-5">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
                    <input
                      type="text"
                      value={promptSearchInput}
                      onChange={(e) => setPromptSearchInput(e.target.value)}
                      placeholder="Tìm mã đề, tiêu đề hoặc nội dung..."
                      className="w-full rounded-xl border border-slateDark-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <select
                    value={promptPublishedFilter}
                    onChange={(e) => {
                      setPromptsPage(1);
                      setPromptPublishedFilter(
                        e.target.value as '' | 'true' | 'false',
                      );
                    }}
                    className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs sm:col-span-3"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="true">Published</option>
                    <option value="false">Bản nháp</option>
                  </select>
                  <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-4">
                    <button
                      type="submit"
                      className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-4 py-2 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-100"
                    >
                      Lọc
                    </button>
                    <button
                      type="button"
                      disabled={!hasActivePromptFilters}
                      onClick={handleResetPromptFilters}
                      className="inline-flex items-center gap-1 rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Đặt lại bộ lọc</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Bulk Action Bar */}
              {selectedPromptIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-25 px-5 py-3 shadow-sm">
                  <p className="text-xs font-bold text-brand-900">
                    Đã chọn {selectedPromptIds.length} đề luyện nói (tối đa{' '}
                    {MAX_BULK_SELECTION}/lần)
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => void handleBulkPublishPrompts(true)}
                      className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {bulkBusy ? 'Đang xử lý...' : 'Xuất bản hàng loạt'}
                    </button>
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => void handleBulkPublishPrompts(false)}
                      className="rounded-xl bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:opacity-50"
                    >
                      {bulkBusy ? 'Đang xử lý...' : 'Chuyển nháp hàng loạt'}
                    </button>
                    <button
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => setSelectedPromptIds([])}
                      className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50 disabled:opacity-50"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                      <tr>
                        <th className="w-10 px-4 py-3.5">
                          <input
                            type="checkbox"
                            aria-label="Chọn tất cả đề luyện nói trên trang này"
                            checked={allPromptsSelected}
                            disabled={prompts.length === 0}
                            onChange={handleToggleSelectAllPrompts}
                            className="h-4 w-4 accent-brand-600"
                          />
                        </th>
                        <th className="px-4 py-3.5">Đề luyện nói</th>
                        <th className="px-4 py-3.5">Chế độ</th>
                        <th className="px-4 py-3.5">Độ khó / Thời lượng</th>
                        <th className="px-4 py-3.5">Trạng thái</th>
                        <th className="px-5 py-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slateDark-100">
                      {promptsLoading ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-12 text-center text-slateDark-700"
                          >
                            Đang tải danh sách đề luyện nói...
                          </td>
                        </tr>
                      ) : prompts.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-12 text-center text-slateDark-700"
                          >
                            Không tìm thấy đề luyện nói nào.
                          </td>
                        </tr>
                      ) : (
                        prompts.map((p) => {
                          const isSelected = selectedPromptIds.includes(p.id);
                          return (
                            <tr
                              key={p.id}
                              className={
                                isSelected
                                  ? 'bg-brand-25/40 hover:bg-brand-25/70'
                                  : 'hover:bg-slateDark-25'
                              }
                            >
                              <td className="px-4 py-3.5">
                                <input
                                  type="checkbox"
                                  aria-label={`Chọn đề ${p.title}`}
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectPrompt(p.id)}
                                  className="h-4 w-4 accent-brand-600"
                                />
                              </td>
                              <td className="max-w-md px-4 py-3.5">
                                <div className="flex items-center gap-3">
                                  {p.imageUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={resolveAdminMediaUrl(p.imageUrl)}
                                      alt={p.title}
                                      className="h-10 w-10 shrink-0 rounded-lg border border-slateDark-100 object-cover"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate font-bold text-slateDark-900">
                                      {p.title}
                                    </p>
                                    <p className="truncate font-mono text-[11px] text-brand-700">
                                      {p.code} · {p.submissionsCount} lượt nộp
                                      {p.preparation ? ' · Có Voice Prep' : ''}
                                    </p>
                                    <p className="mt-0.5 line-clamp-1 text-slateDark-700">
                                      {p.text}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3.5">
                                <span className="rounded-full bg-slateDark-50 px-2.5 py-0.5 font-semibold text-slateDark-800">
                                  {p.mode}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-slateDark-800">
                                Lv.{p.difficulty} · {p.maxDurationSeconds}s
                              </td>
                              <td className="px-4 py-3.5">
                                <button
                                  type="button"
                                  onClick={() => void handleTogglePublish(p)}
                                  className={
                                    p.published
                                      ? 'rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-100'
                                      : 'rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-100'
                                  }
                                >
                                  {p.published ? 'Published' : 'Draft'}
                                </button>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingPrompt(null);
                                      setCloningPrompt(p);
                                      setShowModal(true);
                                    }}
                                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1 font-semibold text-brand-800 hover:bg-brand-50"
                                  >
                                    <Copy className="h-3 w-3" />
                                    <span>Nhân bản</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCloningPrompt(null);
                                      setEditingPrompt(p);
                                      setShowModal(true);
                                    }}
                                    className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 font-semibold text-slateDark-900 hover:bg-slateDark-50"
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setForceDelete(false);
                                      setDeleteTarget(p);
                                    }}
                                    className="rounded-lg border border-red-200 bg-white px-2.5 py-1 font-semibold text-red-600 hover:bg-red-50"
                                  >
                                    Xóa
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <GlobalPagination
                  page={promptsPagination.page}
                  limit={promptsPagination.limit}
                  total={promptsPagination.total}
                  totalPages={promptsPagination.totalPages}
                  onPageChange={(next) => setPromptsPage(next)}
                  onLimitChange={(nextLimit) => {
                    setPromptsLimit(nextLimit);
                    setPromptsPage(1);
                  }}
                />
              </div>
            </>
          )}

          {/* ===================== TAB 2: BÀI NỘP SPEAKING ===================== */}
          {activeTab === 'submissions' && (
            <>
              {/* Summary Badges */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSubStatusFilter(
                      subStatusFilter === 'FAILED' ? '' : 'FAILED',
                    );
                    setSubPage(1);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                    subStatusFilter === 'FAILED'
                      ? 'border-red-400 bg-red-100 text-red-900 shadow-sm'
                      : 'border-red-200 bg-red-50/70 text-red-800 hover:bg-red-50'
                  }`}
                >
                  <XCircle className="h-3.5 w-3.5 text-red-600" />
                  <span>Thất bại (FAILED):</span>
                  <strong className="font-mono">{subSummary.failed}</strong>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubStatusFilter(
                      subStatusFilter === 'UNKNOWN' ? '' : 'UNKNOWN',
                    );
                    setSubPage(1);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                    subStatusFilter === 'UNKNOWN'
                      ? 'border-amber-400 bg-amber-100 text-amber-950 shadow-sm'
                      : 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-50'
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <span>Không rõ (UNKNOWN):</span>
                  <strong className="font-mono">{subSummary.unknown}</strong>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubStatusFilter(
                      subStatusFilter === 'PROCESSING' ? '' : 'PROCESSING',
                    );
                    setSubPage(1);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                    subStatusFilter === 'PROCESSING'
                      ? 'border-blue-400 bg-blue-100 text-blue-950 shadow-sm'
                      : 'border-blue-200 bg-blue-50/70 text-blue-900 hover:bg-blue-50'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  <span>Treo xử lý (&gt;3p):</span>
                  <strong className="font-mono">
                    {subSummary.stuckProcessing}
                  </strong>
                </button>
                <div className="inline-flex items-center gap-2 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2 text-xs font-semibold text-slateDark-800">
                  <Info className="h-3.5 w-3.5 text-slateDark-600" />
                  <span>Thiếu chấm nội dung:</span>
                  <strong className="font-mono text-slateDark-900">
                    {subSummary.contentUnavailable}
                  </strong>
                </div>
              </div>

              {/* Bộ lọc Submissions */}
              <div className="rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setSubPage(1);
                    setSubSearchQuery(subSearchInput.trim());
                    setSubErrorCodeQuery(subErrorCodeInput.trim());
                  }}
                  className="grid grid-cols-1 gap-3 lg:grid-cols-12"
                >
                  <div className="relative lg:col-span-3">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
                    <input
                      type="text"
                      value={subSearchInput}
                      onChange={(e) => setSubSearchInput(e.target.value)}
                      placeholder="Email, tên, mã đề hoặc UUID..."
                      className="w-full rounded-xl border border-slateDark-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <select
                    value={subStatusFilter}
                    onChange={(e) => {
                      setSubPage(1);
                      setSubStatusFilter(e.target.value as SpeakingStatus | '');
                    }}
                    className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs lg:col-span-2"
                  >
                    <option value="">Tất cả trạng thái</option>
                    {SPEAKING_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <select
                    value={subModeFilter}
                    onChange={(e) => {
                      setSubPage(1);
                      setSubModeFilter(e.target.value as SpeakingMode | '');
                    }}
                    className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs lg:col-span-2"
                  >
                    <option value="">Tất cả chế độ</option>
                    {SPEAKING_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={subErrorCodeInput}
                    onChange={(e) => setSubErrorCodeInput(e.target.value)}
                    placeholder="Mã lỗi (errorCode)..."
                    className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 font-mono text-xs focus:border-brand-500 focus:outline-none lg:col-span-2"
                  />
                  <div className="flex flex-wrap items-center justify-end gap-1.5 lg:col-span-3">
                    <button
                      type="submit"
                      className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-100"
                    >
                      Lọc
                    </button>
                    <button
                      type="button"
                      disabled={!hasActiveSubFilters}
                      onClick={handleResetSubFilters}
                      className="inline-flex items-center gap-1 rounded-xl border border-slateDark-200 bg-white px-2.5 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Đặt lại bộ lọc</span>
                    </button>
                    <button
                      type="button"
                      disabled={subsLoading}
                      onClick={() => void loadSubmissions()}
                      aria-label="Làm mới bài nộp Speaking"
                      className="rounded-xl border border-slateDark-200 bg-white p-2 text-slateDark-800 hover:bg-slateDark-50 disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${subsLoading ? 'animate-spin' : ''}`}
                      />
                    </button>
                  </div>
                </form>
              </div>

              {/* Bảng Bài nộp Speaking */}
              <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                      <tr>
                        <th className="px-5 py-3.5">Học viên</th>
                        <th className="px-4 py-3.5">Đề luyện nói</th>
                        <th className="px-4 py-3.5">Trạng thái</th>
                        <th className="px-4 py-3.5">Điểm / Lỗi</th>
                        <th className="px-4 py-3.5">Thời gian</th>
                        <th className="px-5 py-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slateDark-100">
                      {subsLoading ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-12 text-center text-slateDark-700"
                          >
                            Đang tải danh sách bài nộp Speaking...
                          </td>
                        </tr>
                      ) : submissions.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-12 text-center text-slateDark-700"
                          >
                            Không có bài nộp Speaking nào khớp bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        submissions.map((sub) => (
                          <tr
                            key={sub.id}
                            onClick={() => void openSubmissionDrawer(sub.id)}
                            className="cursor-pointer transition hover:bg-slateDark-25"
                          >
                            <td className="px-5 py-3.5">
                              <p className="font-bold text-slateDark-900">
                                {sub.user.name}
                              </p>
                              <p className="text-[11px] text-slateDark-600">
                                {sub.user.email}
                              </p>
                            </td>
                            <td className="max-w-xs px-4 py-3.5">
                              <p className="truncate font-semibold text-slateDark-900">
                                {sub.promptTitle}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="rounded bg-slateDark-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slateDark-700">
                                  {sub.mode}
                                </span>
                                {sub.promptCode && (
                                  <span className="truncate font-mono text-[10px] text-brand-700">
                                    {sub.promptCode}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${submissionStatusBadgeClass(sub.status)}`}
                                >
                                  {sub.status}
                                </span>
                                {sub.isStuckProcessing && (
                                  <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                    Job kẹt
                                  </span>
                                )}
                                {sub.contentStatus && (
                                  <span
                                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                                      sub.contentStatus === 'succeeded'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : sub.contentStatus === 'unavailable'
                                          ? 'bg-amber-50 text-amber-800'
                                          : 'bg-slateDark-50 text-slateDark-700'
                                    }`}
                                  >
                                    content:{sub.contentStatus}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="font-mono font-bold text-slateDark-900">
                                {sub.overallScore !== null
                                  ? `${formatScore(sub.overallScore)} / 100`
                                  : '—'}
                              </p>
                              {sub.errorCode && (
                                <p className="mt-0.5 font-mono text-[11px] font-semibold text-red-600">
                                  {sub.errorCode}
                                </p>
                              )}
                              {sub.adapterVersion && (
                                <p className="font-mono text-[10px] text-slateDark-600">
                                  {sub.adapterVersion}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-[11px] text-slateDark-700">
                              <p>{formatDateTime(sub.createdAt)}</p>
                              {sub.completedAt && (
                                <p className="text-[10px] text-slateDark-600">
                                  Xong: {formatDateTime(sub.completedAt)}
                                </p>
                              )}
                            </td>
                            <td
                              className="px-5 py-3.5 text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  void openSubmissionDrawer(sub.id)
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1 font-semibold text-brand-800 hover:bg-brand-50"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Chi tiết</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <GlobalPagination
                  page={subPagination.page}
                  limit={subPagination.limit}
                  total={subPagination.total}
                  totalPages={subPagination.totalPages}
                  onPageChange={(next) => setSubPage(next)}
                  onLimitChange={(nextLimit) => {
                    setSubLimit(nextLimit);
                    setSubPage(1);
                  }}
                />
              </div>
            </>
          )}

          {/* ===================== TAB 3: HỘI THOẠI VOICE AI ===================== */}
          {activeTab === 'voice' && (
            <>
              {/* Summary Badges */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setVoiceStuckOnly((prev) => !prev);
                    setVoicePage(1);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                    voiceStuckOnly
                      ? 'border-red-400 bg-red-100 text-red-900 shadow-sm'
                      : 'border-red-200 bg-red-50/70 text-red-800 hover:bg-red-50'
                  }`}
                >
                  <Lock className="h-3.5 w-3.5 text-red-600" />
                  <span>Khóa đang hoạt động (activeLocks):</span>
                  <strong className="font-mono">
                    {voiceSummary.activeLocks}
                  </strong>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoiceAssessmentFilter(
                      voiceAssessmentFilter === 'FAILED' ? '' : 'FAILED',
                    );
                    setVoicePage(1);
                  }}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                    voiceAssessmentFilter === 'FAILED'
                      ? 'border-amber-400 bg-amber-100 text-amber-950 shadow-sm'
                      : 'border-amber-200 bg-amber-50/70 text-amber-900 hover:bg-amber-50'
                  }`}
                >
                  <XCircle className="h-3.5 w-3.5 text-amber-700" />
                  <span>Chấm điểm lỗi (failedAssessments):</span>
                  <strong className="font-mono">
                    {voiceSummary.failedAssessments}
                  </strong>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoiceStuckOnly(true);
                    setVoicePage(1);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 px-3.5 py-2 text-xs font-semibold text-blue-900 hover:bg-blue-50"
                >
                  <Clock className="h-3.5 w-3.5 text-blue-600" />
                  <span>Chấm điểm treo (stuckProcessing):</span>
                  <strong className="font-mono">
                    {voiceSummary.stuckProcessing}
                  </strong>
                </button>
              </div>

              {/* Bộ lọc Voice AI */}
              <div className="space-y-3 rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setVoicePage(1);
                    setVoiceSearchQuery(voiceSearchInput.trim());
                  }}
                  className="grid grid-cols-1 items-center gap-3 lg:grid-cols-12"
                >
                  <div className="relative lg:col-span-3">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
                    <input
                      type="text"
                      value={voiceSearchInput}
                      onChange={(e) => setVoiceSearchInput(e.target.value)}
                      placeholder="Email, tên học viên hoặc UUID..."
                      className="w-full rounded-xl border border-slateDark-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <select
                    value={voiceStatusFilter}
                    onChange={(e) => {
                      setVoicePage(1);
                      setVoiceStatusFilter(
                        e.target.value as VoiceSessionStatus | '',
                      );
                    }}
                    className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs lg:col-span-2"
                  >
                    <option value="">Tất cả trạng thái phiên</option>
                    {VOICE_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <select
                    value={voiceAssessmentFilter}
                    onChange={(e) => {
                      setVoicePage(1);
                      setVoiceAssessmentFilter(
                        e.target.value as VoiceAssessmentStatus | '',
                      );
                    }}
                    className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs lg:col-span-2"
                  >
                    <option value="">Tất cả trạng thái chấm</option>
                    {VOICE_ASSESSMENT_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slateDark-200 bg-slateDark-25 px-3 py-2 text-xs font-semibold text-slateDark-800 lg:col-span-2">
                    <input
                      type="checkbox"
                      checked={voiceStuckOnly}
                      onChange={(e) => {
                        setVoicePage(1);
                        setVoiceStuckOnly(e.target.checked);
                      }}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span>Chỉ phiên treo / khóa</span>
                  </label>
                  <div className="flex flex-wrap items-center justify-end gap-1.5 lg:col-span-3">
                    <button
                      type="submit"
                      className="rounded-xl border border-slateDark-200 bg-slateDark-50 px-3.5 py-2 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-100"
                    >
                      Lọc
                    </button>
                    <button
                      type="button"
                      disabled={!hasActiveVoiceFilters}
                      onClick={handleResetVoiceFilters}
                      className="inline-flex items-center gap-1 rounded-xl border border-slateDark-200 bg-white px-2.5 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Đặt lại bộ lọc</span>
                    </button>
                    <button
                      type="button"
                      disabled={voiceLoading}
                      onClick={() => void loadVoiceConversations()}
                      aria-label="Làm mới hội thoại Voice AI"
                      className="rounded-xl border border-slateDark-200 bg-white p-2 text-slateDark-800 hover:bg-slateDark-50 disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${voiceLoading ? 'animate-spin' : ''}`}
                      />
                    </button>
                  </div>
                </form>
              </div>

              {/* Bảng Hội thoại Voice AI */}
              <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                      <tr>
                        <th className="px-5 py-3.5">Học viên</th>
                        <th className="px-4 py-3.5">Chủ đề & Số lượt</th>
                        <th className="px-4 py-3.5">Trạng thái phiên</th>
                        <th className="px-4 py-3.5">Trạng thái chấm</th>
                        <th className="px-4 py-3.5">Thời gian</th>
                        <th className="px-5 py-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slateDark-100">
                      {voiceLoading ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-12 text-center text-slateDark-700"
                          >
                            Đang tải danh sách hội thoại Voice AI...
                          </td>
                        </tr>
                      ) : voiceRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-12 text-center text-slateDark-700"
                          >
                            Không có phiên hội thoại nào khớp bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        voiceRows.map((vc) => (
                          <tr
                            key={vc.id}
                            onClick={() => void openVoiceDrawer(vc.id)}
                            className="cursor-pointer transition hover:bg-slateDark-25"
                          >
                            <td className="px-5 py-3.5">
                              <p className="font-bold text-slateDark-900">
                                {vc.user.name}
                              </p>
                              <p className="text-[11px] text-slateDark-600">
                                {vc.user.email}
                              </p>
                            </td>
                            <td className="max-w-xs px-4 py-3.5">
                              <p className="truncate font-semibold text-slateDark-900">
                                {vc.topicTitle}
                              </p>
                              <p className="mt-0.5 font-mono text-[11px] text-slateDark-600">
                                {vc.turnsCount} lượt nói · {vc.historyStatus}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${voiceSessionBadgeClass(vc.status)}`}
                                >
                                  {vc.status}
                                </span>
                                {vc.hasActiveLock && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                    <Lock className="h-3 w-3" />
                                    <span>Đang khóa</span>
                                  </span>
                                )}
                              </div>
                              {vc.endReason && (
                                <p className="mt-0.5 font-mono text-[10px] text-slateDark-600">
                                  {vc.endReason}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${voiceAssessmentBadgeClass(vc.assessmentStatus)}`}
                              >
                                {vc.assessmentStatus}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-[11px] text-slateDark-700">
                              <p>{formatDateTime(vc.createdAt)}</p>
                              {vc.endedAt && (
                                <p className="text-[10px] text-slateDark-600">
                                  Kết thúc: {formatDateTime(vc.endedAt)}
                                </p>
                              )}
                            </td>
                            <td
                              className="px-5 py-3.5 text-right"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => void openVoiceDrawer(vc.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1 font-semibold text-brand-800 hover:bg-brand-50"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>Chi tiết</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <GlobalPagination
                  page={voicePagination.page}
                  limit={voicePagination.limit}
                  total={voicePagination.total}
                  totalPages={voicePagination.totalPages}
                  onPageChange={(next) => setVoicePage(next)}
                  onLimitChange={(nextLimit) => {
                    setVoiceLimit(nextLimit);
                    setVoicePage(1);
                  }}
                />
              </div>
            </>
          )}

          {/* ===================== MODAL TẠO / SỬA / NHÂN BẢN ĐỀ NÓI ===================== */}
          {showModal && (
            <SpeakingPromptModal
              editingPrompt={editingPrompt}
              cloneFrom={cloningPrompt}
              onClose={() => {
                setShowModal(false);
                setEditingPrompt(null);
                setCloningPrompt(null);
              }}
              onSaved={() => {
                const wasEditing = Boolean(editingPrompt);
                const wasCloning = Boolean(cloningPrompt);
                setShowModal(false);
                setEditingPrompt(null);
                setCloningPrompt(null);
                toastRef.current.success(
                  wasEditing
                    ? 'Đã cập nhật đề luyện nói.'
                    : wasCloning
                      ? 'Đã nhân bản đề luyện nói thành công.'
                      : 'Đã tạo đề luyện nói mới.',
                );
                if (activeTab === 'prompts') {
                  void loadPrompts();
                } else {
                  setActiveTab('prompts');
                }
              }}
            />
          )}

          {/* ===================== SLIDE-OVER DRAWER: SPEAKING SUBMISSION ===================== */}
          {selectedSubId && (
            <div
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedSubId(null);
                  setSubDetail(null);
                }
              }}
              className="fixed inset-0 z-50 flex justify-end bg-slateDark-900/50 backdrop-blur-[1px]"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Chi tiết bài nộp Speaking"
                className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slateDark-100 px-6 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-bold text-slateDark-900">
                        {subDetail?.promptTitle ?? 'Chi tiết bài nộp Speaking'}
                      </h2>
                      {subDetail && (
                        <span
                          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${submissionStatusBadgeClass(subDetail.status)}`}
                        >
                          {subDetail.status}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-slateDark-600">
                      ID: {selectedSubId}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Đóng chi tiết bài nộp"
                    onClick={() => {
                      setSelectedSubId(null);
                      setSubDetail(null);
                    }}
                    className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-6 text-xs">
                  {subDetailLoading ? (
                    <div className="py-16 text-center text-slateDark-700">
                      Đang tải chi tiết bài nộp Speaking...
                    </div>
                  ) : subDetailError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                      {subDetailError}
                    </div>
                  ) : subDetail ? (
                    <>
                      {/* Lưu ý kỹ thuật không lưu raw audio */}
                      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-amber-950">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                        <p className="leading-relaxed">
                          <strong>Lưu ý vận hành:</strong> Hệ thống không lưu
                          trữ bản thu âm gốc (raw audio). Do đó các bài lỗi ở
                          bước chấm giọng nói Azure Speech (
                          <code className="font-mono">result === null</code>)
                          không thể chấm lại từ phía máy chủ — học viên cần thu
                          âm và nộp lại. Chỉ có thể{' '}
                          <strong>chấm lại nội dung</strong> đối với bài{' '}
                          <code className="font-mono">TOPIC</code> /{' '}
                          <code className="font-mono">PICTURE_DESCRIPTION</code>{' '}
                          đã có lời thoại (transcript) hợp lệ.
                        </p>
                      </div>

                      {/* Thanh hành động xử lý sự cố */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={
                            !subDetail.canRetryContent || retryingSubContent
                          }
                          title={
                            subDetail.canRetryContent
                              ? 'Chạy lại bước chấm nội dung AI dựa trên transcript đã lưu'
                              : 'Chỉ khả dụng với bài TOPIC / PICTURE_DESCRIPTION đã có transcript và không đang PROCESSING'
                          }
                          onClick={() => void handleRetrySubmissionContent()}
                          className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 ${retryingSubContent ? 'animate-spin' : ''}`}
                          />
                          <span>
                            {retryingSubContent
                              ? 'Đang chấm lại...'
                              : 'Chấm lại nội dung'}
                          </span>
                        </button>

                        {subDetail.isStuckProcessing && (
                          <button
                            type="button"
                            onClick={() => setExpireSubTarget(subDetail)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>Đóng job kẹt</span>
                          </button>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-slateDark-100 bg-slateDark-25 p-4 sm:grid-cols-2">
                        <div>
                          <span className="text-[11px] text-slateDark-600">
                            Học viên
                          </span>
                          <p className="font-semibold text-slateDark-900">
                            {subDetail.user.name} ({subDetail.user.email})
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slateDark-600">
                            Chế độ / Mã đề
                          </span>
                          <p className="font-mono font-semibold text-slateDark-900">
                            {subDetail.mode}
                            {subDetail.promptCode
                              ? ` · ${subDetail.promptCode}`
                              : ''}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slateDark-600">
                            Mã lỗi (errorCode)
                          </span>
                          <p
                            className={`font-mono font-semibold ${subDetail.errorCode ? 'text-red-700' : 'text-slateDark-700'}`}
                          >
                            {subDetail.errorCode ?? '—'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slateDark-600">
                            Adapter Version
                          </span>
                          <p className="font-mono font-semibold text-slateDark-900">
                            {subDetail.adapterVersion ?? '—'}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-[11px] text-slateDark-600">
                            Audio Hash (SHA-256)
                          </span>
                          <p className="break-all font-mono text-[11px] text-slateDark-800">
                            {subDetail.audioHash ?? '—'}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slateDark-600">
                            Tạo lúc / Xử lý lúc
                          </span>
                          <p className="text-slateDark-800">
                            {formatDateTime(subDetail.createdAt)} ·{' '}
                            {formatDateTime(subDetail.processingAt)}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slateDark-600">
                            Hoàn tất lúc
                          </span>
                          <p className="text-slateDark-800">
                            {formatDateTime(subDetail.completedAt)}
                          </p>
                        </div>
                      </div>

                      {/* Prompt Snapshot */}
                      <section className="space-y-2 rounded-xl border border-slateDark-100 bg-white p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
                          Ngữ cảnh đề bài (promptSnapshot)
                        </h3>
                        {parsedSubSnapshot ? (
                          <div className="space-y-2">
                            {parsedSubSnapshot.text && (
                              <p className="rounded-lg bg-slateDark-25 p-3 text-sm text-slateDark-900">
                                {parsedSubSnapshot.text}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 text-[11px] text-slateDark-700">
                              {parsedSubSnapshot.difficulty !== null && (
                                <span className="rounded bg-slateDark-50 px-2 py-0.5 font-semibold">
                                  Lv.{parsedSubSnapshot.difficulty}
                                </span>
                              )}
                              {parsedSubSnapshot.maxDurationSeconds !== null && (
                                <span className="rounded bg-slateDark-50 px-2 py-0.5 font-semibold">
                                  Tối đa {parsedSubSnapshot.maxDurationSeconds}s
                                </span>
                              )}
                              {parsedSubSnapshot.assessmentProfile && (
                                <span className="rounded bg-brand-50 px-2 py-0.5 font-mono font-semibold text-brand-800">
                                  {parsedSubSnapshot.assessmentProfile}
                                </span>
                              )}
                              {parsedSubSnapshot.contentVersion !== null && (
                                <span className="rounded bg-slateDark-50 px-2 py-0.5 font-mono">
                                  v{parsedSubSnapshot.contentVersion}
                                </span>
                              )}
                            </div>
                            {parsedSubSnapshot.hints.length > 0 && (
                              <div>
                                <p className="text-[11px] font-semibold text-slateDark-700">
                                  Gợi ý:
                                </p>
                                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slateDark-800">
                                  {parsedSubSnapshot.hints.map((h, i) => (
                                    <li key={i}>{h}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {parsedSubSnapshot.visualContext && (
                              <p className="text-[11px] text-slateDark-700">
                                <strong>visualContext:</strong>{' '}
                                {parsedSubSnapshot.visualContext}
                              </p>
                            )}
                            {parsedSubSnapshot.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={resolveAdminMediaUrl(
                                  parsedSubSnapshot.imageUrl,
                                )}
                                alt={parsedSubSnapshot.title ?? 'Prompt image'}
                                className="max-h-40 rounded-lg border border-slateDark-100 object-cover"
                              />
                            )}
                          </div>
                        ) : (
                          <pre className="overflow-x-auto rounded-lg bg-slateDark-25 p-3 font-mono text-[11px] text-slateDark-800">
                            {JSON.stringify(subDetail.promptSnapshot, null, 2)}
                          </pre>
                        )}
                      </section>

                      {/* Result Breakdown */}
                      <section className="space-y-3 rounded-xl border border-slateDark-100 bg-white p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
                          Kết quả chấm điểm (result)
                        </h3>

                        {subDetail.result === null || !parsedSubResult ? (
                          <div className="rounded-xl border border-red-200 bg-red-50/70 p-3.5 text-red-800">
                            <p className="font-semibold">
                              Không có dữ liệu kết quả (
                              <code className="font-mono">result === null</code>
                              ).
                            </p>
                            <p className="mt-1 text-[11px]">
                              Bài nộp thất bại hoặc hết hạn trước khi Azure
                              Speech trả về transcript. Vì âm thanh gốc không
                              được lưu, không thể chấm lại từ máy chủ.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Transcript */}
                            <div>
                              <p className="mb-1 text-[11px] font-semibold text-slateDark-700">
                                Lời thoại nhận diện (Transcript)
                              </p>
                              <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3 text-sm text-slateDark-900">
                                {parsedSubResult.transcript ?? '—'}
                              </div>
                            </div>

                            {/* Scores Grid */}
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {[
                                {
                                  label: 'Overall',
                                  value:
                                    parsedSubResult.overall ??
                                    subDetail.overallScore,
                                },
                                {
                                  label: 'Accuracy',
                                  value: parsedSubResult.accuracy,
                                },
                                {
                                  label: 'Fluency',
                                  value: parsedSubResult.fluency,
                                },
                                {
                                  label: 'Prosody',
                                  value: parsedSubResult.prosody,
                                },
                                {
                                  label: 'Completeness',
                                  value: parsedSubResult.completeness,
                                },
                                {
                                  label: 'Pronunciation',
                                  value: parsedSubResult.pronunciation,
                                },
                              ]
                                .filter((metric) => metric.value !== null)
                                .map((metric) => (
                                  <div
                                    key={metric.label}
                                    className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-2.5"
                                  >
                                    <p className="text-[10px] font-semibold uppercase text-slateDark-600">
                                      {metric.label}
                                    </p>
                                    <p className="mt-0.5 font-mono text-base font-extrabold text-slateDark-900">
                                      {formatScore(metric.value)}
                                    </p>
                                  </div>
                                ))}
                            </div>

                            {parsedSubResult.feedbackVi && (
                              <p className="rounded-xl border border-brand-100 bg-brand-25/50 p-3 text-xs text-slateDark-800">
                                <strong>Nhận xét:</strong>{' '}
                                {parsedSubResult.feedbackVi}
                              </p>
                            )}

                            {/* Words / Phonemes Breakdown */}
                            {parsedSubResult.words.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-[11px] font-bold text-slateDark-700">
                                  Phân tích từ & âm vị ({parsedSubResult.words.length}{' '}
                                  từ)
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {parsedSubResult.words.map((w, idx) => {
                                    const isClean = w.errorType === 'None';
                                    const isSevere =
                                      w.errorType === 'Mispronunciation' ||
                                      w.errorType === 'Omission' ||
                                      w.errorType === 'Insertion';
                                    const pillClass = isClean
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                      : isSevere
                                        ? 'border-red-200 bg-red-50 text-red-900'
                                        : 'border-amber-200 bg-amber-50 text-amber-900';
                                    return (
                                      <div
                                        key={`${w.word}-${idx}`}
                                        className={`rounded-lg border px-2 py-1 text-[11px] ${pillClass}`}
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold">
                                            {w.word}
                                          </span>
                                          <span className="font-mono text-[10px]">
                                            {formatScore(w.accuracy)}
                                          </span>
                                          {!isClean && (
                                            <span className="rounded bg-white/80 px-1 text-[9px] font-semibold">
                                              {w.errorType}
                                            </span>
                                          )}
                                        </div>
                                        {w.phonemes.length > 0 && (
                                          <div className="mt-1 flex flex-wrap gap-1 border-t border-black/5 pt-1 font-mono text-[10px]">
                                            {w.phonemes.map((ph, pIdx) => (
                                              <span
                                                key={`${ph.phoneme}-${pIdx}`}
                                                className="rounded bg-white/75 px-1"
                                              >
                                                /{ph.phoneme}/{' '}
                                                {formatScore(ph.accuracy)}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Content Feedback */}
                            {parsedSubResult.content && (
                              <div className="space-y-2 rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[11px] font-bold uppercase text-slateDark-700">
                                    Đánh giá nội dung (Content Feedback)
                                  </p>
                                  <span
                                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                                      parsedSubResult.content.status ===
                                      'succeeded'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-amber-50 text-amber-800'
                                    }`}
                                  >
                                    {parsedSubResult.content.status ?? 'unknown'}
                                    {parsedSubResult.content.errorCode
                                      ? ` · ${parsedSubResult.content.errorCode}`
                                      : ''}
                                  </span>
                                </div>

                                {(parsedSubResult.content.overall !== null ||
                                  parsedSubResult.content.vocabulary !== null ||
                                  parsedSubResult.content.grammar !== null ||
                                  parsedSubResult.content.topic !== null) && (
                                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {[
                                      {
                                        label: 'Overall',
                                        v: parsedSubResult.content.overall,
                                      },
                                      {
                                        label: 'Vocabulary',
                                        v: parsedSubResult.content.vocabulary,
                                      },
                                      {
                                        label: 'Grammar',
                                        v: parsedSubResult.content.grammar,
                                      },
                                      {
                                        label: 'Topic',
                                        v: parsedSubResult.content.topic,
                                      },
                                    ].map((item) => (
                                      <div
                                        key={item.label}
                                        className="rounded-lg bg-white p-2 text-center"
                                      >
                                        <p className="text-[10px] text-slateDark-600">
                                          {item.label}
                                        </p>
                                        <p className="font-mono text-sm font-bold text-slateDark-900">
                                          {formatScore(item.v)}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {parsedSubResult.content.strengths.length >
                                  0 && (
                                  <div>
                                    <p className="text-[11px] font-semibold text-emerald-800">
                                      Điểm mạnh:
                                    </p>
                                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slateDark-800">
                                      {parsedSubResult.content.strengths.map(
                                        (s, i) => (
                                          <li key={i}>{s}</li>
                                        ),
                                      )}
                                    </ul>
                                  </div>
                                )}

                                {parsedSubResult.content.improvements.length >
                                  0 && (
                                  <div className="space-y-1.5">
                                    <p className="text-[11px] font-semibold text-amber-900">
                                      Gợi ý cải thiện:
                                    </p>
                                    {parsedSubResult.content.improvements.map(
                                      (imp, i) => (
                                        <div
                                          key={i}
                                          className="rounded-lg border border-slateDark-100 bg-white p-2.5 text-[11px]"
                                        >
                                          {imp.quote && (
                                            <p className="font-mono text-red-700">
                                              &ldquo;{imp.quote}&rdquo;
                                            </p>
                                          )}
                                          {imp.explanationVi && (
                                            <p className="mt-0.5 text-slateDark-800">
                                              {imp.explanationVi}
                                            </p>
                                          )}
                                          {imp.suggestion && (
                                            <p className="mt-0.5 font-semibold text-emerald-800">
                                              Gợi ý: {imp.suggestion}
                                            </p>
                                          )}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            <details className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
                              <summary className="cursor-pointer font-semibold text-slateDark-800">
                                Xem JSON đầy đủ (result)
                              </summary>
                              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-white p-3 font-mono text-[11px] text-slateDark-800">
                                {JSON.stringify(subDetail.result, null, 2)}
                              </pre>
                            </details>
                          </>
                        )}
                      </section>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* ===================== SLIDE-OVER DRAWER: VOICE CONVERSATION ===================== */}
          {selectedVoiceId && (
            <div
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedVoiceId(null);
                  setVoiceDetail(null);
                }
              }}
              className="fixed inset-0 z-50 flex justify-end bg-slateDark-900/50 backdrop-blur-[1px]"
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Chi tiết hội thoại Voice AI"
                className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slateDark-100 px-6 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-bold text-slateDark-900">
                        {voiceDetail?.topicTitle ?? 'Chi tiết hội thoại Voice AI'}
                      </h2>
                      {voiceDetail && (
                        <span
                          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${voiceSessionBadgeClass(voiceDetail.status)}`}
                        >
                          {voiceDetail.status}
                        </span>
                      )}
                      {voiceDetail && (
                        <span
                          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${voiceAssessmentBadgeClass(voiceDetail.assessmentStatus)}`}
                        >
                          {voiceDetail.assessmentStatus}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-slateDark-600">
                      ID: {selectedVoiceId}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Đóng chi tiết hội thoại"
                    onClick={() => {
                      setSelectedVoiceId(null);
                      setVoiceDetail(null);
                    }}
                    className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-6 text-xs">
                  {voiceDetailLoading ? (
                    <div className="py-16 text-center text-slateDark-700">
                      Đang tải chi tiết phiên hội thoại Voice AI...
                    </div>
                  ) : voiceDetailError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                      {voiceDetailError}
                    </div>
                  ) : voiceDetail ? (
                    <>
                      {/* Thanh hành động Voice Ops */}
                      {(voiceDetail.hasActiveLock || canRetryVoiceContent) && (
                        <div className="flex flex-wrap items-center gap-2">
                          {voiceDetail.hasActiveLock && (
                            <button
                              type="button"
                              onClick={() => setReleaseLockTarget(voiceDetail)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
                            >
                              <Unlock className="h-3.5 w-3.5" />
                              <span>Giải phóng khóa</span>
                            </button>
                          )}
                          {canRetryVoiceContent && (
                            <button
                              type="button"
                              disabled={retryingVoiceContent}
                              onClick={() => void handleRetryVoiceContent()}
                              className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
                            >
                              <RefreshCw
                                className={`h-3.5 w-3.5 ${retryingVoiceContent ? 'animate-spin' : ''}`}
                              />
                              <span>
                                {retryingVoiceContent
                                  ? 'Đang chấm lại...'
                                  : 'Chấm lại nội dung'}
                              </span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-slateDark-100 bg-slateDark-25 p-4 sm:grid-cols-2">
                        <div>
                          <span className="text-[11px] text-slateDark-600">
                            Học viên
                          </span>
                          <p className="font-semibold text-slateDark-900">
                            {voiceDetail.user.name} ({voiceDetail.user.email})
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slateDark-600">
                            Khóa phiên (activeLock) / Lý do kết thúc
                          </span>
                          <p className="font-mono font-semibold text-slateDark-900">
                            {voiceDetail.hasActiveLock
                              ? 'ĐANG KHÓA'
                              : 'Đã giải phóng'}
                            {voiceDetail.endReason
                              ? ` · ${voiceDetail.endReason}`
                              : ''}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slateDark-600">
                            Số lượt / Lịch sử
                          </span>
                          <p className="font-semibold text-slateDark-900">
                            {voiceDetail.turnsCount} lượt ·{' '}
                            {voiceDetail.historyStatus}
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slateDark-600">
                            Bắt đầu / Kết thúc
                          </span>
                          <p className="text-slateDark-800">
                            {formatDateTime(voiceDetail.startedAt)} ·{' '}
                            {formatDateTime(voiceDetail.endedAt)}
                          </p>
                        </div>
                      </div>

                      {/* Ordered Conversation Turns */}
                      <section className="space-y-2.5 rounded-xl border border-slateDark-100 bg-white p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
                          Lịch sử hội thoại ({sortedVoiceTurns.length} lượt)
                        </h3>
                        {sortedVoiceTurns.length === 0 ? (
                          <p className="rounded-lg bg-slateDark-25 p-4 text-center text-slateDark-600">
                            Chưa ghi nhận lượt hội thoại nào.
                          </p>
                        ) : (
                          <div className="space-y-2.5">
                            {sortedVoiceTurns.map((turn) => {
                              const isUser =
                                turn.role.toUpperCase() === 'USER';
                              return (
                                <div
                                  key={turn.id}
                                  className={`rounded-xl border p-3 ${
                                    isUser
                                      ? 'ml-6 border-brand-200 bg-brand-25/60'
                                      : 'mr-6 border-slateDark-100 bg-slateDark-25'
                                  }`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-slateDark-700">
                                        #{turn.sequence}
                                      </span>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                          isUser
                                            ? 'bg-brand-600 text-white'
                                            : 'bg-slateDark-800 text-white'
                                        }`}
                                      >
                                        {turn.role}
                                      </span>
                                      {turn.interrupted && (
                                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                          Bị ngắt (interrupted)
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono text-[10px] text-slateDark-600">
                                      {formatDateTime(turn.createdAt)}
                                    </span>
                                  </div>
                                  <p className="mt-1.5 text-sm text-slateDark-900">
                                    {turn.transcript || '(Trống)'}
                                  </p>
                                  {turn.translationVi && (
                                    <p className="mt-1 text-[11px] italic text-slateDark-700">
                                      Dịch VI: {turn.translationVi}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>

                      {/* Assessment JSON Summary */}
                      <section className="space-y-3 rounded-xl border border-slateDark-100 bg-white p-4">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
                          Tóm tắt chấm điểm (assessment JSON)
                        </h3>

                        {parsedVoiceAssessment ? (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {parsedVoiceAssessment.pronunciation && (
                              <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
                                <p className="text-[11px] font-bold text-slateDark-700">
                                  Phát âm (
                                  {parsedVoiceAssessment.pronunciationScope ??
                                    'auto'}
                                  )
                                </p>
                                <p className="mt-1 font-mono text-xs text-slateDark-900">
                                  Overall:{' '}
                                  <strong>
                                    {formatScore(
                                      parsedVoiceAssessment.pronunciation
                                        .overall,
                                    )}
                                  </strong>{' '}
                                  · Acc:{' '}
                                  {formatScore(
                                    parsedVoiceAssessment.pronunciation
                                      .accuracy,
                                  )}{' '}
                                  · Flu:{' '}
                                  {formatScore(
                                    parsedVoiceAssessment.pronunciation.fluency,
                                  )}{' '}
                                  · Pro:{' '}
                                  {formatScore(
                                    parsedVoiceAssessment.pronunciation.prosody,
                                  )}
                                </p>
                              </div>
                            )}
                            {parsedVoiceAssessment.content && (
                              <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-3">
                                <p className="text-[11px] font-bold text-slateDark-700">
                                  Nội dung (
                                  {parsedVoiceAssessment.content.status ??
                                    'unknown'}
                                  )
                                </p>
                                <p className="mt-1 font-mono text-xs text-slateDark-900">
                                  Overall:{' '}
                                  <strong>
                                    {formatScore(
                                      parsedVoiceAssessment.content.overall,
                                    )}
                                  </strong>{' '}
                                  · Vocab:{' '}
                                  {formatScore(
                                    parsedVoiceAssessment.content.vocabulary,
                                  )}{' '}
                                  · Gram:{' '}
                                  {formatScore(
                                    parsedVoiceAssessment.content.grammar,
                                  )}{' '}
                                  · Topic:{' '}
                                  {formatScore(
                                    parsedVoiceAssessment.content.topic,
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : null}

                        {voiceDetail.assessment ? (
                          <pre className="max-h-72 overflow-auto rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5 font-mono text-[11px] text-slateDark-800">
                            {JSON.stringify(voiceDetail.assessment, null, 2)}
                          </pre>
                        ) : (
                          <p className="rounded-xl bg-slateDark-25 p-3 text-slateDark-600">
                            Chưa có dữ liệu chấm điểm (assessment === null).
                          </p>
                        )}
                      </section>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )}

          {/* ===================== CONFIRM DIALOGS ===================== */}
          <ConfirmDialog
            open={Boolean(deleteTarget)}
            title="Xác nhận xoá đề luyện nói"
            tone={
              deleteTarget && deleteTarget.submissionsCount > 0 && !forceDelete
                ? 'warning'
                : 'danger'
            }
            confirmLabel={
              deleteTarget && deleteTarget.submissionsCount > 0 && !forceDelete
                ? 'Chuyển bản nháp'
                : 'Xoá đề'
            }
            busy={deleting}
            onConfirm={handleConfirmDelete}
            onCancel={() => {
              setDeleteTarget(null);
              setForceDelete(false);
            }}
            description={
              deleteTarget ? (
                <div className="space-y-3">
                  <p>
                    Đề: <strong>{deleteTarget.title}</strong> (
                    <code className="font-mono text-xs">{deleteTarget.code}</code>
                    )
                  </p>
                  {deleteTarget.submissionsCount > 0 ? (
                    <>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        Đề này đã có{' '}
                        <strong>{deleteTarget.submissionsCount} bài nộp</strong>.
                        Mặc định sẽ chuyển về{' '}
                        <strong>Bản nháp (Unpublish)</strong> để bảo toàn lịch
                        sử người học.
                      </div>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                        <input
                          type="checkbox"
                          checked={forceDelete}
                          onChange={(e) => setForceDelete(e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-red-600"
                        />
                        <span>
                          <strong>Xoá cưỡng bức (Force Delete)</strong>: Xoá
                          sạch đề và toàn bộ {deleteTarget.submissionsCount} bài
                          nộp liên quan.
                        </span>
                      </label>
                    </>
                  ) : (
                    <p className="text-xs text-slateDark-700">
                      Đề chưa có bài nộp và sẽ được xoá vĩnh viễn.
                    </p>
                  )}
                </div>
              ) : null
            }
          />

          <ConfirmDialog
            open={Boolean(expireSubTarget)}
            title="Đóng job Speaking bị kẹt"
            tone="danger"
            confirmLabel="Đóng job kẹt"
            busy={expiringSub}
            onConfirm={handleConfirmExpireSubmission}
            onCancel={() => setExpireSubTarget(null)}
            description={
              expireSubTarget ? (
                <p>
                  Xác nhận đóng bài nộp đang treo ở trạng thái{' '}
                  <code className="font-mono text-xs">PROCESSING</code> (&gt;3
                  phút) của <strong>{expireSubTarget.user.email}</strong> và
                  chuyển sang <code className="font-mono text-xs">UNKNOWN</code>{' '}
                  với mã lỗi{' '}
                  <code className="font-mono text-xs">admin_expired</code>?
                </p>
              ) : null
            }
          />

          <ConfirmDialog
            open={Boolean(releaseLockTarget)}
            title="Giải phóng khóa phiên Voice AI"
            tone="danger"
            confirmLabel="Giải phóng khóa"
            busy={releasingLock}
            onConfirm={handleConfirmReleaseVoiceLock}
            onCancel={() => setReleaseLockTarget(null)}
            description={
              releaseLockTarget ? (
                <p>
                  Bạn có chắc muốn giải phóng khóa hoạt động (
                  <code className="font-mono text-xs">activeUserId</code>) và
                  ngắt kết nối live (nếu đang mở) cho phiên hội thoại của{' '}
                  <strong>{releaseLockTarget.user.email}</strong>? Người dùng sẽ
                  có thể bắt đầu phiên Voice AI mới ngay sau đó.
                </p>
              ) : null
            }
          />
        </div>
      )}
    </AdminShell>
  );
}
