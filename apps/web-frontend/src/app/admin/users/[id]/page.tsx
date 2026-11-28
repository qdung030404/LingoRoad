'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminToast, type AdminToastApi } from '@/components/admin/AdminToast';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { UserActivityTab } from './UserActivityTab';
import { UserPlacementModal } from './UserPlacementModal';
import { UserProfileTab } from './UserProfileTab';
import { UserSessionsTab } from './UserSessionsTab';
import { UserSkillsTab } from './UserSkillsTab';
import { useUserDetailState } from './useUserDetailState';

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

export default function AdminUser360Page(): React.ReactElement {
  const params = useParams<{ id: string }>();
  const userId =
    typeof params?.id === 'string'
      ? params.id
      : Array.isArray(params?.id)
        ? (params.id[0] ?? '')
        : '';

  const state = useUserDetailState(userId);
  const {
    toastRef,
    setAuthReady,
    activeTab,
    setActiveTab,
    detail,
    loading,
    error,
    exporting,
    placementModalSessionId,
    setPlacementModalSessionId,
    placementDetail,
    placementDetailLoading,
    placementDetailError,
    confirmResetRetakeOpen,
    setConfirmResetRetakeOpen,
    resetPlacementSkillLevels,
    setResetPlacementSkillLevels,
    resettingRetake,
    sessions,
    revokeTarget,
    setRevokeTarget,
    revokingOne,
    confirmRevokeAllOpen,
    setConfirmRevokeAllOpen,
    revokingAll,
    tabs,
    loadDetail,
    loadSessions,
    handleExportGdpr,
    handleConfirmResetRetake,
    handleConfirmRevokeOne,
    handleConfirmRevokeAll,
  } = state;

  return (
    <AdminShell
      breadcrumbTitle="Hồ sơ người học 360°"
      title={detail ? detail.name : 'Hồ sơ người học 360°'}
      subtitle={
        detail
          ? `${detail.email} · ID: ${detail.id}`
          : 'Xem và quản lý toàn diện hồ sơ, kỹ năng, bài kiểm tra đầu vào, phiên đăng nhập và lịch sử học tập.'
      }
      onAuthenticated={() => setAuthReady(true)}
      actions={
        <>
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Danh sách người dùng</span>
          </Link>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              void loadDetail();
              void loadSessions();
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
            />
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            disabled={exporting || !detail}
            onClick={() => void handleExportGdpr()}
            className="btn-primary inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>
              {exporting ? 'Đang xuất...' : 'Xuất dữ liệu GDPR (JSON)'}
            </span>
          </button>
        </>
      }
    >
      {(currentAdmin) => {
        const isSelf = detail?.id === currentAdmin.id;
        return (
          <div className="space-y-6">
            <AdminToastBridge toastRef={toastRef} />

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {loading && !detail ? (
              <div className="rounded-2xl border border-slateDark-100 bg-white px-6 py-16 text-center shadow-sm">
                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                <p className="text-sm font-medium text-slateDark-700">
                  Đang tải dữ liệu hồ sơ 360°...
                </p>
              </div>
            ) : detail ? (
              <>
                {/* Dải thống kê tổng quan */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {[
                    { label: 'Lượt học', value: detail.stats.learningAttempts },
                    { label: 'Placement', value: detail.stats.placementSessions },
                    { label: 'Bộ từ vựng', value: detail.stats.vocabularyDecks },
                    { label: 'Bài Luyện nói', value: detail.stats.speakingSubmissions },
                    { label: 'Hội thoại Voice', value: detail.stats.voiceConversations ?? 0 },
                    { label: 'Đáp án đã lộ', value: detail.answerExposuresCount },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-slateDark-100 bg-white p-4 shadow-sm"
                    >
                      <p className="text-[11px] font-semibold text-slateDark-600">
                        {stat.label}
                      </p>
                      <p className="mt-1 text-xl font-extrabold text-slateDark-900">
                        {stat.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Thanh điều hướng 4 tab */}
                <div className="flex flex-wrap gap-2 rounded-2xl border border-slateDark-100 bg-white p-2 shadow-sm">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={
                          active
                            ? 'inline-flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-2 text-xs font-bold text-brand-800 transition'
                            : 'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-slateDark-700 transition hover:bg-slateDark-50 hover:text-slateDark-900'
                        }
                      >
                        <Icon
                          className={`h-4 w-4 ${active ? 'text-brand-600' : 'text-slateDark-500'}`}
                        />
                        <span>{tab.label}</span>
                        {tab.key === 'sessions' && (
                          <span className="rounded-full bg-white px-1.5 py-0.5 font-mono text-[10px] text-slateDark-800">
                            {sessions.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {activeTab === 'profile' && (
                  <UserProfileTab
                    detail={detail}
                    isSelf={isSelf}
                    state={state}
                  />
                )}
                {activeTab === 'skills' && (
                  <UserSkillsTab detail={detail} state={state} />
                )}
                {activeTab === 'sessions' && <UserSessionsTab state={state} />}
                {activeTab === 'activity' && <UserActivityTab detail={detail} />}
              </>
            ) : null}

            <UserPlacementModal
              sessionId={placementModalSessionId}
              detail={placementDetail}
              loading={placementDetailLoading}
              error={placementDetailError}
              onClose={() => setPlacementModalSessionId(null)}
            />

            <ConfirmDialog
              open={confirmResetRetakeOpen}
              tone="warning"
              busy={resettingRetake}
              title="Reset quyền làm lại bài kiểm tra đầu vào?"
              confirmLabel="Xác nhận Reset"
              onCancel={() => setConfirmResetRetakeOpen(false)}
              onConfirm={() => void handleConfirmResetRetake()}
              description={
                <div className="space-y-3">
                  <p>
                    Tất cả phiên kiểm tra đầu vào đang thực hiện hoặc đã hoàn
                    thành của <strong>{detail?.email}</strong> sẽ được chuyển
                    sang trạng thái <code>ABANDONED</code> để người học có thể
                    thi lại.
                  </p>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <input
                      type="checkbox"
                      checked={resetPlacementSkillLevels}
                      onChange={(e) =>
                        setResetPlacementSkillLevels(e.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 accent-amber-600"
                    />
                    <span>
                      <strong>
                        Xóa các trình độ kỹ năng có nguồn PLACEMENT
                      </strong>
                      <br />
                      Các kỹ năng được gán từ bài kiểm tra đầu vào trước đó sẽ
                      được xóa để tính lại sau khi thi.
                    </span>
                  </label>
                </div>
              }
            />

            <ConfirmDialog
              open={Boolean(revokeTarget)}
              tone="danger"
              busy={revokingOne}
              title="Thu hồi phiên đăng nhập này?"
              confirmLabel="Thu hồi phiên"
              onCancel={() => setRevokeTarget(null)}
              onConfirm={() => void handleConfirmRevokeOne()}
              description={
                <p>
                  Thiết bị{' '}
                  <strong>
                    {revokeTarget?.deviceIdentifier || 'không xác định'}
                  </strong>{' '}
                  ({revokeTarget?.ipAddress || 'không rõ IP'}) sẽ không thể làm
                  mới token và buộc đăng nhập lại.
                </p>
              }
            />

            <ConfirmDialog
              open={confirmRevokeAllOpen}
              tone="danger"
              busy={revokingAll}
              title="Thu hồi toàn bộ phiên đăng nhập?"
              confirmLabel="Thu hồi tất cả"
              onCancel={() => setConfirmRevokeAllOpen(false)}
              onConfirm={() => void handleConfirmRevokeAll()}
              description={
                <p>
                  Hành động này sẽ thu hồi tất cả Refresh Session đang hoạt
                  động, tăng <code>tokenVersion</code> và thu hồi token Firebase
                  (nếu có) của <strong>{detail?.email}</strong> trên mọi thiết
                  bị.
                </p>
              }
            />
          </div>
        );
      }}
    </AdminShell>
  );
}
