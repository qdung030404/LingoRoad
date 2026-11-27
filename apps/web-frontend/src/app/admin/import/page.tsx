'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Download,
  FileUp,
  Layers,
  RefreshCw,
  ShieldCheck,
  Tags,
} from 'lucide-react';
import { AdminShell } from '@/components/admin/AdminShell';
import { LegacyStatCard } from '@/components/admin/LegacyStatCard';
import {
  applyAdminImport,
  downloadAdminExport,
  validateAdminImport,
} from '@/lib/admin-api';
import type {
  AdminExportEntity,
  ImportApplyResponse,
  ImportPreviewRecord,
  ImportValidationResponse,
} from '@/types/admin';

type ImportStep = 1 | 2 | 3 | 4;

const SAMPLE_BUNDLE_ALL = JSON.stringify(
  {
    version: '2026.11.27-admin-v2',
    source: 'LingoRoad Admin CMS',
    units: [
      {
        code: 'a1-unit-99',
        cefrLevel: 'A1',
        orderIndex: 99,
        title: 'Giao tiếp nơi làm việc cơ bản',
        description: 'Chào hỏi đồng nghiệp, giới thiệu phòng ban và lịch họp đơn giản.',
      },
    ],
    lessons: [
      {
        code: 'grammar-a1-office-greetings',
        kind: 'GRAMMAR',
        title: 'Động từ To Be tại văn phòng',
        description: 'Thực hành am / is / are khi giới thiệu vai trò công việc.',
        estimatedMinutes: 5,
        published: true,
        unitCode: 'a1-unit-99',
        content: {
          steps: [
            {
              id: 'step-1',
              title: 'Cấu trúc cơ bản',
              body: 'Dùng "am" với I, "is" với he/she/it và danh từ số ít, "are" với we/you/they.',
            },
          ],
          questions: [
            {
              id: 'q-1',
              type: 'MULTIPLE_CHOICE',
              prompt: 'Lan ___ the new marketing coordinator.',
              options: [
                { id: 'A', text: 'am' },
                { id: 'B', text: 'is' },
                { id: 'C', text: 'are' },
                { id: 'D', text: 'be' },
              ],
              correctOptionId: 'B',
              explanation: 'Chủ ngữ số ít "Lan" đi với động từ to be "is".',
            },
            {
              id: 'q-2',
              type: 'MULTIPLE_CHOICE',
              prompt: 'We ___ ready for the Monday meeting.',
              options: [
                { id: 'A', text: 'is' },
                { id: 'B', text: 'am' },
                { id: 'C', text: 'are' },
                { id: 'D', text: 'being' },
              ],
              correctOptionId: 'C',
              explanation: 'Chủ ngữ số nhiều "We" đi với "are".',
            },
            {
              id: 'q-3',
              type: 'MULTIPLE_CHOICE',
              prompt: 'I ___ responsible for updating the daily report.',
              options: [
                { id: 'A', text: 'am' },
                { id: 'B', text: 'is' },
                { id: 'C', text: 'are' },
                { id: 'D', text: 'were' },
              ],
              correctOptionId: 'A',
              explanation: 'Ngôi thứ nhất số ít "I" đi với "am".',
            },
          ],
        },
      },
    ],
    items: [
      {
        externalId: 'cms-demo-reading-a1-01',
        skill: 'READING',
        cefrLevel: 'A1',
        skillCode: 'reading.scanning',
        type: 'MULTIPLE_CHOICE',
        usageScope: 'ALL',
        passage:
          'Welcome to Room 204. The weekly team briefing starts at 9:30 AM every Tuesday.',
        prompt: 'What time does the weekly team briefing start?',
        options: ['8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM'],
        correctOption: '9:30 AM',
        explanation: 'Thông báo ghi buổi họp tuần bắt đầu lúc 9:30 AM mỗi thứ Ba.',
      },
    ],
    topics: [
      {
        slug: 'office-basics',
        titleEn: 'Office Basics',
        titleVi: 'Công sở cơ bản',
        description: 'Từ vựng giao tiếp hằng ngày tại môi trường văn phòng.',
        icon: 'briefcase',
        displayOrder: 20,
        words: [
          {
            word: 'colleague',
            phonetic: '/ˈkɒliːɡ/',
            partOfSpeech: 'Danh từ',
            meaningVi: 'Đồng nghiệp',
            exampleEn: 'My colleagues are very supportive.',
            exampleVi: 'Các đồng nghiệp của tôi rất nhiệt tình hỗ trợ.',
          },
          {
            word: 'schedule',
            phonetic: '/ˈʃedjuːl/',
            partOfSpeech: 'Danh từ',
            meaningVi: 'Lịch trình, thời khóa biểu',
            exampleEn: 'Let me check my schedule for tomorrow.',
            exampleVi: 'Để tôi kiểm tra lịch trình cho ngày mai.',
          },
        ],
      },
    ],
    speakingPrompts: [
      {
        code: 'read-aloud-office-intro',
        mode: 'READ_ALOUD',
        title: 'Giới thiệu bản thân nơi làm việc',
        text: 'Good morning everyone. I am excited to join the product team this week.',
        difficulty: 1,
        maxDurationSeconds: 30,
        published: true,
      },
    ],
  },
  null,
  2,
);

