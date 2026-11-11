import { applySpeakingWeights, validReadAloudResult } from './speaking.service';
import { ReadAloudResult } from './speaking.dto';
describe('Azure read aloud contract', () => {
  const result = { transcript: 'Hello', accuracy: 90, fluency: 90, completeness: 100, pronunciation: 90,
    words: [{ word: 'Hello', accuracy: 90, errorType: 'None' }], durationSeconds: 1, provider: 'azure', adapterVersion: 'v1', feedbackVi: 'Đã đọc đủ.' };
  it('accepts actual 0–100 scores and omitted word with null accuracy', () => {
    expect(validReadAloudResult(result)).toBe(true);
    expect(validReadAloudResult({ ...result, words: [{ word: 'Hello', accuracy: null, errorType: 'Omission' }] })).toBe(true);
  });
  it('weights complete v2 scores while preserving original provider scores', () => {
    const original = { ...result, schemaVersion: 2, accuracy: 88, fluency: 77, prosody: 51.5,
      completeness: 100, pronunciation: 73.6 } as ReadAloudResult;
    const scored = applySpeakingWeights(original);
    expect(scored.overall).toBe(77.325);
    expect(scored.pronunciation).toBe(73.6);
    expect(scored.scoringPolicy!.weights).toEqual({ accuracy: 40, fluency: 25, prosody: 25, completeness: 10 });
    expect(original.overall).toBeUndefined();
    expect(applySpeakingWeights({ ...original, prosody: null }).overall).toBeNull();
    expect(applySpeakingWeights(result as ReadAloudResult)).toBe(result);
    for (const value of [0, 100]) {
      expect(applySpeakingWeights({ ...original, accuracy: value, fluency: value, prosody: value, completeness: value }).overall).toBe(value);
    }
    expect(applySpeakingWeights({ ...original, completeness: 0 }).overall).toBeCloseTo(67.325);
  });
  it('rejects missing, nonfinite, out-of-range scores and malformed words', () => {
    for (const accuracy of [undefined, null, NaN, Infinity, -1, 101]) expect(validReadAloudResult({ ...result, accuracy })).toBe(false);
    for (const words of [[], [null], [false], [{ word: 'Hello', accuracy: 50, errorType: 'Unknown' }]]) expect(validReadAloudResult({ ...result, words })).toBe(false);
    expect(validReadAloudResult({ ...result, durationSeconds: 31 })).toBe(false);
  });
  it('accepts exact v2 decimal scores and explicitly partial prosody', () => {
    const v2 = { ...result, schemaVersion: 2, assessmentProfile: 'read-aloud-v2', prosody: 40.125,
      assessmentCompleteness: 'full', pronunciation: 41.375, accuracy: 31.25, referenceText: 'Hello!', audioHash: 'a'.repeat(64),
      assessedAt: '2026-11-09T05:00:00Z', assessmentConfig: { locale: 'en-US', scenario: 'reading', gradingSystem: 'HundredMark', granularity: 'Phoneme',
        dimension: 'Comprehensive', enableMiscue: true, enableProsodyAssessment: true, breakConfidenceThreshold: .75, monotoneScope: 'utterance' }, words: [{ ...result.words[0],
        offsetMs: 1.25, durationMs: 20.75, phonemes: [{ phoneme: 'h', accuracy: 39.125, offsetMs: 1.25, durationMs: 10 }], syllables: [],
        prosody: { unexpectedBreakConfidence: .751, missingBreakConfidence: .75, monotone: true } }] };
    expect(validReadAloudResult(v2)).toBe(true);
    expect(v2.pronunciation).toBe(41.375);
    expect(validReadAloudResult({ ...v2, prosody: null, assessmentCompleteness: 'partial' })).toBe(true);
    for (const malformed of [
      { prosody: undefined }, { prosody: null }, { audioHash: 'wrong' }, { schemaVersion: 3 }, { schemaVersion: undefined },
      { assessmentConfig: { ...v2.assessmentConfig, enableMiscue: false } },
      { words: [{ ...v2.words[0], durationMs: 2000 }] },
      { words: [{ ...v2.words[0], prosody: { ...v2.words[0].prosody, unexpectedBreakConfidence: 1.1 } }] },
    ]) expect(validReadAloudResult({ ...v2, ...malformed })).toBe(false);
  });
});
