import React from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Download,
  Layers,
  RefreshCw,
  ShieldCheck,
  Tags,
} from 'lucide-react';
import type { LegacyStatCard as LegacyStatCardType } from '@/components/admin/LegacyStatCard';
import { ENTITY_LABELS, EXPORT_ENTITIES } from './import-samples';
import type { ImportAdminState } from './useImportAdminState';

export function renderImportPreviewAndApply(
  state: ImportAdminState,
  LegacyStatCardComponent: typeof LegacyStatCardType,
): React.ReactNode {
  const {
    step,
    setStep,
    validationResult,
    applying,
    confirmedAtomic,
    setConfirmedAtomic,
    applyError,
    applyResult,
    resetProgress,
    handleApply,
  } = state;

  return (
    <>
      {validationResult?.isValid && step >= 2 && step < 4 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LegacyStatCardComponent
              label="Chương học (Units)"
              value={
                validationResult.preview.counts.units.create +
                validationResult.preview.counts.units.update
              }
              subtitle={`${validationResult.preview.counts.units.create} tạo mới · ${validationResult.preview.counts.units.update} cập nhật`}
              icon={<Layers className="h-4 w-4" />}
              tone="green"
            />
            <LegacyStatCardComponent
              label="Bài học (Lessons)"
              value={
                validationResult.preview.counts.lessons.create +
                validationResult.preview.counts.lessons.update
              }
              subtitle={`${validationResult.preview.counts.lessons.create} tạo mới · ${validationResult.preview.counts.lessons.update} cập nhật`}
              icon={<BookOpen className="h-4 w-4" />}
              tone="emerald"
            />
            <LegacyStatCardComponent
              label="Câu hỏi (Items)"
              value={
                validationResult.preview.counts.items.create +
                validationResult.preview.counts.items.update
              }
              subtitle={`${validationResult.preview.counts.items.create} tạo mới · ${validationResult.preview.counts.items.update} cập nhật`}
              icon={<ClipboardList className="h-4 w-4" />}
              tone="amber"
            />
            <LegacyStatCardComponent
              label="Từ vựng & Mở rộng"
              value={
                validationResult.preview.counts.topics.create +
                validationResult.preview.counts.topics.update +
                (validationResult.preview.counts.speakingPrompts?.create ?? 0) +
                (validationResult.preview.counts.speakingPrompts?.update ?? 0) +
                (validationResult.preview.counts.grammarTopics?.create ?? 0) +
                (validationResult.preview.counts.grammarTopics?.update ?? 0) +
                (validationResult.preview.counts.assessmentGroups?.create ?? 0) +
                (validationResult.preview.counts.assessmentGroups?.update ?? 0)
              }
              subtitle="Topics, Speaking, Grammar, Groups"
              icon={<Tags className="h-4 w-4" />}
              tone="slate"
            />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
              <div>
                <h3 className="text-sm font-extrabold text-slateDark-900">
                  Bước 2. Xem trước thay đổi (
                  {validationResult.preview.totalRecords} bản ghi hợp lệ)
                </h3>
                <p className="text-xs text-slateDark-700">
                  Kiểm tra danh sách bản ghi sẽ được tạo mới hoặc cập nhật trước
                  khi xác nhận.
                </p>
              </div>
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  Tiếp tục bước Xác nhận
                </button>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase tracking-wider text-slateDark-700">
                  <tr>
                    <th className="px-6 py-3">Loại dữ liệu</th>
                    <th className="px-4 py-3">Mã định danh</th>
                    <th className="px-4 py-3">Tên / Nội dung</th>
                    <th className="px-6 py-3 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slateDark-100">
                  {validationResult.preview.records.map((rec, idx) => (
                    <tr key={`${rec.entity}-${rec.identifier}-${idx}`}>
                      <td className="px-6 py-3 font-semibold text-slateDark-900">
                        {ENTITY_LABELS[rec.entity]}
                      </td>
                      <td className="px-4 py-3 font-mono text-brand-700">
                        {rec.identifier}
                      </td>
                      <td className="px-4 py-3 text-slateDark-800">
                        {rec.title}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <span
                          className={
                            rec.operation === 'CREATE'
                              ? 'rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700'
                              : 'rounded-full bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800'
                          }
                        >
                          {rec.operation === 'CREATE' ? 'Tạo mới' : 'Cập nhật'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {step === 3 && (
            <div className="space-y-4 rounded-2xl border border-brand-200 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                <div>
                  <h3 className="text-sm font-extrabold text-slateDark-900">
                    Bước 3. Xác nhận nạp dữ liệu nguyên tử (Atomic Apply)
                  </h3>
                  <p className="mt-1 text-xs text-slateDark-800">
                    Toàn bộ {validationResult.preview.totalRecords} bản ghi sẽ
                    được ghi trong một Prisma Transaction duy nhất.
                  </p>
                </div>
              </div>

              {applyError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                  {applyError}
                </div>
              )}

              <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slateDark-900">
                <input
                  type="checkbox"
                  checked={confirmedAtomic}
                  onChange={(e) => setConfirmedAtomic(e.target.checked)}
                  className="h-4 w-4 accent-brand-600"
                />
                <span>
                  Tôi đã kiểm tra danh sách xem trước và xác nhận nạp dữ liệu
                  vào hệ thống.
                </span>
              </label>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-xl border border-slateDark-200 px-4 py-2 text-xs font-semibold text-slateDark-900"
                >
                  Quay lại Preview
                </button>
                <button
                  type="button"
                  disabled={!confirmedAtomic || applying}
                  onClick={() => void handleApply()}
                  className="btn-primary rounded-xl px-5 py-2.5 text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  {applying
                    ? 'Đang ghi dữ liệu...'
                    : '4. Áp dụng vào hệ thống (Apply)'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {step === 4 && applyResult && (
        <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />
            <div>
              <h3 className="text-base font-extrabold text-emerald-950">
                Import thành công {applyResult.preview.totalRecords} bản ghi!
              </h3>
              <p className="mt-1 text-xs text-emerald-900">
                Dữ liệu đã được lưu an toàn vào PostgreSQL và tự động đồng bộ
                cache cho ứng dụng di động.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <Link
              href="/admin/lessons"
              className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Xem danh sách Bài học</span>
            </Link>
            <Link
              href="/admin/items"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span>Xem Item Bank</span>
            </Link>
            <button
              type="button"
              onClick={resetProgress}
              className="inline-flex items-center gap-2 rounded-xl border border-slateDark-200 bg-white px-4 py-2 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Import gói khác</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export function renderImportExportSection(
  state: ImportAdminState,
): React.ReactElement {
  const { exportingKey, handleExport } = state;

  return (
    <div className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
      <h2 className="text-base font-extrabold text-slateDark-900">
        Xuất dữ liệu & Sao lưu (Export JSON / CSV)
      </h2>
      <p className="mt-0.5 text-xs text-slateDark-700">
        JSON giữ nguyên định dạng tương thích Import; CSV có UTF-8 BOM và tự
        động chống OWASP CSV/Formula Injection.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {EXPORT_ENTITIES.map(({ entity, label }) => (
          <div
            key={entity}
            className="flex flex-col justify-between gap-3 rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5"
          >
            <p className="text-xs font-bold text-slateDark-900">{label}</p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={exportingKey === `${entity}-json`}
                onClick={() => void handleExport(entity, 'json')}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                <span>JSON</span>
              </button>
              <button
                type="button"
                disabled={exportingKey === `${entity}-csv`}
                onClick={() => void handleExport(entity, 'csv')}
                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1.5 text-[11px] font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
