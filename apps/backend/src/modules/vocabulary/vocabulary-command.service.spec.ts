import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VocabularyCommandService } from './vocabulary-command.service';
describe('Vocabulary command receipt', () => {
  let service: VocabularyCommandService;
  let rows: any[];
  let mutation: jest.Mock;
  beforeEach(() => {
    rows = [];
    const db = { $queryRaw: jest.fn(async () => []), vocabularyCommandReceipt: {
      findUnique: jest.fn(async ({ where }: any) => rows.find(r => r.userId === where.userId_commandId.userId && r.commandId === where.userId_commandId.commandId)),
      create: jest.fn(async ({ data }: any) => { rows.push(data); return data; }),
    } };
    service = new VocabularyCommandService({ $transaction: async (fn: any) => fn(db) } as unknown as PrismaService);
    mutation = jest.fn(async () => ({ targetId: 'deck', appliedVersion: 1, result: { deckId: 'deck' } }));
  });
  it('returns the original receipt before executing an already applied mutation', async () => {
    const first = await service.execute('A', 'id', 'CREATE', 'decks', { a: 1, b: 2 }, mutation);
    const replay = await service.execute('A', 'id', 'CREATE', 'decks', { b: 2, a: 1 }, mutation);
    expect(replay).toEqual(first); expect(mutation).toHaveBeenCalledTimes(1);
  });
  it('rejects changed target, action, or payload under the same command ID', async () => {
    await service.execute('A', 'id', 'CREATE', 'decks', { a: 1 }, mutation);
    await expect(service.execute('A', 'id', 'CREATE', 'decks', { a: 2 }, mutation)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.execute('A', 'id', 'DELETE', 'decks', { a: 1 }, mutation)).rejects.toBeInstanceOf(ConflictException);
    expect(mutation).toHaveBeenCalledTimes(1);
  });
  it('isolates receipt keys by account', async () => {
    await service.execute('A', 'id', 'CREATE', 'decks', {}, mutation);
    await service.execute('B', 'id', 'CREATE', 'decks', {}, mutation);
    expect(mutation).toHaveBeenCalledTimes(2);
  });
});
