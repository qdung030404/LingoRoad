import type React from 'react';
import {
  useMemo as reactUseMemo,
  useState as reactUseState,
} from 'react';
import type * as AdminApi from '@/lib/admin-api';
import {
  assessmentChoiceDraft,
  buildAssessmentChoices,
  mergeAssessmentRubricCriteria,
  validateAssessmentItemDraft,
} from '@/lib/admin-validation';
import type {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
} from '@/types/admin';
import {
  buildCloneExternalId,
  extractMatchingPairs,
  extractReorderTokens,
  type AssessmentItemModalProps,
  type ExistingRubric,
} from './assessment-item.helpers';

export interface AssessmentItemStateDeps {
  useState: typeof reactUseState;
  useMemo: typeof reactUseMemo;
  createAdminAssessmentItem: typeof AdminApi.createAdminAssessmentItem;
  updateAdminAssessmentItem: typeof AdminApi.updateAdminAssessmentItem;
}

export function useAssessmentItemState(
  {
    descriptors,
    editingItem = null,
    cloneFrom = null,
    onSaved,
  }: AssessmentItemModalProps,
  deps: AssessmentItemStateDeps,
) {
  const {
    useState,
    useMemo,
    createAdminAssessmentItem,
    updateAdminAssessmentItem,
  } = deps;

  const isEditing = Boolean(editingItem);
  const isCloning = !editingItem && Boolean(cloneFrom);
  const sourceItem = editingItem ?? cloneFrom ?? null;
  const initialSkill: AssessmentSkill = sourceItem?.skill ?? 'READING';
  const initialLevel: CefrLevel = sourceItem?.cefrLevel ?? 'B1';

  const [externalId, setExternalId] = useState(
    editingItem
      ? editingItem.externalId ?? ''
      : cloneFrom
        ? buildCloneExternalId(cloneFrom.externalId)
        : '',
  );
  const [skill, setSkill] = useState<AssessmentSkill>(initialSkill);
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>(initialLevel);
  const [usageScope, setUsageScope] = useState<ItemUsageScope>(
    sourceItem?.usageScope ?? 'ALL',
  );
  const [type, setType] = useState<ItemType>(
    sourceItem?.type ?? 'MULTIPLE_CHOICE',
  );
  const [groupId, setGroupId] = useState(sourceItem?.groupId ?? '');
  const [itemOrder, setItemOrder] = useState(sourceItem?.itemOrder ?? 1);

  const matchingDescriptors = useMemo(
    () =>
      descriptors.filter(
        (d) => d.skill === skill && d.cefrLevel === cefrLevel,
      ),
    [descriptors, skill, cefrLevel],
  );

  const [skillCode, setSkillCode] = useState<string>(
    sourceItem?.skillCode ??
      matchingDescriptors[0]?.skillCode ??
      'reading.skimming',
  );
  const [irtA, setIrtA] = useState<number>(sourceItem?.irtA ?? 1.0);
  const [irtB, setIrtB] = useState<number>(
    sourceItem?.irtB ?? matchingDescriptors[0]?.defaultIrtB ?? 0,
  );
  const [irtC, setIrtC] = useState<number>(sourceItem?.irtC ?? 0.25);
  const [passage, setPassage] = useState(sourceItem?.passage ?? '');
  const [audioUrl, setAudioUrl] = useState(sourceItem?.audioUrl ?? '');
  const [prompt, setPrompt] = useState(sourceItem?.prompt ?? '');

  const initialChoices = assessmentChoiceDraft(
    sourceItem?.options,
    sourceItem?.correctOption,
  );

  const [options, setOptions] = useState<string[]>(initialChoices.options);
  const [correctIndex, setCorrectIndex] = useState<number>(
    initialChoices.correctIndex,
  );
  const [reorderTokensText, setReorderTokensText] = useState<string>(
    sourceItem?.type === 'SENTENCE_REORDER'
      ? extractReorderTokens(sourceItem.options)
      : '',
  );
  const [matchingPairs, setMatchingPairs] = useState<
    Array<{ left: string; right: string }>
  >(
    sourceItem?.type === 'MATCHING'
      ? extractMatchingPairs(sourceItem.options)
      : [
          { left: '', right: '' },
          { left: '', right: '' },
          { left: '', right: '' },
        ],
  );

  const existingRubric = (sourceItem?.rubricCriteria ?? {}) as ExistingRubric;
  const [targetGrammarsText, setTargetGrammarsText] = useState(
    Array.isArray(existingRubric.targetGrammars)
      ? existingRubric.targetGrammars.join(', ')
      : '',
  );
  const [wordCountMin, setWordCountMin] = useState<string>(
    existingRubric.wordCount?.min !== undefined
      ? String(existingRubric.wordCount.min)
      : '',
  );
  const [wordCountMax, setWordCountMax] = useState<string>(
    existingRubric.wordCount?.max !== undefined
      ? String(existingRubric.wordCount.max)
      : '',
  );
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<string>(
    existingRubric.timeLimitSeconds !== undefined
      ? String(existingRubric.timeLimitSeconds)
      : '',
  );
  const [minSpeakingSeconds, setMinSpeakingSeconds] = useState<string>(
    existingRubric.minSpeakingSeconds !== undefined
      ? String(existingRubric.minSpeakingSeconds)
      : '',
  );
  const [maxSpeakingSeconds, setMaxSpeakingSeconds] = useState<string>(
    existingRubric.maxSpeakingSeconds !== undefined
      ? String(existingRubric.maxSpeakingSeconds)
      : '',
  );
  const [taskAchievement, setTaskAchievement] = useState<string>(
    typeof existingRubric.taskAchievement === 'string'
      ? existingRubric.taskAchievement
      : '',
  );
  const [coherenceCohesion, setCoherenceCohesion] = useState<string>(
    typeof existingRubric.coherenceCohesion === 'string'
      ? existingRubric.coherenceCohesion
      : '',
  );
  const [lexicalResource, setLexicalResource] = useState<string>(
    typeof existingRubric.lexicalResource === 'string'
      ? existingRubric.lexicalResource
      : '',
  );
  const [grammarAccuracy, setGrammarAccuracy] = useState<string>(
    typeof existingRubric.grammarAccuracy === 'string'
      ? existingRubric.grammarAccuracy
      : '',
  );

  const [explanation, setExplanation] = useState(
    sourceItem?.explanation ?? '',
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const syncDescriptorDefaults = (
    nextSkill: AssessmentSkill,
    nextLevel: CefrLevel,
  ): void => {
    const matched = descriptors.find(
      (d) => d.skill === nextSkill && d.cefrLevel === nextLevel,
    );
    if (matched) {
      setSkillCode(matched.skillCode);
      setIrtB(matched.defaultIrtB);
    }
  };

  const usesChoiceOptions =
    type === 'MULTIPLE_CHOICE' || type === 'CLOZE' || type === 'GAP_FILL';
  const usesRubric = type === 'ESSAY' || type === 'SPEAKING_PROMPT';
  const maxChoiceOptions = usageScope === 'PLACEMENT' ? 4 : 8;
  const minChoiceOptions = usageScope === 'PLACEMENT' ? 4 : 2;

  const handleRemoveOption = (idx: number): void => {
    setOptions((prev) => prev.filter((_, i) => i !== idx));
    setCorrectIndex((prev) => {
      if (prev === idx) return -1;
      if (prev > idx) return prev - 1;
      return prev;
    });
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setErrorMessage(null);

    const validationError = validateAssessmentItemDraft({
      skill,
      type,
      usageScope,
      passage,
      audioUrl: skill === 'LISTENING' ? audioUrl : undefined,
      prompt,
      options,
      correctIndex,
      irtB,
    });
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const cleanOptions = options.map((opt) => opt.trim());
    let structuredOptions: unknown;
    let structuredCorrectOption: string | undefined;

    if (usesChoiceOptions) {
      const built = buildAssessmentChoices(
        cleanOptions,
        correctIndex,
        sourceItem?.options,
      );
      structuredOptions = built.options;
      structuredCorrectOption = built.correctOption;
    } else if (type === 'SENTENCE_REORDER') {
      const tokens = reorderTokensText
        .split('|')
        .map((t) => t.trim())
        .filter(Boolean);
      if (tokens.length < 2) {
        setErrorMessage(
          'SENTENCE_REORDER cần tối thiểu 2 mảnh câu cách nhau bởi dấu |.',
        );
        return;
      }
      structuredOptions = tokens;
      structuredCorrectOption = tokens.join(' ');
    } else if (type === 'MATCHING') {
      const cleanPairs = matchingPairs.filter(
        (p) => p.left.trim() && p.right.trim(),
      );
      if (cleanPairs.length < 2) {
        setErrorMessage(
          'MATCHING cần tối thiểu 2 cặp ghép đầy đủ trái – phải.',
        );
        return;
      }
      structuredOptions = cleanPairs.map((p) => ({
        left: p.left.trim(),
        right: p.right.trim(),
      }));
      structuredCorrectOption = JSON.stringify(structuredOptions);
    }

    const mergedRubric = mergeAssessmentRubricCriteria(
      sourceItem?.rubricCriteria,
      {
        targetGrammarsText,
        wordCountMin,
        wordCountMax,
        timeLimitSeconds,
        minSpeakingSeconds,
        maxSpeakingSeconds,
        taskAchievement,
        coherenceCohesion,
        lexicalResource,
        grammarAccuracy,
      },
      type,
    );

    setSubmitting(true);
    try {
      if (editingItem) {
        await updateAdminAssessmentItem(editingItem.id, {
          externalId: externalId.trim() || null,
          ...(groupId ? { groupId, itemOrder } : { groupId: null }),
          skill,
          skillCode: skillCode.trim(),
          cefrLevel,
          type,
          usageScope,
          passage: passage.trim() || null,
          audioUrl: skill === 'LISTENING' ? audioUrl.trim() || null : null,
          prompt: prompt.trim(),
          ...(structuredOptions !== undefined
            ? { options: structuredOptions }
            : {}),
          correctOption: structuredCorrectOption ?? null,
          rubricCriteria: mergedRubric,
          explanation: explanation.trim() || null,
          irtA,
          irtB,
          irtC,
        });
      } else {
        await createAdminAssessmentItem({
          ...(externalId.trim() ? { externalId: externalId.trim() } : {}),
          ...(groupId ? { groupId, itemOrder } : {}),
          skill,
          skillCode: skillCode.trim(),
          cefrLevel,
          type,
          usageScope,
          passage: passage.trim() || undefined,
          audioUrl:
            skill === 'LISTENING' ? audioUrl.trim() || undefined : undefined,
          prompt: prompt.trim(),
          ...(structuredOptions !== undefined
            ? { options: structuredOptions }
            : {}),
          ...(structuredCorrectOption !== undefined
            ? { correctOption: structuredCorrectOption }
            : {}),
          ...(mergedRubric !== null ? { rubricCriteria: mergedRubric } : {}),
          explanation: explanation.trim() || undefined,
          irtA,
          irtB,
          irtC,
        });
      }
      onSaved();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Không thể lưu câu hỏi.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return {
    isEditing,
    isCloning,
    externalId,
    setExternalId,
    skill,
    setSkill,
    cefrLevel,
    setCefrLevel,
    usageScope,
    setUsageScope,
    type,
    setType,
    groupId,
    setGroupId,
    itemOrder,
    setItemOrder,
    matchingDescriptors,
    skillCode,
    setSkillCode,
    irtA,
    setIrtA,
    irtB,
    setIrtB,
    irtC,
    setIrtC,
    passage,
    setPassage,
    audioUrl,
    setAudioUrl,
    prompt,
    setPrompt,
    options,
    setOptions,
    correctIndex,
    setCorrectIndex,
    reorderTokensText,
    setReorderTokensText,
    matchingPairs,
    setMatchingPairs,
    targetGrammarsText,
    setTargetGrammarsText,
    wordCountMin,
    setWordCountMin,
    wordCountMax,
    setWordCountMax,
    timeLimitSeconds,
    setTimeLimitSeconds,
    minSpeakingSeconds,
    setMinSpeakingSeconds,
    maxSpeakingSeconds,
    setMaxSpeakingSeconds,
    taskAchievement,
    setTaskAchievement,
    coherenceCohesion,
    setCoherenceCohesion,
    lexicalResource,
    setLexicalResource,
    grammarAccuracy,
    setGrammarAccuracy,
    explanation,
    setExplanation,
    submitting,
    errorMessage,
    syncDescriptorDefaults,
    usesChoiceOptions,
    usesRubric,
    maxChoiceOptions,
    minChoiceOptions,
    handleRemoveOption,
    handleSubmit,
  };
}

export type AssessmentItemState = ReturnType<typeof useAssessmentItemState>;
