import { type Dispatch, type SetStateAction } from 'react';
import type {
  createAdminLesson as createAdminLessonFn,
  createLearningUnit as createLearningUnitFn,
  updateAdminLesson as updateAdminLessonFn,
} from '@/lib/admin-api';
import {
  buildLessonContentFromForm,
  LISTENING_SKILL_CODES,
  parseLessonJsonDraft,
  READING_SKILL_CODES,
  validateLessonDraft,
} from '@/lib/admin-validation';
import type {
  CefrLevel,
  LearningContentPayload,
  LearningKeyVocabInput,
  LearningKind,
  LearningQuestionInput,
  LearningQuestionType,
  LearningStepInput,
  ListeningSegmentInput,
} from '@/types/admin';
import {
  buildCloneLessonCode,
  createDefaultListeningSegments,
  createDefaultSteps,
  createEmptyQuestion,
  DEFAULT_JSON_TEMPLATE,
  DEFAULT_LISTENING_QUESTION_SKILLS,
  orderEvidenceSegmentIds,
  type LessonComposerModalProps,
} from './lesson-composer.helpers';

type UseStateFn = <S>(initialState: S | (() => S)) => [S, Dispatch<SetStateAction<S>>];

export interface LessonComposerStateDeps {
  useStateImpl: UseStateFn;
  createAdminLesson: typeof createAdminLessonFn;
  createLearningUnit: typeof createLearningUnitFn;
  updateAdminLesson: typeof updateAdminLessonFn;
}

