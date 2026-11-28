import React from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { GlobalPagination } from '@/components/admin/GlobalPagination';
import { formatDate, getAvatarLetters } from './users-admin.helpers';
import type { UsersAdminState } from './useUsersAdminState';

export function renderUsersTable(
  state: UsersAdminState,
  currentAdminId: string,
): React.ReactElement {
  const {
    users,
    loading,
    pagination,
    setPage,
    setLimit,
    openEditModal,
    setToggleLockTarget,
    setHardDelete,
    setDeleteTarget,
  } = state;

  return (
    <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase tracking-wider text-slateDark-700">
            <tr>
              <th className="px-6 py-3.5">Người dùng</th>
              <th className="px-4 py-3.5">Vai trò</th>
              <th className="px-4 py-3.5">Trạng thái</th>
              <th className="px-4 py-3.5">CEFR mục tiêu</th>
              <th className="px-4 py-3.5">Ngày tạo</th>
              <th className="px-6 py-3.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slateDark-100">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-slateDark-700"
                >
                  Đang tải danh sách người dùng...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-slateDark-700"
                >
                  Không tìm thấy người dùng nào khớp bộ lọc.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isSelf = user.id === currentAdminId;
                return (
                  <tr key={user.id} className="hover:bg-slateDark-25">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                          {getAvatarLetters(user.name, user.email)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-semibold text-slateDark-900">
                              {user.name}
                            </p>
                            {isSelf && (
                              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800">
                                Bạn
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-slateDark-700">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={
                          user.role === 'ADMIN'
                            ? 'rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800'
                            : 'rounded-full bg-slateDark-50 px-2.5 py-1 text-xs font-medium text-slateDark-800'
                        }
                      >
                        {user.role === 'ADMIN' ? 'Admin' : 'Learner'}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={
                          user.status === 'ACTIVE'
                            ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700'
                            : user.status === 'SUSPENDED'
                              ? 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800'
                              : 'rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700'
                        }
                      >
                        {user.status}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-xs font-semibold text-slateDark-900">
                      {user.profile?.targetCefr ?? 'B1'}
                    </td>

                    <td className="px-4 py-4 text-xs text-slateDark-700">
                      {formatDate(user.createdAt)}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-brand-25 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-50"
                        >
                          <span>Xem 360°</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          className="rounded-lg border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 transition hover:bg-slateDark-50"
                        >
                          Xem / Sửa
                        </button>

                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => setToggleLockTarget(user)}
                          className="rounded-lg border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 transition hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {user.status === 'ACTIVE' ? 'Khóa' : 'Mở khóa'}
                        </button>

                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => {
                            setHardDelete(false);
                            setDeleteTarget(user);
                          }}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <GlobalPagination
        page={pagination.page}
        limit={pagination.limit}
        total={pagination.total}
        totalPages={pagination.totalPages}
        onPageChange={(next) => setPage(next)}
        onLimitChange={(nextLimit) => {
          setLimit(nextLimit);
          setPage(1);
        }}
      />
    </div>
  );
}
