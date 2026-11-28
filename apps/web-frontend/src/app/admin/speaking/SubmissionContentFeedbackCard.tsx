'use client';

import React from 'react';
import { formatScore, type ParsedSubmissionContentFeedback } from './speaking-admin.helpers';

export function SubmissionContentFeedbackCard({
  content,
}: {
  content: ParsedSubmissionContentFeedback;
}): React.ReactElement {
  return (
    <div className="space-y-2 rounded-xl border border-slateDark-100 bg-slateDark-25 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase text-slateDark-700">
          Đánh giá nội dung (Content Feedback)
        </p>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
            content.status === 'succeeded'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-800'
          }`}
        >
          {content.status ?? 'unknown'}
          {content.errorCode ? ` · ${content.errorCode}` : ''}
        </span>
      </div>

      {(content.overall !== null ||
        content.vocabulary !== null ||
        content.grammar !== null ||
        content.topic !== null) && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Overall', v: content.overall },
            { label: 'Vocabulary', v: content.vocabulary },
            { label: 'Grammar', v: content.grammar },
            { label: 'Topic', v: content.topic },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-white p-2 text-center">
              <p className="text-[10px] text-slateDark-600">{item.label}</p>
              <p className="font-mono text-sm font-bold text-slateDark-900">
                {formatScore(item.v)}
              </p>
            </div>
          ))}
        </div>
      )}

      {content.strengths.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-emerald-800">Điểm mạnh:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-slateDark-800">
            {content.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {content.improvements.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-amber-900">Gợi ý cải thiện:</p>
          {content.improvements.map((imp, i) => (
            <div
              key={i}
              className="rounded-lg border border-slateDark-100 bg-white p-2.5 text-[11px]"
            >
              {imp.quote && (
                <p className="font-mono text-red-700">&ldquo;{imp.quote}&rdquo;</p>
              )}
              {imp.explanationVi && (
                <p className="mt-0.5 text-slateDark-800">{imp.explanationVi}</p>
              )}
              {imp.suggestion && (
                <p className="mt-0.5 font-semibold text-emerald-800">
                  Gợi ý: {imp.suggestion}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
