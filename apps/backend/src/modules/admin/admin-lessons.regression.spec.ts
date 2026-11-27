import { BadRequestException } from '@nestjs/common';
import { LearningKind } from '@prisma/client';
import { AdminContentService } from './services/admin-content.service';
import { AdminImportService } from './services/admin-import.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentMatrixService } from '../assessment/services/assessment-matrix.service';
import { CuratedVocabularyService } from '../vocabulary/curated-vocabulary.service';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
jest.mock('firebase-admin/app', () => ({}));
jest.mock('firebase-admin/auth', () => ({}));
const content = () => JSON.parse(readFileSync(join(__dirname, '../../../prisma/listening-content/campus-cafe-v1.json'), 'utf8'));
describe('Admin lesson publication integrity', () => {
  const db = { learningLesson: { findUnique: jest.fn(), update: jest.fn() }, learningUnit: { findMany: jest.fn(async () => []) } };
  const service = new AdminContentService(db as unknown as PrismaService, {} as AssessmentMatrixService);
  beforeEach(() => jest.clearAllMocks());
  it('rejects a kind-only patch incompatible with stored content', async () => {
    db.learningLesson.findUnique.mockResolvedValue({ id: 'l', code: 'cafe', kind: LearningKind.LISTENING, published: true, content: content() });
    await expect(service.updateLesson('l', { kind: LearningKind.READING })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.learningLesson.update).not.toHaveBeenCalled();
  });
  it('checks stored audio before publishing a draft', async () => {
    db.learningLesson.findUnique.mockResolvedValue({ id: 'l', code: 'cafe', kind: LearningKind.LISTENING, published: false, content: { ...content(), audioUrl: 'https://example.com/audio.wav' } });
    await expect(service.updateLesson('l', { published: true })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.learningLesson.update).not.toHaveBeenCalled();
  });
  it('rejects unusable audio in published imports but permits editorial drafts', async () => {
    const importer = new AdminImportService({ ...db, learningLesson: { findMany: async () => [] } } as unknown as PrismaService, {} as AssessmentMatrixService, {} as CuratedVocabularyService);
    const lesson = { code: 'cafe', title: 'Cafe', description: 'Listening', kind: 'LISTENING', content: { ...content(), audioUrl: 'https://example.com/audio.wav' } };
    expect((await importer.validateBundle({ lessons: [lesson] })).isValid).toBe(false);
    expect((await importer.validateBundle({ lessons: [{ ...lesson, published: false }] })).isValid).toBe(true);
  });
});
