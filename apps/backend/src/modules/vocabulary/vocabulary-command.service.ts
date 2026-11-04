import { Injectable } from '@nestjs/common';
import { Prisma, VocabularyCommandReceipt } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Db, vocabConflict } from './vocabulary.types';

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]));
  return value;
}
@Injectable()
export class VocabularyCommandService {
  constructor(private readonly prisma: PrismaService) {}
  async execute(userId: string, commandId: string, action: string, targetId: string, payload: unknown,
    run: (db: Db) => Promise<{ targetId: string; appliedVersion?: number; result: Prisma.InputJsonValue }>): Promise<VocabularyCommandReceipt> {
    const hash = createHash('sha256').update(JSON.stringify(canonical({ action, targetId, payload }))).digest('hex');
    // Account lock serializes all vocabulary writes, including cross-attempt projections and duplicate receipts.
    // This shares the established learning lock order and makes receipt+state+projection one short transaction.
    return this.prisma.$transaction(async db => {
      await db.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const old = await db.vocabularyCommandReceipt.findUnique({ where: { userId_commandId: { userId, commandId } } });
      if (old) { if (old.canonicalPayloadHash !== hash) vocabConflict('VOCAB_COMMAND_CONFLICT'); return old; }
      const outcome = await run(db);
      return db.vocabularyCommandReceipt.create({ data: { userId, commandId, action, targetId: outcome.targetId,
        canonicalPayloadHash: hash, appliedVersion: outcome.appliedVersion, result: outcome.result } });
    }, { timeout: 10000 });
  }
  view(receipt: VocabularyCommandReceipt) {
    return { commandId: receipt.commandId, targetId: receipt.targetId, appliedVersion: receipt.appliedVersion, result: receipt.result };
  }
}
