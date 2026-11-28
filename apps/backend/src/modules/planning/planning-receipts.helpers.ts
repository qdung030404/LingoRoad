import { LearningKind } from '@prisma/client';
import { PreferredSkill } from './planning.dto';

export const PREFERRED_SKILLS_RECEIPT_ID = '00000000-0000-4000-8000-505245465331';
export const WRITING_HISTORY_RECEIPT_ID = '00000000-0000-4000-8000-575249544531';
const PREFERRED_SKILLS_SCHEMA_VERSION = 2;
const LESSON_KIND_COUNT = Object.values(LearningKind).length;

export interface ReceiptReaderDb {
  vocabularyCommandReceipt?: {
    findUnique?: (args: {
      where: { userId_commandId: { userId: string; commandId: string } };
      select: { result: true };
    }) => Promise<{ result: unknown } | null>;
  };
}

export interface ReceiptWriterDb extends ReceiptReaderDb {
  vocabularyCommandReceipt?: ReceiptReaderDb['vocabularyCommandReceipt'] & {
    upsert?: (args: {
      where: { userId_commandId: { userId: string; commandId: string } };
      create: {
        userId: string;
        commandId: string;
        action: string;
        targetId: string;
        canonicalPayloadHash: string;
        appliedVersion: number | null;
        result: { preferredKinds?: PreferredSkill[]; schemaVersion?: number; completedByItem?: Record<string, string> };
      };
      update: {
        canonicalPayloadHash: string;
        appliedVersion?: number | null;
        result: { preferredKinds?: PreferredSkill[]; schemaVersion?: number; completedByItem?: Record<string, string> };
      };
    }) => Promise<unknown>;
  };
}

export interface WritingReceiptDb extends ReceiptWriterDb {
  assessmentItem?: {
    findFirst?: (args: {
      where: { OR: Array<{ id?: string; externalId?: string }> } | { externalId: string };
      select: { id: true; externalId: true };
    }) => Promise<{ id: string; externalId?: string | null } | null>;
  };
}

/** Resolves ordered preferred skills with backward-compatible fallback for older profiles. */
export function resolvePreferredSkills(
  profile: {
    preferredSkills?: string[] | null;
    preferredKinds?: LearningKind[] | null;
  },
  storedSkills?: PreferredSkill[] | null,
): PreferredSkill[] {
  if (Array.isArray(storedSkills) && storedSkills.length > 0) {
    return storedSkills;
  }
  if (Array.isArray(profile.preferredSkills) && profile.preferredSkills.length > 0) {
    return profile.preferredSkills as PreferredSkill[];
  }
  if (Array.isArray(profile.preferredKinds) && profile.preferredKinds.length > 0) {
    return profile.preferredKinds as PreferredSkill[];
  }
  return ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING', 'SPEAKING', 'WRITING'];
}

/** Reads ordered preferred skills stored in the user's receipt row. */
export async function readPreferredSkillsForUser(
  db: ReceiptReaderDb,
  userId: string,
  fallbackKinds?: LearningKind[] | null,
): Promise<PreferredSkill[] | null> {
  if (!db.vocabularyCommandReceipt?.findUnique) return null;
  const receipt = await db.vocabularyCommandReceipt.findUnique({
    where: { userId_commandId: { userId, commandId: PREFERRED_SKILLS_RECEIPT_ID } },
    select: { result: true },
  });
  const resultObj = receipt?.result as { preferredKinds?: unknown; schemaVersion?: unknown } | null;
  const saved = resultObj?.preferredKinds;
  if (Array.isArray(saved) && saved.length > 0) {
    const skills = saved as PreferredSkill[];
    if (
      resultObj?.schemaVersion !== PREFERRED_SKILLS_SCHEMA_VERSION &&
      skills.length === 5 &&
      !skills.includes('WRITING')
    ) {
      return [...skills, 'WRITING'];
    }
    return skills;
  }
  const hasCustomSubset =
    Array.isArray(fallbackKinds) &&
    fallbackKinds.length > 0 &&
    fallbackKinds.length < LESSON_KIND_COUNT;
  if (hasCustomSubset) {
    return [...new Set<PreferredSkill>(fallbackKinds as PreferredSkill[])];
  }
  const base = Array.isArray(fallbackKinds) && fallbackKinds.length > 0
    ? (fallbackKinds as PreferredSkill[])
    : (['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'] as PreferredSkill[]);
  return [...new Set<PreferredSkill>([...base, 'SPEAKING', 'WRITING'])];
}