const SAMPLE_ITEMS_ONLY = JSON.stringify(
  [
    {
      externalId: 'cms-item-b1-01',
      skill: 'READING',
      cefrLevel: 'B1',
      skillCode: 'reading.main_idea',
      passage:
        'Remote work gives employees greater flexibility, though teams still need clear communication habits to stay aligned.',
      prompt: 'What is required for remote teams to stay aligned?',
      options: [
        'Longer office hours',
        'Clear communication habits',
        'Daily travel',
        'Weekly paper reports',
      ],
      correctOption: 'Clear communication habits',
      explanation:
        'Đoạn văn nêu rõ các nhóm làm việc từ xa vẫn cần thói quen giao tiếp rõ ràng để giữ đồng bộ.',
    },
  ],
  null,
  2,
);

const SAMPLE_TOPICS_ONLY = JSON.stringify(
  [
    {
      topic: {
        slug: 'technology-work',
        titleEn: 'Technology & Work',
        titleVi: 'Công nghệ & Công việc',
        description: 'Từ vựng cốt lõi về phần mềm, hệ thống và hợp tác trực tuyến.',
        icon: 'laptop',
        displayOrder: 21,
      },
      words: [
        {
          word: 'deploy',
          phonetic: '/dɪˈplɔɪ/',
          partOfSpeech: 'Động từ',
          meaningVi: 'Triển khai (hệ thống, ứng dụng)',
          exampleEn: 'We will deploy the new update tonight.',
          exampleVi: 'Chúng tôi sẽ triển khai bản cập nhật mới vào tối nay.',
        },
      ],
    },
  ],
  null,
  2,
);

const ENTITY_LABELS: Record<ImportPreviewRecord['entity'], string> = {
  unit: 'Chương học',
  lesson: 'Bài học',
  item: 'Câu hỏi Item',
  topic: 'Chủ đề từ vựng',
  speakingPrompt: 'Đề luyện nói',
  grammarTopic: 'Ngữ pháp DAG',
  assessmentGroup: 'Nhóm đề',
};

const EXPORT_ENTITIES: Array<{ entity: AdminExportEntity; label: string }> = [
  { entity: 'units', label: 'Chương học (Units)' },
  { entity: 'lessons', label: 'Bài học (Lessons)' },
  { entity: 'items', label: 'Ngân hàng đề (Items)' },
  { entity: 'topics', label: 'Từ vựng (Topics & Words)' },
  { entity: 'speaking', label: 'Đề luyện nói (Speaking)' },
  { entity: 'grammar', label: 'Ngữ pháp (Grammar DAG)' },
  { entity: 'users', label: 'Người dùng (Users)' },
  { entity: 'audit-logs', label: 'Nhật ký hệ thống (Audit Logs)' },
];

const STEP_LABELS: Array<{ step: ImportStep; label: string }> = [
  { step: 1, label: 'Validate' },
  { step: 2, label: 'Preview' },
  { step: 3, label: 'Confirm' },
  { step: 4, label: 'Apply' },
];

