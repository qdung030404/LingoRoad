export type UserRole = 'LEARNER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type AuthProvider = 'LOCAL' | 'GOOGLE' | 'APPLE';
export type LearningPurpose = 'EXAM' | 'WORK' | 'DAILY_COMMUNICATION' | 'STUDY';
export type LearningKind = 'GRAMMAR' | 'VOCABULARY' | 'READING' | 'LISTENING';
export type LearningQuestionType = 'MULTIPLE_CHOICE' | 'GAP_FILL' | 'TRUE_FALSE_NOT_GIVEN';
export type AssessmentSkill = 'READING' | 'LISTENING' | 'WRITING' | 'SPEAKING';
export type SpeakingMode =
  | 'READ_ALOUD'
  | 'TOPIC'
  | 'PICTURE_DESCRIPTION'
  | 'TONGUE_TWISTER';
export type SpeakingStatus =
  | 'CREATED'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'UNKNOWN';
export type SkillLevelSource = 'PLACEMENT' | 'ADAPTIVE' | 'DEFAULT';
export type VoiceHistoryStatus = 'PENDING' | 'SAVED' | 'DISCARDED';
export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
export type DashboardTimeframe = '7_DAYS' | '30_DAYS' | '90_DAYS' | 'ALL_TIME';
export type AdminExportEntity =
  | 'units'
  | 'lessons'
  | 'items'
  | 'assessment-groups'
  | 'topics'
  | 'speaking'
  | 'grammar'
  | 'users'
  | 'audit-logs';
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
  group: 'listening' | 'grammar' | 'vocabulary' | 'writing' | 'reading' | 'speaking';
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

