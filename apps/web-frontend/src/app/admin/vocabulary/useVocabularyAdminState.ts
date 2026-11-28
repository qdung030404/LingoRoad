import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NOOP_ADMIN_TOAST, type AdminToastApi } from '@/components/admin/AdminToast';
import {
  createAdminVocabTopic,
  createAdminVocabWord,
  deleteAdminVocabTopic,
  deleteAdminVocabWord,
  downloadAdminExport,
  listAdminVocabTopics,
  listAdminVocabWords,
  updateAdminVocabTopic,
  updateAdminVocabWord,
} from '@/lib/admin-api';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import type {
  AdminCuratedTopic,
  AdminCuratedWord,
  PaginationMeta,
} from '@/types/admin';

export type ConfirmDeleteTarget =
  | { kind: 'topic'; topic: AdminCuratedTopic }
  | { kind: 'word'; word: AdminCuratedWord };

export function useVocabularyAdminState() {
  const toastRef = useRef<AdminToastApi>(NOOP_ADMIN_TOAST);
  const [authReady, setAuthReady] = useState(false);
  const [topics, setTopics] = useState<AdminCuratedTopic[]>([]);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [topicSearch, setTopicSearch] = useState('');
  const debouncedTopicSearch = useDebouncedValue(topicSearch, 300);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const requestIdRef = useRef(0);

  const [words, setWords] = useState<AdminCuratedWord[]>([]);
  const [wordPagination, setWordPagination] = useState<PaginationMeta>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [wordPage, setWordPage] = useState(1);
  const [wordLimit, setWordLimit] = useState(10);
  const [wordSearchInput, setWordSearchInput] = useState('');
  const [wordSearch, setWordSearch] = useState('');
  const [loadingWords, setLoadingWords] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [bannerError, setBannerError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] =
    useState<ConfirmDeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Topic modal
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<AdminCuratedTopic | null>(
    null,
  );
  const [tSlug, setTSlug] = useState('');
  const [tTitleEn, setTTitleEn] = useState('');
  const [tTitleVi, setTTitleVi] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tIcon, setTIcon] = useState('');
  const [tOrder, setTOrder] = useState(1);
  const [savingTopic, setSavingTopic] = useState(false);
  const [topicError, setTopicError] = useState<string | null>(null);

  // Word modal
  const [showWordModal, setShowWordModal] = useState(false);
  const [editingWord, setEditingWord] = useState<AdminCuratedWord | null>(null);
  const [wWord, setWWord] = useState('');
  const [wPhonetic, setWPhonetic] = useState('');
  const [wPos, setWPos] = useState('');
  const [wMeaning, setWMeaning] = useState('');
  const [wExampleEn, setWExampleEn] = useState('');
  const [wExampleVi, setWExampleVi] = useState('');
  const [wImageUrl, setWImageUrl] = useState('');
  const [wAudioUrl, setWAudioUrl] = useState('');
  const [savingWord, setSavingWord] = useState(false);
  const [wordError, setWordError] = useState<string | null>(null);

  const loadTopics = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoadingTopics(true);
    setBannerError(null);
    try {
      const rows = await listAdminVocabTopics(debouncedTopicSearch);
      if (requestId !== requestIdRef.current) return;
      setTopics(rows);
      setSelectedTopicId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setBannerError(
        err instanceof Error
          ? err.message
          : 'Không thể tải danh sách chủ đề từ vựng.',
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingTopics(false);
      }
    }
  }, [debouncedTopicSearch]);

  const loadWords = useCallback(async () => {
    if (!selectedTopicId) {
      setWords([]);
      return;
    }
    setLoadingWords(true);
    try {
      const res = await listAdminVocabWords(selectedTopicId, {
        page: wordPage,
        limit: wordLimit,
        search: wordSearch,
      });
      setWords(res.items);
      setWordPagination(res.pagination);
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Không thể tải danh sách từ vựng.',
      );
    } finally {
      setLoadingWords(false);
    }
  }, [selectedTopicId, wordPage, wordLimit, wordSearch]);

  useEffect(() => {
    if (!authReady) return;
    void loadTopics();
  }, [authReady, loadTopics]);

  useEffect(() => {
    if (!authReady) return;
    void loadWords();
  }, [authReady, loadWords]);

  const selectedTopic = topics.find((t) => t.id === selectedTopicId) ?? null;

  const openTopicModal = (topic: AdminCuratedTopic | null): void => {
    setEditingTopic(topic);
    setTSlug(topic?.slug ?? '');
    setTTitleEn(topic?.titleEn ?? '');
    setTTitleVi(topic?.titleVi ?? '');
    setTDesc(topic?.description ?? '');
    setTIcon(topic?.icon ?? '');
    setTOrder(topic?.displayOrder ?? topics.length + 1);
    setTopicError(null);
    setShowTopicModal(true);
  };

  const handleSaveTopic = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setTopicError(null);
    setSavingTopic(true);
    try {
      const payload = {
        slug: tSlug.trim().toLowerCase(),
        titleEn: tTitleEn.trim(),
        titleVi: tTitleVi.trim(),
        description: tDesc.trim() || null,
        icon: tIcon.trim() || null,
        displayOrder: tOrder,
      };
      if (editingTopic) {
        await updateAdminVocabTopic(editingTopic.id, payload);
        toastRef.current.success(`Đã cập nhật chủ đề "${payload.titleVi}".`);
      } else {
        const created = await createAdminVocabTopic(payload);
        setSelectedTopicId(created.id);
        toastRef.current.success(`Đã tạo chủ đề "${payload.titleVi}".`);
      }
      setShowTopicModal(false);
      await loadTopics();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lưu chủ đề thất bại.';
      setTopicError(msg);
      toastRef.current.error(msg);
    } finally {
      setSavingTopic(false);
    }
  };

  const openWordModal = (word: AdminCuratedWord | null): void => {
    setEditingWord(word);
    setWWord(word?.word ?? '');
    setWPhonetic(word?.phonetic ?? '');
    setWPos(word?.partOfSpeech ?? '');
    setWMeaning(word?.meaningVi ?? '');
    setWExampleEn(word?.exampleEn ?? '');
    setWExampleVi(word?.exampleVi ?? '');
    setWImageUrl(word?.imageUrl ?? '');
    setWAudioUrl(word?.audioUrl ?? '');
    setWordError(null);
    setShowWordModal(true);
  };

  const handleSaveWord = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!selectedTopicId) return;
    setWordError(null);
    setSavingWord(true);
    try {
      const payload = {
        word: wWord.trim(),
        phonetic: wPhonetic.trim(),
        partOfSpeech: wPos.trim(),
        meaningVi: wMeaning.trim(),
        exampleEn: wExampleEn.trim(),
        exampleVi: wExampleVi.trim(),
        imageUrl: wImageUrl.trim() || null,
        audioUrl: wAudioUrl.trim() || null,
      };
      if (editingWord) {
        await updateAdminVocabWord(selectedTopicId, editingWord.id, payload);
        toastRef.current.success(`Đã cập nhật từ "${payload.word}".`);
      } else {
        await createAdminVocabWord(selectedTopicId, payload);
        toastRef.current.success(`Đã thêm từ "${payload.word}".`);
      }
      setShowWordModal(false);
      await Promise.all([loadWords(), loadTopics()]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lưu từ vựng thất bại.';
      setWordError(msg);
      toastRef.current.error(msg);
    } finally {
      setSavingWord(false);
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    setBannerError(null);
    try {
      if (confirmDelete.kind === 'topic') {
        await deleteAdminVocabTopic(confirmDelete.topic.id);
        toastRef.current.success(
          `Đã xoá chủ đề "${confirmDelete.topic.titleVi}".`,
        );
        setConfirmDelete(null);
        await loadTopics();
      } else {
        if (!selectedTopicId) return;
        await deleteAdminVocabWord(selectedTopicId, confirmDelete.word.id);
        toastRef.current.success(`Đã xoá từ "${confirmDelete.word.word}".`);
        setConfirmDelete(null);
        await Promise.all([loadWords(), loadTopics()]);
      }
    } catch (err) {
      const fallback =
        confirmDelete.kind === 'topic'
          ? 'Xoá chủ đề thất bại.'
          : 'Xoá từ thất bại.';
      const msg = err instanceof Error ? err.message : fallback;
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json'): Promise<void> => {
    if (exporting) return;
    setExporting(true);
    setBannerError(null);
    try {
      await downloadAdminExport('topics', format);
      toastRef.current.success(
        `Đã xuất dữ liệu từ vựng (${format.toUpperCase()}).`,
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Xuất dữ liệu từ vựng thất bại.';
      setBannerError(msg);
      toastRef.current.error(msg);
    } finally {
      setExporting(false);
    }
  };

  return {
    toastRef,
    setAuthReady,
    topics,
    selectedTopicId,
    setSelectedTopicId,
    selectedTopic,
    topicSearch,
    setTopicSearch,
    loadingTopics,
    words,
    wordPagination,
    wordPage,
    setWordPage,
    wordLimit,
    setWordLimit,
    wordSearchInput,
    setWordSearchInput,
    setWordSearch,
    loadingWords,
    exporting,
    bannerError,
    confirmDelete,
    setConfirmDelete,
    deleting,
    showTopicModal,
    setShowTopicModal,
    editingTopic,
    tSlug,
    setTSlug,
    tTitleEn,
    setTTitleEn,
    tTitleVi,
    setTTitleVi,
    tDesc,
    setTDesc,
    tIcon,
    setTIcon,
    tOrder,
    setTOrder,
    savingTopic,
    topicError,
    showWordModal,
    setShowWordModal,
    editingWord,
    wWord,
    setWWord,
    wPhonetic,
    setWPhonetic,
    wPos,
    setWPos,
    wMeaning,
    setWMeaning,
    wExampleEn,
    setWExampleEn,
    wExampleVi,
    setWExampleVi,
    wImageUrl,
    setWImageUrl,
    wAudioUrl,
    setWAudioUrl,
    savingWord,
    wordError,
    openTopicModal,
    handleSaveTopic,
    openWordModal,
    handleSaveWord,
    handleConfirmDelete,
    handleExport,
  };
}

export type VocabularyAdminState = ReturnType<typeof useVocabularyAdminState>;
