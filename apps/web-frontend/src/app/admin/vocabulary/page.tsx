'use client';

import React, { useEffect } from 'react';
import { Download, Plus, Search, Tags, Trash2 } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminToast, type AdminToastApi } from '@/components/admin/AdminToast';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { resolveAdminMediaUrl } from '@/lib/admin-api';
import {
  VocabularyTopicModal,
  VocabularyWordModal,
} from './VocabularyModals';
import { useVocabularyAdminState } from './useVocabularyAdminState';

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
  const state = useVocabularyAdminState();
  const {
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
    wordLimit,
    setWordPage,
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
    openTopicModal,
    openWordModal,
    handleConfirmDelete,
    handleExport,
  } = state;

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
                            {topic.titleEn} · {topic.wordsCount} từ · #
                            {topic.displayOrder}
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
                            <td
                              colSpan={3}
                              className="py-10 text-center text-slateDark-700"
                            >
                              Đang tải danh sách từ...
                            </td>
                          </tr>
                        ) : words.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3}
                              className="py-10 text-center text-slateDark-700"
                            >
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

          <VocabularyTopicModal state={state} />
          <VocabularyWordModal state={state} />

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
