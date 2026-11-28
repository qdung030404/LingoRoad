import type {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
  LearningKind,
  LearningQuestionType,
  SpeakingMode,
  SpeakingStatus,
} from './admin-core.types';

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

export interface AdminOrphanMediaItem {
  key: string;
  url: string;
  size: number;
  lastModified: string | null;
}

export interface AdminOrphanMediaScanResult {
  scannedAt: string;
  storage: 'azure' | 'local';
  minAgeHours: number;
  totalBlobs: number;
  referencedCount: number;
  protectedRecentCount: number;
  orphanCount: number;
  orphanBytes: number;
  orphans: AdminOrphanMediaItem[];
}

export interface AdminOrphanMediaCleanupResult {
  cleanedAt: string;
  minAgeHours: number;
  deletedCount: number;
  deletedBytes: number;
  skippedCount: number;
  deletedKeys: string[];
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
