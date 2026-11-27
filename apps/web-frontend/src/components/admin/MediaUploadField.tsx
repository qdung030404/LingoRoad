'use client';

import React, { useState } from 'react';
import { Image as ImageIcon, Loader2, Music, Upload, X } from 'lucide-react';
import {
  resolveAdminMediaUrl,
  uploadAdminAudio,
  uploadAdminImage,
} from '@/lib/admin-api';

interface MediaUploadFieldProps {
  kind: 'image' | 'audio';
  audioScope?: 'learning' | 'placement';
  slug?: string;
  slugHint?: string;
  label: string;
  value: string;
  placeholder?: string;
  helperText?: string;
  onChange: (url: string, meta?: { durationMs?: number }) => void;
  onAudioMetadata?: (meta: { url: string; durationMs: number }) => void;
}

export function MediaUploadField({
  kind,
  audioScope = 'learning',
  slug,
  slugHint,
  label,
  value,
  placeholder,
  helperText,
  onChange,
  onAudioMetadata,
}: MediaUploadFieldProps): React.ReactElement {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const effectiveSlug = slug ?? slugHint;

  const resolvedPreview = value.trim() ? resolveAdminMediaUrl(value) : '';

  const handleSelectFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      if (kind === 'image') {
        const res = await uploadAdminImage(file, effectiveSlug);
        onChange(res.url);
      } else {
        const res = await uploadAdminAudio(file, audioScope, effectiveSlug);
        onChange(res.url, { durationMs: res.durationMs });
        onAudioMetadata?.({ url: res.url, durationMs: res.durationMs });
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Tải tệp lên thất bại.',
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-slateDark-800">
          {label}
        </label>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-25 px-2.5 py-1 text-[11px] font-semibold text-brand-800 transition hover:bg-brand-50">
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          <span>
            {uploading
              ? 'Đang tải lên...'
              : kind === 'image'
                ? 'Tải ảnh lên'
                : 'Tải WAV lên'}
          </span>
          <input
            type="file"
            accept={
              kind === 'image'
                ? 'image/jpeg,image/png,image/webp'
                : '.wav,audio/wav,audio/x-wav'
            }
            disabled={uploading}
            onChange={(e) => void handleSelectFile(e)}
            className="hidden"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slateDark-500">
            {kind === 'image' ? (
              <ImageIcon className="h-4 w-4" />
            ) : (
              <Music className="h-4 w-4" />
            )}
          </span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={
              placeholder ??
              (kind === 'image'
                ? 'https://... hoặc /media/learning/v1/images/...'
                : audioScope === 'placement'
                  ? '/media/placement/listening-a1-01.wav'
                  : '/media/learning/v1/listening-sample.wav')
            }
            className="w-full rounded-xl border-[1.5px] border-slateDark-200 bg-slateDark-50 py-2 pl-9 pr-3 text-xs text-slateDark-900 focus:border-brand-500 focus:bg-white focus:outline-none"
          />
        </div>
        {value.trim() && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Xoá đường dẫn media"
            className="rounded-lg border border-slateDark-200 p-2 text-slateDark-600 hover:bg-slateDark-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {helperText && (
        <p className="text-[11px] text-slateDark-600">{helperText}</p>
      )}

      {uploadError && (
        <p className="text-[11px] font-medium text-red-600">{uploadError}</p>
      )}

      {resolvedPreview && kind === 'image' && (
        <div className="flex items-center gap-3 rounded-xl border border-slateDark-100 bg-slateDark-25 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvedPreview}
            alt="Xem trước ảnh"
            className="h-14 w-20 rounded-lg border border-slateDark-200 object-cover"
          />
          <span className="truncate font-mono text-[11px] text-slateDark-700">
            {value}
          </span>
        </div>
      )}

      {resolvedPreview && kind === 'audio' && (
        <div className="rounded-xl border border-slateDark-100 bg-slateDark-25 p-2.5">
          <audio controls src={resolvedPreview} className="h-9 w-full">
            Trình duyệt không hỗ trợ nghe thử audio.
          </audio>
        </div>
      )}
    </div>
  );
}
