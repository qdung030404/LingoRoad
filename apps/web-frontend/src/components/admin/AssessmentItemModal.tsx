'use client';

import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  createAdminAssessmentItem,
  updateAdminAssessmentItem,
} from '@/lib/admin-api';
import type {
  AssessmentSkill,
  CefrLevel,
  ItemType,
  ItemUsageScope,
} from '@/types/admin';
import { MediaUploadField } from './MediaUploadField';
import { renderAnswerAndRubricEditors } from './assessment-item/AssessmentItemAnswerEditors';
import {
  LEVELS,
  type AssessmentItemModalProps,
} from './assessment-item/assessment-item.helpers';
import { useAssessmentItemState } from './assessment-item/useAssessmentItemState';

export function AssessmentItemModal(
  props: AssessmentItemModalProps,
): React.ReactElement {
  const { groups = [], onClose } = props;
  const state = useAssessmentItemState(props, {
    useState,
    useMemo,
    createAdminAssessmentItem,
    updateAdminAssessmentItem,
  });

  const {
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
    explanation,
    setExplanation,
    submitting,
    errorMessage,
    syncDescriptorDefaults,
    handleSubmit,
  } = state;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slateDark-900">
              {isEditing
                ? 'Chỉnh sửa câu hỏi Item Bank'
                : isCloning
                  ? 'Nhân bản câu hỏi Item Bank'
                  : 'Tạo item mới trong Item Bank'}
            </h2>
            <p className="text-xs text-slateDark-700">
              {isCloning
                ? 'Đang tạo bản sao mới từ câu hỏi gốc (có thể chỉnh sửa tự do kể cả khi câu gốc đã khóa chỉnh sửa).'
                : 'Hệ thống tự động làm mới cache ma trận CEFR sau khi lưu.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="rounded-lg p-2 text-slateDark-700 hover:bg-slateDark-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex-1 space-y-4 overflow-y-auto p-6"
        >
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Stable External ID (tuỳ chọn)
              </label>
              <input
                type="text"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="vd: placement-reading-b1-05"
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 font-mono text-xs text-slateDark-900 focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Loại câu hỏi *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ItemType)}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              >
                <option value="MULTIPLE_CHOICE">MULTIPLE_CHOICE</option>
                <option value="CLOZE">CLOZE</option>
                <option value="GAP_FILL">GAP_FILL</option>
                <option value="SENTENCE_REORDER">SENTENCE_REORDER</option>
                <option value="MATCHING">MATCHING</option>
                <option value="ESSAY">ESSAY (Viết tự luận)</option>
                <option value="SPEAKING_PROMPT">SPEAKING_PROMPT</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Kỹ năng *
              </label>
              <select
                value={skill}
                onChange={(e) => {
                  const nextSkill = e.target.value as AssessmentSkill;
                  setSkill(nextSkill);
                  syncDescriptorDefaults(nextSkill, cefrLevel);
                }}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              >
                <option value="READING">READING</option>
                <option value="LISTENING">LISTENING</option>
                <option value="WRITING">WRITING</option>
                <option value="SPEAKING">SPEAKING</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Bậc CEFR *
              </label>
              <select
                value={cefrLevel}
                onChange={(e) => {
                  const nextLevel = e.target.value as CefrLevel;
                  setCefrLevel(nextLevel);
                  syncDescriptorDefaults(skill, nextLevel);
                }}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              >
                {LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Mã Can-Do Descriptor *
              </label>
              {matchingDescriptors.length > 0 &&
              matchingDescriptors.some((d) => d.skillCode === skillCode) ? (
                <select
                  value={skillCode}
                  onChange={(e) => {
                    const selectedCode = e.target.value;
                    setSkillCode(selectedCode);
                    const matched = matchingDescriptors.find(
                      (d) => d.skillCode === selectedCode,
                    );
                    if (matched) setIrtB(matched.defaultIrtB);
                  }}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                >
                  {matchingDescriptors.map((d) => (
                    <option
                      key={`${d.skillCode}-${d.cefrLevel}`}
                      value={d.skillCode}
                    >
                      {d.skillCode} — {d.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  required
                  value={skillCode}
                  onChange={(e) => setSkillCode(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-4 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                />
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                Phạm vi sử dụng
              </label>
              <select
                value={usageScope}
                onChange={(e) =>
                  setUsageScope(e.target.value as ItemUsageScope)
                }
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
              >
                <option value="ALL">ALL</option>
                <option value="PLACEMENT">PLACEMENT</option>
                <option value="PRACTICE">PRACTICE</option>
                <option value="MOCK_EXAM">MOCK_EXAM</option>
              </select>
            </div>
          </div>

          {/* Tham số IRT 3PL & Nhóm đề */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                IRT a (phân biệt)
              </label>
              <input
                type="number"
                step="0.1"
                min={0.1}
                max={5}
                value={irtA}
                onChange={(e) => setIrtA(Number(e.target.value))}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                IRT b (độ khó)
              </label>
              <input
                type="number"
                step="0.1"
                value={irtB}
                onChange={(e) => setIrtB(Number(e.target.value))}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                IRT c (đoán mò)
              </label>
              <input
                type="number"
                step="0.05"
                min={0}
                max={0.5}
                value={irtC}
                onChange={(e) => setIrtC(Number(e.target.value))}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm"
              />
            </div>
            {groups.length > 0 && (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                  Thuộc nhóm đề (Group)
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-2.5 py-2 text-xs"
                  >
                    <option value="">-- Độc lập --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        [{g.skill} {g.cefrLevel} P{g.partNumber}]{' '}
                        {g.title ?? g.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                  {groupId && (
                    <input
                      type="number"
                      min={1}
                      value={itemOrder}
                      onChange={(e) => setItemOrder(Number(e.target.value))}
                      title="Thứ tự trong nhóm"
                      className="w-16 rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-2 py-2 text-xs"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {skill === 'LISTENING' && (
            <MediaUploadField
              kind="audio"
              audioScope="placement"
              slug={externalId || 'placement-audio'}
              label={`Âm thanh nghe hiểu WAV ${usageScope === 'PLACEMENT' ? '*' : '(tuỳ chọn)'}`}
              value={audioUrl}
              onChange={(url) => setAudioUrl(url)}
              placeholder="/media/placement/..."
            />
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
              Đoạn văn đính kèm (tuỳ chọn)
            </label>
            <textarea
              rows={3}
              value={passage}
              onChange={(e) => setPassage(e.target.value)}
              placeholder="Nhập đoạn văn đọc hiểu nếu câu hỏi đi kèm ngữ cảnh..."
              className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-slateDark-50 p-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
              Đề bài / Câu hỏi *
            </label>
            <textarea
              rows={2}
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Nhập nội dung câu hỏi..."
              className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-slateDark-50 p-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
            />
          </div>

          {renderAnswerAndRubricEditors(state)}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
              Giải thích đáp án (tiếng Việt)
            </label>
            <textarea
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Giải thích lý do đáp án đúng..."
              className="w-full rounded-lg border-[1.5px] border-slateDark-200 bg-slateDark-50 p-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
            />
          </div>

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
                    : 'Thêm câu hỏi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
