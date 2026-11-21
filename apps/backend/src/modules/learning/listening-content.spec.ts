import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LearningContent, LISTENING_SKILL_CODES, validateLearningContent } from './learning.types';
import { listeningWaveDurationMs, validateListeningAudio } from './listening-media';

const mediaRoot = join(__dirname, '../../../media/learning');
const content = JSON.parse(readFileSync(join(__dirname, '../../../prisma/listening-content/campus-cafe-v1.json'), 'utf8')) as LearningContent;

describe('Listening v1 content and media', () => {
  it('validates the recorded fixture and canonical skill catalog without changing legacy content rules', () => {
    expect(() => validateLearningContent(content, 'LISTENING')).not.toThrow();
    expect(() => validateListeningAudio(content, mediaRoot)).not.toThrow();
    const catalog = JSON.parse(readFileSync(join(__dirname, '../../../../ml/data/skills.json'), 'utf8')) as { skills: Array<{ code: string; category: string }> };
    const canonical = catalog.skills.filter((skill) => skill.category === 'listening' && skill.code.startsWith('listening.')).map((skill) => skill.code).sort();
    expect([...LISTENING_SKILL_CODES].sort()).toEqual(canonical);
  });

  it('rejects profile downgrade, mismatched kind, passages and incomplete authoring drafts', () => {
    for (const kind of ['READING', 'GRAMMAR', 'VOCABULARY'] as const) {
      expect(() => validateLearningContent(content, kind)).toThrow();
    }
    for (const patch of [
      { listeningVersion: undefined }, { listeningVersion: 2 }, { passage: content.transcript },
      { steps: [{ id: 'step', title: 'Title', body: 'Body' }] },
      { audioDurationMs: null }, { audioDurationMs: 29999 }, { audioDurationMs: 90001 },
      { preparation: { situation: '', objective: 'Listen' } },
      { keyVocabulary: content.keyVocabulary!.slice(0, 2) },
      { questions: content.questions.slice(0, 4) }, { transcriptSegments: [] },
      { transcript: 'Transcript inconsistent with segments.' },
    ]) expect(() => validateLearningContent({ ...content, ...patch }, 'LISTENING')).toThrow();
  });

  it('rejects invalid, overlapping, duplicate and null segment timestamps', () => {
    for (const patch of [
      { startMs: null }, { startMs: -1 }, { startMs: 0.5 }, { endMs: content.audioDurationMs! + 1 },
      { endMs: 0 }, { id: '' }, { text: '' }, { translationVi: '' }, { speaker: '' },
    ]) {
      const invalid = structuredClone(content);
      Object.assign(invalid.transcriptSegments![0], patch);
      expect(() => validateLearningContent(invalid, 'LISTENING')).toThrow();
    }
    const overlap = structuredClone(content);
    overlap.transcriptSegments![1].startMs = overlap.transcriptSegments![0].endMs - 1;
    expect(() => validateLearningContent(overlap, 'LISTENING')).toThrow();
    const duplicate = structuredClone(content);
    duplicate.transcriptSegments![1].id = duplicate.transcriptSegments![0].id;
    expect(() => validateLearningContent(duplicate, 'LISTENING')).toThrow();
  });

  it('requires supported listening MCQ skills, distinct options and chronological evidence', () => {
    for (const patch of [
      { skillCode: 'reading.scanning' }, { skillCode: 'listening.unknown' }, { skillCode: undefined },
      { type: 'GAP_FILL' }, { evidenceSegmentIds: [] }, { evidenceSegmentIds: ['missing'] },
      { evidenceSegmentIds: ['s01', 's01'] }, { evidenceSegmentIds: ['s02', 's01'] },
      { evidence: content.transcript },
      { options: content.questions[0].options.map((option) => ({ ...option, text: 'Duplicate' })) },
    ]) {
      const invalid = structuredClone(content);
      Object.assign(invalid.questions[0], patch);
      expect(() => validateLearningContent(invalid, 'LISTENING')).toThrow();
    }
    const withoutGist = structuredClone(content);
    withoutGist.questions.forEach((question) => { question.skillCode = 'listening.specific_information'; });
    expect(() => validateLearningContent(withoutGist, 'LISTENING')).toThrow();
  });

  it('rejects unsafe URLs, missing files, wrong metadata duration and corrupt PCM headers', () => {
    for (const audioUrl of ['https://example.com/audio.wav', '/media/learning/v1/../secret.wav', '/media/learning/v1/missing.wav']) {
      expect(() => validateListeningAudio({ ...content, audioUrl }, mediaRoot)).toThrow();
    }
    expect(() => validateListeningAudio({ ...content, audioDurationMs: content.audioDurationMs! + 1000 }, mediaRoot)).toThrow();
    const wave = readFileSync(join(mediaRoot, 'v1/listening-campus-cafe-v1.wav'));
    expect(Math.abs(listeningWaveDurationMs(wave) - content.audioDurationMs!)).toBeLessThanOrEqual(1);
    expect(() => listeningWaveDurationMs(wave.subarray(0, wave.length - 1))).toThrow();
    const stereo = Buffer.from(wave);
    const fmt = stereo.indexOf(Buffer.from('fmt '));
    stereo.writeUInt16LE(2, fmt + 10);
    expect(() => listeningWaveDurationMs(stereo)).toThrow();
    const rate = Buffer.from(wave);
    rate.writeUInt32LE(1, fmt + 16);
    expect(() => listeningWaveDurationMs(rate)).toThrow();
  });
});
