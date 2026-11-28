'use client';

import React, { useState } from 'react';
import { Eye, Plus, Upload, X } from 'lucide-react';
import {
  createAdminLesson,
  createLearningUnit,
  updateAdminLesson,
} from '@/lib/admin-api';
import { parseLessonJsonDraft } from '@/lib/admin-validation';
import type { CefrLevel, LearningKind } from '@/types/admin';
import { ListeningLessonForm } from './ListeningLessonForm';
import { MediaUploadField } from './MediaUploadField';
import { LessonKeyVocabAndStepsEditor } from './lesson-composer/LessonKeyVocabAndStepsEditor';
import { LessonPreviewPane } from './lesson-composer/LessonPreviewPane';
import { LessonQuestionsEditor } from './lesson-composer/LessonQuestionsEditor';
import { type LessonComposerModalProps } from './lesson-composer/lesson-composer.helpers';
import { useLessonComposerState } from './lesson-composer/useLessonComposerState';

export function LessonComposerModal(props: LessonComposerModalProps): React.ReactElement {
  const { units, onClose } = props;
  const state = useLessonComposerState(props, {
    useStateImpl: useState,
    createAdminLesson,
    createLearningUnit,
    updateAdminLesson,
  });
  const {
    isEditing, isCloning, mode, setMode, setPreviewAnswers,
    code, setCode, kind, title, setTitle, description, setDescription,
    estimatedMinutes, setEstimatedMinutes, sortOrder, setSortOrder,
    unitId, setUnitId, grammarTopicId, setGrammarTopicId,
    published, setPublished, passage, setPassage,
    coverImageUrl, setCoverImageUrl, audioUrl, setAudioUrl,
    audioDurationMs, setAudioDurationMs, preparation, setPreparation,
    transcriptSegments, rawJson, setRawJson, showQuickUnit, setShowQuickUnit,
    unitCode, setUnitCode, unitLevel, setUnitLevel, unitOrder,
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
    handleSubmit,
    previewPayload,
  } = state;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slateDark-900">
              {isEditing
                ? 'Chỉnh sửa bài tập'
                : isCloning
                  ? 'Nhân bản bài tập'
                  : 'Thêm bài tập lộ trình mới'}
            </h2>
            <p className="text-xs text-slateDark-700">
              Hỗ trợ soạn trực quan đầy đủ Ngữ pháp, Từ vựng, Đọc hiểu & Nghe hiểu
              v1.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="rounded-lg p-2 text-slateDark-700 transition hover:bg-slateDark-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="flex-1 space-y-6 overflow-y-auto p-6"
        >
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Thông tin cơ bản */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Mã bài tập (slug) *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="vd: grammar-a1-present-simple-01"
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Loại bài tập *
              </label>
              <select
                value={kind}
                onChange={(e) => handleKindChange(e.target.value as LearningKind)}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              >
                <option value="GRAMMAR">Ngữ pháp (GRAMMAR)</option>
                <option value="VOCABULARY">Từ vựng (VOCABULARY)</option>
                <option value="READING">Đọc hiểu (READING)</option>
                <option value="LISTENING">Nghe hiểu (LISTENING v1)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Tiêu đề bài tập *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Thì Hiện tại đơn trong giao tiếp hằng ngày"
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Mô tả ngắn *
              </label>
              <textarea
                rows={2}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả mục tiêu học tập của bài tập..."
                className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-slateDark-50 p-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold text-slateDark-800">
                  Thuộc chương học (Unit)
                </label>
                <button
                  type="button"
                  onClick={() => setShowQuickUnit((prev) => !prev)}
                  className="text-xs font-semibold text-brand-700 hover:underline"
                >
                  {showQuickUnit ? 'Đóng tạo nhanh' : '+ Tạo chương mới'}
                </button>
              </div>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              >
                <option value="">-- Chưa gắn chương học --</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    [{unit.cefrLevel}] Chương {unit.orderIndex}: {unit.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Thời lượng *
                </label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Thứ tự
                </label>
                <input
                  type="number"
                  min={0}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  placeholder="Tự động"
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col justify-end pb-2">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slateDark-900">
                  <input
                    type="checkbox"
                    checked={published}
                    onChange={(e) => setPublished(e.target.checked)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  <span>Xuất bản</span>
                </label>
              </div>
            </div>

            {kind === 'GRAMMAR' && leafGrammarTopics.length > 0 && (
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Liên kết Chủ điểm Ngữ pháp (Grammar DAG Leaf)
                </label>
                <select
                  value={grammarTopicId}
                  onChange={(e) => setGrammarTopicId(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                >
                  <option value="">-- Không liên kết --</option>
                  {leafGrammarTopics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      [{topic.cefrLevel}] {topic.titleVi} ({topic.code})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {showQuickUnit && (
            <div className="space-y-3 rounded-2xl border border-brand-200 bg-brand-25 p-4">
              <p className="text-xs font-bold text-brand-800">
                Tạo nhanh Chương học (Learning Unit)
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value)}
                  placeholder="Mã chương (vd: a1-unit-5)"
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <select
                  value={unitLevel}
                  onChange={(e) => setUnitLevel(e.target.value as CefrLevel)}
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                >
                  {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const).map((lvl) => (
                    <option key={lvl} value={lvl}>
                      Bậc {lvl}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={unitOrder}
                  onChange={(e) => setUnitOrder(Number(e.target.value))}
                  placeholder="Thứ tự"
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={unitTitle}
                  onChange={(e) => setUnitTitle(e.target.value)}
                  placeholder="Tên chương học"
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={unitDescription}
                  onChange={(e) => setUnitDescription(e.target.value)}
                  placeholder="Mô tả chương học"
                  className="rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={creatingUnit}
                  onClick={() => void handleQuickCreateUnit()}
                  className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {creatingUnit ? 'Đang tạo...' : 'Lưu chương mới'}
                </button>
              </div>
            </div>
          )}

          {/* Chuyển đổi chế độ soạn thảo */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slateDark-100 pt-4">
            <div className="inline-flex rounded-xl bg-slateDark-50 p-1">
              <button
                type="button"
                onClick={() => {
                  if (mode === 'json') {
                    const parsed = parseLessonJsonDraft(rawJson);
                    if (!parsed.content || parsed.error) {
                      setErrorMessage(parsed.error);
                      return;
                    }
                    syncFromParsedContent(parsed.content);
                  }
                  setErrorMessage(null);
                  setMode('form');
                }}
                className={
                  mode === 'form'
                    ? 'rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-slateDark-900 shadow-sm'
                    : 'rounded-lg px-3.5 py-1.5 text-xs font-medium text-slateDark-700'
                }
              >
                Biểu mẫu trực quan
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mode !== 'json') {
                    setRawJson(
                      JSON.stringify(buildCurrentDraftPayload(), null, 2),
                    );
                  }
                  setMode('json');
                }}
                className={
                  mode === 'json'
                    ? 'rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-slateDark-900 shadow-sm'
                    : 'rounded-lg px-3.5 py-1.5 text-xs font-medium text-slateDark-700'
                }
              >
                Soạn JSON nâng cao
              </button>
              <button
                type="button"
                onClick={() => {
                  if (mode === 'json') {
                    const parsed = parseLessonJsonDraft(rawJson);
                    if (!parsed.content || parsed.error) {
                      setErrorMessage(parsed.error);
                      return;
                    }
                    syncFromParsedContent(parsed.content);
                  }
                  setErrorMessage(null);
                  setMode('preview');
                }}
                className={
                  mode === 'preview'
                    ? 'inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-1.5 text-xs font-semibold text-slateDark-900 shadow-sm'
                    : 'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-medium text-slateDark-700'
                }
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Xem trước</span>
              </button>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50">
              <Upload className="h-3.5 w-3.5" />
              <span>Nạp từ tệp .json</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => void handleFileUpload(e)}
                className="hidden"
              />
            </label>
          </div>

          {mode === 'json' ? (
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Nội dung JSON bài học (steps, questions, passage / listening v1)
              </label>
              <textarea
                rows={14}
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                spellCheck={false}
                className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-slateDark-50 p-4 font-mono text-xs text-slateDark-900 focus:border-brand-500 focus:outline-none"
              />
            </div>
          ) : mode === 'preview' && previewPayload ? (
            <LessonPreviewPane state={state} />
          ) : (
            <div className="space-y-6">
              {/* Ảnh bìa bài học */}
              <MediaUploadField
                kind="image"
                slug={code || 'lesson-cover'}
                label="Ảnh bìa bài học (coverImageUrl — tuỳ chọn)"
                value={coverImageUrl}
                onChange={(url) => setCoverImageUrl(url)}
                placeholder="/media/learning/v1/images/... hoặc https://..."
              />

              {/* Form chuyên biệt cho LISTENING v1 */}
              {kind === 'LISTENING' && (
                <ListeningLessonForm
                  lessonCode={code}
                  audioUrl={audioUrl}
                  audioDurationMs={audioDurationMs}
                  preparation={preparation}
                  keyVocabulary={state.keyVocabulary}
                  transcriptSegments={transcriptSegments}
                  onAudioChange={(url, durationMs) => {
                    setAudioUrl(url);
                    if (durationMs) setAudioDurationMs(durationMs);
                  }}
                  onDurationChange={setAudioDurationMs}
                  onPreparationChange={setPreparation}
                  onKeyVocabularyChange={state.setKeyVocabulary}
                  onSegmentsChange={handleSegmentsChange}
                />
              )}

              {kind === 'READING' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                    Đoạn văn đọc hiểu (Passage) *
                  </label>
                  <textarea
                    rows={5}
                    value={passage}
                    onChange={(e) => setPassage(e.target.value)}
                    placeholder="Nhập đoạn văn tiếng Anh cho bài đọc hiểu..."
                    className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-slateDark-50 p-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              )}

              <LessonKeyVocabAndStepsEditor state={state} />
              <LessonQuestionsEditor state={state} />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slateDark-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slateDark-200 bg-white px-5 py-2.5 text-sm font-semibold text-slateDark-900 hover:bg-slateDark-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              {submitting
                ? 'Đang lưu...'
                : isEditing
                  ? 'Lưu thay đổi'
                  : isCloning
                    ? 'Tạo bản sao'
                    : 'Tạo bài tập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
