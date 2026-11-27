import { describe, test } from 'node:test';
import assert from 'node:assert';
import './admin-regressions.test';
import {
  GRAMMAR_CODE_REGEX,
  LISTENING_SKILL_CODES,
  READING_SKILL_CODES,
  SPEAKING_MAX_HINTS,
  buildLessonContentFromForm,
  computePaginationRange,
  isSafeImageUrl,
  maxSpeakingDurationForMode,
  mergeAssessmentRubricCriteria,
  normalizeGrammarTopicPayload,
  parseLessonJsonDraft,
  validateLessonDraft,
  type LessonDraftInput,
} from '../src/lib/admin-validation';
import {
  buildFrontendHealthPayload,
  resolveAdminMediaUrl,
  validateCloudApiBaseUrl,
} from '../src/lib/admin-api';

function validDraft(): LessonDraftInput {
  return {
    code: 'grammar-a1-present',
    kind: 'GRAMMAR',
    title: 'Thì Hiện tại đơn',
    description: 'Ôn luyện động từ ở hiện tại đơn',
    estimatedMinutes: 5,
    steps: [{ id: 'step-1', title: 'Công thức', body: 'S + V(s/es)' }],
    questions: [1, 2, 3].map((idx) => ({
      id: `q-${idx}`,
      type: 'MULTIPLE_CHOICE',
      prompt: `Question ${idx}`,
      options: [
        { id: 'A', text: 'Option A' },
        { id: 'B', text: 'Option B' },
        { id: 'C', text: 'Option C' },
        { id: 'D', text: 'Option D' },
      ],
      correctOptionId: 'A',
      explanation: 'Giải thích mẫu',
    })),
  };
}

function validListeningDraft(): LessonDraftInput {
  const skills = [
    'listening.gist',
    'listening.detail',
    'listening.specific_information',
    'listening.speaker_attitude',
    'listening.implied_meaning',
  ];
  return {
    ...validDraft(),
    code: 'listening-a1-cafe',
    kind: 'LISTENING',
    steps: [],
    audioUrl: '/media/learning/v1/cafe-order.wav',
    audioDurationMs: 42000,
    preparation: {
      situation: 'At a coffee shop',
      objective: 'Understand drink orders and prices',
    },
    keyVocabulary: [1, 2, 3].map((i) => ({
      id: `kv-${i}`,
      word: `word${i}`,
      meaning: `nghĩa ${i}`,
      imageUrl: `/media/learning/v1/images/vocab-${i}.png`,
    })),
    transcriptSegments: [
      {
        id: 'seg-1',
        speaker: 'Waiter',
        startMs: 0,
        endMs: 20000,
        text: 'Hello, what would you like?',
        translationVi: 'Xin chào, bạn muốn gọi gì?',
        speakerAvatar: '/media/learning/v1/images/waiter.png',
      },
      {
        id: 'seg-2',
        speaker: 'Guest',
        startMs: 20000,
        endMs: 42000,
        text: 'One iced coffee please.',
        translationVi: 'Cho tôi một cà phê đá.',
      },
    ],
    questions: [1, 2, 3, 4, 5].map((i) => ({
      id: `q-${i}`,
      type: 'MULTIPLE_CHOICE',
      prompt: `Listening Q${i}?`,
      options: [
        { id: 'A', text: 'Opt A' },
        { id: 'B', text: 'Opt B' },
        { id: 'C', text: 'Opt C' },
        { id: 'D', text: 'Opt D' },
      ],
      correctOptionId: 'A',
      explanation: 'Giải thích nghe hiểu',
      skillCode: skills[i - 1],
      evidenceSegmentIds: ['seg-1'],
    })),
  };
}

