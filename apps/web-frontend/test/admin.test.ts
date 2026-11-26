import { describe, test } from 'node:test';
import assert from 'node:assert';
import {
  buildLessonContentFromForm,
  computePaginationRange,
  parseLessonJsonDraft,
  validateLessonDraft,
  type LessonDraftInput,
} from '../src/lib/admin-validation';

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
});
