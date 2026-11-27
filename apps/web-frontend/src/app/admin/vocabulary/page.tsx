'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Plus, Search, Tags, Trash2, X } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  NOOP_ADMIN_TOAST,
  useAdminToast,
  type AdminToastApi,
} from '@/components/admin/AdminToast';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { MediaUploadField } from '@/components/admin/MediaUploadField';
import {
  createAdminVocabTopic,
  createAdminVocabWord,
  deleteAdminVocabTopic,
  deleteAdminVocabWord,
  downloadAdminExport,
  listAdminVocabTopics,
  listAdminVocabWords,
  resolveAdminMediaUrl,
  updateAdminVocabTopic,
  updateAdminVocabWord,
} from '@/lib/admin-api';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import type {
  AdminCuratedTopic,
  AdminCuratedWord,
  PaginationMeta,
} from '@/types/admin';

type ConfirmDeleteTarget =
  | { kind: 'topic'; topic: AdminCuratedTopic }
  | { kind: 'word'; word: AdminCuratedWord };

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

export default function AdminVocabularyPage(): React.ReactElement {
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
  const [editingTopic, setEditingTopic] = useState<AdminCuratedTopic | null>(null);
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
        err instanceof Error ? err.message : 'Không thể tải danh sách chủ đề từ vựng.',
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

  return (
    <AdminShell
      breadcrumbTitle="Từ vựng"
      title="Curated Vocabulary CMS"
      subtitle="Quản lý bộ chủ đề từ vựng hệ thống và từng từ vựng kèm phiên âm, ví dụ và hình ảnh."
      onAuthenticated={() => setAuthReady(true)}
      actions={
        <>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport('csv')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => void handleExport('json')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={() => openTopicModal(null)}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo chủ đề</span>
          </button>
        </>
      }
    >
      {() => (
        <div className="space-y-5">
          <AdminToastBridge toastRef={toastRef} />

          {bannerError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700">
              {bannerError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Cột trái: Danh sách chủ đề */}
            <div className="space-y-3 rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm lg:col-span-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
                <input
                  type="text"
                  value={topicSearch}
                  onChange={(e) => setTopicSearch(e.target.value)}
                  placeholder="Tìm chủ đề từ vựng..."
                  className="w-full rounded-xl border border-slateDark-200 bg-slateDark-25 py-2 pl-9 pr-3 text-xs focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="max-h-[65vh] space-y-1.5 overflow-y-auto pr-1">
                {loadingTopics ? (
                  <p className="py-8 text-center text-xs text-slateDark-700">
                    Đang tải chủ đề...
                  </p>
                ) : topics.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slateDark-700">
                    Chưa có chủ đề từ vựng nào.
                  </p>
                ) : (
                  topics.map((topic) => {
                    const active = topic.id === selectedTopicId;
                    return (
                      <div
                        key={topic.id}
                        className={
                          active
                            ? 'flex items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3'
                            : 'flex items-center justify-between gap-2 rounded-xl border border-transparent p-3 hover:bg-slateDark-25'
                        }
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTopicId(topic.id);
                            setWordPage(1);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-1.5">
                            <Tags className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                            <p className="truncate text-xs font-bold text-slateDark-900">
                              {topic.titleVi}
                            </p>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-slateDark-700">
                            {topic.titleEn} · {topic.wordsCount} từ · #{topic.displayOrder}
                          </p>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openTopicModal(topic)}
                            className="rounded-lg border border-slateDark-200 bg-white px-2 py-1 text-[11px] font-semibold text-slateDark-800 hover:bg-slateDark-50"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDelete({ kind: 'topic', topic })
                            }
                            aria-label="Xoá chủ đề"
                            className="rounded-lg p-1 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Cột phải: Danh sách từ trong chủ đề */}
            <div className="space-y-4 rounded-2xl border border-slateDark-100 bg-white p-5 shadow-sm lg:col-span-8">
              {selectedTopic ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slateDark-100 pb-4">
                    <div>
                      <h2 className="text-base font-extrabold text-slateDark-900">
                        {selectedTopic.titleVi}{' '}
                        <span className="font-normal text-slateDark-700">
                          ({selectedTopic.titleEn})
                        </span>
                      </h2>
                      <p className="text-xs text-slateDark-700">
                        Slug: <code>{selectedTopic.slug}</code> ·{' '}
                        {selectedTopic.wordsCount} từ vựng
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openWordModal(null)}
                      className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Thêm từ vựng</span>
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setWordPage(1);
                      setWordSearch(wordSearchInput);
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={wordSearchInput}
                      onChange={(e) => setWordSearchInput(e.target.value)}
                      placeholder="Tìm từ tiếng Anh, nghĩa tiếng Việt..."
                      className="flex-1 rounded-xl border border-slateDark-200 bg-slateDark-25 px-3.5 py-2 text-xs focus:border-brand-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-xl border border-slateDark-200 bg-white px-4 py-2 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
                    >
                      Tìm
                    </button>
                  </form>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                        <tr>
                          <th className="px-4 py-3">Từ vựng</th>
                          <th className="px-4 py-3">Nghĩa & Ví dụ</th>
                          <th className="px-4 py-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slateDark-100">
                        {loadingWords ? (
                          <tr>
                            <td colSpan={3} className="py-10 text-center text-slateDark-700">
                              Đang tải danh sách từ...
                            </td>
                          </tr>
                        ) : words.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-10 text-center text-slateDark-700">
                              Chưa có từ vựng nào trong chủ đề này.
                            </td>
                          </tr>
                        ) : (
                          words.map((word) => (
                            <tr key={word.id} className="hover:bg-slateDark-25">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  {word.imageUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={resolveAdminMediaUrl(word.imageUrl)}
                                      alt={word.word}
                                      className="h-9 w-9 shrink-0 rounded-lg border border-slateDark-100 object-cover"
                                    />
                                  )}
                                  <div>
                                    <p className="font-bold text-slateDark-900">
                                      {word.word}{' '}
                                      {word.partOfSpeech && (
                                        <span className="font-normal text-brand-700">
                                          ({word.partOfSpeech})
                                        </span>
                                      )}
                                    </p>
                                    {word.phonetic && (
                                      <p className="font-mono text-[11px] text-slateDark-700">
                                        {word.phonetic}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="max-w-sm px-4 py-3">
                                <p className="font-semibold text-slateDark-900">
                                  {word.meaningVi}
                                </p>
                                {word.exampleEn && (
                                  <p className="mt-0.5 line-clamp-1 italic text-slateDark-700">
                                    {word.exampleEn}
                                  </p>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => openWordModal(word)}
                                    className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 font-semibold text-slateDark-900 hover:bg-slateDark-50"
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmDelete({ kind: 'word', word })
                                    }
                                    className="rounded-lg border border-red-200 bg-white px-2.5 py-1 font-semibold text-red-600 hover:bg-red-50"
                                  >
                                    Xóa
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <GlobalPagination
                    page={wordPagination.page}
                    limit={wordLimit}
                    total={wordPagination.total}
                    totalPages={wordPagination.totalPages}
                    onPageChange={(next) => setWordPage(next)}
                    onLimitChange={(next) => {
                      setWordLimit(next);
                      setWordPage(1);
                    }}
                  />
                </>
              ) : (
                <p className="py-12 text-center text-sm text-slateDark-700">
                  Chọn một chủ đề ở cột trái hoặc tạo chủ đề mới để bắt đầu.
                </p>
              )}
            </div>
          </div>

          {/* Modal Chủ đề */}
          {showTopicModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
              <div className="w-full max-w-md rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slateDark-900">
                    {editingTopic ? 'Sửa chủ đề từ vựng' : 'Tạo chủ đề từ vựng'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowTopicModal(false)}
                    className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={(e) => void handleSaveTopic(e)} className="space-y-3.5">
                  {topicError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {topicError}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-semibold">Slug *</label>
                      <input
                        type="text"
                        required
                        value={tSlug}
                        onChange={(e) => setTSlug(e.target.value)}
                        placeholder="office-basics"
                        className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold">Thứ tự</label>
                      <input
                        type="number"
                        min={0}
                        value={tOrder}
                        onChange={(e) => setTOrder(Number(e.target.value))}
                        className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="mb-1 block text-xs font-semibold">Tên tiếng Việt *</label>
                      <input
                        type="text"
                        required
                        value={tTitleVi}
                        onChange={(e) => setTTitleVi(e.target.value)}
                        className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold">Tên tiếng Anh *</label>
                      <input
                        type="text"
                        required
                        value={tTitleEn}
                        onChange={(e) => setTTitleEn(e.target.value)}
                        className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Icon (tuỳ chọn)</label>
                    <input
                      type="text"
                      value={tIcon}
                      onChange={(e) => setTIcon(e.target.value)}
                      placeholder="briefcase / plane / book"
                      className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold">Mô tả</label>
                    <textarea
                      rows={2}
                      value={tDesc}
                      onChange={(e) => setTDesc(e.target.value)}
                      className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-xs"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowTopicModal(false)}
                      className="rounded-xl border border-slateDark-200 px-4 py-2 text-xs font-semibold"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={savingTopic}
                      className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold disabled:opacity-50"
                    >
                      {savingTopic ? 'Đang lưu...' : 'Lưu chủ đề'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Modal Từ vựng */}
          {showWordModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
              <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
                  <h2 className="text-lg font-bold text-slateDark-900">
                    {editingWord ? 'Sửa từ vựng' : 'Thêm từ vựng mới'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowWordModal(false)}
                    className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <form
                  onSubmit={(e) => void handleSaveWord(e)}
                  className="flex-1 space-y-3.5 overflow-y-auto p-6"
                >
                  {wordError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {wordError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold">Từ tiếng Anh *</label>
                      <input
                        type="text"
                        required
                        value={wWord}
                        onChange={(e) => setWWord(e.target.value)}
                        className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold">Phiên âm IPA</label>
                      <input
                        type="text"
                        value={wPhonetic}
                        onChange={(e) => setWPhonetic(e.target.value)}
                        placeholder="/ˈkɒliːɡ/"
                        className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold">Từ loại</label>
                      <input
                        type="text"
                        value={wPos}
                        onChange={(e) => setWPos(e.target.value)}
                        placeholder="Danh từ / n."
                        className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold">Nghĩa tiếng Việt *</label>
                    <input
                      type="text"
                      required
                      value={wMeaning}
                      onChange={(e) => setWMeaning(e.target.value)}
                      className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold">Ví dụ tiếng Anh</label>
                    <textarea
                      rows={2}
                      value={wExampleEn}
                      onChange={(e) => setWExampleEn(e.target.value)}
                      className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold">Dịch ví dụ tiếng Việt</label>
                    <textarea
                      rows={2}
                      value={wExampleVi}
                      onChange={(e) => setWExampleVi(e.target.value)}
                      className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 p-3 text-xs"
                    />
                  </div>

                  <MediaUploadField
                    kind="image"
                    slug={`vocab-${wWord || 'word'}`}
                    label="Ảnh minh họa từ vựng (tuỳ chọn)"
                    value={wImageUrl}
                    onChange={(url) => setWImageUrl(url)}
                  />

                  <div>
                    <label className="mb-1 block text-xs font-semibold">URL Audio phát âm (tuỳ chọn)</label>
                    <input
                      type="text"
                      value={wAudioUrl}
                      onChange={(e) => setWAudioUrl(e.target.value)}
                      placeholder="https://... hoặc /media/..."
                      className="w-full rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 border-t border-slateDark-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowWordModal(false)}
                      className="rounded-xl border border-slateDark-200 px-4 py-2 text-xs font-semibold"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={savingWord}
                      className="btn-primary rounded-xl px-5 py-2 text-xs font-semibold disabled:opacity-50"
                    >
                      {savingWord ? 'Đang lưu...' : 'Lưu từ vựng'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <ConfirmDialog
            open={Boolean(confirmDelete)}
            title={
              confirmDelete?.kind === 'topic'
                ? 'Xoá chủ đề từ vựng'
                : 'Xoá từ vựng'
            }
            description={
              confirmDelete?.kind === 'topic' ? (
                <>
                  Bạn có chắc muốn xoá chủ đề{' '}
                  <strong>{confirmDelete.topic.titleVi}</strong> cùng toàn bộ{' '}
                  <strong>{confirmDelete.topic.wordsCount} từ vựng</strong>{' '}
                  trong chủ đề này? Hành động này không thể hoàn tác.
                </>
              ) : confirmDelete?.kind === 'word' ? (
                <>
                  Bạn có chắc muốn xoá từ{' '}
                  <strong>{confirmDelete.word.word}</strong> khỏi chủ đề hiện
                  tại?
                </>
              ) : null
            }
            confirmLabel={
              confirmDelete?.kind === 'topic' ? 'Xoá chủ đề' : 'Xoá từ'
            }
            tone="danger"
            busy={deleting}
            onConfirm={handleConfirmDelete}
            onCancel={() => setConfirmDelete(null)}
          />
        </div>
      )}
    </AdminShell>
  );
}
