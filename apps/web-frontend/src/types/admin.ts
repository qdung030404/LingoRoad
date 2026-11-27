export type UserRole = 'LEARNER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type AuthProvider = 'LOCAL' | 'GOOGLE' | 'APPLE';
export type LearningKind = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'LISTENING';
export type LearningQuestionType = 'MULTIPLE_CHOICE' | 'GAP_FILL' | 'TRUE_FALSE_NOT_GIVEN';
export type AssessmentSkill = 'READING' | 'LISTENING' | 'WRITING' | 'SPEAKING';
export type ItemType =
  | 'MULTIPLE_CHOICE'
  | 'CLOZE'
  | 'SENTENCE_REORDER'
  | 'MATCHING'
  | 'GAP_FILL'
  | 'ESSAY'
  | 'SPEAKING_PROMPT';
export type ItemUsageScope = 'PLACEMENT' | 'MOCK_EXAM' | 'PRACTICE' | 'ALL';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl: string | null;
}

export interface AdminAuthSession {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedData<T, S = undefined> {
  items: T[];
  pagination: PaginationMeta;
  summary?: S;
}

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
  createdAt: string;
}

export interface DashboardOverview {
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
    createdAt: string;
  }>;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  provider: AuthProvider;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  profile: {
    targetCefr: CefrLevel;
    dailyGoalMinutes: number;
  } | null;
  stats: {
    learningAttempts: number;
    placementSessions: number;
    vocabularyDecks: number;
    speakingSubmissions: number;
  };
}

export interface UsersListSummary {
  total: number;
  activeLearners30d: number;
  learners: number;
  admins: number;
}

export interface LearningUnitItem {
  id: string;
  code: string;
  cefrLevel: CefrLevel;
  orderIndex: number;
  title: string;
  description: string;
  lessonsCount: number;
}

export interface LearningOptionInput {
  id: string;
  text: string;
  imageUrl?: string;
}

export interface LearningStepInput {
  id: string;
  title: string;
  body: string;
  word?: string;
  phonetic?: string;
  meaning?: string;
  example?: string;
  audioUrl?: string;
}

export interface LearningQuestionInput {
  id: string;
  type?: LearningQuestionType;
  prompt: string;
  options: LearningOptionInput[];
  correctOptionId: string;
  explanation: string;
  evidence?: string;
  skillCode?: string;
  evidenceSegmentIds?: string[];
}

export interface LearningContentPayload {
  steps: LearningStepInput[];
  questions: LearningQuestionInput[];
  passage?: string;
  audioUrl?: string;
  transcript?: string;
  coverImageUrl?: string;
  listeningVersion?: 1;
  audioDurationMs?: number;
  preparation?: {
    situation: string;
    objective: string;
  };
  keyVocabulary?: Array<{
    id: string;
    word: string;
    meaning: string;
    phonetic?: string;
    example?: string;
    translation?: string;
    imageUrl?: string;
  }>;
  transcriptSegments?: Array<{
    id: string;
    speaker: string;
    startMs: number;
    endMs: number;
    text: string;
    translationVi: string;
    speakerAvatar?: string;
  }>;
}

export interface AdminLessonItem {
  id: string;
  code: string;
  kind: LearningKind;
  primarySkillCode: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  sortOrder: number;
  published: boolean;
  contentVersion: number;
  questionsCount: number;
  attemptsCount: number;
  unit: {
    id: string;
    code: string;
    title: string;
    cefrLevel: CefrLevel;
  } | null;
  content?: LearningContentPayload;
  createdAt: string;
  updatedAt: string;
}

export interface LessonsListSummary {
  total: number;
  published: number;
  drafts: number;
  linkedQuestions: number;
}

export interface CefrDescriptorItem {
  skillCode: string;
  skill: AssessmentSkill;
  cefrLevel: CefrLevel;
  name: string;
  statementEn: string;
  statementVi: string;
  defaultIrtB: number;
}

export interface AdminAssessmentItem {
  id: string;
  externalId: string | null;
  skill: AssessmentSkill | null;
  skillCode: string;
  cefrLevel: CefrLevel;
  type: ItemType;
  usageScope: ItemUsageScope;
  passage: string | null;
  prompt: string;
  options: unknown;
  correctOption: string | null;
  explanation: string | null;
  audioUrl: string | null;
  irtA: number;
  irtB: number;
  irtC: number;
  responsesCount: number;
  createdAt: string;
}

export interface AssessmentItemsSummary {
  total: number;
  mcqCount: number;
  clozeAndOtherCount: number;
  coveredSkillsCount: number;
}

export interface ImportErrorItem {
  path: string;
  message: string;
}

export interface ImportPreviewRecord {
  entity: 'unit' | 'lesson' | 'item' | 'topic';
  identifier: string;
  title: string;
  operation: 'CREATE' | 'UPDATE';
}

export interface ImportEntityCount {
  create: number;
  update: number;
}

export interface ImportCountsSummary {
  units: ImportEntityCount;
  lessons: ImportEntityCount;
  items: ImportEntityCount;
  topics: ImportEntityCount;
}

export interface ImportPreviewSummary {
  totalRecords: number;
  counts: ImportCountsSummary;
  records: ImportPreviewRecord[];
}

export interface ImportValidationResponse {
  isValid: boolean;
  errors: ImportErrorItem[];
  preview: ImportPreviewSummary;
}

export interface ImportApplyResponse {
  appliedAt: string;
  preview: ImportPreviewSummary;
}
