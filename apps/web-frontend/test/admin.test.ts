import { describe, test } from 'node:test';
import assert from 'node:assert';
import './admin-regressions.test';
import {
  buildLessonContentFromForm,
  computePaginationRange,
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

  test('validateLessonDraft checks unique READING evidence in passage', () => {
    const base = validDraft();
    const readingDraft: LessonDraftInput = {
      ...base,
      kind: 'READING',
      passage: 'Anna lives in Hanoi. She loves reading.',
      questions: base.questions.map((q, idx) =>
        idx === 0 ? { ...q, evidence: 'Anna lives in Hanoi.' } : q,
      ),
    };
    assert.strictEqual(validateLessonDraft(readingDraft), null);

    const invalidEvidence: LessonDraftInput = {
      ...readingDraft,
      questions: readingDraft.questions.map((q, idx) =>
        idx === 0 ? { ...q, evidence: 'not in passage' } : q,
      ),
    };
    assert.ok(validateLessonDraft(invalidEvidence)?.includes('Dẫn chứng'));
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
      process.env.NEXT_PUBLIC_API_URL = 'https://lingoroad-api-demo.azurewebsites.net/';
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

  test('validateLessonDraft & buildLessonContentFromForm validate Listening v1 drafts', () => {
    const base = validDraft();
    const listeningDraft: LessonDraftInput = {
      ...base,
      code: 'listening-a1-cafe',
      kind: 'LISTENING',
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
      })),
      transcriptSegments: [
        {
          id: 'seg-1',
          speaker: 'Waiter',
          startMs: 0,
          endMs: 20000,
          text: 'Hello, what would you like?',
          translationVi: 'Xin chào, bạn muốn gọi gì?',
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
        skillCode: 'listening.detail',
        evidenceSegmentIds: ['seg-1'],
      })),
    };

    assert.strictEqual(validateLessonDraft(listeningDraft), null);
    const built = buildLessonContentFromForm(listeningDraft);
    assert.strictEqual(built.listeningVersion, 1);
    assert.strictEqual(built.audioDurationMs, 42000);
    assert.ok(built.transcript?.includes('Waiter: Hello, what would you like?'));
    assert.strictEqual(built.transcriptSegments?.length, 2);

    const shortAudio = { ...listeningDraft, audioDurationMs: 12000 };
    assert.ok(validateLessonDraft(shortAudio)?.includes('30.000ms'));
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