describe('Admin Lesson Validation & Helpers', () => {
  test('validateLessonDraft accepts valid lesson with 3 questions', () => {
    const draft = validDraft();
    assert.strictEqual(validateLessonDraft(draft), null);

    const built = buildLessonContentFromForm(draft);
    assert.strictEqual(built.steps.length, 1);
    assert.strictEqual(built.questions.length, 3);
  });

  test('validateLessonDraft rejects invalid slug or < 3 questions', () => {
    const badCode = { ...validDraft(), code: 'Invalid Code!' };
    assert.ok(validateLessonDraft(badCode)?.includes('Mã bài học'));

    const tooFew = { ...validDraft(), questions: validDraft().questions.slice(0, 2) };
    assert.ok(validateLessonDraft(tooFew)?.includes('3 đến 10'));
  });

  test('validateLessonDraft checks unique READING evidence and all 17 canonical READING_SKILL_CODES', () => {
    assert.strictEqual(READING_SKILL_CODES.length, 17);
    assert.strictEqual(LISTENING_SKILL_CODES.length, 12);

    const base = validDraft();
    for (const code of READING_SKILL_CODES) {
      const readingDraft: LessonDraftInput = {
        ...base,
        kind: 'READING',
        passage: 'Anna lives in Hanoi. She loves reading.',
        questions: base.questions.map((q, idx) =>
          idx === 0
            ? { ...q, skillCode: code, evidence: 'Anna lives in Hanoi.' }
            : { ...q, skillCode: code },
        ),
      };
      assert.strictEqual(validateLessonDraft(readingDraft), null);
    }

    const invalidSkill: LessonDraftInput = {
      ...base,
      kind: 'READING',
      passage: 'Anna lives in Hanoi.',
      questions: base.questions.map((q, idx) =>
        idx === 0 ? { ...q, skillCode: 'reading.gist' } : q,
      ),
    };
    assert.ok(validateLessonDraft(invalidSkill)?.includes('17 mã kỹ năng'));

    const invalidEvidence: LessonDraftInput = {
      ...base,
      kind: 'READING',
      passage: 'Anna lives in Hanoi.',
      questions: base.questions.map((q, idx) =>
        idx === 0 ? { ...q, evidence: 'not in passage' } : q,
      ),
    };
    assert.ok(validateLessonDraft(invalidEvidence)?.includes('Dẫn chứng'));
  });

  test('validateLessonDraft validates option images (all 4 valid & unique when used)', () => {
    const base = validDraft();
    const partialImages: LessonDraftInput = {
      ...base,
      questions: base.questions.map((q, idx) =>
        idx === 0
          ? {
              ...q,
              options: q.options.map((o, oIdx) =>
                oIdx === 0 ? { ...o, imageUrl: 'https://cdn.example.com/a.png' } : o,
              ),
            }
          : q,
      ),
    };
    assert.ok(validateLessonDraft(partialImages)?.includes('Ảnh phương án'));

    const duplicateImages: LessonDraftInput = {
      ...base,
      questions: base.questions.map((q, idx) =>
        idx === 0
          ? {
              ...q,
              options: q.options.map((o) => ({
                ...o,
                imageUrl: 'https://cdn.example.com/same.png',
              })),
            }
          : q,
      ),
    };
    assert.ok(validateLessonDraft(duplicateImages)?.includes('Ảnh phương án'));

    const validImages: LessonDraftInput = {
      ...base,
      questions: base.questions.map((q, idx) =>
        idx === 0
          ? {
              ...q,
              options: q.options.map((o) => ({
                ...o,
                imageUrl: `https://cdn.example.com/${o.id}.png`,
              })),
            }
          : q,
      ),
    };
    assert.strictEqual(validateLessonDraft(validImages), null);
  });

  test('parseLessonJsonDraft validates JSON syntax and question count', () => {
    const goodJson = JSON.stringify(buildLessonContentFromForm(validDraft()));
    const parsedGood = parseLessonJsonDraft(goodJson);
    assert.strictEqual(parsedGood.error, null);
    assert.ok(parsedGood.content);

    const badJson = parseLessonJsonDraft('{invalid');
    assert.strictEqual(badJson.content, null);
    assert.ok(badJson.error?.includes('Lỗi cú pháp JSON'));
  });

  test('computePaginationRange formats compact page tokens', () => {
    assert.deepStrictEqual(computePaginationRange(1, 0), []);
    assert.deepStrictEqual(computePaginationRange(1, 5), [1, 2, 3, 4, 5]);
    assert.deepStrictEqual(
      computePaginationRange(5, 10),
      [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10],
    );
  });

  test('validateCloudApiBaseUrl rejects empty, non-HTTPS, or localhost values and normalizes cloud HTTPS URL', () => {
    assert.throws(() => validateCloudApiBaseUrl(''), /không được để trống/);
    assert.throws(() => validateCloudApiBaseUrl('   '), /không được để trống/);
    assert.throws(
      () => validateCloudApiBaseUrl('http://localhost:3000'),
      /HTTPS/,
    );
    assert.throws(
      () => validateCloudApiBaseUrl('https://localhost:3000'),
      /localhost/,
    );
    assert.throws(
      () => validateCloudApiBaseUrl('https://127.0.0.1:3000'),
      /localhost/,
    );
    assert.throws(
      () => validateCloudApiBaseUrl('https://backend.local'),
      /localhost/,
    );
    assert.strictEqual(
      validateCloudApiBaseUrl('https://lingoroad-api-demo.azurewebsites.net///'),
      'https://lingoroad-api-demo.azurewebsites.net',
    );
  });

  test('resolveAdminMediaUrl resolves relative Listening media against configured API base URL', () => {
    const prev = process.env.NEXT_PUBLIC_API_URL;
    try {
      process.env.NEXT_PUBLIC_API_URL =
        'https://lingoroad-api-demo.azurewebsites.net/';
      assert.strictEqual(
        resolveAdminMediaUrl('/media/learning/v1/sample-a1.wav'),
        'https://lingoroad-api-demo.azurewebsites.net/media/learning/v1/sample-a1.wav',
      );
      assert.strictEqual(
        resolveAdminMediaUrl('https://cdn.example.com/audio.wav'),
        'https://cdn.example.com/audio.wav',
      );
    } finally {
      if (prev === undefined) {
        delete process.env.NEXT_PUBLIC_API_URL;
      } else {
        process.env.NEXT_PUBLIC_API_URL = prev;
      }
    }
  });

  test('validateLessonDraft & buildLessonContentFromForm normalize and validate Listening v1 drafts', () => {
    const listeningDraft = validListeningDraft();

    assert.strictEqual(validateLessonDraft(listeningDraft), null);

    // Out-of-order evidenceSegmentIds & empty strings & leftover passage/evidence/steps get normalized cleanly
    const built = buildLessonContentFromForm(
      {
        ...listeningDraft,
        passage: 'Leftover passage',
        coverImageUrl: '',
        steps: [{ id: 's1', title: 'Old step', body: 'Should be stripped' }],
        transcriptSegments: [
          {
            ...listeningDraft.transcriptSegments![0],
            speakerAvatar: '',
          },
          listeningDraft.transcriptSegments![1],
        ],
        questions: listeningDraft.questions.map((q, idx) =>
          idx === 0
            ? {
                ...q,
                evidence: 'Leftover evidence',
                evidenceSegmentIds: ['seg-2', 'seg-deleted', 'seg-1'],
                options: q.options.map((o) => ({ ...o, imageUrl: '' })),
              }
            : q,
        ),
      },
      {
        steps: [{ id: 'orig', title: 'Orig', body: 'Orig' }],
        questions: [],
        passage: 'Original passage',
        coverImageUrl: 'https://cdn.example.com/old-cover.png',
      },
    );

    assert.strictEqual(built.listeningVersion, 1);
    assert.strictEqual(built.audioDurationMs, 42000);
    assert.deepStrictEqual(built.steps, []);
    assert.strictEqual(built.passage, undefined);
    assert.strictEqual(built.coverImageUrl, undefined);
    assert.strictEqual(
      built.transcript,
      'Hello, what would you like? One iced coffee please.',
    );
    assert.ok(!built.transcript?.includes('Waiter:'));
    assert.strictEqual(built.transcriptSegments?.length, 2);
    assert.strictEqual('speakerAvatar' in built.transcriptSegments![0], false);
    assert.deepStrictEqual(built.questions[0].evidenceSegmentIds, ['seg-1', 'seg-2']);
    assert.strictEqual('evidence' in built.questions[0], false);
    assert.strictEqual('imageUrl' in built.questions[0].options[0], false);
  });

  test('validateLessonDraft rejects invalid Listening v1 drafts matching backend rules', () => {
    const base = validListeningDraft();

    assert.ok(
      validateLessonDraft({
        ...base,
        steps: [{ id: 'step-1', title: 'T', body: 'B' }],
      })?.includes('steps phải rỗng'),
    );
    assert.ok(
      validateLessonDraft({
        ...base,
        audioUrl: 'https://example.com/audio.mp3',
      })?.includes('/media/learning/v1/'),
    );
    assert.ok(
      validateLessonDraft({ ...base, audioDurationMs: 12000 })?.includes('30.000ms'),
    );
    assert.ok(
      validateLessonDraft({
        ...base,
        transcriptSegments: [
          base.transcriptSegments![0],
          { ...base.transcriptSegments![1], startMs: 15000, endMs: 40000 },
        ],
      })?.includes('chồng lấn'),
    );
    assert.ok(
      validateLessonDraft({
        ...base,
        transcriptSegments: [
          base.transcriptSegments![0],
          { ...base.transcriptSegments![1], endMs: 50000 },
        ],
      })?.includes('vượt quá tổng thời lượng'),
    );
    assert.ok(
      validateLessonDraft({
        ...base,
        transcriptSegments: [
          { ...base.transcriptSegments![0], speakerAvatar: 'http://insecure.com/a.png' },
          base.transcriptSegments![1],
        ],
      })?.includes('speakerAvatar'),
    );
    assert.ok(
      validateLessonDraft({
        ...base,
        keyVocabulary: [
          { id: 'kv-1', word: 'coffee', meaning: 'cà phê' },
          { id: 'kv-2', word: 'Coffee', meaning: 'Cà Phê' },
          { id: 'kv-3', word: 'tea', meaning: 'trà' },
        ],
      })?.includes('trùng lặp'),
    );
    assert.ok(
      validateLessonDraft({
        ...base,
        keyVocabulary: [
          { id: 'kv-1', word: 'a', meaning: 'một', imageUrl: 'javascript:alert(1)' },
          { id: 'kv-2', word: 'b', meaning: 'hai' },
          { id: 'kv-3', word: 'c', meaning: 'ba' },
        ],
      })?.includes('Ảnh minh họa'),
    );
    assert.ok(
      validateLessonDraft({
        ...base,
        questions: base.questions.map((q, idx) =>
          idx === 0 ? { ...q, type: 'GAP_FILL', prompt: 'Hello ___?' } : q,
        ),
      })?.includes('MULTIPLE_CHOICE'),
    );
    assert.ok(
      validateLessonDraft({
        ...base,
        questions: base.questions.map((q, idx) =>
          idx === 0
            ? {
                ...q,
                options: [
                  { id: 'A', text: 'Same' },
                  { id: 'B', text: 'same' },
                  { id: 'C', text: 'Other' },
                  { id: 'D', text: 'Another' },
                ],
              }
            : q,
        ),
      })?.includes('4 phương án trả lời khác nhau'),
    );
    assert.ok(
      validateLessonDraft({
        ...base,
        questions: base.questions.map((q) => ({
          ...q,
          skillCode: 'listening.detail',
        })),
      })?.includes('listening.gist'),
    );
    assert.ok(
      validateLessonDraft({
        ...base,
        questions: base.questions.map((q) => ({
          ...q,
          skillCode: 'listening.gist',
        })),
      })?.includes('nhóm chi tiết'),
    );
    assert.ok(
      validateLessonDraft({
        ...base,
        questions: base.questions.map((q, idx) =>
          idx === 0 ? { ...q, skillCode: 'listening.specific_info' } : q,
        ),
      })?.includes('skillCode hợp lệ'),
    );
  });

  test('buildLessonContentFromForm strips Listening fields on non-Listening and allows clearing coverImageUrl & keyVocabulary', () => {
    const listeningOriginal = buildLessonContentFromForm(validListeningDraft());
    const grammarBuilt = buildLessonContentFromForm(
      {
        ...validDraft(),
        kind: 'GRAMMAR',
        passage: 'Should be stripped on grammar',
        coverImageUrl: '',
        keyVocabulary: [],
        questions: validDraft().questions.map((q) => ({
          ...q,
          evidence: 'Should be stripped',
          evidenceSegmentIds: ['seg-1'],
        })),
      },
      {
        ...listeningOriginal,
        coverImageUrl: 'https://cdn.example.com/cover.png',
        passage: 'Old passage',
      },
    );

    assert.strictEqual('listeningVersion' in grammarBuilt, false);
    assert.strictEqual('audioDurationMs' in grammarBuilt, false);
    assert.strictEqual('preparation' in grammarBuilt, false);
    assert.strictEqual('transcriptSegments' in grammarBuilt, false);
    assert.strictEqual('audioUrl' in grammarBuilt, false);
    assert.strictEqual('transcript' in grammarBuilt, false);
    assert.strictEqual('passage' in grammarBuilt, false);
    assert.strictEqual('coverImageUrl' in grammarBuilt, false);
    assert.strictEqual('keyVocabulary' in grammarBuilt, false);
    assert.strictEqual('evidence' in grammarBuilt.questions[0], false);
    assert.strictEqual('evidenceSegmentIds' in grammarBuilt.questions[0], false);
  });

  test('normalizeGrammarTopicPayload & GRAMMAR_CODE_REGEX align with backend Grammar DTO', () => {
    assert.strictEqual(GRAMMAR_CODE_REGEX.test('grammar'), true);
    assert.strictEqual(
      GRAMMAR_CODE_REGEX.test('grammar.tenses.present_simple'),
      true,
    );
    assert.strictEqual(GRAMMAR_CODE_REGEX.test('grammar.tenses-1'), false);
    assert.strictEqual(GRAMMAR_CODE_REGEX.test('grammar.Tenses'), false);
    assert.strictEqual(GRAMMAR_CODE_REGEX.test('other.topic'), false);

    const groupResult = normalizeGrammarTopicPayload({
      isLeaf: false,
      formulas: [{ form: 'AFFIRMATIVE', labelVi: 'Ignored', structure: 'S + V' }],
    });
    assert.strictEqual(groupResult.error, null);
    assert.deepStrictEqual(groupResult.formulas, []);
    assert.deepStrictEqual(groupResult.usageNotes, []);
    assert.deepStrictEqual(groupResult.examples, []);

    const leafResult = normalizeGrammarTopicPayload({
      isLeaf: true,
      formulas: [
        {
          form: 'AFFIRMATIVE',
          labelVi: ' Khẳng định ',
          structure: ' S + V(s/es) + O ',
          noteVi: '  ',
        },
        {
          form: 'NEGATIVE',
          labelVi: 'Phủ định',
          structure: 'S + do/does not + V',
          noteVi: 'Động từ giữ nguyên mẫu',
        },
      ],
      usageNotes: [
        {
          useCaseVi: ' Diễn tả thói quen lặp lại ',
          signalWordsText: 'always, usually,  every day, ',
          commonMistakeVi: 'Quên thêm s/es cho ngôi thứ ba số ít',
        },
      ],
      examples: [
        {
          sentenceEn: 'She goes to work by bus.',
          translationVi: 'Cô ấy đi làm bằng xe buýt.',
          highlight: 'goes',
        },
      ],
    });
    assert.strictEqual(leafResult.error, null);
    assert.deepStrictEqual(leafResult.formulas, [
      { form: 'AFFIRMATIVE', labelVi: 'Khẳng định', structure: 'S + V(s/es) + O' },
      {
        form: 'NEGATIVE',
        labelVi: 'Phủ định',
        structure: 'S + do/does not + V',
        noteVi: 'Động từ giữ nguyên mẫu',
      },
    ]);
    assert.deepStrictEqual(leafResult.usageNotes, [
      {
        useCaseVi: 'Diễn tả thói quen lặp lại',
        signalWords: ['always', 'usually', 'every day'],
        commonMistakeVi: 'Quên thêm s/es cho ngôi thứ ba số ít',
      },
    ]);
    assert.deepStrictEqual(leafResult.examples, [
      {
        sentenceEn: 'She goes to work by bus.',
        translationVi: 'Cô ấy đi làm bằng xe buýt.',
        highlight: 'goes',
      },
    ]);

    const missingExample = normalizeGrammarTopicPayload({
      isLeaf: true,
      formulas: [{ form: 'NOTE', labelVi: 'Lưu ý', structure: 'S + V' }],
      usageNotes: [{ useCaseVi: 'Dùng hàng ngày' }],
      examples: [{ sentenceEn: '', translationVi: '' }],
    });
    assert.ok(missingExample.error?.includes('ví dụ'));

    const badForm = normalizeGrammarTopicPayload({
      isLeaf: true,
      formulas: [{ form: 'INVALID', labelVi: 'A', structure: 'B' }],
      usageNotes: [{ useCaseVi: 'C' }],
      examples: [{ sentenceEn: 'D', translationVi: 'E' }],
    });
    assert.ok(badForm.error?.includes('form'));
  });

  test('mergeAssessmentRubricCriteria preserves seeded Writing rubric keys & unknown keys and returns null when cleared', () => {
    const seededRubric = {
      taskAchievement: 'Viết đủ 3 ý chính.',
      coherenceCohesion: 'Dùng từ nối hợp lý.',
      lexicalResource: 'Từ vựng bậc B1.',
      grammarAccuracy: 'Dùng đúng thì quá khứ.',
      customAiWeight: 1.5,
    };

    const preserved = mergeAssessmentRubricCriteria(
      seededRubric,
      {
        targetGrammarsText: 'past simple, present perfect',
        wordCountMin: '100',
        wordCountMax: '150',
        timeLimitSeconds: '900',
        minSpeakingSeconds: '',
        maxSpeakingSeconds: '',
        taskAchievement: seededRubric.taskAchievement,
        coherenceCohesion: 'Cập nhật mạch lạc.',
        lexicalResource: seededRubric.lexicalResource,
        grammarAccuracy: seededRubric.grammarAccuracy,
      },
      'ESSAY',
    );

    assert.deepStrictEqual(preserved, {
      taskAchievement: 'Viết đủ 3 ý chính.',
      coherenceCohesion: 'Cập nhật mạch lạc.',
      lexicalResource: 'Từ vựng bậc B1.',
      grammarAccuracy: 'Dùng đúng thì quá khứ.',
      customAiWeight: 1.5,
      targetGrammars: ['past simple', 'present perfect'],
      wordCount: { min: 100, max: 150 },
      timeLimitSeconds: 900,
    });

    const cleared = mergeAssessmentRubricCriteria(
      {
        taskAchievement: 'Old',
        coherenceCohesion: 'Old',
        lexicalResource: 'Old',
        grammarAccuracy: 'Old',
        wordCount: { min: 80 },
      },
      {
        targetGrammarsText: '',
        wordCountMin: '',
        wordCountMax: '',
        timeLimitSeconds: '',
        minSpeakingSeconds: '',
        maxSpeakingSeconds: '',
        taskAchievement: '',
        coherenceCohesion: '',
        lexicalResource: '',
        grammarAccuracy: '',
      },
      'ESSAY',
    );
    assert.strictEqual(cleared, null);

    const speakingRubric = mergeAssessmentRubricCriteria(
      null,
      {
        targetGrammarsText: 'conditionals',
        wordCountMin: '',
        wordCountMax: '',
        timeLimitSeconds: '',
        minSpeakingSeconds: '20',
        maxSpeakingSeconds: '60',
      },
      'SPEAKING_PROMPT',
    );
    assert.deepStrictEqual(speakingRubric, {
      targetGrammars: ['conditionals'],
      minSpeakingSeconds: 20,
      maxSpeakingSeconds: 60,
    });

    assert.strictEqual(
      mergeAssessmentRubricCriteria(
        seededRubric,
        {
          targetGrammarsText: '',
          wordCountMin: '',
          wordCountMax: '',
          timeLimitSeconds: '',
          minSpeakingSeconds: '',
          maxSpeakingSeconds: '',
        },
        'MULTIPLE_CHOICE',
      ),
      null,
    );
  });

  test('speaking limits and isSafeImageUrl match backend ML/security constraints', () => {
    assert.strictEqual(SPEAKING_MAX_HINTS, 3);
    assert.strictEqual(maxSpeakingDurationForMode('READ_ALOUD'), 30);
    assert.strictEqual(maxSpeakingDurationForMode('TONGUE_TWISTER'), 30);
    assert.strictEqual(maxSpeakingDurationForMode('TOPIC'), 60);
    assert.strictEqual(maxSpeakingDurationForMode('PICTURE_DESCRIPTION'), 60);

    assert.strictEqual(isSafeImageUrl('/media/learning/v1/images/cafe-1.png'), true);
    assert.strictEqual(isSafeImageUrl('https://cdn.example.com/img.webp'), true);
    assert.strictEqual(isSafeImageUrl(''), false);
    assert.strictEqual(isSafeImageUrl('http://cdn.example.com/img.png'), false);
    assert.strictEqual(isSafeImageUrl('/media/learning/v1/images/../evil.png'), false);
  });

  test('buildFrontendHealthPayload returns public health status and running version', () => {
    const payload = buildFrontendHealthPayload({
      NODE_ENV: 'production',
      APP_VERSION: 'sha-7f8a9b0',
    });
    assert.strictEqual(payload.success, true);
    assert.strictEqual(payload.data.status, 'ok');
    assert.strictEqual(payload.data.service, 'web-frontend');
    assert.strictEqual(payload.data.version, 'sha-7f8a9b0');
    assert.ok(payload.data.timestamp.length > 0);
  });
});
