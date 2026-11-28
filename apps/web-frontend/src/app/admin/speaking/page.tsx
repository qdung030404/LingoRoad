'use client';

import React, { useEffect } from 'react';
import { Download, Mic, Plus } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminToast, type AdminToastApi } from '@/components/admin/AdminToast';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { SpeakingPromptModal } from '@/components/admin/SpeakingPromptModal';
import {
  useAdminQueryParams,
  useSyncAdminQueryParams,
  type QueryParamValue,
  type UseAdminQueryParamsResult,
} from '@/lib/use-admin-query-params';
import {
  SPEAKING_QUERY_DEFAULTS,
  type SpeakingAdminTab,
} from './speaking-admin.helpers';
import { SpeakingPromptsTab } from './SpeakingPromptsTab';
import { SpeakingSubmissionDrawer } from './SpeakingSubmissionDrawer';
import { SpeakingSubmissionsTab } from './SpeakingSubmissionsTab';
import { SpeakingVoiceDrawer } from './SpeakingVoiceDrawer';
import { SpeakingVoiceTab } from './SpeakingVoiceTab';
import { useSpeakingAdminState } from './useSpeakingAdminState';

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

function SpeakingQuerySync({
  params,
  onExternalChange,
}: {
  params: Record<string, QueryParamValue>;
  onExternalChange: (api: UseAdminQueryParamsResult) => void;
}): null {
  const queryApi = useAdminQueryParams();
  useSyncAdminQueryParams(params, SPEAKING_QUERY_DEFAULTS);
  useEffect(() => {
    onExternalChange(queryApi);
  }, [queryApi, onExternalChange]);
  return null;
}

