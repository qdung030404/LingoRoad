'use client';

import React, { useEffect, useRef } from 'react';
import { AudioLines, Download, FileAudio, Mic, Plus } from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { useAdminToast, type AdminToastApi } from '@/components/admin/AdminToast';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { SpeakingPromptModal } from '@/components/admin/SpeakingPromptModal';
import { SpeakingPromptsTab } from '@/components/admin/SpeakingPromptsTab';
import { SpeakingSubmissionDrawer } from '@/components/admin/SpeakingSubmissionDrawer';
import { SpeakingSubmissionsTab } from '@/components/admin/SpeakingSubmissionsTab';
import { SpeakingVoiceDrawer } from '@/components/admin/SpeakingVoiceDrawer';
import { SpeakingVoiceTab } from '@/components/admin/SpeakingVoiceTab';
import { SPEAKING_QUERY_DEFAULTS } from '@/lib/admin-speaking-helpers';
import { useAdminSpeakingPage } from '@/lib/use-admin-speaking-page';
import {
  buildQueryString,
  normalizeQueryString,
  useAdminQueryParams,
  useSyncAdminQueryParams,
  type QueryParamValue,
  type UseAdminQueryParamsResult,
} from '@/lib/use-admin-query-params';

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
  onExternalQueryChange,
}: {
  params: Record<string, QueryParamValue>;
  onExternalQueryChange: (api: UseAdminQueryParamsResult) => void;
}): null {
  const queryApi = useAdminQueryParams();
  const rawSearch = queryApi.searchParams?.toString() ?? '';
  const lastSeenRawRef = useRef(rawSearch);
  const expectedQuery = buildQueryString(params, SPEAKING_QUERY_DEFAULTS);

  useSyncAdminQueryParams(params, SPEAKING_QUERY_DEFAULTS);

  useEffect(() => {
    if (rawSearch === lastSeenRawRef.current) return;
    lastSeenRawRef.current = rawSearch;
    if (normalizeQueryString(rawSearch) === expectedQuery) return;
    onExternalQueryChange(queryApi);
  }, [rawSearch, expectedQuery, queryApi, onExternalQueryChange]);

  return null;
}