export default function AdminImportPage(): React.ReactElement {
  const revision = useRef(0);
  const validatedJson = useRef<string | null>(null);
  const applyInFlight = useRef(false);
  const [step, setStep] = useState<ImportStep>(1);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [rawJson, setRawJson] = useState<string>(SAMPLE_BUNDLE_ALL);
  const [topicWordsMode, setTopicWordsMode] = useState<'merge' | 'replace'>('merge');
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
    validatedJson.current = null;
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
    validatedJson.current = null;
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
      setValidationResult(null);
      setStep(1);
      setSyntaxError(
        err instanceof Error
          ? `Lỗi cú pháp JSON: ${err.message}`
          : 'Không thể phân tích chuỗi JSON.',
      );
      return;
    }

    setValidating(true);
    try {
      const result = await validateAdminImport(parsed, topicWordsMode);
      if (requestRevision !== revision.current) return;
      validatedJson.current = result.isValid ? rawJson : null;
      setParsedBundle(parsed);
      setValidationResult(result);
      setStep(result.isValid ? 2 : 1);
    } catch (err) {
      if (requestRevision !== revision.current) return;
      setValidationResult(null);
      setStep(1);
      setSyntaxError(
        err instanceof Error
          ? err.message
          : 'Không thể kiểm tra gói JSON với máy chủ.',
      );
    } finally {
      if (requestRevision === revision.current) setValidating(false);
    }
  };

  const handleApply = async (): Promise<void> => {
    if (
      !parsedBundle ||
      !validationResult?.isValid ||
      !confirmedAtomic ||
      validatedJson.current !== rawJson ||
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
    } catch (err) {
      setApplyError(
        err instanceof Error
          ? err.message
          : 'Áp dụng gói JSON thất bại. Toàn bộ giao dịch đã được hoàn tác.',
      );
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
    } catch (err) {
      setSyntaxError(err instanceof Error ? err.message : 'Xuất dữ liệu thất bại.');
    } finally {
      setExportingKey(null);
    }
  };

  return (
    <AdminShell
      breadcrumbTitle="Import & Export"
      title="Content Import & Backup Export"
      subtitle="Nạp dữ liệu JSON nguyên tử (Units, Lessons, Items, Topics, Speaking, Grammar, Groups) và sao lưu JSON/CSV an toàn."
    >
      {() => (
        <div className="space-y-6">
          {/* Thanh 4 bước */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STEP_LABELS.map((item) => {
              const isCurrent = step === item.step;
              const isCompleted = step > item.step;
              return (
                <div
                  key={item.step}
                  className={
                    isCurrent
                      ? 'flex items-center gap-3 rounded-2xl border border-brand-200 bg-brand-25 px-4 py-3.5 shadow-sm'
                      : isCompleted
                        ? 'flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3.5'
                        : 'flex items-center gap-3 rounded-2xl border border-slateDark-100 bg-white px-4 py-3.5 opacity-75'
                  }
                >
                  <span
                    className={
                      isCurrent || isCompleted
                        ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white'
                        : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slateDark-100 text-xs font-bold text-slateDark-700'
                    }
                  >
                    {item.step}
                  </span>
                  <span
                    className={
                      isCurrent || isCompleted
                        ? 'text-sm font-bold text-slateDark-900'
                        : 'text-sm font-medium text-slateDark-700'
                    }
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Khối nhập JSON */}
          <div className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slateDark-900">
                  Content bundle JSON
                </h2>
                <p className="mt-0.5 text-xs text-slateDark-700">
                  Mọi thay đổi nội dung đều yêu cầu Validate lại trước khi nạp vào
                  cơ sở dữ liệu.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleLoadSample(SAMPLE_BUNDLE_ALL)}
                  disabled={applying}
                  className="rounded-xl border border-brand-200 bg-brand-25 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-50"
                >
                  Mẫu Bundle tổng hợp
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample(SAMPLE_ITEMS_ONLY)}
                  disabled={applying}
                  className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50"
                >
                  Mẫu Items
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample(SAMPLE_TOPICS_ONLY)}
                  disabled={applying}
                  className="rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-800 hover:bg-slateDark-50"
                >
                  Mẫu Từ vựng chủ đề
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slateDark-300 bg-slateDark-25 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slateDark-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slateDark-900 shadow-sm hover:bg-slateDark-50">
                  <FileUp className="h-3.5 w-3.5 text-brand-700" />
                  <span>Chọn tệp</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    disabled={applying}
                    onChange={(e) => void handleFileChange(e)}
                    className="hidden"
                  />
                </label>
                <span className="text-xs font-medium text-slateDark-800">
                  {selectedFileName
                    ? `Đã nạp tệp: ${selectedFileName}`
                    : 'Không có tệp nào được chọn'}
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-slateDark-800">
                  Chế độ từ vựng chủ đề:
                </span>
                <select
                  value={topicWordsMode}
                  onChange={(e) =>
                    setTopicWordsMode(e.target.value as 'merge' | 'replace')
                  }
                  className="rounded-lg border border-slateDark-200 bg-white px-2.5 py-1 text-xs font-semibold text-slateDark-900"
                >
                  <option value="merge">Merge (chỉ thêm từ mới, giữ từ cũ)</option>
                  <option value="replace">Replace (thay thế toàn bộ từ của chủ đề)</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <textarea
                rows={16}
                value={rawJson}
                disabled={applying}
                onChange={(e) => {
                  setRawJson(e.target.value);
                  resetProgress();
                }}
                spellCheck={false}
                aria-label="Nội dung JSON import"
                className="w-full rounded-lg border-[1.5px] border-slateDark-800 bg-[#141A23] p-4 font-mono text-xs leading-relaxed text-emerald-100 focus:border-brand-500 focus:outline-none"
              />
            </div>

            {syntaxError && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{syntaxError}</span>
              </div>
            )}

            {validationResult && !validationResult.isValid && (
              <div className="mt-4 space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
                <p className="font-bold">
                  Phát hiện {validationResult.errors.length} lỗi cần chỉnh sửa:
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {validationResult.errors.map((err, idx) => (
                    <li key={`${err.path}-${idx}`}>
                      <code className="font-semibold">{err.path}</code>:{' '}
                      {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slateDark-700">
                Hỗ trợ{' '}
                <code>
                  {
                    '{ units, lessons, items, topics, speakingPrompts, grammarTopics, assessmentGroups }'
                  }
                </code>
                .
              </p>

              <button
                type="button"
                disabled={applying || validating || !rawJson.trim()}
                onClick={() => void handleValidate()}
                className="btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {validating
                    ? 'Đang kiểm tra...'
                    : '1. Kiểm tra gói JSON (Validate)'}
                </span>
              </button>
            </div>
          </div>

          {/* Bước 2 & 3: Preview & Confirm */}
          {validationResult?.isValid && step >= 2 && step < 4 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <LegacyStatCard
                  label="Chương học (Units)"
                  value={
                    validationResult.preview.counts.units.create +
                    validationResult.preview.counts.units.update
                  }
                  subtitle={`${validationResult.preview.counts.units.create} tạo mới · ${validationResult.preview.counts.units.update} cập nhật`}
                  icon={<Layers className="h-4 w-4" />}
                  tone="green"
                />
                <LegacyStatCard
                  label="Bài học (Lessons)"
                  value={
                    validationResult.preview.counts.lessons.create +
                    validationResult.preview.counts.lessons.update
                  }
                  subtitle={`${validationResult.preview.counts.lessons.create} tạo mới · ${validationResult.preview.counts.lessons.update} cập nhật`}
                  icon={<BookOpen className="h-4 w-4" />}
                  tone="emerald"
                />
                <LegacyStatCard
                  label="Câu hỏi (Items)"
                  value={
                    validationResult.preview.counts.items.create +
                    validationResult.preview.counts.items.update
                  }
                  subtitle={`${validationResult.preview.counts.items.create} tạo mới · ${validationResult.preview.counts.items.update} cập nhật`}
                  icon={<ClipboardList className="h-4 w-4" />}
                  tone="amber"
                />
                <LegacyStatCard
                  label="Từ vựng & Mở rộng"
                  value={
                    validationResult.preview.counts.topics.create +
                    validationResult.preview.counts.topics.update +
                    (validationResult.preview.counts.speakingPrompts?.create ?? 0) +
                    (validationResult.preview.counts.speakingPrompts?.update ?? 0) +
                    (validationResult.preview.counts.grammarTopics?.create ?? 0) +
                    (validationResult.preview.counts.grammarTopics?.update ?? 0) +
                    (validationResult.preview.counts.assessmentGroups?.create ?? 0) +
                    (validationResult.preview.counts.assessmentGroups?.update ?? 0)
                  }
                  subtitle="Topics, Speaking, Grammar, Groups"
                  icon={<Tags className="h-4 w-4" />}
                  tone="slate"
                />
              </div>

              <div className="overflow-hidden rounded-2xl border border-slateDark-100 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slateDark-100 px-6 py-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slateDark-900">
                      Bước 2. Xem trước thay đổi ({validationResult.preview.totalRecords} bản ghi hợp lệ)
                    </h3>
                    <p className="text-xs text-slateDark-700">
                      Kiểm tra danh sách bản ghi sẽ được tạo mới hoặc cập nhật trước khi xác nhận.
                    </p>
                  </div>
                  {step === 2 && (
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="btn-primary rounded-xl px-4 py-2 text-xs font-semibold"
                    >
                      Tiếp tục bước Xác nhận
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slateDark-100 bg-slateDark-25 text-[11px] font-bold uppercase tracking-wider text-slateDark-700">
                      <tr>
                        <th className="px-6 py-3">Loại dữ liệu</th>
                        <th className="px-4 py-3">Mã định danh</th>
                        <th className="px-4 py-3">Tên / Nội dung</th>
                        <th className="px-6 py-3 text-right">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slateDark-100">
                      {validationResult.preview.records.map((rec, idx) => (
                        <tr key={`${rec.entity}-${rec.identifier}-${idx}`}>
                          <td className="px-6 py-3 font-semibold text-slateDark-900">
                            {ENTITY_LABELS[rec.entity]}
                          </td>
                          <td className="px-4 py-3 font-mono text-brand-700">
                            {rec.identifier}
                          </td>
                          <td className="px-4 py-3 text-slateDark-800">
                            {rec.title}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span
                              className={
                                rec.operation === 'CREATE'
                                  ? 'rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700'
                                  : 'rounded-full bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-800'
                              }
                            >
                              {rec.operation === 'CREATE'
                                ? 'Tạo mới'
                                : 'Cập nhật'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {step === 3 && (
                <div className="space-y-4 rounded-2xl border border-brand-200 bg-white p-6 shadow-sm">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                    <div>
                      <h3 className="text-sm font-extrabold text-slateDark-900">
                        Bước 3. Xác nhận nạp dữ liệu nguyên tử (Atomic Apply)
                      </h3>
                      <p className="mt-1 text-xs text-slateDark-800">
                        Toàn bộ {validationResult.preview.totalRecords} bản ghi
                        sẽ được ghi trong một Prisma Transaction duy nhất.
                      </p>
                    </div>
                  </div>

                  {applyError && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">
                      {applyError}
                    </div>
                  )}

                  <label className="flex cursor-pointer items-center gap-2.5 text-xs font-semibold text-slateDark-900">
                    <input
                      type="checkbox"
                      checked={confirmedAtomic}
                      onChange={(e) => setConfirmedAtomic(e.target.checked)}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span>
                      Tôi đã kiểm tra danh sách xem trước và xác nhận nạp dữ
                      liệu vào hệ thống.
                    </span>
                  </label>

                  <div className="flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="rounded-xl border border-slateDark-200 px-4 py-2 text-xs font-semibold text-slateDark-900"
                    >
                      Quay lại Preview
                    </button>
                    <button
                      type="button"
                      disabled={!confirmedAtomic || applying}
                      onClick={() => void handleApply()}
                      className="btn-primary rounded-xl px-5 py-2.5 text-xs font-semibold shadow-sm disabled:opacity-50"
                    >
                      {applying
                        ? 'Đang ghi dữ liệu...'
                        : '4. Áp dụng vào hệ thống (Apply)'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bước 4: Hoàn tất */}
          {step === 4 && applyResult && (
            <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />
                <div>
                  <h3 className="text-base font-extrabold text-emerald-950">
                    Import thành công {applyResult.preview.totalRecords} bản ghi!
                  </h3>
                  <p className="mt-1 text-xs text-emerald-900">
                    Dữ liệu đã được lưu an toàn vào PostgreSQL và tự động đồng
                    bộ cache cho ứng dụng di động.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                <Link
                  href="/admin/lessons"
                  className="btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>Xem danh sách Bài học</span>
                </Link>
                <Link
                  href="/admin/items"
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  <span>Xem Item Bank</span>
                </Link>
                <button
                  type="button"
                  onClick={resetProgress}
                  className="inline-flex items-center gap-2 rounded-xl border border-slateDark-200 bg-white px-4 py-2 text-xs font-semibold text-slateDark-900 hover:bg-slateDark-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Import gói khác</span>
                </button>
              </div>
            </div>
          )}

          {/* Khối Sao lưu & Export Dữ liệu an toàn (P2.2) */}
          <div className="rounded-2xl border border-slateDark-100 bg-white p-6 shadow-sm">
            <h2 className="text-base font-extrabold text-slateDark-900">
              Xuất dữ liệu & Sao lưu (Export JSON / CSV)
            </h2>
            <p className="mt-0.5 text-xs text-slateDark-700">
              JSON giữ nguyên định dạng tương thích Import; CSV có UTF-8 BOM và tự
              động chống OWASP CSV/Formula Injection.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {EXPORT_ENTITIES.map(({ entity, label }) => (
                <div
                  key={entity}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5"
                >
                  <p className="text-xs font-bold text-slateDark-900">{label}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={exportingKey === `${entity}-json`}
                      onClick={() => void handleExport(entity, 'json')}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slateDark-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slateDark-900 hover:bg-slateDark-50 disabled:opacity-50"
                    >
                      <Download className="h-3 w-3" />
                      <span>JSON</span>
                    </button>
                    <button
                      type="button"
                      disabled={exportingKey === `${entity}-csv`}
                      onClick={() => void handleExport(entity, 'csv')}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1.5 text-[11px] font-semibold text-brand-800 hover:bg-brand-50 disabled:opacity-50"
                    >
                      <Download className="h-3 w-3" />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
