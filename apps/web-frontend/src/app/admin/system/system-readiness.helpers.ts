import type { ParsedMlSubsystemStatus } from '@/lib/admin-validation';
import type { SpeakingMode } from '@/types/admin';

export const CANONICAL_ML_SUBSYSTEMS: ReadonlyArray<{
  key: string;
  label: string;
  description: string;
  optional?: boolean;
}> = [
  {
    key: 'cat',
    label: 'CAT (Kiểm tra thích ứng)',
    description: 'Chọn câu hỏi IRT & ước lượng năng lực đầu vào',
  },
  {
    key: 'llm',
    label: 'LLM (Phản hồi AI)',
    description: 'Giải thích bài học, đánh giá viết và tư vấn học tập',
  },
  {
    key: 'rag',
    label: 'RAG (Truy xuất tri thức)',
    description: 'Chỉ mục vector học liệu tùy chọn cho gia sư AI',
    optional: true,
  },
  {
    key: 'speech',
    label: 'Speech (ASR cơ bản)',
    description: 'Nhận diện giọng nói và chấm đọc cơ bản (lazy-load)',
  },
  {
    key: 'speech_azure',
    label: 'Speech Azure',
    description: 'Chấm điểm phát âm Read Aloud / Tongue Twister',
  },
  {
    key: 'speech_topic',
    label: 'Speech Topic',
    description: 'Chấm phát âm nói tự do (Topic & Picture)',
  },
  {
    key: 'speaking_content',
    label: 'Speaking Content',
    description: 'Chấm nội dung từ vựng, ngữ pháp và bám sát đề',
  },
  {
    key: 'kt',
    label: 'Knowledge Tracing (KT)',
    description: 'Theo dõi mức độ nắm vững kỹ năng theo thời gian',
  },
];

export const SPEAKING_MODE_LABELS: Record<
  SpeakingMode,
  { label: string; description: string }
> = {
  READ_ALOUD: {
    label: 'Read Aloud (Đọc to)',
    description: 'Chấm phát âm theo văn bản mẫu',
  },
  TOPIC: {
    label: 'Topic Speaking (Chủ đề)',
    description: 'Nói tự do theo gợi ý & chấm nội dung AI',
  },
  PICTURE_DESCRIPTION: {
    label: 'Picture Description (Mô tả tranh)',
    description: 'Mô tả hình ảnh & chấm ngữ cảnh trực quan',
  },
  TONGUE_TWISTER: {
    label: 'Tongue Twister (Xoắn lưỡi)',
    description: 'Trò chơi luyện phát âm tính sao',
  },
};

export const ORPHAN_GRACE_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 24, label: 'Ân hạn 24 giờ (Khuyên dùng)' },
  { value: 72, label: 'Ân hạn 72 giờ (3 ngày)' },
  { value: 168, label: 'Ân hạn 168 giờ (7 ngày)' },
];

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function badgeClassForTone(tone: ParsedMlSubsystemStatus['tone']): string {
  switch (tone) {
    case 'ready':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'warn':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'error':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slateDark-50 text-slateDark-700 border-slateDark-200';
  }
}
