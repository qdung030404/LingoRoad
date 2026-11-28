import React from 'react';
import type { AdminGrammarTopic } from '@/types/admin';

interface GrammarTopicsTableProps {
  topics: AdminGrammarTopic[];
  loading: boolean;
  onTogglePublish: (topic: AdminGrammarTopic) => Promise<void>;
  onOpenPrereq: (topic: AdminGrammarTopic) => void;
  onEdit: (topic: AdminGrammarTopic) => void;
  onDelete: (topic: AdminGrammarTopic) => void;
}

export function GrammarTopicsTable({
  topics,
  loading,
  onTogglePublish,
  onOpenPrereq,
  onEdit,
  onDelete,
}: GrammarTopicsTableProps): React.ReactElement {
  return (
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
                      onClick={() => void onTogglePublish(topic)}
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
                          onClick={() => onOpenPrereq(topic)}
                          className="rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1 font-semibold text-brand-800 hover:bg-brand-50"
                        >
                          DAG ({topic.prerequisiteIds.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(topic)}
                        className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 font-semibold text-slateDark-900 hover:bg-slateDark-50"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(topic)}
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
  );
}
