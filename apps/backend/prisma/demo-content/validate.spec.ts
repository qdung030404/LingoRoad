import { strict as assert } from 'node:assert';
import { PrismaClient } from '@prisma/client';
import { loadDemoContent, seedDemoContent } from '../seed-placement';
import { validateDemoContent, waveDurationSeconds } from './validate';

async function main(): Promise<void> {
  const items = loadDemoContent();
  assert.equal(validateDemoContent(items).audioDurations.length, 20);
  assert.throws(() => validateDemoContent(items.slice(1)), /exactly 40/);

  const duplicate = structuredClone(items);
  duplicate[1] = structuredClone(duplicate[0]);
  assert.throws(() => validateDemoContent(duplicate), /duplicate externalId/);

  const invalidAnswer = structuredClone(items);
  invalidAnswer[0].correctOption = 'This is not an offered answer';
  assert.throws(() => validateDemoContent(invalidAnswer), /four distinct options/);

  const repeatedOption = structuredClone(items);
  repeatedOption[0].options[1] = repeatedOption[0].options[0];
  assert.throws(() => validateDemoContent(repeatedOption), /four distinct options/);

  const missingPassage = structuredClone(items);
  delete missingPassage[0].passage;
  assert.throws(() => validateDemoContent(missingPassage), /invalid reading source/);

  const unsafeId = structuredClone(items);
  unsafeId[20].externalId = '../../private';
  assert.throws(() => validateDemoContent(unsafeId), /Invalid or duplicate externalId/);

  assert.throws(() => waveDurationSeconds(Buffer.from('not audio')), /Invalid WAV/);
  const truncated = Buffer.alloc(12);
  truncated.write('RIFF');
  truncated.write('WAVE', 8);
  truncated.writeUInt32LE(100, 4);
  assert.throws(() => waveDurationSeconds(truncated), /Truncated WAV/);

  // An in-memory Prisma stand-in verifies idempotent keys and the offline transcript boundary.
  const stored = new Map<string, Record<string, unknown>>();
  let transactionCount = 0;
  const prisma = {
    assessmentItem: {
      upsert: (args: { where: { externalId: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => {
        assert.equal(args.where.externalId, args.create.externalId);
        assert.equal(args.create.bankVersion, 'demo-v1');
        assert.equal('transcript' in args.create, false);
        assert.equal('transcript' in args.update, false);
        stored.set(args.where.externalId, args.create);
        return Promise.resolve(args.create);
      },
    },
    $transaction: (writes: Promise<unknown>[]) => {
      transactionCount += 1;
      return Promise.all(writes);
    },
  } as unknown as PrismaClient;
  assert.equal(await seedDemoContent(prisma), 40);
  assert.equal(await seedDemoContent(prisma), 40);
  assert.equal(stored.size, 40);
  assert.equal(transactionCount, 2);
  for (const item of stored.values()) {
    if (item.skill === 'LISTENING') {
      assert.equal(item.passage, null);
      assert.equal(item.audioUrl, `/media/placement/${item.externalId}.wav`);
    } else {
      assert.equal(item.audioUrl, null);
      assert.ok(typeof item.passage === 'string' && item.passage.length > 0);
    }
  }
  console.log('PASS: bank coverage, malformed data, WAV rejection, seed keys and transcript boundary.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
