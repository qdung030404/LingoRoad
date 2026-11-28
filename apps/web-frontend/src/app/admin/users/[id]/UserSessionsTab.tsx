import React from 'react';
import { RefreshCw, ShieldAlert, Smartphone, Trash2 } from 'lucide-react';
import { formatDateTime } from './user-detail.helpers';
import type { UserDetailState } from './useUserDetailState';

interface UserSessionsTabProps {
  state: UserDetailState;
}

export function UserSessionsTab({
  state,
}: UserSessionsTabProps): React.ReactElement {
  const {
    sessions,
    sessionsLoading,
    sessionsError,
    revokingAll,
    loadSessions,
    setRevokeTarget,
    setConfirmRevokeAllOpen,
  } = state;

  return (
    <section className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slateDark-900">
            Phiên đăng nhập đang hoạt động (Refresh Sessions)
          </h2>
          <p className="text-xs text-slateDark-700">
            Danh sách phiên còn hiệu lực (không hiển thị token hash). Thu hồi
            tất cả sẽ đồng thời nâng tokenVersion và vô hiệu hóa phiên Firebase.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={sessionsLoading}
            onClick={() => void loadSessions()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3 py-2 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${sessionsLoading ? 'animate-spin' : ''}`}
            />
            <span>Tải lại</span>
          </button>
          <button
            type="button"
            disabled={revokingAll}
            onClick={() => setConfirmRevokeAllOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Thu hồi tất cả phiên</span>
          </button>
        </div>
      </div>

      {sessionsError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
          {sessionsError}
        </div>
      )}

      {sessionsLoading ? (
        <p className="py-10 text-center text-xs text-slateDark-600">
          Đang tải danh sách phiên đăng nhập...
        </p>
      ) : sessions.length === 0 ? (
        <p className="rounded-xl border border-slateDark-100 bg-slateDark-25 px-4 py-8 text-center text-xs text-slateDark-600">
          Không có phiên đăng nhập nào đang hoạt động.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase text-slateDark-700">
              <tr>
                <th className="px-4 py-3">Thiết bị</th>
                <th className="px-4 py-3">Địa chỉ IP</th>
                <th className="px-4 py-3">Tạo lúc</th>
                <th className="px-4 py-3">Hết hạn</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slateDark-100">
              {sessions.map((session) => (
                <tr key={session.id} className="hover:bg-slateDark-25">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 shrink-0 text-slateDark-500" />
                      <div>
                        <p className="font-semibold text-slateDark-900">
                          {session.deviceIdentifier ||
                            'Thiết bị không xác định'}
                        </p>
                        <p className="font-mono text-[10px] text-slateDark-600">
                          {session.id.slice(0, 12)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slateDark-800">
                    {session.ipAddress || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                    {formatDateTime(session.createdAt)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slateDark-700">
                    {formatDateTime(session.expiresAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setRevokeTarget(session)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1 font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Thu hồi</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
