import type {
  AdminGrammarTopic,
  AdminLessonItem,
  LearningQuestionInput,
  LearningStepInput,
  LearningUnitItem,
  ListeningSegmentInput,
} from '@/types/admin';

export interface LessonComposerModalProps {
  units: LearningUnitItem[];
  grammarTopics?: AdminGrammarTopic[];
  editingLesson?: AdminLessonItem | null;
  cloneFrom?: AdminLessonItem | null;
  onClose: () => void;
  onSaved: () => void;
  onUnitCreated: (unit: LearningUnitItem) => void;
}

export const MAX_LESSON_CODE_LENGTH = 100;

export function buildCloneLessonCode(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return '';
  const suffix = '-copy';
  return `${trimmed.slice(0, Math.max(1, MAX_LESSON_CODE_LENGTH - suffix.length))}${suffix}`;
}

export const DEFAULT_LISTENING_QUESTION_SKILLS = [
  'listening.gist',
  'listening.detail',
  'listening.specific_information',
  'listening.speaker_attitude',
  'listening.implied_meaning',
] as const;

export function orderEvidenceSegmentIds(
  ids: string[] | undefined,
  segments: ListeningSegmentInput[],
): string[] {
  if (!ids?.length) return [];
  const selected = new Set(ids.map((id) => id.trim()).filter(Boolean));
  return segments.map((seg) => seg.id).filter((id) => selected.has(id));
}

export function createEmptyQuestion(
  index: number,
  isListening = false,
  defaultSegmentId = 'seg-1',
): LearningQuestionInput {
  return {
    id: `q-${index + 1}`,
    type: 'MULTIPLE_CHOICE',
    prompt: '',
    options: [
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' },
    ],
    correctOptionId: 'A',
    explanation: '',
    ...(isListening
      ? {
          skillCode:
            DEFAULT_LISTENING_QUESTION_SKILLS[
              index % DEFAULT_LISTENING_QUESTION_SKILLS.length
            ],
          evidenceSegmentIds: [defaultSegmentId],
        }
      : { evidence: '' }),
  };
}

export function createDefaultSteps(): LearningStepInput[] {
  return [
    {
      id: 'step-1',
      title: 'Kiến thức trọng tâm',
      body: '',
    },
  ];
}

export function createDefaultListeningSegments(): ListeningSegmentInput[] {
  return [
    {
      id: 'seg-1',
      speaker: 'Speaker A',
      startMs: 0,
      endMs: 15000,
      text: '',
      translationVi: '',
      speakerAvatar: '',
    },
    {
      id: 'seg-2',
      speaker: 'Speaker B',
      startMs: 15000,
      endMs: 30000,
      text: '',
      translationVi: '',
      speakerAvatar: '',
    },
  ];
}

export const DEFAULT_JSON_TEMPLATE = JSON.stringify(
  {
    steps: [
      {
        id: 'step-1',
        title: 'Giới thiệu ngữ pháp',
        body: 'Ôn tập cách sử dụng thì hiện tại đơn cho thói quen hằng ngày.',
      },
    ],
    questions: [
      {
        id: 'q-1',
        type: 'MULTIPLE_CHOICE',
        prompt: 'She ___ to school by bus every morning.',
        options: [
          { id: 'A', text: 'go' },
          { id: 'B', text: 'goes' },
          { id: 'C', text: 'going' },
          { id: 'D', text: 'went' },
        ],
        correctOptionId: 'B',
        explanation:
          'Chủ ngữ ngôi thứ ba số ít "She" dùng động từ thêm "-es": goes.',
      },
      {
        id: 'q-2',
        type: 'MULTIPLE_CHOICE',
        prompt: 'They ___ coffee after dinner.',
        options: [
          { id: 'A', text: 'do not drink' },
          { id: 'B', text: 'does not drink' },
          { id: 'C', text: 'not drinks' },
          { id: 'D', text: 'is not drink' },
        ],
        correctOptionId: 'A',
        explanation:
          'Chủ ngữ số nhiều "They" phủ định với trợ động từ "do not".',
      },
      {
        id: 'q-3',
        type: 'MULTIPLE_CHOICE',
        prompt: '___ your brother play football on Sundays?',
        options: [
          { id: 'A', text: 'Do' },
          { id: 'B', text: 'Are' },
          { id: 'C', text: 'Does' },
          { id: 'D', text: 'Is' },
        ],
        correctOptionId: 'C',
        explanation:
          'Câu hỏi thì hiện tại đơn với chủ ngữ số ít dùng trợ động từ "Does".',
      },
    ],
  },
  null,
  2,
);
