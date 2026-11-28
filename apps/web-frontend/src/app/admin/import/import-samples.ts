import type { AdminExportEntity, ImportPreviewRecord } from '@/types/admin';

export type ImportStep = 1 | 2 | 3 | 4;

export const SAMPLE_BUNDLE_ALL = JSON.stringify(
  {
    version: '2026.11.27-admin-v2',
    source: 'LingoRoad Admin CMS',
    units: [
      {
        code: 'a1-unit-99',
        cefrLevel: 'A1',
        orderIndex: 99,
        title: 'Giao tiếp nơi làm việc cơ bản',
        description:
          'Chào hỏi đồng nghiệp, giới thiệu phòng ban và lịch họp đơn giản.',
      },
    ],
    lessons: [
      {
        code: 'grammar-a1-office-greetings',
        kind: 'GRAMMAR',
        title: 'Động từ To Be tại văn phòng',
        description:
          'Thực hành am / is / are khi giới thiệu vai trò công việc.',
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
        explanation:
          'Thông báo ghi buổi họp tuần bắt đầu lúc 9:30 AM mỗi thứ Ba.',
      },
    ],
    topics: [
      {
        slug: 'office-basics',
        titleEn: 'Office Basics',
        titleVi: 'Công sở cơ bản',
        description:
          'Từ vựng giao tiếp hằng ngày tại môi trường văn phòng.',
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
    grammarTopics: [
      {
        code: 'grammar.office_basics',
        cefrLevel: 'A1',
        isLeaf: false,
        titleEn: 'Office Grammar Basics',
        titleVi: 'Ngữ pháp công sở cơ bản',
        summaryVi:
          'Nhóm chủ điểm ngữ pháp nền tảng trong giao tiếp văn phòng.',
        orderIndex: 1,
        published: true,
        formulas: [],
        usageNotes: [],
        examples: [],
      },
      {
        code: 'grammar.office_basics.to_be_roles',
        parentCode: 'grammar.office_basics',
        cefrLevel: 'A1',
        isLeaf: true,
        titleEn: 'Verb To Be for Roles',
        titleVi: 'Động từ To Be giới thiệu vai trò',
        summaryVi: 'Dùng am / is / are để giới thiệu chức danh và phòng ban.',
        orderIndex: 2,
        published: true,
        formulas: [
          {
            form: 'AFFIRMATIVE',
            labelVi: 'Khẳng định',
            structure: 'S + am / is / are + N / Adj',
          },
        ],
        usageNotes: [
          {
            useCaseVi:
              'Giới thiệu nghề nghiệp, vai trò và trạng thái tại văn phòng.',
            signalWords: ['am', 'is', 'are'],
          },
        ],
        examples: [
          {
            sentenceEn: 'Lan is the new marketing coordinator.',
            translationVi: 'Lan là điều phối viên marketing mới.',
            highlight: 'is',
          },
        ],
      },
    ],
    assessmentGroups: [
      {
        id: '11111111-1111-4111-8111-111111111101',
        skill: 'READING',
        cefrLevel: 'A1',
        partNumber: 1,
        usageScope: 'MOCK_EXAM',
        title: 'Reading Part 1 — Thông báo nội bộ',
        passage:
          'Welcome to Room 204. The weekly team briefing starts at 9:30 AM every Tuesday.',
      },
    ],
  },
  null,
  2,
);

export const SAMPLE_ITEMS_ONLY = JSON.stringify(
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

export const SAMPLE_TOPICS_ONLY = JSON.stringify(
  [
    {
      topic: {
        slug: 'technology-work',
        titleEn: 'Technology & Work',
        titleVi: 'Công nghệ & Công việc',
        description:
          'Từ vựng cốt lõi về phần mềm, hệ thống và hợp tác trực tuyến.',
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

export const ENTITY_LABELS: Record<ImportPreviewRecord['entity'], string> = {
  unit: 'Chương học',
  lesson: 'Bài học',
  item: 'Câu hỏi Item',
  topic: 'Chủ đề từ vựng',
  speakingPrompt: 'Đề luyện nói',
  grammarTopic: 'Ngữ pháp DAG',
  assessmentGroup: 'Nhóm đề',
};

export const EXPORT_ENTITIES: Array<{
  entity: AdminExportEntity;
  label: string;
}> = [
  { entity: 'units', label: 'Chương học (Units)' },
  { entity: 'lessons', label: 'Bài học (Lessons)' },
  { entity: 'items', label: 'Ngân hàng đề (Items)' },
  { entity: 'assessment-groups', label: 'Nhóm câu hỏi (Groups)' },
  { entity: 'topics', label: 'Từ vựng (Topics & Words)' },
  { entity: 'speaking', label: 'Đề luyện nói (Speaking)' },
  { entity: 'grammar', label: 'Ngữ pháp (Grammar DAG)' },
  { entity: 'users', label: 'Người dùng (Users)' },
  { entity: 'audit-logs', label: 'Nhật ký hệ thống (Audit Logs)' },
];

export const STEP_LABELS: Array<{ step: ImportStep; label: string }> = [
  { step: 1, label: 'Validate' },
  { step: 2, label: 'Preview' },
  { step: 3, label: 'Confirm' },
  { step: 4, label: 'Apply' },
];