export interface DashboardOverview {
  timeframe?: DashboardTimeframe;
  generatedAt?: string;
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
    curatedTopicsTotal?: number;
    grammarTopicsTotal?: number;
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
  attemptsByCefr?: CefrAttemptStat[];
  learningTrend?: LearningTrendPoint[];
  hardItems?: HardAssessmentItemAlert[];
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

export interface AdminUserProfile {
  targetCefr: CefrLevel;
  dailyGoalMinutes: number;
  learningPurpose?: LearningPurpose | null;
  preferredKinds?: LearningKind[];
  selfAssessedCefr?: CefrLevel | null;
  onboardingCompletedAt?: string | null;
  reminderEnabled?: boolean;
  reminderTime?: string;
  preferencesVersion?: number;
  reminderVersion?: number;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  hasFirebaseIdentity?: boolean;
  provider: AuthProvider;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  profile: AdminUserProfile | null;
  stats: {
    learningAttempts: number;
    placementSessions: number;
    vocabularyDecks: number;
    speakingSubmissions: number;
    voiceConversations?: number;
  };
}

export interface AdminUserSkillLevel {
  id: string;
  kind: LearningKind;
  cefrLevel: CefrLevel;
  source: SkillLevelSource;
  previousCefr: CefrLevel | null;
  changedAt: string | null;
  updatedAt: string;
}

export interface AdminUserSkillLevelEvent {
  id: string;
  attemptId: string;
  kind: LearningKind;
  fromCefr: CefrLevel;
  toCefr: CefrLevel;
  direction: string;
  createdAt: string;
}

export interface AdminUserDayPlan {
  id: string;
  date: string;
  version: number;
  preferencesVersion: number;
  dailyGoalMinutes: number;
  policyVersion: string;
  items: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserRecentVoiceConversation {
  id: string;
  topicId: string;
  topicTitle: string;
  status: string;
  endReason: string | null;
  assessmentStatus: string;
  hasActiveLock: boolean;
  turnsCount: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface AdminUserDetail extends AdminUserListItem {
  skillLevels: AdminUserSkillLevel[];
  skillLevelEvents: AdminUserSkillLevelEvent[];
  todayDayPlan: AdminUserDayPlan | null;
  answerExposuresCount: number;
  recentVoiceConversations: AdminUserRecentVoiceConversation[];
  recentAttempts: Array<{
    id: string;
    lessonTitle: string;
    status: string;
    correctCount: number | null;
    totalQuestions: number;
    startedAt: string;
    submittedAt: string | null;
  }>;
  recentPlacements: Array<{
    id: string;
    status: string;
    estimatedCefr: CefrLevel | null;
    correctCount: number;
    totalItems: number;
    startedAt: string;
    completedAt: string | null;
  }>;
  recentSpeaking: Array<{
    id: string;
    promptTitle: string;
    status: string;
    overallScore: number | null;
    createdAt: string;
  }>;
}

export interface AdminUserSessionView {
  id: string;
  deviceIdentifier: string | null;
  ipAddress: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface AdminUserSkillLevelOverrideResult {
  skillLevel: AdminUserSkillLevel & { userId?: string };
  resetExposuresCount: number;
}

export interface AdminPlacementSessionResponseItem {
  id: string;
  sessionId: string;
  itemId: string;
  itemIndex: number;
  selectedOption: string;
  isCorrect: boolean;
  responseTimeMs: number | null;
  createdAt: string;
  item: {
    id: string;
    externalId: string | null;
    prompt: string;
    skill: AssessmentSkill | null;
    skillCode: string;
    cefrLevel: CefrLevel;
    type: ItemType;
    options: unknown;
    correctOption: string | null;
  };
}

export interface AdminPlacementSessionDetail {
  id: string;
  userId: string;
  status: SessionStatus | string;
  currentItemIndex: number;
  totalItems: number;
  testVersion: string;
  bankVersion: string;
  currentItemId: string | null;
  version: number;
  skillResults: unknown;
  correctCount: number;
  estimatedCefr: CefrLevel | null;
  confidenceScore: number | null;
  startedAt: string;
  completedAt: string | null;
  responses: AdminPlacementSessionResponseItem[];
}

export interface ResetPlacementRetakeResult {
  userId: string;
  abandonedSessionsCount: number;
  resetSkillLevelsCount: number;
}

export interface AdminVoiceConversationItem {
  id: string;
  userId: string;
  topicId: string;
  topicTitle: string;
  status: string;
  endReason: string | null;
  historyStatus: VoiceHistoryStatus | string;
  historyHiddenAt: string | null;
  assessmentStatus: string;
  hasActiveLock: boolean;
  turnsCount: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  assessmentStartedAt: string | null;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface AdminVoiceConversationsSummary {
  activeLocks: number;
  failedAssessments: number;
  stuckProcessing: number;
}

export interface AdminVoiceConversationTurn {
  id: string;
  providerItemId: string;
  sequence: number;
  role: string;
  transcript: string;
  translationVi: string | null;
  interrupted: boolean;
  createdAt: string;
}

export interface AdminVoiceConversationDetail extends AdminVoiceConversationItem {
  topicSnapshot: unknown;
  assessment: unknown;
  assessmentAudioHash: string | null;
  turns: AdminVoiceConversationTurn[];
}

export interface ReleaseVoiceConversationLockResult {
  id: string;
  released: boolean;
  hadLiveCall: boolean;
  status: string;
  endReason: string | null;
  endedAt: string | null;
  hasActiveLock: boolean;
}

export interface AdminSpeakingSubmissionItem {
  id: string;
  userId: string;
  promptId: string;
  promptCode: string | null;
  promptTitle: string;
  mode: SpeakingMode;
  status: SpeakingStatus;
  overallScore: number | null;
  contentStatus: string | null;
  errorCode: string | null;
  adapterVersion: string | null;
  canRetryContent: boolean;
  isStuckProcessing: boolean;
  processingAt: string | null;
  completedAt: string | null;
  createdAt: string;
  historyHiddenAt: string | null;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface AdminSpeakingSubmissionsSummary {
  failed: number;
  unknown: number;
  stuckProcessing: number;
  contentUnavailable: number;
}

export interface AdminSpeakingSubmissionDetail extends AdminSpeakingSubmissionItem {
  promptSnapshot: unknown;
  result: unknown;
  audioHash: string | null;
}

export interface AdminMlReadinessView {
  reachable: boolean;
  httpStatus: number | null;
  status: string;
  components: Record<string, unknown>;
  speakingProfiles?: unknown;
  error?: string;
}

export interface AdminSystemReadinessView {
  checkedAt: string;
  appVersion: string;
  authProvider: string;
  database: {
    status: 'ready' | 'unavailable';
    latencyMs: number;
    error?: string;
  };
  mediaStorage: {
    mode: 'azure' | 'local';
    azureConfigured: boolean;
    azureRequired: boolean;
  };
  ml: AdminMlReadinessView;
  voiceLive: {
    enabled: boolean;
    status: string;
    maxDurationSeconds: number;
    model: string;
    voice: string;
    apiVersion: string;
  };
  speaking: {
    scoringProfile: string;
    modes: Record<SpeakingMode, boolean>;
  };
  incidents: {
    stuckVoiceLocks: number;
    stuckSpeakingJobs: number;
    failedSpeaking24h: number;
    activeRefreshSessions: number;
  };
}

export interface BulkPublishResult {
  updatedCount: number;
  published: boolean;
  ids: string[];
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

export interface LearningKeyVocabInput {
  id: string;
  word: string;
  meaning: string;
  phonetic?: string;
  example?: string;
  translation?: string;
  imageUrl?: string;
}

export interface ListeningSegmentInput {
  id: string;
  speaker: string;
  startMs: number;
  endMs: number;
  text: string;
  translationVi: string;
  speakerAvatar?: string;
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
  keyVocabulary?: LearningKeyVocabInput[];
  transcriptSegments?: ListeningSegmentInput[];
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
  grammarTopic?: {
    id: string;
    code: string;
    titleVi: string;
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
  groupId?: string | null;
  itemOrder?: number;
  group?: {
    id: string;
    title: string | null;
    skill: AssessmentSkill;
    cefrLevel: CefrLevel;
    partNumber: number;
  } | null;
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
  rubricCriteria?: Record<string, unknown> | null;
  irtA: number;
  irtB: number;
  irtC: number;
  responsesCount: number;
  activeSessionsCount?: number;
  createdAt: string;
}

export interface AssessmentItemsSummary {
  total: number;
  mcqCount: number;
  clozeAndOtherCount: number;
  coveredSkillsCount: number;
}

export interface AdminAssessmentGroup {
  id: string;
  skill: AssessmentSkill;
  title: string | null;
  cefrLevel: CefrLevel;
  partNumber: number;
  passage: string | null;
  audioUrl: string | null;
  transcript: string | null;
  usageScope: ItemUsageScope;
  itemsCount: number;
  items?: Array<{
    id: string;
    externalId: string | null;
    itemOrder: number;
    skillCode: string;
    type: ItemType;
    prompt: string;
  }>;
  createdAt: string;
}

export interface AdminCuratedTopic {
  id: string;
  slug: string;
  titleEn: string;
  titleVi: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
  wordsCount: number;
  createdAt: string;
}

export interface AdminCuratedWord {
  id: string;
  topicId: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  meaningVi: string;
  exampleEn: string;
  exampleVi: string;
  imageUrl: string | null;
  audioUrl: string | null;
  createdAt: string;
}

export type GrammarFormulaForm = 'AFFIRMATIVE' | 'NEGATIVE' | 'QUESTION' | 'NOTE';

export interface GrammarFormulaItem {
  form: GrammarFormulaForm;
  labelVi: string;
  structure: string;
  noteVi?: string;
}

export interface GrammarUsageItem {
  useCaseVi: string;
  signalWords?: string[];
  commonMistakeVi?: string;
}

export interface GrammarExampleItem {
  sentenceEn: string;
  translationVi: string;
  highlight?: string;
}

export interface AdminGrammarTopic {
  id: string;
  code: string;
  parentId: string | null;
  parentCode: string | null;
  cefrLevel: CefrLevel;
  isLeaf: boolean;
  titleEn: string;
  titleVi: string;
  summaryVi: string;
  formulas: GrammarFormulaItem[];
  usageNotes: GrammarUsageItem[];
  examples: GrammarExampleItem[];
  orderIndex: number;
  published: boolean;
  contentVersion: number;
  prerequisiteIds: string[];
  prerequisiteCodes: string[];
  dependentCodes: string[];
  lessonsCount: number;
  childrenCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SpeakingPreparationPayload {
  goal?: string;
  sceneImageUrl?: string;
  vocabulary?: Array<{
    word: string;
    meaningVi: string;
    example: string;
    imageUrl?: string;
  }>;
  phrases?: Array<{
    text: string;
    meaningVi: string;
  }>;
}

export interface AdminSpeakingPrompt {
  id: string;
  code: string;
  mode: SpeakingMode;
  title: string;
  text: string;
  difficulty: number;
  maxDurationSeconds: number;
  hints: string[];
  sampleAsset: string | null;
  imageUrl: string | null;
  visualContext: string | null;
  preparation: SpeakingPreparationPayload | null;
  linkedReadAloudCodes: string[];
  contentVersion: number;
  sortOrder: number;
  published: boolean;
  submissionsCount: number;
}

export interface SpeakingPromptsSummary {
  total: number;
  published: number;
  readAloud: number;
  topic: number;
  pictureDescription: number;
  tongueTwister: number;
}

export interface AdminAuditLog {
  id: string;
  adminUserId: string | null;
  adminEmail: string;
  action: string;
  method: string;
  path: string;
  resourceType: string;
  resourceId: string | null;
  statusCode: number;
  ipAddress: string | null;
  payloadSnapshot: unknown;
  createdAt: string;
}

export interface AdminMediaImageUploadResult {
  url: string;
  storage: 'azure' | 'local';
  mime: string;
  size: number;
}

export interface AdminMediaAudioUploadResult {
  url: string;
  scope: 'learning' | 'placement';
  durationMs: number;
  size: number;
}

export interface ImportErrorItem {
  path: string;
  message: string;
}

export interface ImportPreviewRecord {
  entity:
    | 'unit'
    | 'lesson'
    | 'item'
    | 'topic'
    | 'speakingPrompt'
    | 'grammarTopic'
    | 'assessmentGroup';
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
  speakingPrompts?: ImportEntityCount;
  grammarTopics?: ImportEntityCount;
  assessmentGroups?: ImportEntityCount;
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
