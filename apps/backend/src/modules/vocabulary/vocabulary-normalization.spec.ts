import { normalizeVocabularyAnswer } from './vocabulary.types';
describe('vocabulary normalization v1', () => {
  it.each([
    ['  APPLE ', 'apple', true], ['ａｐｐｌｅ', 'apple', true], ['don’t', "don't", true],
    ['ice\t cream', 'ice cream', true], ['cafe\u0301', 'café', true],
    ['dont', "don't", false], ['apple.', 'apple', false], ['resume', 'résumé', false],
    ['ice-cream', 'ice cream', false], ['C', 'C++', false],
  ])('%s compared with %s => %s', (answer, expected, correct) => {
    expect(normalizeVocabularyAnswer(answer) === normalizeVocabularyAnswer(expected)).toBe(correct);
  });
});
