import type {
  AdminAssessmentGroup,
  AdminAssessmentItem,
  AdminCuratedTopic,
  AdminCuratedWord,
  AdminGrammarTopic,
  AdminLessonItem,
  AssessmentItemsSummary,
  AssessmentSkill,
  BulkPublishResult,
  CefrDescriptorItem,
  CefrLevel,
  GrammarExampleItem,
  GrammarFormulaItem,
  GrammarUsageItem,
  ItemType,
  ItemUsageScope,
  LearningContentPayload,
  LearningKind,
  LearningUnitItem,
  LessonsListSummary,
  PaginatedData,
} from '../types/admin';
import { adminFetch } from './admin-api-core';

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

export async function bulkPublishAdminLessons(
  ids: string[],
  published: boolean,
): Promise<BulkPublishResult> {
  return adminFetch<BulkPublishResult>('/admin/lessons/bulk-publish', {
    method: 'PATCH',
    body: JSON.stringify({ ids, published }),
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
  groupId?: string;
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
  if (params.groupId?.trim()) qs.set('groupId', params.groupId.trim());
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
    passage?: string | null;
    prompt?: string;
    options?: unknown;
    correctOption?: string | null;
    explanation?: string | null;
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

export async function listAdminVocabTopics(search?: string): Promise<AdminCuratedTopic[]> {
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
    { method: 'PATCH', body: JSON.stringify(input) },
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

export async function deleteAdminGrammarTopic(id: string): Promise<{ deleted: true; id: string }> {
  return adminFetch<{ deleted: true; id: string }>(`/admin/grammar/topics/${id}`, {
    method: 'DELETE',
  });
}

export async function addAdminGrammarPrerequisite(
  prerequisiteId: string,
  targetId: string,
): Promise<{ prerequisiteId: string; targetId: string }> {
  return adminFetch<{ prerequisiteId: string; targetId: string }>('/admin/grammar/prerequisites', {
    method: 'POST',
    body: JSON.stringify({ prerequisiteId, targetId }),
  });
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