export default function AdminSpeakingPage(): React.ReactElement {
  const s = useAdminSpeakingPage();

  return (
    <AdminShell
      breadcrumbTitle="Luyện nói"
      title="Speaking Prompts & Voice AI Ops"
      subtitle="Quản lý đề luyện nói, giám sát bài nộp Speaking lỗi/treo và điều phối phiên hội thoại Voice AI."
      onAuthenticated={() => s.setAuthReady(true)}
      actions={
        <>
          <button
            type="button"
            disabled={s.exporting}
            onClick={() => void s.handleExport()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{s.exporting ? 'Đang xuất...' : 'JSON'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              s.setEditingPrompt(null);
              s.setCloningPrompt(null);
              s.setShowModal(true);
            }}
            className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo đề nói</span>
          </button>
        </>
      }
    >
      {() => (
        <div className="space-y-5">
          <AdminToastBridge toastRef={s.toastRef} />
          <SpeakingQuerySync
            params={s.activeQueryParams}
            onExternalQueryChange={s.handleExternalQueryChange}
          />

          {/* 3 Tab Điều hướng đồng bộ URL */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex flex-wrap rounded-xl border border-slateDark-100 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => s.setActiveTab('prompts')}
                className={
                  s.activeTab === 'prompts'
                    ? 'inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm'
                    : 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50'
                }
              >
                <Mic className="h-3.5 w-3.5" />
                <span>Đề luyện nói</span>
              </button>
              <button
                type="button"
                onClick={() => s.setActiveTab('submissions')}
                className={
                  s.activeTab === 'submissions'
                    ? 'inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm'
                    : 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50'
                }
              >
                <FileAudio className="h-3.5 w-3.5" />
                <span>Bài nộp Speaking</span>
              </button>
              <button
                type="button"
                onClick={() => s.setActiveTab('voice')}
                className={
                  s.activeTab === 'voice'
                    ? 'inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-sm'
                    : 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50'
                }
              >
                <AudioLines className="h-3.5 w-3.5" />
                <span>Hội thoại Voice AI</span>
              </button>
            </div>
          </div>

          {s.bannerError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3.5 text-sm font-medium text-red-700">
              {s.bannerError}
            </div>
          )}

          {/* ===================== TAB 1: ĐỀ LUYỆN NÓI ===================== */}
          {s.activeTab === 'prompts' && (
            <SpeakingPromptsTab
              prompts={s.prompts}
              promptsLoading={s.promptsLoading}
              promptsSummary={s.promptsSummary}
              promptsPagination={s.promptsPagination}
              promptModeFilter={s.promptModeFilter}
              setPromptModeFilter={s.setPromptModeFilter}
              setPromptsPage={s.setPromptsPage}
              setPromptsLimit={s.setPromptsLimit}
              promptSearchInput={s.promptSearchInput}
              setPromptSearchInput={s.setPromptSearchInput}
              setPromptSearchQuery={s.setPromptSearchQuery}
              promptPublishedFilter={s.promptPublishedFilter}
              setPromptPublishedFilter={s.setPromptPublishedFilter}
              hasActivePromptFilters={s.hasActivePromptFilters}
              handleResetPromptFilters={s.handleResetPromptFilters}
              selectedPromptIds={s.selectedPromptIds}
              setSelectedPromptIds={s.setSelectedPromptIds}
              bulkBusy={s.bulkBusy}
              handleBulkPublishPrompts={s.handleBulkPublishPrompts}
              allPromptsSelected={s.allPromptsSelected}
              handleToggleSelectAllPrompts={s.handleToggleSelectAllPrompts}
              handleToggleSelectPrompt={s.handleToggleSelectPrompt}
              handleTogglePublish={s.handleTogglePublish}
              onClonePrompt={(p) => {
                s.setEditingPrompt(null);
                s.setCloningPrompt(p);
                s.setShowModal(true);
              }}
              onEditPrompt={(p) => {
                s.setCloningPrompt(null);
                s.setEditingPrompt(p);
                s.setShowModal(true);
              }}
              onDeletePrompt={(p) => {
                s.setForceDelete(false);
                s.setDeleteTarget(p);
              }}
            />
          )}

          {/* ===================== TAB 2: BÀI NỘP SPEAKING ===================== */}
          {s.activeTab === 'submissions' && (
            <SpeakingSubmissionsTab
              submissions={s.submissions}
              subsLoading={s.subsLoading}
              subSummary={s.subSummary}
              subPagination={s.subPagination}
              subSearchInput={s.subSearchInput}
              setSubSearchInput={s.setSubSearchInput}
              setSubSearchQuery={s.setSubSearchQuery}
              subStatusFilter={s.subStatusFilter}
              setSubStatusFilter={s.setSubStatusFilter}
              subModeFilter={s.subModeFilter}
              setSubModeFilter={s.setSubModeFilter}
              subErrorCodeInput={s.subErrorCodeInput}
              setSubErrorCodeInput={s.setSubErrorCodeInput}
              setSubErrorCodeQuery={s.setSubErrorCodeQuery}
              setSubPage={s.setSubPage}
              setSubLimit={s.setSubLimit}
              hasActiveSubFilters={s.hasActiveSubFilters}
              handleResetSubFilters={s.handleResetSubFilters}
              loadSubmissions={s.loadSubmissions}
              openSubmissionDrawer={s.openSubmissionDrawer}
            />
          )}

          {/* ===================== TAB 3: HỘI THOẠI VOICE AI ===================== */}
          {s.activeTab === 'voice' && (
            <SpeakingVoiceTab
              voiceRows={s.voiceRows}
              voiceLoading={s.voiceLoading}
              voiceSummary={s.voiceSummary}
              voicePagination={s.voicePagination}
              voiceSearchInput={s.voiceSearchInput}
              setVoiceSearchInput={s.setVoiceSearchInput}
              setVoiceSearchQuery={s.setVoiceSearchQuery}
              voiceStatusFilter={s.voiceStatusFilter}
              setVoiceStatusFilter={s.setVoiceStatusFilter}
              voiceAssessmentFilter={s.voiceAssessmentFilter}
              setVoiceAssessmentFilter={s.setVoiceAssessmentFilter}
              voiceStuckOnly={s.voiceStuckOnly}
              setVoiceStuckOnly={s.setVoiceStuckOnly}
              setVoicePage={s.setVoicePage}
              setVoiceLimit={s.setVoiceLimit}
              hasActiveVoiceFilters={s.hasActiveVoiceFilters}
              handleResetVoiceFilters={s.handleResetVoiceFilters}
              loadVoiceConversations={s.loadVoiceConversations}
              openVoiceDrawer={s.openVoiceDrawer}
            />
          )}

          {/* ===================== MODAL TẠO / SỬA / NHÂN BẢN ĐỀ NÓI ===================== */}
          {s.showModal && (
            <SpeakingPromptModal
              editingPrompt={s.editingPrompt}
              cloneFrom={s.cloningPrompt}
              onClose={() => {
                s.setShowModal(false);
                s.setEditingPrompt(null);
                s.setCloningPrompt(null);
              }}
              onSaved={() => {
                const wasEditing = Boolean(s.editingPrompt);
                const wasCloning = Boolean(s.cloningPrompt);
                s.setShowModal(false);
                s.setEditingPrompt(null);
                s.setCloningPrompt(null);
                s.toastRef.current.success(
                  wasEditing
                    ? 'Đã cập nhật đề luyện nói.'
                    : wasCloning
                      ? 'Đã nhân bản đề luyện nói thành công.'
                      : 'Đã tạo đề luyện nói mới.',
                );
                if (s.activeTab === 'prompts') {
                  void s.loadPrompts();
                } else {
                  s.setActiveTab('prompts');
                }
              }}
            />
          )}

          {/* ===================== SLIDE-OVER DRAWER: SPEAKING SUBMISSION ===================== */}
          {s.selectedSubId && (
            <SpeakingSubmissionDrawer
              selectedSubId={s.selectedSubId}
              subDetail={s.subDetail}
              subDetailLoading={s.subDetailLoading}
              subDetailError={s.subDetailError}
              parsedSubSnapshot={s.parsedSubSnapshot}
              parsedSubResult={s.parsedSubResult}
              retryingSubContent={s.retryingSubContent}
              onClose={() => {
                s.setSelectedSubId(null);
                s.setSubDetail(null);
              }}
              handleRetrySubmissionContent={s.handleRetrySubmissionContent}
              onExpireStuckJob={(sub) => s.setExpireSubTarget(sub)}
            />
          )}

          {/* ===================== SLIDE-OVER DRAWER: VOICE CONVERSATION ===================== */}
          {s.selectedVoiceId && (
            <SpeakingVoiceDrawer
              selectedVoiceId={s.selectedVoiceId}
              voiceDetail={s.voiceDetail}
              voiceDetailLoading={s.voiceDetailLoading}
              voiceDetailError={s.voiceDetailError}
              canRetryVoiceContent={s.canRetryVoiceContent}
              retryingVoiceContent={s.retryingVoiceContent}
              sortedVoiceTurns={s.sortedVoiceTurns}
              parsedVoiceAssessment={s.parsedVoiceAssessment}
              onClose={() => {
                s.setSelectedVoiceId(null);
                s.setVoiceDetail(null);
              }}
              onReleaseLock={(detail) => s.setReleaseLockTarget(detail)}
              handleRetryVoiceContent={s.handleRetryVoiceContent}
            />
          )}

          {/* ===================== CONFIRM DIALOGS ===================== */}
          <ConfirmDialog
            open={Boolean(s.deleteTarget)}
            title="Xác nhận xoá đề luyện nói"
            tone={
              s.deleteTarget &&
              s.deleteTarget.submissionsCount > 0 &&
              !s.forceDelete
                ? 'warning'
                : 'danger'
            }
            confirmLabel={
              s.deleteTarget &&
              s.deleteTarget.submissionsCount > 0 &&
              !s.forceDelete
                ? 'Chuyển bản nháp'
                : 'Xoá đề'
            }
            busy={s.deleting}
            onConfirm={s.handleConfirmDelete}
            onCancel={() => {
              s.setDeleteTarget(null);
              s.setForceDelete(false);
            }}
            description={
              s.deleteTarget ? (
                <div className="space-y-3">
                  <p>
                    Đề: <strong>{s.deleteTarget.title}</strong> (
                    <code className="font-mono text-xs">
                      {s.deleteTarget.code}
                    </code>
                    )
                  </p>
                  {s.deleteTarget.submissionsCount > 0 ? (
                    <>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                        Đề này đã có{' '}
                        <strong>{s.deleteTarget.submissionsCount} bài nộp</strong>
                        . Mặc định sẽ chuyển về{' '}
                        <strong>Bản nháp (Unpublish)</strong> để bảo toàn lịch
                        sử người học.
                      </div>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                        <input
                          type="checkbox"
                          checked={s.forceDelete}
                          onChange={(e) => s.setForceDelete(e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-red-600"
                        />
                        <span>
                          <strong>Xoá cưỡng bức (Force Delete)</strong>: Xoá
                          sạch đề và toàn bộ {s.deleteTarget.submissionsCount} bài
                          nộp liên quan.
                        </span>
                      </label>
                    </>
                  ) : (
                    <p className="text-xs text-slateDark-700">
                      Đề chưa có bài nộp và sẽ được xoá vĩnh viễn.
                    </p>
                  )}
                </div>
              ) : null
            }
          />

          <ConfirmDialog
            open={Boolean(s.expireSubTarget)}
            title="Đóng job Speaking bị kẹt"
            tone="danger"
            confirmLabel="Đóng job kẹt"
            busy={s.expiringSub}
            onConfirm={s.handleConfirmExpireSubmission}
            onCancel={() => s.setExpireSubTarget(null)}
            description={
              s.expireSubTarget ? (
                <p>
                  Xác nhận đóng bài nộp đang treo ở trạng thái{' '}
                  <code className="font-mono text-xs">PROCESSING</code> (&gt;3
                  phút) của <strong>{s.expireSubTarget.user.email}</strong> và
                  chuyển sang <code className="font-mono text-xs">UNKNOWN</code>{' '}
                  với mã lỗi{' '}
                  <code className="font-mono text-xs">admin_expired</code>?
                </p>
              ) : null
            }
          />

          <ConfirmDialog
            open={Boolean(s.releaseLockTarget)}
            title="Giải phóng khóa phiên Voice AI"
            tone="danger"
            confirmLabel="Giải phóng khóa"
            busy={s.releasingLock}
            onConfirm={s.handleConfirmReleaseVoiceLock}
            onCancel={() => s.setReleaseLockTarget(null)}
            description={
              s.releaseLockTarget ? (
                <p>
                  Bạn có chắc muốn giải phóng khóa hoạt động (
                  <code className="font-mono text-xs">activeUserId</code>) và
                  ngắt kết nối live (nếu đang mở) cho phiên hội thoại của{' '}
                  <strong>{s.releaseLockTarget.user.email}</strong>? Người dùng
                  sẽ có thể bắt đầu phiên Voice AI mới ngay sau đó.
                </p>
              ) : null
            }
          />
        </div>
      )}
    </AdminShell>
  );
}
