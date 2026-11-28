import React from 'react';
import { X } from 'lucide-react';
import type { CefrLevel, LearningUnitItem } from '@/types/admin';

const CEFR_LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

interface UnitFormModalProps {
  open: boolean;
  editingUnit: LearningUnitItem | null;
  code: string;
  setCode: (v: string) => void;
  cefrLevel: CefrLevel;
  setCefrLevel: (v: CefrLevel) => void;
  orderIndex: number;
  setOrderIndex: (v: number) => void;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  saving: boolean;
  formError: string | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => Promise<void>;
}

export function UnitFormModal({
  open,
  editingUnit,
  code,
  setCode,
  cefrLevel,
  setCefrLevel,
  orderIndex,
  setOrderIndex,
  title,
  setTitle,
  description,
  setDescription,
  saving,
  formError,
  onClose,
  onSubmit,
}: UnitFormModalProps): React.ReactElement | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slateDark-900">
            {editingUnit ? 'Cập nhật chương học' : 'Tạo chương học mới'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                Mã chương (slug) *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="a1-unit-1"
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                Bậc CEFR *
              </label>
              <select
                value={cefrLevel}
                onChange={(e) => setCefrLevel(e.target.value as CefrLevel)}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              >
                {CEFR_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slateDark-800">
                Thứ tự *
              </label>
              <input
                type="number"
                min={1}
                required
                value={orderIndex}
                onChange={(e) => setOrderIndex(Number(e.target.value))}
                className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              Tên chương học *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Chào hỏi và giới thiệu bản thân"
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slateDark-800">
              Mô tả ngắn *
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mục tiêu và nội dung chính của chương học..."
              className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 p-3.5 text-sm focus:border-brand-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold text-slateDark-900 hover:bg-slateDark-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary rounded-xl px-5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {saving
                ? 'Đang lưu...'
                : editingUnit
                  ? 'Lưu thay đổi'
                  : 'Tạo chương'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface UnitDeleteModalProps {
  deleteTarget: LearningUnitItem | null;
  detachLessons: boolean;
  setDetachLessons: (v: boolean) => void;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function UnitDeleteModal({
  deleteTarget,
  detachLessons,
  setDetachLessons,
  deleting,
  onClose,
  onConfirm,
}: UnitDeleteModalProps): React.ReactElement | null {
  if (!deleteTarget) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-bold text-slateDark-900">
          Xác nhận xóa chương học
        </h2>
        <p className="text-sm text-slateDark-800">
          Chương:{' '}
          <strong className="text-slateDark-900">
            [{deleteTarget.cefrLevel}] {deleteTarget.title}
          </strong>
        </p>

        {deleteTarget.lessonsCount > 0 ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
            <input
              type="checkbox"
              checked={detachLessons}
              onChange={(e) => setDetachLessons(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-amber-600"
            />
            <span>
              Chương này đang có{' '}
              <strong>{deleteTarget.lessonsCount} bài học</strong>. Tích chọn để
              tự động gỡ liên kết các bài học đó (bài học vẫn được giữ nguyên)
              rồi xóa chương.
            </span>
          </label>
        ) : (
          <p className="text-xs text-slateDark-700">
            Chương này chưa có bài học nào và sẽ được xóa vĩnh viễn.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold text-slateDark-900"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={
              deleting || (deleteTarget.lessonsCount > 0 && !detachLessons)
            }
            onClick={() => void onConfirm()}
            className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
          >
            {deleting ? 'Đang xóa...' : 'Xóa chương'}
          </button>
        </div>
      </div>
    </div>
  );
}