export default function AdminSpeakingPage(): React.ReactElement {
  const state = useSpeakingAdminState();
  const {
    toastRef,
    setAuthReady,
    activeTab,
    setActiveTab,
    bannerError,
    exporting,
    promptsSummary,
    subSummary,
    voiceSummary,
    showModal,
    setShowModal,
    editingPrompt,
    setEditingPrompt,
    cloningPrompt,
    setCloningPrompt,
    deleteTarget,
    setDeleteTarget,
    forceDelete,
    setForceDelete,
    deleting,
    selectedSubId,
    expireSubTarget,
    setExpireSubTarget,
    expiringSub,
    selectedVoiceId,
    releaseLockTarget,
    setReleaseLockTarget,
    releasingLock,
    activeQueryParams,
    handleExternalQueryChange,
    loadPrompts,
    handleConfirmDelete,
    handleExport,
    handleConfirmExpireSubmission,
    handleConfirmReleaseVoiceLock,
  } = state;

  return (
    <AdminShell
      breadcrumbTitle="Luyện nói & Voice AI"
      title="Luyện nói & Voice AI"
      onAuthenticated={() => setAuthReady(true)}
    >
      {() => (
        <>
          <AdminToastBridge toastRef={toastRef} />
          <SpeakingQuerySync
            params={activeQueryParams}
            onExternalChange={handleExternalQueryChange}
          />

          <div className="min-w-0 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-slateDark-900">
              Luyện nói &amp; Voice AI
            </h1>
            <p className="mt-1 text-sm text-slateDark-500">
              Quản lý kho đề luyện nói, giám sát bài nộp Speaking và kiểm soát phiên Voice AI bị treo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {activeTab === 'prompts' && (
              <>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 rounded-xl border border-slateDark-200 bg-white px-4 py-2.5 text-sm font-semibold text-slateDark-700 hover:bg-slateDark-50 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? 'Đang xuất...' : 'Xuất JSON'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPrompt(null);
                    setCloningPrompt(null);
                    setShowModal(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold !text-white shadow-sm hover:bg-brand-700"
                >
                  <Plus className="h-4 w-4" />
                  Tạo đề nói
                </button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slateDark-200 pb-2">
          {(
            [
              { key: 'prompts', label: `Đề luyện nói (${promptsSummary.total})` },
              {
                key: 'submissions',
                label: `Bài nộp Speaking${subSummary.failed + subSummary.unknown > 0 ? ` (${subSummary.failed + subSummary.unknown} lỗi)` : ''}`,
              },
              {
                key: 'voice',
                label: `Hội thoại Voice AI${voiceSummary.activeLocks > 0 ? ` (${voiceSummary.activeLocks} lock)` : ''}`,
              },
            ] as Array<{ key: SpeakingAdminTab; label: string }>
          ).map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-brand-600 !text-white shadow-sm'
                    : 'bg-white text-slateDark-600 hover:bg-slateDark-50'
                }`}
              >
                <Mic className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {bannerError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700">
            {bannerError}
          </div>
        )}

        {activeTab === 'prompts' && <SpeakingPromptsTab state={state} />}
        {activeTab === 'submissions' && <SpeakingSubmissionsTab state={state} />}
        {activeTab === 'voice' && <SpeakingVoiceTab state={state} />}

        {showModal && (
          <SpeakingPromptModal
            editingPrompt={editingPrompt}
            cloneFrom={cloningPrompt}
            onClose={() => {
              setShowModal(false);
              setEditingPrompt(null);
              setCloningPrompt(null);
            }}
            onSaved={() => {
              const wasEditing = Boolean(editingPrompt);
              const wasCloning = Boolean(cloningPrompt);
              setShowModal(false);
              setEditingPrompt(null);
              setCloningPrompt(null);
              toastRef.current.success(
                wasEditing
                  ? 'Đã cập nhật đề luyện nói.'
                  : wasCloning
                    ? 'Đã nhân bản đề luyện nói thành công.'
                    : 'Đã tạo đề luyện nói mới.',
              );
              if (activeTab === 'prompts') {
                void loadPrompts();
              } else {
                setActiveTab('prompts');
              }
            }}
          />
        )}

        {selectedSubId && <SpeakingSubmissionDrawer state={state} />}
        {selectedVoiceId && <SpeakingVoiceDrawer state={state} />}

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="Xác nhận xoá đề luyện nói"
          tone={
            deleteTarget && deleteTarget.submissionsCount > 0 && !forceDelete
              ? 'warning'
              : 'danger'
          }
          confirmLabel={
            deleteTarget && deleteTarget.submissionsCount > 0 && !forceDelete
              ? 'Chuyển bản nháp'
              : 'Xoá đề'
          }
          busy={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => {
            if (!deleting) {
              setDeleteTarget(null);
              setForceDelete(false);
            }
          }}
          description={
            deleteTarget ? (
              <div className="space-y-3 text-sm text-slateDark-600">
                <p>
                  Bạn đang thao tác trên đề{' '}
                  <strong className="text-slateDark-900">{deleteTarget.title}</strong> (
                  <code>{deleteTarget.code}</code>).
                </p>
                {deleteTarget.submissionsCount > 0 ? (
                  <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                    <p>
                      Đề này đã có <strong>{deleteTarget.submissionsCount}</strong> bài nộp từ học viên. Mặc định hệ thống sẽ chuyển sang <strong>Bản nháp</strong> để bảo toàn lịch sử.
                    </p>
                    <label className="flex cursor-pointer items-center gap-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={forceDelete}
                        onChange={(e) => setForceDelete(e.target.checked)}
                        className="rounded border-amber-400 text-red-600 focus:ring-red-500"
                      />
                      Xoá cưỡng bức vĩnh viễn (kèm toàn bộ bài nộp liên quan)
                    </label>
                  </div>
                ) : (
                  <p>Hành động này sẽ xoá vĩnh viễn đề luyện nói khỏi cơ sở dữ liệu.</p>
                )}
              </div>
            ) : null
          }
        />

        <ConfirmDialog
          open={Boolean(expireSubTarget)}
          title="Đánh dấu bài nộp quá hạn (Expire)"
          tone="warning"
          confirmLabel="Xác nhận Expire"
          busy={expiringSub}
          onConfirm={handleConfirmExpireSubmission}
          onCancel={() => {
            if (!expiringSub) setExpireSubTarget(null);
          }}
          description={
            expireSubTarget ? (
              <p className="text-sm text-slateDark-600">
                Bài nộp của học viên{' '}
                <strong className="text-slateDark-900">
                  {expireSubTarget.user.email}
                </strong>{' '}
                đang bị treo ở trạng thái <code>PROCESSING</code> sẽ được chuyển sang{' '}
                <code>UNKNOWN</code> (<code>speaking_processing_expired</code>) để học viên có thể thử lại.
              </p>
            ) : null
          }
        />

        <ConfirmDialog
          open={Boolean(releaseLockTarget)}
          title="Gỡ khoá phiên Voice AI (Release Lock)"
          tone="warning"
          confirmLabel="Gỡ khoá ngay"
          busy={releasingLock}
          onConfirm={handleConfirmReleaseVoiceLock}
          onCancel={() => {
            if (!releasingLock) setReleaseLockTarget(null);
          }}
          description={
            releaseLockTarget ? (
              <p className="text-sm text-slateDark-600">
                Thao tác này sẽ ngắt phiên Voice AI đang bị khoá của{' '}
                <strong className="text-slateDark-900">
                  {releaseLockTarget.user.email}
                </strong>{' '}
                và giải phóng <code>activeUserId</code> để học viên có thể bắt đầu hội thoại mới.
              </p>
            ) : null
          }
        />
      </div>
        </>
      )}
    </AdminShell>
  );
}
