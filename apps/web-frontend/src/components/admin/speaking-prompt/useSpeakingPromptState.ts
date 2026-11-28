import type React from 'react';
import { useState as reactUseState } from 'react';
import type * as AdminApi from '@/lib/admin-api';
import {
  SPEAKING_MAX_HINTS,
  isSafeImageUrl,
  maxSpeakingDurationForMode,
} from '@/lib/admin-validation';
import type {
  AdminSpeakingPrompt,
  SpeakingMode,
  SpeakingPreparationPayload,
} from '@/types/admin';

export interface SpeakingPromptModalProps {
  editingPrompt?: AdminSpeakingPrompt | null;
  cloneFrom?: AdminSpeakingPrompt | null;
  onClose: () => void;
  onSaved: () => void;
}

export interface PrepVocabRow {
  word: string;
  meaningVi: string;
  example: string;
  imageUrl?: string;
}

export const MAX_CODE_LENGTH = 100;
export const MAX_TEXT_LENGTH = 1000;
export const MAX_VISUAL_CONTEXT_LENGTH = 2000;

function buildCloneSpeakingCode(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return '';
  const suffix = '-copy';
  return `${trimmed.slice(0, Math.max(1, MAX_CODE_LENGTH - suffix.length))}${suffix}`;
}

export interface SpeakingPromptStateDeps {
  useState: typeof reactUseState;
  createAdminSpeakingPrompt: typeof AdminApi.createAdminSpeakingPrompt;
  updateAdminSpeakingPrompt: typeof AdminApi.updateAdminSpeakingPrompt;
}

