'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileUp } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminToast, type AdminToastApi } from '@/components/admin/AdminToast';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import {
  applyAdminImport,
  downloadAdminExport,
  validateAdminImport,
} from '@/lib/admin-api';
import {
  renderImportExportSection,
  renderImportPreviewAndApply,
} from './ImportPreviewSection';
import {
  SAMPLE_BUNDLE_ALL,
  SAMPLE_ITEMS_ONLY,
  SAMPLE_TOPICS_ONLY,
  STEP_LABELS,
} from './import-samples';
import { useImportAdminState } from './useImportAdminState';

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

export default function AdminImportPage(): React.ReactElement {
  const state = useImportAdminState({
    useState,
    useRef,
    applyAdminImport,
    downloadAdminExport,
    validateAdminImport,
  });

  const {
    toastRef,
    step,
    selectedFileName,
    rawJson,
    setRawJson,
    topicWordsMode,
    setTopicWordsMode,
    validating,
    applying,
    syntaxError,
    validationResult,
    resetProgress,
    handleLoadSample,
    handleFileChange,
    handleValidate,
  } = state;

  return (
    <AdminShell
      breadcrumbTitle="Import & Export"
      title="Content Import & Backup Export"
      subtitle="Nạp dữ liệu JSON nguyên tử (Units, Lessons, Items, Topics, Speaking, Grammar, Groups) và sao lưu JSON/CSV an toàn."
    >
      {() => (
        <div className="space-y-6">
          <AdminToastBridge toastRef={toastRef} />

          {/* Thanh 4 bước */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STEP_LABELS.map((item) => {
              const isCurrent = step === item.step;
              const isCompleted = step > item.step;
              return (
                <div
                  key={item.step}
                  className={
                    isCurrent
                      ? 'flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-25 px-4 py-3.5 shadow-sm'
                      : isCompleted
                        ? 'flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3.5'
                        : 'flex items-center gap-3 rounded-2xl border border-slateDark-100 bg-white px-4 py-3.5 opacity-75'
                  }
                >
                  <span
                    className={
                      isCurrent || isCompleted
                        ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white'
                        : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slateDark-100 text-xs font-bold text-slateDark-700'
                    }
                  >
                    {item.step}
                  </span>
                  <span
                    className={
                      isCurrent || isCompleted
                        ? 'text-sm font-bold text-slateDark-900'
                        : 'text-sm font-medium text-slateDark-700'
                    }
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Khối nhập JSON */}
          <div className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slateDark-900">
                  Content bundle JSON
                </h2>
                <p className="mt-0.5 text-xs text-slateDark-700">
                  Mọi thay đổi nội dung đều yêu cầu Validate lại trước khi nạp
                  vào cơ sở dữ liệu.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleLoadSample(SAMPLE_BUNDLE_ALL)}
                  disabled={applying}
                  className="rounded-xl border border-brand-200 bg-brand-25 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50"
                >
                  Mẫu Bundle tổng hợp
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample(SAMPLE_ITEMS_ONLY)}
                  disabled={applying}
                  className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50"
                >
                  Mẫu Items
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample(SAMPLE_TOPICS_ONLY)}
                  disabled={applying}
                  className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50"
                >
                  Mẫu Từ vựng chủ đề
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slateDark-300 bg-slateDark-25 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slateDark-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slateDark-900 shadow-sm hover:bg-slateDark-50">
                  <FileUp className="h-3.5 w-3.5 text-brand-700" />
                  <span>Chọn tệp</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    disabled={applying}
                    onChange={(e) => void handleFileChange(e)}
                    className="hidden"
                  />
                </label>
                <span className="text-xs font-medium text-slateDark-800">
                  {selectedFileName
                    ? `Đã nạp tệp: ${selectedFileName}`
                    : 'Không có tệp nào được chọn'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slateDark-800">
                  Chế độ từ vựng chủ đề:
                </span>
                <select
                  value={topicWordsMode}
                  disabled={applying}
                  onChange={(e) => {
                    if (applying) return;
                    setTopicWordsMode(e.target.value as 'merge' | 'replace');
                    resetProgress();
                  }}
                  className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-xs font-semibold text-slateDark-900 disabled:opacity-50"
                >
                  <option value="merge">
                    Merge (chỉ thêm từ mới, giữ từ cũ)
                  </option>
                  <option value="replace">
                    Replace (thay thế toàn bộ từ của chủ đề)
                  </option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <textarea
                rows={16}
                value={rawJson}
                disabled={applying}
                onChange={(e) => {
                  setRawJson(e.target.value);
                  resetProgress();
                }}
                spellCheck={false}
                aria-label="Nội dung JSON import"
                className="w-full rounded-lg border-[1.5px] border-slateDark-800 bg-[#141A23] p-4 font-mono text-xs leading-relaxed text-emerald-100 focus:border-brand-500 focus:outline-none"
              />
            </div>

            {syntaxError && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{syntaxError}</span>
              </div>
            )}

            {validationResult && !validationResult.isValid && (
              <div className="mt-4 space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                <p className="font-bold">
                  Phát hiện {validationResult.errors.length} lỗi cần chỉnh sửa:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {validationResult.errors.map((err, idx) => (
                    <li key={`${err.path}-${idx}`}>
                      <code className="font-semibold">{err.path}</code>:{' '}
                      {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slateDark-700">
                Hỗ trợ{' '}
                <code>
                  {
                    '{ units, lessons, items, topics, speakingPrompts, grammarTopics, assessmentGroups }'
                  }
                </code>
                .
              </p>

              <button
                type="button"
                disabled={applying || validating || !rawJson.trim()}
                onClick={() => void handleValidate()}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {validating
                    ? 'Đang kiểm tra...'
                    : '1. Kiểm tra gói JSON (Validate)'}
                </span>
              </button>
            </div>
          </div>

          {renderImportPreviewAndApply(state, LegacyStatCard)}
          {renderImportExportSection(state)}
        </div>
      )}
    </AdminShell>
  );
}
