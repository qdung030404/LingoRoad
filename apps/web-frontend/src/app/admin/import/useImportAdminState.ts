import type React from 'react';
import {
  useRef as reactUseRef,
  useState as reactUseState,
} from 'react';
import { NOOP_ADMIN_TOAST, type AdminToastApi } from '@/components/admin/AdminToast';
import type * as AdminApi from '@/lib/admin-api';
import type {
  AdminExportEntity,
  ImportApplyResponse,
  ImportValidationResponse,
} from '@/types/admin';
import {
  EXPORT_ENTITIES,
  SAMPLE_BUNDLE_ALL,
  type ImportStep,
} from './import-samples';

export interface ImportAdminStateDeps {
  useState: typeof reactUseState;
  useRef: typeof reactUseRef;
  applyAdminImport: typeof AdminApi.applyAdminImport;
  downloadAdminExport: typeof AdminApi.downloadAdminExport;
  validateAdminImport: typeof AdminApi.validateAdminImport;
}

export function useImportAdminState(deps: ImportAdminStateDeps) {
  const {
    useState,
    useRef,
    applyAdminImport,
    downloadAdminExport,
    validateAdminImport,
  } = deps;

  const toastRef = useRef<AdminToastApi>(NOOP_ADMIN_TOAST);
  const revision = useRef(0);
  const validatedSignature = useRef<string | null>(null);
  const applyInFlight = useRef(false);

  const [step, setStep] = useState<ImportStep>(1);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [rawJson, setRawJson] = useState<string>(SAMPLE_BUNDLE_ALL);
  const [topicWordsMode, setTopicWordsMode] = useState<'merge' | 'replace'>(
    'merge',
  );
  const [parsedBundle, setParsedBundle] = useState<unknown>(null);

  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmedAtomic, setConfirmedAtomic] = useState(false);
  const [exportingKey, setExportingKey] = useState<string | null>(null);

  const [syntaxError, setSyntaxError] = useState<string | null>(null);
  const [validationResult, setValidationResult] =
    useState<ImportValidationResponse | null>(null);
  const [applyResult, setApplyResult] = useState<ImportApplyResponse | null>(
    null,
  );
  const [applyError, setApplyError] = useState<string | null>(null);

  const resetProgress = (): void => {
    revision.current += 1;
    validatedSignature.current = null;
    setValidating(false);
    setStep(1);
    setParsedBundle(null);
    setValidationResult(null);
    setApplyResult(null);
    setSyntaxError(null);
    setApplyError(null);
    setConfirmedAtomic(false);
  };

  const handleLoadSample = (sample: string): void => {
    if (applying) return;
    setSelectedFileName(null);
    setRawJson(sample);
    resetProgress();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file || applying) return;
    resetProgress();
    const requestRevision = revision.current;
    const text = await file.text();
    if (requestRevision !== revision.current) return;
    setSelectedFileName(file.name);
    setRawJson(text);
    resetProgress();
    event.target.value = '';
  };

  const handleValidate = async (): Promise<void> => {
    const requestRevision = ++revision.current;
    const signature = `${topicWordsMode}::${rawJson}`;
    validatedSignature.current = null;
    setParsedBundle(null);
    setValidationResult(null);
    setStep(1);
    setSyntaxError(null);
    setApplyError(null);
    setApplyResult(null);
    setConfirmedAtomic(false);

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch (err) {
      const msg =
        err instanceof Error
          ? `Lỗi cú pháp JSON: ${err.message}`
          : 'Không thể phân tích chuỗi JSON.';
      setValidationResult(null);
      setStep(1);
      setSyntaxError(msg);
      toastRef.current.error(msg);
      return;
    }

    setValidating(true);
    try {
      const result = await validateAdminImport(parsed, topicWordsMode);
      if (requestRevision !== revision.current) return;
      validatedSignature.current = result.isValid ? signature : null;
      setParsedBundle(parsed);
      setValidationResult(result);
      setStep(result.isValid ? 2 : 1);
      if (result.isValid) {
        toastRef.current.success(
          `Kiểm tra hợp lệ: ${result.preview.totalRecords} bản ghi sẵn sàng nạp.`,
        );
      } else {
        toastRef.current.error(
          `Phát hiện ${result.errors.length} lỗi trong gói JSON.`,
        );
      }
    } catch (err) {
      if (requestRevision !== revision.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : 'Không thể kiểm tra gói JSON với máy chủ.';
      setValidationResult(null);
      setStep(1);
      setSyntaxError(msg);
      toastRef.current.error(msg);
    } finally {
      if (requestRevision === revision.current) setValidating(false);
    }
  };

  const handleApply = async (): Promise<void> => {
    const currentSignature = `${topicWordsMode}::${rawJson}`;
    if (
      !parsedBundle ||
      !validationResult?.isValid ||
      !confirmedAtomic ||
      validatedSignature.current !== currentSignature ||
      applyInFlight.current
    ) {
      return;
    }
    applyInFlight.current = true;
    setApplyError(null);
    setApplying(true);
    try {
      const res = await applyAdminImport(parsedBundle, topicWordsMode);
      setApplyResult(res);
      setStep(4);
      toastRef.current.success(
        `Import thành công ${res.preview.totalRecords} bản ghi!`,
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Áp dụng gói JSON thất bại. Toàn bộ giao dịch đã được hoàn tác.';
      setApplyError(msg);
      toastRef.current.error(msg);
    } finally {
      applyInFlight.current = false;
      setApplying(false);
    }
  };

  const handleExport = async (
    entity: AdminExportEntity,
    format: 'json' | 'csv',
  ): Promise<void> => {
    const key = `${entity}-${format}`;
    setExportingKey(key);
    try {
      await downloadAdminExport(entity, format);
      const label =
        EXPORT_ENTITIES.find((item) => item.entity === entity)?.label ?? entity;
      toastRef.current.success(
        `Đã xuất dữ liệu ${label} (${format.toUpperCase()}).`,
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Xuất dữ liệu thất bại.';
      setSyntaxError(msg);
      toastRef.current.error(msg);
    } finally {
      setExportingKey(null);
    }
  };

  return {
    toastRef,
    step,
    setStep,
    selectedFileName,
    rawJson,
    setRawJson,
    topicWordsMode,
    setTopicWordsMode,
    validating,
    applying,
    confirmedAtomic,
    setConfirmedAtomic,
    exportingKey,
    syntaxError,
    validationResult,
    applyResult,
    applyError,
    resetProgress,
    handleLoadSample,
    handleFileChange,
    handleValidate,
    handleApply,
    handleExport,
  };
}

export type ImportAdminState = ReturnType<typeof useImportAdminState>;