export function useSpeakingPromptState(
  {
    editingPrompt = null,
    cloneFrom = null,
    onSaved,
  }: SpeakingPromptModalProps,
  deps: SpeakingPromptStateDeps,
) {
  const { useState, createAdminSpeakingPrompt, updateAdminSpeakingPrompt } =
    deps;

  const isEditing = Boolean(editingPrompt);
  const isCloning = !editingPrompt && Boolean(cloneFrom);
  const sourcePrompt = editingPrompt ?? cloneFrom ?? null;

  const [code, setCode] = useState(
    editingPrompt
      ? editingPrompt.code
      : cloneFrom
        ? buildCloneSpeakingCode(cloneFrom.code)
        : '',
  );
  const [mode, setMode] = useState<SpeakingMode>(
    sourcePrompt?.mode ?? 'READ_ALOUD',
  );
  const [title, setTitle] = useState(
    editingPrompt
      ? editingPrompt.title
      : cloneFrom
        ? `${cloneFrom.title} (Bản sao)`
        : '',
  );
  const [text, setText] = useState(sourcePrompt?.text ?? '');
  const [difficulty, setDifficulty] = useState(sourcePrompt?.difficulty ?? 1);
  const [maxDurationSeconds, setMaxDurationSeconds] = useState(() => {
    const initialMode = sourcePrompt?.mode ?? 'READ_ALOUD';
    const limit = maxSpeakingDurationForMode(initialMode);
    const raw = sourcePrompt?.maxDurationSeconds ?? limit;
    return Math.min(limit, Math.max(5, raw));
  });
  const [sortOrder, setSortOrder] = useState<string>(
    editingPrompt?.sortOrder !== undefined ? String(editingPrompt.sortOrder) : '',
  );
  const [published, setPublished] = useState(
    editingPrompt ? editingPrompt.published : cloneFrom ? false : true,
  );
  const [hintsText, setHintsText] = useState(
    (sourcePrompt?.hints ?? []).join('\n'),
  );
  const [sampleAsset, setSampleAsset] = useState(
    sourcePrompt?.sampleAsset ?? '',
  );
  const [imageUrl, setImageUrl] = useState(sourcePrompt?.imageUrl ?? '');
  const [visualContext, setVisualContext] = useState(
    sourcePrompt?.visualContext ?? '',
  );
  const [linkedCodesText, setLinkedCodesText] = useState(
    (sourcePrompt?.linkedReadAloudCodes ?? []).join(', '),
  );

  const initialPrep = sourcePrompt?.preparation ?? {};
  const [prepGoal, setPrepGoal] = useState(initialPrep.goal ?? '');
  const [prepSceneImage, setPrepSceneImage] = useState(
    initialPrep.sceneImageUrl ?? '',
  );
  const [prepVocab, setPrepVocab] = useState<PrepVocabRow[]>(
    initialPrep.vocabulary?.map((v) => ({
      word: v.word,
      meaningVi: v.meaningVi,
      example: v.example,
      imageUrl: v.imageUrl ?? '',
    })) ?? [],
  );
  const [prepPhrases, setPrepPhrases] = useState<
    Array<{ text: string; meaningVi: string }>
  >(
    initialPrep.phrases?.map((p) => ({
      text: p.text,
      meaningVi: p.meaningVi,
    })) ?? [],
  );

  const [confirmVersionReset, setConfirmVersionReset] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const durationLimit = maxSpeakingDurationForMode(mode);
  const parsedHints = hintsText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const originalHints = (editingPrompt?.hints ?? [])
    .map((l) => l.trim())
    .filter(Boolean);
  const hintsChanged =
    parsedHints.length !== originalHints.length ||
    parsedHints.some((hint, idx) => hint !== originalHints[idx]);
  const isTongueTwisterContentChanged = Boolean(
    editingPrompt &&
      editingPrompt.mode === 'TONGUE_TWISTER' &&
      (text.trim() !== editingPrompt.text.trim() ||
        mode !== editingPrompt.mode ||
        hintsChanged ||
        (imageUrl.trim() || null) !== (editingPrompt.imageUrl?.trim() || null)),
  );

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    const cleanCode = code.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(cleanCode) || cleanCode.length > MAX_CODE_LENGTH) {
      setError(
        `Mã đề luyện nói chỉ gồm chữ thường, số và dấu gạch ngang (tối đa ${MAX_CODE_LENGTH} ký tự).`,
      );
      return;
    }

    const cleanText = text.trim();
    if (cleanText.length < 2 || cleanText.length > MAX_TEXT_LENGTH) {
      setError(
        `Nội dung đề luyện nói phải có độ dài từ 2 đến ${MAX_TEXT_LENGTH} ký tự.`,
      );
      return;
    }

    const cleanVisualContext = visualContext.trim();
    if (cleanVisualContext.length > MAX_VISUAL_CONTEXT_LENGTH) {
      setError(
        `Ngữ cảnh chấm AI (visualContext) không được vượt quá ${MAX_VISUAL_CONTEXT_LENGTH} ký tự.`,
      );
      return;
    }

    if (
      !Number.isInteger(maxDurationSeconds) ||
      maxDurationSeconds < 5 ||
      maxDurationSeconds > durationLimit
    ) {
      setError(
        `Thời lượng tối đa cho chế độ ${mode} phải nằm trong khoảng 5–${durationLimit} giây.`,
      );
      return;
    }

    if (parsedHints.length > SPEAKING_MAX_HINTS) {
      setError(
        `Chế độ luyện nói chỉ hỗ trợ tối đa ${SPEAKING_MAX_HINTS} gợi ý (hints).`,
      );
      return;
    }

    const cleanImageUrl = imageUrl.trim();
    if (mode === 'PICTURE_DESCRIPTION' && !cleanImageUrl) {
      setError(
        'Chế độ Mô tả tranh (PICTURE_DESCRIPTION) bắt buộc có ảnh minh họa.',
      );
      return;
    }
    if (cleanImageUrl && !isSafeImageUrl(cleanImageUrl)) {
      setError('Đường dẫn ảnh minh họa không hợp lệ.');
      return;
    }

    if (isTongueTwisterContentChanged && !confirmVersionReset) {
      setError(
        'Vui lòng xác nhận việc tăng contentVersion trước khi lưu thay đổi nội dung Tongue Twister.',
      );
      return;
    }

    const linkedReadAloudCodes = linkedCodesText
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);

    let preparation: SpeakingPreparationPayload | null = null;
    if (
      mode === 'TOPIC' &&
      (prepGoal.trim() ||
        prepSceneImage.trim() ||
        prepVocab.some(
          (v) => v.word.trim() || v.meaningVi.trim() || v.imageUrl?.trim(),
        ) ||
        prepPhrases.some((p) => p.text.trim()))
    ) {
      const cleanSceneImage = prepSceneImage.trim();
      if (cleanSceneImage && !isSafeImageUrl(cleanSceneImage)) {
        setError('Ảnh bối cảnh hội thoại (sceneImageUrl) không hợp lệ.');
        return;
      }

      const cleanVocab = [];
      for (let i = 0; i < prepVocab.length; i++) {
        const v = prepVocab[i];
        if (!v.word.trim() || !v.meaningVi.trim()) continue;
        const vocabImg = v.imageUrl?.trim();
        if (vocabImg && !isSafeImageUrl(vocabImg)) {
          setError(`Ảnh minh họa của từ vựng gợi ý #${i + 1} không hợp lệ.`);
          return;
        }
        cleanVocab.push({
          word: v.word.trim(),
          meaningVi: v.meaningVi.trim(),
          example: v.example.trim(),
          ...(vocabImg ? { imageUrl: vocabImg } : {}),
        });
      }

      preparation = {
        ...(prepGoal.trim() ? { goal: prepGoal.trim() } : {}),
        ...(cleanSceneImage ? { sceneImageUrl: cleanSceneImage } : {}),
        vocabulary: cleanVocab,
        phrases: prepPhrases
          .filter((p) => p.text.trim() && p.meaningVi.trim())
          .map((p) => ({
            text: p.text.trim(),
            meaningVi: p.meaningVi.trim(),
          })),
      };
    }

    const parsedOrder =
      sortOrder.trim() !== '' && Number.isInteger(Number(sortOrder))
        ? Number(sortOrder)
        : undefined;

    setSaving(true);
    try {
      const payload = {
        code: cleanCode,
        mode,
        title: title.trim(),
        text: cleanText,
        difficulty,
        maxDurationSeconds,
        hints: parsedHints,
        sampleAsset: sampleAsset.trim() || null,
        imageUrl: cleanImageUrl || null,
        visualContext: cleanVisualContext || null,
        preparation,
        linkedReadAloudCodes,
        ...(parsedOrder !== undefined ? { sortOrder: parsedOrder } : {}),
        published,
      };
      if (editingPrompt) {
        await updateAdminSpeakingPrompt(editingPrompt.id, payload);
      } else {
        await createAdminSpeakingPrompt(payload);
      }
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Không thể lưu đề luyện nói.',
      );
    } finally {
      setSaving(false);
    }
  };

  return {
    isEditing,
    isCloning,
    code,
    setCode,
    mode,
    setMode,
    title,
    setTitle,
    text,
    setText,
    difficulty,
    setDifficulty,
    maxDurationSeconds,
    setMaxDurationSeconds,
    sortOrder,
    setSortOrder,
    published,
    setPublished,
    hintsText,
    setHintsText,
    sampleAsset,
    setSampleAsset,
    imageUrl,
    setImageUrl,
    visualContext,
    setVisualContext,
    linkedCodesText,
    setLinkedCodesText,
    prepGoal,
    setPrepGoal,
    prepSceneImage,
    setPrepSceneImage,
    prepVocab,
    setPrepVocab,
    prepPhrases,
    setPrepPhrases,
    confirmVersionReset,
    setConfirmVersionReset,
    saving,
    error,
    durationLimit,
    parsedHints,
    isTongueTwisterContentChanged,
    handleSubmit,
  };
}

export type SpeakingPromptState = ReturnType<typeof useSpeakingPromptState>;