export function useLessonComposerState(
  {
    grammarTopics = [],
    editingLesson,
    cloneFrom,
    onSaved,
    onUnitCreated,
  }: LessonComposerModalProps,
  {
    useStateImpl,
    createAdminLesson,
    createLearningUnit,
    updateAdminLesson,
  }: LessonComposerStateDeps,
) {
  const isEditing = Boolean(editingLesson);
  const isCloning = !editingLesson && Boolean(cloneFrom);
  const sourceLesson = editingLesson ?? cloneFrom ?? null;
  const initialContent = sourceLesson?.content;
  const [contentBase, setContentBase] = useStateImpl<
    LearningContentPayload | undefined
  >(initialContent);

  const [mode, setMode] = useStateImpl<'form' | 'json' | 'preview'>('form');
  const [previewAnswers, setPreviewAnswers] = useStateImpl<Record<string, string>>(
    {},
  );
  const [code, setCode] = useStateImpl(
    editingLesson
      ? editingLesson.code
      : cloneFrom
        ? buildCloneLessonCode(cloneFrom.code)
        : '',
  );
  const [kind, setKind] = useStateImpl<LearningKind>(
    sourceLesson?.kind ?? 'GRAMMAR',
  );
  const [title, setTitle] = useStateImpl(
    editingLesson
      ? editingLesson.title
      : cloneFrom
        ? `${cloneFrom.title} (Bản sao)`
        : '',
  );
  const [description, setDescription] = useStateImpl(
    sourceLesson?.description ?? '',
  );
  const [estimatedMinutes, setEstimatedMinutes] = useStateImpl(
    sourceLesson?.estimatedMinutes ?? 5,
  );
  const [sortOrder, setSortOrder] = useStateImpl<string>(
    editingLesson?.sortOrder !== undefined ? String(editingLesson.sortOrder) : '',
  );
  const [unitId, setUnitId] = useStateImpl<string>(sourceLesson?.unit?.id ?? '');
  const [grammarTopicId, setGrammarTopicId] = useStateImpl<string>(
    sourceLesson?.grammarTopic?.id ?? '',
  );
  const [published, setPublished] = useStateImpl<boolean>(
    editingLesson ? editingLesson.published : cloneFrom ? false : true,
  );

  const [passage, setPassage] = useStateImpl(initialContent?.passage ?? '');
  const [coverImageUrl, setCoverImageUrl] = useStateImpl(
    initialContent?.coverImageUrl ?? '',
  );
  const [keyVocabulary, setKeyVocabulary] = useStateImpl<LearningKeyVocabInput[]>(
    initialContent?.keyVocabulary?.map((item) => ({ ...item })) ?? [],
  );
  const [audioUrl, setAudioUrl] = useStateImpl(initialContent?.audioUrl ?? '');
  const [audioDurationMs, setAudioDurationMs] = useStateImpl(
    initialContent?.audioDurationMs ?? 35000,
  );
  const [preparation, setPreparation] = useStateImpl(
    initialContent?.preparation
      ? { ...initialContent.preparation }
      : { situation: '', objective: '' },
  );
  const [transcriptSegments, setTranscriptSegments] = useStateImpl<
    ListeningSegmentInput[]
  >(
    initialContent?.transcriptSegments?.length
      ? initialContent.transcriptSegments.map((seg) => ({ ...seg }))
      : createDefaultListeningSegments(),
  );
  const [steps, setSteps] = useStateImpl<LearningStepInput[]>(
    initialContent?.steps
      ? initialContent.steps.map((step) => ({ ...step }))
      : sourceLesson?.kind === 'LISTENING'
        ? []
        : createDefaultSteps(),
  );
  const [questions, setQuestions] = useStateImpl<LearningQuestionInput[]>(
    initialContent?.questions?.length
      ? initialContent.questions.map((q) => ({
          ...q,
          options: q.options.map((opt) => ({ ...opt })),
          ...(q.evidenceSegmentIds
            ? { evidenceSegmentIds: [...q.evidenceSegmentIds] }
            : {}),
        }))
      : [createEmptyQuestion(0), createEmptyQuestion(1), createEmptyQuestion(2)],
  );
  const [rawJson, setRawJson] = useStateImpl<string>(
    initialContent
      ? JSON.stringify(initialContent, null, 2)
      : DEFAULT_JSON_TEMPLATE,
  );

  const [showQuickUnit, setShowQuickUnit] = useStateImpl(false);
  const [unitCode, setUnitCode] = useStateImpl('');
  const [unitLevel, setUnitLevel] = useStateImpl<CefrLevel>('A1');
  const [unitOrder, setUnitOrder] = useStateImpl(1);
  const [unitTitle, setUnitTitle] = useStateImpl('');
  const [unitDescription, setUnitDescription] = useStateImpl('');
  const [creatingUnit, setCreatingUnit] = useStateImpl(false);

  const [submitting, setSubmitting] = useStateImpl(false);
  const [errorMessage, setErrorMessage] = useStateImpl<string | null>(null);

  const leafGrammarTopics = grammarTopics.filter((g) => g.isLeaf);

  const buildCurrentDraftPayload = (): LearningContentPayload =>
    buildLessonContentFromForm(
      {
        kind,
        passage: kind === 'READING' ? passage : undefined,
        coverImageUrl,
        keyVocabulary,
        audioUrl: kind === 'LISTENING' ? audioUrl : undefined,
        audioDurationMs: kind === 'LISTENING' ? audioDurationMs : undefined,
        preparation: kind === 'LISTENING' ? preparation : undefined,
        transcriptSegments:
          kind === 'LISTENING' ? transcriptSegments : undefined,
        steps: kind === 'LISTENING' ? [] : steps,
        questions,
      },
      contentBase,
    );

  const syncFromParsedContent = (parsed: LearningContentPayload): void => {
    setContentBase(parsed);
    setSteps(parsed.steps);
    setQuestions(parsed.questions);
    setPassage(parsed.passage ?? '');
    setCoverImageUrl(parsed.coverImageUrl ?? '');
    setKeyVocabulary(parsed.keyVocabulary ?? []);
    if (parsed.audioUrl !== undefined) setAudioUrl(parsed.audioUrl);
    if (parsed.audioDurationMs !== undefined) {
      setAudioDurationMs(parsed.audioDurationMs);
    }
    if (parsed.preparation) setPreparation(parsed.preparation);
    if (parsed.transcriptSegments?.length) {
      setTranscriptSegments(parsed.transcriptSegments);
    }
  };

  const handleSegmentsChange = (nextSegments: ListeningSegmentInput[]): void => {
    setTranscriptSegments(nextSegments);
    setQuestions((prev) =>
      prev.map((q) => {
        if (!q.evidenceSegmentIds?.length) return q;
        return {
          ...q,
          evidenceSegmentIds: orderEvidenceSegmentIds(
            q.evidenceSegmentIds,
            nextSegments,
          ),
        };
      }),
    );
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRawJson(text);
    setMode('json');
    setErrorMessage(null);
  };

  const handleQuickCreateUnit = async (): Promise<void> => {
    setErrorMessage(null);
    setCreatingUnit(true);
    try {
      const created = await createLearningUnit({
        code: unitCode.trim().toLowerCase(),
        cefrLevel: unitLevel,
        orderIndex: unitOrder,
        title: unitTitle.trim(),
        description: unitDescription.trim(),
      });
      onUnitCreated(created);
      setUnitId(created.id);
      setShowQuickUnit(false);
      setUnitCode('');
      setUnitTitle('');
      setUnitDescription('');
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể tạo chương học mới.',
      );
    } finally {
      setCreatingUnit(false);
    }
  };

  const handleKindChange = (nextKind: LearningKind): void => {
    setKind(nextKind);
    if (nextKind === 'LISTENING') {
      setSteps([]);
      const nextSegments =
        transcriptSegments.length >= 2
          ? transcriptSegments
          : createDefaultListeningSegments();
      if (transcriptSegments.length < 2) {
        setTranscriptSegments(nextSegments);
      }
      if (keyVocabulary.length < 3) {
        const padded = [...keyVocabulary];
        while (padded.length < 3) {
          padded.push({
            id: `kv-${padded.length + 1}`,
            word: '',
            meaning: '',
            phonetic: '',
            example: '',
            translation: '',
            imageUrl: '',
          });
        }
        setKeyVocabulary(padded);
      }
      const defaultSegId = nextSegments[0]?.id ?? 'seg-1';
      setQuestions((prev) => {
        const normalized = prev.map((q, idx) => {
          const paddedOptions =
            q.options.length === 4
              ? q.options
              : [
                  { id: 'A', text: q.options[0]?.text ?? '' },
                  { id: 'B', text: q.options[1]?.text ?? '' },
                  { id: 'C', text: q.options[2]?.text ?? '' },
                  { id: 'D', text: q.options[3]?.text ?? '' },
                ];
          const validSkill =
            q.skillCode &&
            (LISTENING_SKILL_CODES as readonly string[]).includes(q.skillCode)
              ? q.skillCode
              : DEFAULT_LISTENING_QUESTION_SKILLS[
                  idx % DEFAULT_LISTENING_QUESTION_SKILLS.length
                ];
          const orderedEv = orderEvidenceSegmentIds(
            q.evidenceSegmentIds,
            nextSegments,
          );
          const nextQuestion: LearningQuestionInput = {
            ...q,
            type: 'MULTIPLE_CHOICE',
            options: paddedOptions,
            correctOptionId: paddedOptions.some(
              (opt) => opt.id === q.correctOptionId,
            )
              ? q.correctOptionId
              : 'A',
            skillCode: validSkill,
            evidenceSegmentIds: orderedEv.length > 0 ? orderedEv : [defaultSegId],
          };
          delete nextQuestion.evidence;
          return nextQuestion;
        });
        while (normalized.length < 5) {
          normalized.push(
            createEmptyQuestion(normalized.length, true, defaultSegId),
          );
        }
        return normalized;
      });
    } else {
      setQuestions((prev) =>
        prev.map((q) => {
          const nextQuestion: LearningQuestionInput = { ...q };
          delete nextQuestion.evidenceSegmentIds;
          if (nextKind !== 'READING') {
            delete nextQuestion.evidence;
          }
          if (
            !q.skillCode ||
            !(READING_SKILL_CODES as readonly string[]).includes(q.skillCode)
          ) {
            delete nextQuestion.skillCode;
          }
          return nextQuestion;
        }),
      );
    }
  };

  const handleQuestionTypeChange = (
    qIndex: number,
    nextType: LearningQuestionType,
  ): void => {
    if (kind === 'LISTENING') return;
    setQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== qIndex) return q;
        if (nextType === 'TRUE_FALSE_NOT_GIVEN') {
          return {
            ...q,
            type: nextType,
            options: [
              { id: 'A', text: 'True' },
              { id: 'B', text: 'False' },
              { id: 'C', text: 'Not Given' },
            ],
            correctOptionId: ['A', 'B', 'C'].includes(q.correctOptionId)
              ? q.correctOptionId
              : 'A',
          };
        }
        const paddedOptions =
          q.options.length === 4
            ? q.options
            : [
                { id: 'A', text: q.options[0]?.text ?? '' },
                { id: 'B', text: q.options[1]?.text ?? '' },
                { id: 'C', text: q.options[2]?.text ?? '' },
                { id: 'D', text: '' },
              ];
        return {
          ...q,
          type: nextType,
          options: paddedOptions,
        };
      }),
    );
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);

    let contentPayload: LearningContentPayload;
    if (mode === 'json') {
      const parsed = parseLessonJsonDraft(rawJson);
      if (!parsed.content || parsed.error) {
        setErrorMessage(parsed.error || 'Nội dung JSON không hợp lệ.');
        return;
      }
      const jsonValidationError = validateLessonDraft({
        code,
        kind,
        title,
        description,
        estimatedMinutes,
        passage: parsed.content.passage,
        coverImageUrl: parsed.content.coverImageUrl,
        keyVocabulary: parsed.content.keyVocabulary,
        listeningVersion: parsed.content.listeningVersion,
        audioUrl: parsed.content.audioUrl,
        audioDurationMs: parsed.content.audioDurationMs,
        transcript: parsed.content.transcript,
        preparation: parsed.content.preparation,
        transcriptSegments: parsed.content.transcriptSegments,
        steps: parsed.content.steps,
        questions: parsed.content.questions,
      });
      if (jsonValidationError) {
        setErrorMessage(jsonValidationError);
        return;
      }
      contentPayload = parsed.content;
    } else {
      const validationError = validateLessonDraft({
        code,
        kind,
        title,
        description,
        estimatedMinutes,
        passage: kind === 'READING' ? passage : undefined,
        coverImageUrl,
        keyVocabulary,
        audioUrl: kind === 'LISTENING' ? audioUrl : undefined,
        audioDurationMs: kind === 'LISTENING' ? audioDurationMs : undefined,
        preparation: kind === 'LISTENING' ? preparation : undefined,
        transcriptSegments:
          kind === 'LISTENING' ? transcriptSegments : undefined,
        steps: kind === 'LISTENING' ? [] : steps,
        questions,
      });
      if (validationError) {
        setErrorMessage(validationError);
        return;
      }
      contentPayload = buildCurrentDraftPayload();
    }

    const parsedSortOrder =
      sortOrder.trim() !== '' && Number.isInteger(Number(sortOrder))
        ? Number(sortOrder)
        : undefined;

    setSubmitting(true);
    try {
      const payload = {
        code: code.trim().toLowerCase(),
        kind,
        title: title.trim(),
        description: description.trim(),
        estimatedMinutes,
        ...(parsedSortOrder !== undefined ? { sortOrder: parsedSortOrder } : {}),
        published,
        unitId: unitId || null,
        ...(kind === 'GRAMMAR' || grammarTopicId
          ? { grammarTopicId: grammarTopicId || null }
          : {}),
        content: contentPayload,
      };
      if (editingLesson) {
        await updateAdminLesson(editingLesson.id, payload);
      } else {
        await createAdminLesson(payload);
      }
      onSaved();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Lưu bài tập thất bại. Vui lòng kiểm tra lại dữ liệu.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const previewPayload =
    mode === 'preview' ? buildCurrentDraftPayload() : null;
  const previewQuestions = previewPayload?.questions ?? [];
  const previewAnsweredCount = previewQuestions.reduce((count, q, idx) => {
    const qKey = `${idx}-${q.id}`;
    return previewAnswers[qKey] !== undefined ? count + 1 : count;
  }, 0);
  const previewCorrectCount = previewQuestions.reduce((count, q, idx) => {
    const qKey = `${idx}-${q.id}`;
    return previewAnswers[qKey] === q.correctOptionId ? count + 1 : count;
  }, 0);
  const previewRevealedSegmentIds = new Set<string>();
  previewQuestions.forEach((q, idx) => {
    const qKey = `${idx}-${q.id}`;
    if (previewAnswers[qKey] !== undefined && q.evidenceSegmentIds?.length) {
      q.evidenceSegmentIds.forEach((segId) =>
        previewRevealedSegmentIds.add(segId),
      );
    }
  });
  const previewSegmentsById = new Map<string, ListeningSegmentInput>(
    (previewPayload?.transcriptSegments ?? []).map((seg) => [seg.id, seg]),
  );

  return {
    isEditing,
    isCloning,
    sourceLesson,
    contentBase,
    setContentBase,
    mode,
    setMode,
    previewAnswers,
    setPreviewAnswers,
    code,
    setCode,
    kind,
    title,
    setTitle,
    description,
    setDescription,
    estimatedMinutes,
    setEstimatedMinutes,
    sortOrder,
    setSortOrder,
    unitId,
    setUnitId,
    grammarTopicId,
    setGrammarTopicId,
    published,
    setPublished,
    passage,
    setPassage,
    coverImageUrl,
    setCoverImageUrl,
    keyVocabulary,
    setKeyVocabulary,
    audioUrl,
    setAudioUrl,
    audioDurationMs,
    setAudioDurationMs,
    preparation,
    setPreparation,
    transcriptSegments,
    steps,
    setSteps,
    questions,
    setQuestions,
    rawJson,
    setRawJson,
    showQuickUnit,
    setShowQuickUnit,
    unitCode,
    setUnitCode,
    unitLevel,
    setUnitLevel,
    unitOrder,
    setUnitOrder,
    unitTitle,
    setUnitTitle,
    unitDescription,
    setUnitDescription,
    creatingUnit,
    submitting,
    errorMessage,
    setErrorMessage,
    leafGrammarTopics,
    buildCurrentDraftPayload,
    syncFromParsedContent,
    handleSegmentsChange,
    handleFileUpload,
    handleQuickCreateUnit,
    handleKindChange,
    handleQuestionTypeChange,
    handleSubmit,
    previewPayload,
    previewQuestions,
    previewAnsweredCount,
    previewCorrectCount,
    previewRevealedSegmentIds,
    previewSegmentsById,
  };
}

export type LessonComposerState = ReturnType<typeof useLessonComposerState>;
