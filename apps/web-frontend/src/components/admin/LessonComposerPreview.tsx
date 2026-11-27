import React from 'react';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { resolveAdminMediaUrl } from '@/lib/admin-api';
import type {
  LearningContentPayload,
  LearningKind,
  ListeningSegmentInput,
} from '@/types/admin';

export interface LessonPreviewPaneProps {
  kind: LearningKind;
  title: string;
  description: string;
  estimatedMinutes: number;
  previewPayload: LearningContentPayload;
  previewAnswers: Record<string, string>;
  onResetAnswers: () => void;
  onSelectAnswer: (qKey: string, optionId: string) => void;
}

export function renderLessonPreviewPane({
  kind,
  title,
  description,
  estimatedMinutes,
  previewPayload,
  previewAnswers,
  onResetAnswers,
  onSelectAnswer,
}: LessonPreviewPaneProps): React.ReactElement {
  const previewQuestions = previewPayload.questions ?? [];
  const previewAnsweredCount = previewQuestions.reduce((count, q, idx) => {
    const qKey = `${idx}-${q.id}`;
    return previewAnswers[qKey] !== undefined ? count + 1 : count;
  }, 0);
  const previewCorrectCount = previewQuestions.reduce((count, q, idx) => {
    const qKey = `${idx}-${q.id}`;
    return previewAnswers[qKey] === q.correctOptionId ? count + 1 : count;
  }, 0);
  const previewRevealedSegmentIds = new Set<string>();
  previewQuestions.forEach((q, idx) => {
    const qKey = `${idx}-${q.id}`;
    if (previewAnswers[qKey] !== undefined && q.evidenceSegmentIds?.length) {
      q.evidenceSegmentIds.forEach((segId) => previewRevealedSegmentIds.add(segId));
    }
  });
  const previewSegmentsById = new Map<string, ListeningSegmentInput>(
    (previewPayload.transcriptSegments ?? []).map((seg) => [seg.id, seg]),
  );

  return (
    <div className="space-y-4 rounded-2xl border border-slateDark-100 bg-slateDark-25 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-bold text-brand-800">
            {kind}
          </span>
          <h3 className="mt-1 text-base font-extrabold text-slateDark-900">
            {title || '(Chưa có tiêu đề)'}
          </h3>
          <p className="text-xs text-slateDark-700">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slateDark-700 shadow-sm">
            {estimatedMinutes} phút · {previewPayload.questions.length} câu hỏi
          </span>
          <span className="rounded-full border border-brand-200 bg-brand-25 px-2.5 py-1 text-xs font-semibold text-brand-800">
            Đã thử: {previewAnsweredCount}/{previewPayload.questions.length}
            {previewAnsweredCount > 0
              ? ` · Đúng ${previewCorrectCount}/${previewAnsweredCount}`
              : ''}
          </span>
          <button
            type="button"
            disabled={previewAnsweredCount === 0}
            onClick={onResetAnswers}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slateDark-200 bg-white px-3 py-1.5 text-xs font-semibold text-slateDark-900 transition hover:bg-slateDark-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Làm lại preview</span>
          </button>
        </div>
      </div>

      {previewPayload.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveAdminMediaUrl(previewPayload.coverImageUrl)}
          alt={title}
          className="max-h-48 w-full rounded-xl object-cover"
        />
      )}

      {previewPayload.audioUrl && (
        <div className="space-y-1">
          <audio controls src={resolveAdminMediaUrl(previewPayload.audioUrl)} className="w-full" />
          {previewPayload.audioDurationMs !== undefined && (
            <p className="text-[11px] text-slateDark-600">
              Thời lượng: {(previewPayload.audioDurationMs / 1000).toFixed(1)}s (
              {previewPayload.audioDurationMs}ms)
            </p>
          )}
        </div>
      )}

      {previewPayload.preparation && (
        <div className="rounded-xl border border-brand-100 bg-brand-25/50 p-3.5 text-xs">
          <p className="font-bold uppercase tracking-wider text-brand-800">
            Bối cảnh chuẩn bị (Preparation)
          </p>
          <p className="mt-1 text-slateDark-800">
            <span className="font-semibold">Tình huống:</span> {previewPayload.preparation.situation}
          </p>
          <p className="mt-0.5 text-slateDark-800">
            <span className="font-semibold">Mục tiêu:</span> {previewPayload.preparation.objective}
          </p>
        </div>
      )}

      {previewPayload.keyVocabulary && previewPayload.keyVocabulary.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
            Từ vựng trọng tâm ({previewPayload.keyVocabulary.length})
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {previewPayload.keyVocabulary.map((vocab, idx) => (
              <div
                key={vocab.id || idx}
                className="flex gap-2.5 rounded-xl border border-slateDark-100 bg-white p-3"
              >
                {vocab.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveAdminMediaUrl(vocab.imageUrl)}
                    alt={vocab.word}
                    className="h-12 w-12 shrink-0 rounded-lg border border-slateDark-200 object-cover"
                  />
                )}
                <div className="min-w-0 text-xs">
                  <p className="font-bold text-slateDark-900">
                    {vocab.word}{' '}
                    {vocab.phonetic && (
                      <span className="font-normal text-slateDark-600">{vocab.phonetic}</span>
                    )}
                  </p>
                  <p className="text-slateDark-700">{vocab.meaning}</p>
                  {vocab.example && (
                    <p className="mt-0.5 text-[11px] italic text-slateDark-600">
                      {vocab.example}
                      {vocab.translation ? ` — ${vocab.translation}` : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {previewPayload.transcriptSegments && previewPayload.transcriptSegments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
            Transcript Segments ({previewPayload.transcriptSegments.length})
          </p>
          <div className="space-y-2">
            {previewPayload.transcriptSegments.map((seg, idx) => {
              const isEvidenceRevealed = previewRevealedSegmentIds.has(seg.id);
              return (
                <div
                  key={seg.id || idx}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs transition ${
                    isEvidenceRevealed
                      ? 'border-brand-300 bg-brand-25/70'
                      : 'border-slateDark-100 bg-white'
                  }`}
                >
                  {seg.speakerAvatar && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveAdminMediaUrl(seg.speakerAvatar)}
                      alt={seg.speaker}
                      className="h-9 w-9 shrink-0 rounded-full border border-slateDark-200 object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-brand-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-800">
                        {seg.id}
                      </span>
                      <span className="font-bold text-slateDark-900">{seg.speaker}</span>
                      <span className="font-mono text-[11px] text-slateDark-600">
                        {seg.startMs}–{seg.endMs} ms
                      </span>
                      {isEvidenceRevealed && (
                        <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          Dẫn chứng liên kết
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-slateDark-900">{seg.text}</p>
                    <p className="mt-0.5 text-[11px] text-slateDark-600">{seg.translationVi}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {previewPayload.passage && (
        <div className="whitespace-pre-wrap rounded-xl border border-slateDark-200 bg-white p-4 text-sm leading-relaxed text-slateDark-800">
          {previewPayload.passage}
        </div>
      )}

      {previewPayload.steps.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
            Các bước hướng dẫn ({previewPayload.steps.length})
          </p>
          {previewPayload.steps.map((s, idx) => (
            <div key={idx} className="space-y-1.5 rounded-xl border border-slateDark-100 bg-white p-3">
              <p className="text-xs font-bold text-slateDark-900">
                {idx + 1}. {s.title}
              </p>
              <p className="text-xs text-slateDark-700">{s.body}</p>
              {(s.word || s.meaning) && (
                <p className="text-[11px] text-slateDark-700">
                  <span className="font-semibold">{s.word}</span> {s.phonetic ? `(${s.phonetic})` : ''}{' '}
                  {s.meaning ? `— ${s.meaning}` : ''}
                </p>
              )}
              {s.audioUrl && (
                <audio controls src={resolveAdminMediaUrl(s.audioUrl)} className="h-8 w-full" />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slateDark-700">
            Câu hỏi luyện tập tương tác ({previewPayload.questions.length})
          </p>
          <p className="text-[11px] text-slateDark-600">
            Bấm vào phương án để kiểm tra đúng/sai, giải thích & dẫn chứng
          </p>
        </div>
        {previewPayload.questions.map((q, idx) => {
          const qKey = `${idx}-${q.id}`;
          const selectedOptionId = previewAnswers[qKey];
          const hasAnswered = selectedOptionId !== undefined;
          const isCorrectAnswer = hasAnswered && selectedOptionId === q.correctOptionId;

          return (
            <div key={qKey} className="rounded-xl border border-slateDark-100 bg-white p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slateDark-900">
                  Câu {idx + 1}: {q.prompt || '(Chưa nhập câu hỏi)'}
                </p>
                <div className="flex items-center gap-1.5">
                  {q.skillCode && (
                    <span className="rounded bg-slateDark-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slateDark-700">
                      {q.skillCode}
                    </span>
                  )}
                  {hasAnswered && (
                    <span
                      className={
                        isCorrectAnswer
                          ? 'inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700'
                          : 'inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700'
                      }
                    >
                      {isCorrectAnswer ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      <span>{isCorrectAnswer ? 'Đúng' : 'Sai'}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {q.options.map((opt) => {
                  const isSelected = selectedOptionId === opt.id;
                  const isCorrectOption = opt.id === q.correctOptionId;

                  let optionClass =
                    'border-slateDark-200 bg-slateDark-25 text-slateDark-800 hover:border-brand-400 hover:bg-brand-25/50';
                  if (hasAnswered) {
                    if (isCorrectOption) {
                      optionClass = 'border-emerald-400 bg-emerald-50 font-semibold text-emerald-900';
                    } else if (isSelected) {
                      optionClass = 'border-red-400 bg-red-50 font-semibold text-red-900';
                    } else {
                      optionClass = 'border-slateDark-100 bg-slateDark-25/60 text-slateDark-600';
                    }
                  }

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelectAnswer(qKey, opt.id)}
                      className={`space-y-1.5 rounded-lg border px-3 py-2 text-left text-xs transition ${optionClass}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span>
                          <strong>{opt.id}.</strong> {opt.text || '(Trống)'}
                        </span>
                        {hasAnswered && isCorrectOption && (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{isSelected ? 'Bạn chọn' : 'Đáp án đúng'}</span>
                          </span>
                        )}
                        {hasAnswered && isSelected && !isCorrectOption && (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-red-700">
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Bạn chọn</span>
                          </span>
                        )}
                      </div>
                      {opt.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveAdminMediaUrl(opt.imageUrl)}
                          alt={opt.text}
                          className="h-20 w-full rounded-md border border-slateDark-200 object-cover"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              {hasAnswered ? (
                <div
                  className={`mt-3 space-y-1.5 rounded-xl border p-3 text-[11px] ${
                    isCorrectAnswer
                      ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
                      : 'border-red-200 bg-red-50/70 text-red-950'
                  }`}
                >
                  <p className="font-bold">
                    {isCorrectAnswer
                      ? 'Chính xác! Bạn đã chọn đúng đáp án.'
                      : `Chưa chính xác. Đáp án đúng là phương án ${q.correctOptionId}.`}
                  </p>
                  <p className="text-slateDark-800">
                    <span className="font-semibold">Giải thích:</span>{' '}
                    {q.explanation || '(Chưa nhập giải thích)'}
                  </p>
                  {q.evidence && (
                    <p className="text-brand-800">
                      <span className="font-semibold">Dẫn chứng:</span> &ldquo;{q.evidence}&rdquo;
                    </p>
                  )}
                  {q.evidenceSegmentIds && q.evidenceSegmentIds.length > 0 && (
                    <div className="space-y-1 pt-0.5">
                      <p className="font-mono font-semibold text-brand-800">
                        Đoạn dẫn chứng: {q.evidenceSegmentIds.join(', ')}
                      </p>
                      {q.evidenceSegmentIds.map((segId) => {
                        const seg = previewSegmentsById.get(segId);
                        if (!seg) return null;
                        return (
                          <div
                            key={segId}
                            className="rounded-lg border border-brand-100 bg-white/80 px-2.5 py-1.5 text-[11px] text-slateDark-800"
                          >
                            <span className="font-mono font-bold text-brand-700">[{seg.id}]</span>{' '}
                            <span className="font-semibold">{seg.speaker}:</span> {seg.text}
                            {seg.translationVi && (
                              <span className="block text-[10px] text-slateDark-600">
                                {seg.translationVi}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2.5 text-[11px] text-slateDark-600">
                  Chọn một phương án để kiểm tra đáp án và mở giải thích / dẫn chứng.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