/** Persists ordered preferred skills into the user's receipt row. */
export async function writePreferredSkillsForUser(
  db: ReceiptWriterDb,
  userId: string,
  preferredSkills: PreferredSkill[],
  version?: number,
): Promise<void> {
  if (!db.vocabularyCommandReceipt?.upsert) return;
  const payload = { preferredKinds: preferredSkills, schemaVersion: PREFERRED_SKILLS_SCHEMA_VERSION };
  await db.vocabularyCommandReceipt.upsert({
    where: { userId_commandId: { userId, commandId: PREFERRED_SKILLS_RECEIPT_ID } },
    create: {
      userId,
      commandId: PREFERRED_SKILLS_RECEIPT_ID,
      action: 'PREFERRED_SKILLS',
      targetId: userId,
      canonicalPayloadHash: preferredSkills.join(',').slice(0, 64),
      appliedVersion: version ?? null,
      result: payload,
    },
    update: {
      canonicalPayloadHash: preferredSkills.join(',').slice(0, 64),
      appliedVersion: version ?? null,
      result: payload,
    },
  });
}

/** Reads completed writing practice timestamps keyed by item ID and external ID. */
export async function readWritingHistoryForUser(
  db: ReceiptReaderDb,
  userId: string,
): Promise<Record<string, string>> {
  if (!db.vocabularyCommandReceipt?.findUnique) return {};
  const receipt = await db.vocabularyCommandReceipt.findUnique({
    where: { userId_commandId: { userId, commandId: WRITING_HISTORY_RECEIPT_ID } },
    select: { result: true },
  });
  const map = (receipt?.result as { completedByItem?: unknown } | null)?.completedByItem;
  if (map && typeof map === 'object' && !Array.isArray(map)) {
    return map as Record<string, string>;
  }
  return {};
}

/** Records a completed writing practice submission in the user's receipt history. */
export async function recordWritingCompletionForUser(
  db: WritingReceiptDb,
  userId: string,
  itemIdOrExternalId: string,
  completedAt: Date = new Date(),
): Promise<void> {
  if (!db.vocabularyCommandReceipt?.upsert) return;
  const existing = await readWritingHistoryForUser(db, userId);
  const iso = completedAt.toISOString();
  const next: Record<string, string> = { ...existing, [itemIdOrExternalId]: iso };
  if (db.assessmentItem?.findFirst) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemIdOrExternalId);
    const matched = await db.assessmentItem.findFirst({
      where: isUuid
        ? { OR: [{ id: itemIdOrExternalId }, { externalId: itemIdOrExternalId }] }
        : { externalId: itemIdOrExternalId },
      select: { id: true, externalId: true },
    });
    if (matched) {
      next[matched.id] = iso;
      if (matched.externalId) next[matched.externalId] = iso;
    }
  }
  const payload = { completedByItem: next };
  const hash = `${itemIdOrExternalId}:${iso}`.slice(0, 64);
  await db.vocabularyCommandReceipt.upsert({
    where: { userId_commandId: { userId, commandId: WRITING_HISTORY_RECEIPT_ID } },
    create: {
      userId,
      commandId: WRITING_HISTORY_RECEIPT_ID,
      action: 'WRITING_HISTORY',
      targetId: userId,
      canonicalPayloadHash: hash,
      appliedVersion: null,
      result: payload,
    },
    update: {
      canonicalPayloadHash: hash,
      result: payload,
    },
  });
}
