'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  GitBranch,
  Link2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { GrammarTopicModal } from '@/components/admin/GrammarTopicModal';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import {
  addAdminGrammarPrerequisite,
  deleteAdminGrammarTopic,
  downloadAdminExport,
  listAdminGrammarTopics,
  removeAdminGrammarPrerequisite,
  updateAdminGrammarTopic,
} from '@/lib/admin-api';
import type { AdminGrammarTopic, CefrLevel } from '@/types/admin';

const LEVELS: readonly CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function AdminGrammarPage(): React.ReactElement {
  const [topics, setTopics] = useState<AdminGrammarTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cefrFilter, setCefrFilter] = useState<CefrLevel | ''>('');
  const [leafFilter, setLeafFilter] = useState<'' | 'true' | 'false'>('');
  const [publishedFilter, setPublishedFilter] = useState<'' | 'true' | 'false'>('');
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<AdminGrammarTopic | null>(null);

  // Prerequisite DAG modal
  const [prereqTarget, setPrereqTarget] = useState<AdminGrammarTopic | null>(null);
  const [selectedPrereqId, setSelectedPrereqId] = useState('');
  const [prereqError, setPrereqError] = useState<string | null>(null);
  const [prereqSaving, setPrereqSaving] = useState(false);

  const loadTopics = useCallback(async () => {
    setLoading(true);
    setBannerError(null);
    try {
      const rows = await listAdminGrammarTopics({
        cefrLevel: cefrFilter,
        search,
        published: publishedFilter,
        isLeaf: leafFilter,
      });
      setTopics(rows);
    } catch (err) {
      setBannerError(
        err instanceof Error ? err.message : 'Không thể tải đồ thị ngữ pháp.',
      );
    } finally {
      setLoading(false);
    }
  }, [cefrFilter, search, publishedFilter, leafFilter]);

  useEffect(() => {
    void loadTopics();
  }, [loadTopics]);

  const leafTopics = useMemo(() => topics.filter((t) => t.isLeaf), [topics]);
  const groupCount = topics.length - leafTopics.length;
  const edgeCount = useMemo(
    () => topics.reduce((sum, t) => sum + t.prerequisiteIds.length, 0),
    [topics],
  );

  const handleTogglePublish = async (topic: AdminGrammarTopic): Promise<void> => {
    try {
      await updateAdminGrammarTopic(topic.id, { published: !topic.published });
      setBannerSuccess(
        !topic.published
          ? `Đã xuất bản "${topic.titleVi}".`
          : `Đã ẩn "${topic.titleVi}" (Bản nháp).`,
      );
      await loadTopics();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Cập nhật thất bại.');
    }
  };

  const handleDelete = async (topic: AdminGrammarTopic): Promise<void> => {
    if (
      !window.confirm(
        `Xoá chủ điểm ngữ pháp "${topic.titleVi}" (${topic.code})?`,
      )
    ) {
      return;
    }
    try {
      await deleteAdminGrammarTopic(topic.id);
      setBannerSuccess(`Đã xoá chủ điểm "${topic.titleVi}".`);
      await loadTopics();
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Xoá chủ điểm thất bại.');
    }
  };

  const handleAddPrerequisite = async (): Promise<void> => {
    if (!prereqTarget || !selectedPrereqId) return;
    setPrereqError(null);
    setPrereqSaving(true);
    try {
      await addAdminGrammarPrerequisite(selectedPrereqId, prereqTarget.id);
      setSelectedPrereqId('');
      const refreshed = await listAdminGrammarTopics();
      setTopics(refreshed);
      const updatedTarget = refreshed.find((t) => t.id === prereqTarget.id) ?? null;
      setPrereqTarget(updatedTarget);
      setBannerSuccess('Đã thêm liên kết tiên quyết (DAG) hợp lệ.');
    } catch (err) {
      setPrereqError(
        err instanceof Error ? err.message : 'Không thể thêm cạnh tiên quyết.',
      );
    } finally {
      setPrereqSaving(false);
    }
  };

  const handleRemovePrerequisite = async (prereqId: string): Promise<void> => {
    if (!prereqTarget) return;
    setPrereqError(null);
    setPrereqSaving(true);
    try {
      await removeAdminGrammarPrerequisite(prereqId, prereqTarget.id);
      const refreshed = await listAdminGrammarTopics();
      setTopics(refreshed);
      setPrereqTarget(refreshed.find((t) => t.id === prereqTarget.id) ?? null);
      setBannerSuccess('Đã gỡ liên kết tiên quyết.');
    } catch (err) {
      setPrereqError(
        err instanceof Error ? err.message : 'Không thể gỡ cạnh tiên quyết.',
      );
    } finally {
      setPrereqSaving(false);
    }
  };

  return (
    <AdminShell
      breadcrumbTitle="Ngữ pháp"
      title="Grammar Knowledge Graph (DAG)"
      subtitle="Quản lý cây chuyên đề ngữ pháp A1–C2, công thức, ví dụ và đồ thị tiên quyết không chu trình."
      actions={
        <>
          <button
            type="button"
            onClick={() => void downloadAdminExport('grammar', 'json')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>JSON</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingTopic(null);
              setShowModal(true);
            }}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo chủ điểm</span>
          </button>
        </>
      }
    >
      {() => (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <LegacyStatCard
              label="Tổng nút ngữ pháp"
              value={topics.length}
              subtitle={`${groupCount} nhóm · ${leafTopics.length} cấu trúc lá`}
              icon={<GitBranch className="h-4 w-4" />}
              tone="green"
            />
            <LegacyStatCard
              label="Cạnh tiên quyết (DAG)"
              value={edgeCount}
              subtitle="Kiểm tra chu trình tự động"
              icon={<Link2 className="h-4 w-4" />}
              tone="emerald"
            />
            <LegacyStatCard
              label="Bài học đã liên kết"
              value={topics.reduce((s, t) => s + t.lessonsCount, 0)}
              subtitle="Gắn với bài học lộ trình"
              icon={<GitBranch className="h-4 w-4" />}
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
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm sm:grid-cols-12">
            <div className="relative sm:col-span-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slateDark-600" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo mã grammar.*, tên tiếng Việt hoặc tiếng Anh..."
                className="w-full rounded-xl border border-slateDark-200 bg-white py-2 pl-9 pr-3 text-xs focus:border-brand-500 focus:outline-none"
              />
            </div>
            <select
              value={cefrFilter}
              onChange={(e) => setCefrFilter(e.target.value as CefrLevel | '')}
              className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs sm:col-span-2"
            >
              <option value="">Tất cả CEFR</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <select
              value={leafFilter}
              onChange={(e) => setLeafFilter(e.target.value as '' | 'true' | 'false')}
              className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs sm:col-span-2"
            >
              <option value="">Nhóm & Lá</option>
              <option value="false">Chỉ Nhóm (Group)</option>
              <option value="true">Chỉ Cấu trúc (Leaf)</option>
            </select>
            <select
              value={publishedFilter}
              onChange={(e) =>
                setPublishedFilter(e.target.value as '' | 'true' | 'false')
              }
              className="rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs sm:col-span-3"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="true">Published</option>
              <option value="false">Bản nháp</option>
            </select>
          </div>

          {/* Bảng */}
          <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
                  <tr>
                    <th className="px-5 py-3.5">Chủ điểm</th>
                    <th className="px-4 py-3.5">Loại & CEFR</th>
                    <th className="px-4 py-3.5">Tiên quyết (DAG)</th>
                    <th className="px-4 py-3.5">Trạng thái</th>
                    <th className="px-5 py-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slateDark-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slateDark-700">
                        Đang tải chủ điểm ngữ pháp...
                      </td>
                    </tr>
                  ) : topics.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slateDark-700">
                        Chưa có chủ điểm ngữ pháp nào khớp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    topics.map((topic) => (
                      <tr key={topic.id} className="hover:bg-slateDark-25">
                        <td className="px-5 py-3.5">
                          <div className={topic.isLeaf && topic.parentId ? 'pl-4' : ''}>
                            <p className="font-bold text-slateDark-900">
                              {topic.titleVi}{' '}
                              <span className="font-normal text-slateDark-700">
                                ({topic.titleEn})
                              </span>
                            </p>
                            <p className="mt-0.5 font-mono text-[11px] text-brand-700">
                              {topic.code}
                              {topic.parentCode ? ` · cha: ${topic.parentCode}` : ''}
                              {topic.lessonsCount > 0
                                ? ` · ${topic.lessonsCount} bài học`
                                : ''}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-bold text-amber-800">
                              {topic.cefrLevel}
                            </span>
                            <span
                              className={
                                topic.isLeaf
                                  ? 'rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-800'
                                  : 'rounded-full bg-slateDark-100 px-2 py-0.5 font-semibold text-slateDark-800'
                              }
                            >
                              {topic.isLeaf ? 'Leaf' : `Group (${topic.childrenCount})`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {topic.isLeaf ? (
                            <div className="flex flex-wrap items-center gap-1">
                              {topic.prerequisiteCodes.length === 0 ? (
                                <span className="text-slateDark-600">Không</span>
                              ) : (
                                topic.prerequisiteCodes.map((c) => (
                                  <span
                                    key={c}
                                    className="rounded bg-slateDark-50 px-1.5 py-0.5 font-mono text-[10px] text-slateDark-800"
                                  >
                                    {c.replace(/^grammar\./, '')}
                                  </span>
                                ))
                              )}
                            </div>
                          ) : (
                            <span className="text-slateDark-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => void handleTogglePublish(topic)}
                            className={
                              topic.published
                                ? 'rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700'
                                : 'rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800'
                            }
                          >
                            {topic.published ? 'Published' : 'Draft'}
                          </button>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {topic.isLeaf && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPrereqError(null);
                                  setSelectedPrereqId('');
                                  setPrereqTarget(topic);
                                }}
                                className="rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1 font-semibold text-brand-800 hover:bg-brand-50"
                              >
                                DAG ({topic.prerequisiteIds.length})
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTopic(topic);
                                setShowModal(true);
                              }}
                              className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 font-semibold text-slateDark-900 hover:bg-slateDark-50"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(topic)}
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
          </div>

          {showModal && (
            <GrammarTopicModal
              allTopics={topics}
              editingTopic={editingTopic}
              onClose={() => {
                setShowModal(false);
                setEditingTopic(null);
              }}
              onSaved={() => {
                setShowModal(false);
                setBannerSuccess(
                  editingTopic
                    ? 'Đã cập nhật chủ điểm ngữ pháp.'
                    : 'Đã tạo chủ điểm ngữ pháp mới.',
                );
                setEditingTopic(null);
                void loadTopics();
              }}
            />
          )}

          {/* Modal Quản lý Tiên quyết DAG */}
          {prereqTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateDark-900/50 p-4">
              <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slateDark-100 bg-white p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slateDark-900">
                      Quan hệ tiên quyết (DAG)
                    </h2>
                    <p className="text-xs text-slateDark-700">
                      Đích: <strong>{prereqTarget.titleVi}</strong> (
                      <code>{prereqTarget.code}</code>)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrereqTarget(null)}
                    className="rounded-lg p-1.5 text-slateDark-700 hover:bg-slateDark-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {prereqError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    {prereqError}
                  </div>
                )}

                <div className="flex gap-2">
                  <select
                    value={selectedPrereqId}
                    onChange={(e) => setSelectedPrereqId(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-slateDark-200 bg-slateDark-50 px-3 py-2 text-xs"
                  >
                    <option value="">-- Chọn cấu trúc cần học trước --</option>
                    {leafTopics
                      .filter(
                        (t) =>
                          t.id !== prereqTarget.id &&
                          !prereqTarget.prerequisiteIds.includes(t.id),
                      )
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          [{t.cefrLevel}] {t.titleVi} ({t.code})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    disabled={!selectedPrereqId || prereqSaving}
                    onClick={() => void handleAddPrerequisite()}
                    className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    Thêm cạnh
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slateDark-800">
                    Đang yêu cầu hoàn thành trước ({prereqTarget.prerequisiteIds.length}):
                  </p>
                  {prereqTarget.prerequisiteIds.length === 0 ? (
                    <p className="rounded-xl bg-slateDark-25 px-3 py-4 text-center text-xs text-slateDark-600">
                      Chủ điểm này chưa có điều kiện tiên quyết.
                    </p>
                  ) : (
                    prereqTarget.prerequisiteIds.map((pid, idx) => {
                      const codeLabel = prereqTarget.prerequisiteCodes[idx] ?? pid;
                      const match = topics.find((t) => t.id === pid);
                      return (
                        <div
                          key={pid}
                          className="flex items-center justify-between rounded-xl border border-slateDark-100 bg-slateDark-25 px-3 py-2 text-xs"
                        >
                          <div>
                            <p className="font-semibold text-slateDark-900">
                              {match?.titleVi ?? codeLabel}
                            </p>
                            <p className="font-mono text-[11px] text-slateDark-600">
                              {codeLabel}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={prereqSaving}
                            onClick={() => void handleRemovePrerequisite(pid)}
                            className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
