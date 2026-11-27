'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Download,
  Layers,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import {
  createLearningUnit,
  deleteLearningUnit,
  downloadAdminExport,
  listLearningUnits,
  updateLearningUnit,
} from '@/lib/admin-api';
import type { CefrLevel, LearningUnitItem } from '@/types/admin';

const CEFR_LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function AdminUnitsPage(): React.ReactElement {
  const [units, setUnits] = useState<LearningUnitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cefrFilter, setCefrFilter] = useState<CefrLevel | ''>('');
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Create / Edit modal state
  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<LearningUnitItem | null>(null);
  const [code, setCode] = useState('');
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>('A1');
  const [orderIndex, setOrderIndex] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<LearningUnitItem | null>(null);
  const [detachLessons, setDetachLessons] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadUnits = useCallback(async () => {
    setLoading(true);
    setBannerError(null);
    try {
      const rows = await listLearningUnits();
      setUnits(rows);
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Không thể tải danh sách chương học.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  const filteredUnits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return units.filter((u) => {
      if (cefrFilter && u.cefrLevel !== cefrFilter) return false;
      if (!q) return true;
      return (
        u.code.toLowerCase().includes(q) ||
        u.title.toLowerCase().includes(q) ||
        u.description.toLowerCase().includes(q)
      );
    });
  }, [units, search, cefrFilter]);

  const totalLessonsLinked = useMemo(
    () => units.reduce((sum, u) => sum + u.lessonsCount, 0),
    [units],
  );
  const coveredCefrCount = useMemo(
    () => new Set(units.map((u) => u.cefrLevel)).size,
    [units],
  );

  const openCreateModal = (): void => {
    setEditingUnit(null);
    setCode('');
    setCefrLevel('A1');
    const a1Units = units.filter((u) => u.cefrLevel === 'A1');
    const maxOrder = a1Units.reduce((m, u) => Math.max(m, u.orderIndex), 0);
    setOrderIndex(maxOrder + 1);
    setTitle('');
    setDescription('');
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (unit: LearningUnitItem): void => {
    setEditingUnit(unit);
    setCode(unit.code);
    setCefrLevel(unit.cefrLevel);
    setOrderIndex(unit.orderIndex);
    setTitle(unit.title);
    setDescription(unit.description);
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    const cleanCode = code.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(cleanCode)) {
      setFormError('Mã chương chỉ gồm chữ thường, số và dấu gạch ngang.');
      return;
    }
    if (!title.trim() || !description.trim()) {
      setFormError('Vui lòng nhập đầy đủ tên và mô tả chương học.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code: cleanCode,
        cefrLevel,
        orderIndex,
        title: title.trim(),
        description: description.trim(),
      };
      if (editingUnit) {
        await updateLearningUnit(editingUnit.id, payload);
        setBannerSuccess(`Đã cập nhật chương học "${title.trim()}".`);
      } else {
        await createLearningUnit(payload);
        setBannerSuccess(`Đã tạo chương học "${title.trim()}".`);
      }
      setShowModal(false);
      await loadUnits();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Không thể lưu chương học.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!deleteTarget) return;
    setDeleting(true);
    setBannerError(null);
    try {
      const res = await deleteLearningUnit(deleteTarget.id, detachLessons);
      setBannerSuccess(
        res.detachedLessonsCount > 0
          ? `Đã xoá chương "${deleteTarget.title}" và gỡ liên kết ${res.detachedLessonsCount} bài học.`
          : `Đã xoá chương học "${deleteTarget.title}".`,
      );
      setDeleteTarget(null);
      setDetachLessons(false);
      await loadUnits();
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Không thể xoá chương học.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv'): Promise<void> => {
    try {
      await downloadAdminExport('units', format);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Xuất dữ liệu thất bại.');
    }
  };

  return (
    <AdminShell
      breadcrumbTitle="Chương học"
      title="Learning Units"
      subtitle="Quản lý cấu trúc chương học lộ trình theo 6 bậc CEFR (A1 – C2) và thứ tự bài học."
      actions={
        <>
          <button
            type="button"
            onClick={() => void handleExport('csv')}
            className="inline-flex items-center gap-2 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => void handleExport('json')}
            className="inline-flex items-center gap-2 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo chương học</span>
          </button>
        </>
      }
    >
      {() => (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <LegacyStatCard
              label="Tổng chương học"
              value={units.length}
              subtitle="Đang vận hành trong lộ trình"
              icon={<Layers className="h-4 w-4" />}
              tone="green"
            />
            <LegacyStatCard
              label="Bài học đã gắn"
              value={totalLessonsLinked}
              subtitle="Thuộc các chương CEFR"
              icon={<BookOpen className="h-4 w-4" />}
              tone="emerald"
            />
            <LegacyStatCard
              label="Bậc CEFR phủ"
              value={`${coveredCefrCount} / 6`}
              subtitle="A1, A2, B1, B2, C1, C2"
              icon={<Layers className="h-4 w-4" />}
              tone="amber"
            />
          </div>

          {bannerError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700">
              {bannerError}
            </div>
          )}
          {bannerSuccess && (
            <div className="rounded-2xl border border-brand-200 bg-brand-25 px-5 py-3.5 text-sm font-medium text-brand-800">
              {bannerSuccess}
            </div>
          )}

          {/* Bộ lọc */}
          <div className="rounded-2xl border border-slateDark-100 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-12">
              <div className="sm:col-span-6">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Tìm chương học
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Mã chương, tiêu đề hoặc mô tả..."
                    className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="mb-1.5 block text-xs font-semibold text-slateDark-800">
                  Bậc CEFR
                </label>
                <select
                  value={cefrFilter}
                  onChange={(e) => setCefrFilter(e.target.value as CefrLevel | '')}
                  className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-white px-3.5 py-2.5 text-sm text-slateDark-900 focus:border-brand-500 focus:outline-none"
                >
                  <option value="">Tất cả bậc CEFR</option>
                  {CEFR_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      Bậc {lvl}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end sm:col-span-3">
                <span className="text-xs font-medium text-slateDark-700">
                  Hiển thị {filteredUnits.length} / {units.length} chương
                </span>
              </div>
            </div>
          </div>

          {/* Bảng danh sách */}
          <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase tracking-wider text-slateDark-700">
                  <tr>
                    <th className="px-6 py-3.5">Bậc & Thứ tự</th>
                    <th className="px-4 py-3.5">Mã chương</th>
                    <th className="px-4 py-3.5">Tên chương & Mô tả</th>
                    <th className="px-4 py-3.5">Số bài học</th>
                    <th className="px-6 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slateDark-100">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-sm text-slateDark-700"
                      >
                        Đang tải danh sách chương học...
                      </td>
                    </tr>
                  ) : filteredUnits.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-sm text-slateDark-700"
                      >
                        Không tìm thấy chương học nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredUnits.map((unit) => (
                      <tr key={unit.id} className="hover:bg-slateDark-25">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-6 items-center justify-center rounded-full bg-brand-50 px-2.5 text-xs font-bold text-brand-800">
                              {unit.cefrLevel}
                            </span>
                            <span className="text-xs font-semibold text-slateDark-700">
                              Chương {unit.orderIndex}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs font-medium text-brand-700">
                          {unit.code}
                        </td>
                        <td className="max-w-md px-4 py-4">
                          <p className="font-semibold text-slateDark-900">
                            {unit.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slateDark-700">
                            {unit.description}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <span className="rounded-full bg-slateDark-50 px-2.5 py-1 text-xs font-semibold text-slateDark-800">
                            {unit.lessonsCount} bài học
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(unit)}
                              className="rounded-lg border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDetachLessons(false);
                                setDeleteTarget(unit);
                              }}
                              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
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
          </div>

          {/* Modal Tạo / Sửa */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
              <div className="w-full max-w-lg rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slateDark-900">
                    {editingUnit ? 'Cập nhật chương học' : 'Tạo chương học mới'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
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
                      onClick={() => setShowModal(false)}
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
          )}

          {/* Modal Xác nhận Xóa */}
          {deleteTarget && (
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
                      <strong>{deleteTarget.lessonsCount} bài học</strong>. Tích
                      chọn để tự động gỡ liên kết các bài học đó (bài học vẫn được
                      giữ nguyên) rồi xóa chương.
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
                    onClick={() => setDeleteTarget(null)}
                    className="rounded-xl border border-slateDark-200 px-4 py-2 text-sm font-semibold text-slateDark-900"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={
                      deleting || (deleteTarget.lessonsCount > 0 && !detachLessons)
                    }
                    onClick={() => void handleConfirmDelete()}
                    className="rounded-xl bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                  >
                    {deleting ? 'Đang xóa...' : 'Xóa chương'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
