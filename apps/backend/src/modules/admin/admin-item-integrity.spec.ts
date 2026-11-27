import { BadRequestException, ConflictException } from '@nestjs/common';
import { AssessmentItem, Prisma } from '@prisma/client';
import { AdminContentService } from './services/admin-content.service';
import { AdminImportService } from './services/admin-import.service';
import { adminPlacementBankVersion } from './services/assessment-item-integrity';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentMatrixService } from '../assessment/services/assessment-matrix.service';
import { CuratedVocabularyService } from '../vocabulary/curated-vocabulary.service';

jest.mock('firebase-admin/app', () => ({}));
jest.mock('firebase-admin/auth', () => ({}));

function item() {
  return { id: '00000000-0000-4000-8000-000000000001', externalId: 'cms-reading', bankVersion: 'demo-v1', groupId: null,
    skill: 'READING', skillCode: 'reading.scanning', cefrLevel: 'A2', type: 'MULTIPLE_CHOICE', usageScope: 'ALL',
    prompt: 'Where is the cafe?', passage: 'The cafe is in the park.', options: ['Park', 'School', 'Bank', 'Station'],
    correctOption: 'Park', explanation: null, audioUrl: null, irtA: 1, irtB: 0, irtC: 0.25,
    createdAt: new Date(), _count: { responses: 1, currentSessions: 1 } } as AssessmentItem & { _count: { responses: number; currentSessions: number } };
}

describe('Admin item lifecycle integrity', () => {
  const tx = {
    $queryRaw: jest.fn(async () => []),
    assessmentItem: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), create: jest.fn(), upsert: jest.fn() },
    assessmentResponse: { deleteMany: jest.fn() },
    placementSession: { updateMany: jest.fn() },
  };
  const prisma = { ...tx,
    learningUnit: { findMany: jest.fn(async () => []) },
    assessmentItem: { ...tx.assessmentItem, findMany: jest.fn(async () => [{ externalId: 'cms-reading' }]) },
    $transaction: jest.fn(async (fn: (db: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  const matrix = { invalidateCache: jest.fn(async () => undefined) };
  const service = new AdminContentService(prisma as unknown as PrismaService, matrix as unknown as AssessmentMatrixService);
  const importer = new AdminImportService(prisma as unknown as PrismaService, matrix as unknown as AssessmentMatrixService, {} as CuratedVocabularyService);
  beforeEach(() => { jest.clearAllMocks(); tx.assessmentItem.findUnique.mockResolvedValue(item()); });

  it('rejects answer changes to delivered or historical questions before mutation', async () => {
    await expect(service.updateAssessmentItem(item().id, { correctOption: 'School' })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.assessmentItem.update).not.toHaveBeenCalled();
  });

  it('allows an identical save of a referenced question', async () => {
    tx.assessmentItem.update.mockResolvedValue(item());
    await expect(service.updateAssessmentItem(item().id, { prompt: item().prompt, correctOption: 'Park' })).resolves.toHaveProperty('id', item().id);
  });

  it('assigns new eligible content to the bank used by the placement API', async () => {
    tx.assessmentItem.create.mockResolvedValue(item());
    const original = item();
    await service.createAssessmentItem({ skill: 'READING', skillCode: original.skillCode, cefrLevel: 'A2',
      prompt: original.prompt, passage: original.passage!, options: original.options, correctOption: 'Park', usageScope: 'PLACEMENT' });
    expect(tx.assessmentItem.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ bankVersion: 'demo-v1' }) }));
  });

  it.each([
    { options: ['Park', 'School'] }, { irtA: 0 }, { irtC: 1 }, { passage: null },
    { options: ['Park', 'Park', 'Bank', 'Station'] },
    { skill: 'LISTENING', audioUrl: 'https://example.com/remote.wav' },
  ])('rejects placement content the learner cannot use: %j', (changes) => {
    expect(() => adminPlacementBankVersion({ ...item(), usageScope: 'PLACEMENT', ...changes } as ReturnType<typeof item>)).toThrow(BadRequestException);
  });

  it('keeps object-ID ALL questions usable by practice without adding them to placement', () => {
    expect(adminPlacementBankVersion({ ...item(), options: [{ id: 'A', text: 'Park' }, { id: 'B', text: 'School' }], correctOption: 'A' })).toBeNull();
  });

  it('abandons affected active sessions before force deletion, including answered history references', async () => {
    await service.deleteAssessmentItem(item().id, true);
    expect(tx.placementSession.updateMany).toHaveBeenCalledWith({
      where: { status: 'IN_PROGRESS', OR: [{ currentItemId: item().id }, { responses: { some: { itemId: item().id } } }] },
      data: { currentItemId: null, status: 'ABANDONED', version: { increment: 1 } },
    });
    expect(tx.assessmentResponse.deleteMany).toHaveBeenCalledWith({ where: { itemId: item().id } });
    expect(tx.assessmentItem.delete).toHaveBeenCalled();
  });

  it('applies the same immutability rule to import upserts inside the transaction', async () => {
    const original = item();
    await expect(importer.applyBundle({ items: [{ externalId: original.externalId, skill: original.skill,
      skillCode: original.skillCode, cefrLevel: original.cefrLevel, prompt: original.prompt,
      passage: original.passage, options: original.options as Prisma.JsonValue, correctOption: 'School' }] })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.assessmentItem.upsert).not.toHaveBeenCalled();
  });

  it('also puts newly imported eligible items in the active placement bank', async () => {
    tx.assessmentItem.findUnique.mockResolvedValue(null);
    const original = item();
    await importer.applyBundle({ items: [{ externalId: original.externalId, skill: original.skill,
      skillCode: original.skillCode, cefrLevel: original.cefrLevel, prompt: original.prompt,
      passage: original.passage, options: original.options, correctOption: original.correctOption, usageScope: 'PLACEMENT' }] });
    expect(tx.assessmentItem.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ bankVersion: 'demo-v1' }),
      update: expect.objectContaining({ bankVersion: 'demo-v1' }),
    }));
  });
});
