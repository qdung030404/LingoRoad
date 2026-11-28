import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CefrLevel, LearningAttempt, LearningDayPlan, LearningKind, LearningSkillLevel, Prisma } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityBatchDto, LearningPreferencesDto, PreferredSkill } from './planning.dto';
import { AdaptiveReadingTarget, decideReadingLevel, initialReadingLevel, isEligibleReadingEvidence } from './skill-level.policy';
import {
  chooseReadingFocus, readingEvidence, ReadingFocusCode, selectReadingFocusAttempts,
} from './reading-focus.policy';
import {
  buildDailyRoadmapItems,
  buildProgressUnits,
  chooseDailyItems,
  computeScoreStats,
  CURRENT_PLAN_POLICY_VERSION,
  DAY_MS,
  dedupePlanItems,
  finishedOn,
  LEARNING_TIME_ZONE,
  learningDate,
  learningDayStart,
  PlanItem,
  PlannedLesson,
  PlannedSpeakingTopic,
  PlannedWritingItem,
  SkillLevelChange,
} from './planning.helpers';

export {
  buildDailyRoadmapItems,
  buildProgressUnits,
  chooseDailyItems,
  computeScoreStats,
  CURRENT_PLAN_POLICY_VERSION,
  dedupePlanItems,
  deriveWritingTitle,
  isCefrEligible,
  LEARNING_TIME_ZONE,
  learningDate,
  learningDayStart,
} from './planning.helpers';
export type {
  PlanItem,
  PlannedLesson,
  PlannedSpeakingTopic,
  PlannedWritingItem,
  ProgressScoreStats,
  ProgressUnit,
  ProgressUnitStatus,
  SkillLevelChange,
} from './planning.helpers';

type Db = Prisma.TransactionClient;

const PLAN_LESSON_SELECT = {
  id: true,
  code: true,
  kind: true,
  title: true,
  estimatedMinutes: true,
  sortOrder: true,
  unit: { select: { cefrLevel: true } },
} as const;

const LESSON_KIND_SET = new Set<string>(Object.values(LearningKind));
export const PREFERRED_SKILLS_RECEIPT_ID = '00000000-0000-4000-8000-505245465331';
export const WRITING_HISTORY_RECEIPT_ID = '00000000-0000-4000-8000-575249544531';
const PREFERRED_SKILLS_SCHEMA_VERSION = 2;

function isLessonKind(value: string): value is LearningKind {
  return LESSON_KIND_SET.has(value);
}

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

export async function readPreferredSkillsForUser(
  db: { vocabularyCommandReceipt?: { findUnique?: (...args: any[]) => Promise<any> } },
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
    fallbackKinds.length < LESSON_KIND_SET.size;
  if (hasCustomSubset) {
    return [...new Set<PreferredSkill>(fallbackKinds as PreferredSkill[])];
  }
  const base = Array.isArray(fallbackKinds) && fallbackKinds.length > 0
    ? (fallbackKinds as PreferredSkill[])
    : (['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'] as PreferredSkill[]);
  return [...new Set<PreferredSkill>([...base, 'SPEAKING', 'WRITING'])];
}

export async function writePreferredSkillsForUser(
  db: { vocabularyCommandReceipt?: { upsert?: (...args: any[]) => Promise<any> } },
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

export async function readWritingHistoryForUser(
  db: { vocabularyCommandReceipt?: { findUnique?: (...args: any[]) => Promise<any> } },
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

export async function recordWritingCompletionForUser(
  db: {
    vocabularyCommandReceipt?: {
      findUnique?: (...args: any[]) => Promise<any>;
      upsert?: (...args: any[]) => Promise<any>;
    };
    assessmentItem?: {
      findFirst?: (...args: any[]) => Promise<{ id: string; externalId?: string | null } | null>;
    };
  },
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

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}
  private invalid(message: string): never { throw new BadRequestException({ code: 'LEARNING_INVALID_ACTIVITY', message }); }
  private missing(): never { throw new NotFoundException({ code: 'LEARNING_RECORD_NOT_FOUND', message: 'Không tìm thấy dữ liệu học tập.' }); }
  private conflict(): never { throw new ConflictException({ code: 'LEARNING_PREFERENCES_CONFLICT', message: 'Thiết lập đã thay đổi. Hãy tải lại trước khi lưu.' }); }
  private async lock(db: Db, userId: string) { await db.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`; }
  private async profile(db: Db, userId: string) {
    const profile = await db.userProfile.findUnique({ where: { userId } });
    if (!profile) this.missing();
    return profile;
  }
  private preferenceDto(
    profile: Awaited<ReturnType<PlanningService['profile']>>,
    storedSkills?: PreferredSkill[] | null,
  ) {
    return {
      learningPurpose: profile.learningPurpose ?? null,
      targetCefr: profile.targetCefr,
      dailyGoalMinutes: profile.dailyGoalMinutes,
      preferredKinds: resolvePreferredSkills(profile, storedSkills),
      version: profile.preferencesVersion,
    };
  }
  async preferences(userId: string) {
    const profile = await this.profile(this.prisma, userId);
    const [skillLevel, placement, storedSkills] = await Promise.all([
      this.prisma.learningSkillLevel?.findUnique({ where: { userId_kind: { userId, kind: 'READING' } } }) ?? Promise.resolve(null),
      this.prisma.placementSession?.findFirst({
        where: { userId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { skillResults: true, completedAt: true },
      }) ?? Promise.resolve(null),
      readPreferredSkillsForUser(this.prisma, userId, profile.preferredKinds),
    ]);
    const placementInit = initialReadingLevel(
      placement?.skillResults as Record<string, unknown> | undefined,
      placement?.completedAt,
    );
    const readingLevel = skillLevel
      ? this.shouldUpgradeFromPlacement(skillLevel, placementInit)
        ? { cefrLevel: placementInit.cefrLevel, source: placementInit.source }
        : { cefrLevel: skillLevel.cefrLevel, source: skillLevel.source }
      : { cefrLevel: placementInit.cefrLevel, source: placementInit.source };
    return { ...this.preferenceDto(profile, storedSkills), readingLevel };
  }

  async updatePreferences(userId: string, dto: LearningPreferencesDto) {
    return this.prisma.$transaction(async tx => {
      await this.lock(tx, userId);
      const profile = await this.profile(tx, userId);
      if (profile.preferencesVersion !== dto.expectedVersion) this.conflict();
      const preferredSkills = [...new Set(dto.preferredKinds)];
      const storedSkills = await readPreferredSkillsForUser(tx, userId, profile.preferredKinds);
      const currentSkills = resolvePreferredSkills(profile, storedSkills);
      const kindsChanged =
        currentSkills.length !== preferredSkills.length ||
        currentSkills.some((kind, index) => kind !== preferredSkills[index]);
      const lessonKinds = preferredSkills.filter(isLessonKind);
      const minutesChanged = profile.dailyGoalMinutes !== dto.dailyGoalMinutes;
      const purposeChanged = dto.learningPurpose !== undefined && dto.learningPurpose !== profile.learningPurpose;
      const cefrChanged = dto.targetCefr !== undefined && dto.targetCefr !== profile.targetCefr;
      const changed = minutesChanged || kindsChanged || purposeChanged || cefrChanged;
      const saved = changed ? await tx.userProfile.update({
        where: { userId },
        data: {
          dailyGoalMinutes: dto.dailyGoalMinutes,
          preferredKinds: lessonKinds.length > 0 ? lessonKinds : profile.preferredKinds,
          ...(dto.learningPurpose === undefined ? {} : { learningPurpose: dto.learningPurpose }),
          ...(dto.targetCefr === undefined ? {} : { targetCefr: dto.targetCefr }),
          preferencesVersion: { increment: 1 },
        },
      }) : profile;
      if (changed) {
        await writePreferredSkillsForUser(tx, userId, preferredSkills, saved.preferencesVersion);
      }
      const savedWithSkills = { ...saved, preferredSkills } as typeof saved;
      const existing = await tx.learningDayPlan.findUnique({ where: { userId_date: { userId, date: learningDate(new Date()) } } });
      if (existing && changed) await this.ensureIn(tx, userId, { preferredSkillsOverride: preferredSkills });
      return this.preferenceDto(savedWithSkills, preferredSkills);
    });
  }

  async updateAccountProfile<T>(
    userId: string,
    write: (db: Db) => Promise<T>,
    shouldReconcile?: (result: T) => boolean,
  ): Promise<T> {
    return this.prisma.$transaction(async tx => {
      await this.lock(tx, userId);
      const result = await write(tx);
      if (shouldReconcile ? shouldReconcile(result) : true) {
        const existing = await tx.learningDayPlan.findUnique({ where: { userId_date: { userId, date: learningDate(new Date()) } } });
        if (existing) await this.ensureIn(tx, userId);
      }
      return result;
    });
  }

  private shouldUpgradeFromPlacement(
    existing: Pick<LearningSkillLevel, 'source' | 'changedAt'>,
    init: ReturnType<typeof initialReadingLevel>,
  ): boolean {
    if (init.source !== 'PLACEMENT') return false;
    if (existing.source === 'DEFAULT') return true;
    return (
      existing.source === 'PLACEMENT' &&
      init.changedAt != null &&
      (!existing.changedAt || init.changedAt > existing.changedAt)
    );
  }

  /** Lazy-initializes and reconciles DEFAULT->PLACEMENT READING skill level inside a transaction holding `users FOR UPDATE`. */
  async resolveReadingSkillLevel(
    db: Db,
    userId: string,
    latestPlacement?: { skillResults: unknown; completedAt: Date | null } | null,
  ): Promise<{ skillLevel: LearningSkillLevel; upgraded: boolean }> {
    const existing = await db.learningSkillLevel.findUnique({ where: { userId_kind: { userId, kind: 'READING' } } });
    const placement = latestPlacement !== undefined
      ? latestPlacement
      : await db.placementSession.findFirst({
          where: { userId, status: 'COMPLETED' },
          orderBy: { completedAt: 'desc' },
          select: { skillResults: true, completedAt: true },
        });
    const init = initialReadingLevel(placement?.skillResults as Record<string, unknown> | undefined, placement?.completedAt);
    if (!existing) {
      return {
        skillLevel: await db.learningSkillLevel.create({
          data: {
            userId,
            kind: 'READING',
            cefrLevel: init.cefrLevel,
            source: init.source,
            changedAt: init.changedAt,
          },
        }),
        upgraded: false,
      };
    }
    if (this.shouldUpgradeFromPlacement(existing, init)) {
      return {
        skillLevel: await db.learningSkillLevel.update({
          where: { id: existing.id },
          data: {
            cefrLevel: init.cefrLevel,
            source: 'PLACEMENT',
            previousCefr: null,
            changedAt: init.changedAt,
          },
        }),
        upgraded: true,
      };
    }
    return { skillLevel: existing, upgraded: false };
  }

  async ensureReadingSkillLevel(db: Db, userId: string): Promise<LearningSkillLevel> {
    return (await this.resolveReadingSkillLevel(db, userId)).skillLevel;
  }

  @OnEvent('placement.completed')
  async onPlacementCompleted(event: { userId?: string; sessionId?: string; estimatedCefr?: CefrLevel | string }) {
    if (!event?.userId) return;
    await this.prisma.$transaction(async tx => {
      await this.lock(tx, event.userId!);
      const latestPlacement = await tx.placementSession.findFirst({
        where: { userId: event.userId!, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { id: true, estimatedCefr: true, skillResults: true, completedAt: true },
      });
      const { skillLevel, upgraded } = await this.resolveReadingSkillLevel(tx, event.userId!, latestPlacement);
      const existingPlan = await tx.learningDayPlan.findUnique({
        where: { userId_date: { userId: event.userId!, date: learningDate(new Date()) } },
        select: { id: true },
      });
      if (existingPlan && upgraded) {
        await this.ensureIn(tx, event.userId!, { force: true, skillLevel });
      }
      const placementKey = event.sessionId ?? latestPlacement?.id;
      if (placementKey && this.notifications) {
        const estimatedCefr = event.estimatedCefr ?? latestPlacement?.estimatedCefr ?? skillLevel.cefrLevel;
        await this.notifications.createNotification(
          {
            userId: event.userId!,
            type: 'PLACEMENT_COMPLETED',
            title: 'Hoàn thành kiểm tra đầu vào',
            body: estimatedCefr
              ? `Trình độ ước tính của bạn là ${estimatedCefr}. Lộ trình học đã được cá nhân hóa.`
              : 'Lộ trình học của bạn đã được cá nhân hóa theo kết quả kiểm tra đầu vào.',
            targetType: 'DAILY_PLAN',
            targetPayload: { estimatedCefr: estimatedCefr ?? null },
            dedupeKey: `placement:${placementKey}`,
          },
          tx,
        );
      }
    });
  }

  /** Evaluates READING CEFR promotion/demotion within a caller transaction already holding `users FOR UPDATE`. */
  async evaluateReadingLevel(
    tx: Db,
    userId: string,
    submittedAttempt: LearningAttempt,
  ): Promise<SkillLevelChange | null> {
    const snapshot = submittedAttempt.lessonSnapshot as { kind?: string };
    if (snapshot?.kind !== 'READING') return null;
    const skillLevel = await this.ensureReadingSkillLevel(tx, userId);
    const [attempts, exposures, readingLessons] = await Promise.all([
      tx.learningAttempt.findMany({
        where: { userId, status: 'COMPLETED' },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      }),
      tx.learningAnswerExposure.findMany({ where: { userId }, select: { lessonId: true, firstAttemptId: true } }),
      tx.learningLesson.findMany({
        where: { published: true, kind: 'READING' },
        select: { id: true, unit: { select: { cefrLevel: true } } },
      }),
    ]);
    const exposureByLesson = new Map(exposures.map((e) => [e.lessonId, e.firstAttemptId]));
    const candidates = attempts.map(attempt => readingEvidence(attempt, exposureByLesson.get(attempt.lessonId) ?? null));
    const publishedCountAt = (level: CefrLevel) =>
      readingLessons.filter((l) => l.unit?.cefrLevel === level).length;
    const unexposedPublishedCountAt = (level: CefrLevel) =>
      readingLessons.filter((l) => l.unit?.cefrLevel === level && !exposureByLesson.has(l.id)).length;

    const decision = decideReadingLevel({
      current: skillLevel.cefrLevel,
      changedAt: skillLevel.changedAt,
      attempts: candidates,
      publishedCountAt,
      unexposedPublishedCountAt,
    });
    if (!decision) {
      const evidence = readingEvidence(submittedAttempt, exposureByLesson.get(submittedAttempt.lessonId) ?? null);
      if (isEligibleReadingEvidence(evidence, skillLevel.cefrLevel, skillLevel.changedAt)) {
        await this.refreshExistingReadingPlan(tx, userId, skillLevel, exposureByLesson);
      }
      return null;
    }

    const updated = await tx.learningSkillLevel.update({
      where: { id: skillLevel.id },
      data: {
        cefrLevel: decision.next,
        source: 'ADAPTIVE',
        previousCefr: skillLevel.cefrLevel,
        changedAt: submittedAttempt.submittedAt ?? new Date(),
      },
    });
    await tx.learningSkillLevelEvent.create({
      data: {
        userId,
        attemptId: submittedAttempt.id,
        kind: 'READING',
        fromCefr: skillLevel.cefrLevel,
        toCefr: decision.next,
        direction: decision.direction,
      },
    });
    if (this.notifications) {
      const isUp = decision.direction === 'UP';
      await this.notifications.createNotification(
        {
          userId,
          type: 'SKILL_LEVEL_CHANGED',
          title: isUp
            ? `Trình độ Đọc hiểu nâng lên ${decision.next}`
            : `Điều chỉnh trình độ Đọc hiểu sang ${decision.next}`,
          body: isUp
            ? `Chúc mừng! Mức Đọc hiểu của bạn đã tăng từ ${skillLevel.cefrLevel} lên ${decision.next}.`
            : `Mức Đọc hiểu đã được điều chỉnh từ ${skillLevel.cefrLevel} xuống ${decision.next} để phù hợp hơn.`,
          targetType: 'PROFILE',
          targetPayload: {
            kind: 'READING',
            fromCefr: skillLevel.cefrLevel,
            toCefr: decision.next,
            direction: decision.direction,
          },
          dedupeKey: `skill_level:${submittedAttempt.id}`,
        },
        tx,
      );
    }
    await this.refreshExistingReadingPlan(tx, userId, updated, exposureByLesson);
    return {
      kind: 'READING',
      from: skillLevel.cefrLevel,
      to: decision.next,
      direction: decision.direction,
    };
  }

  private async refreshExistingReadingPlan(
    db: Db,
    userId: string,
    skillLevel: LearningSkillLevel,
    exposureByLesson: ReadonlyMap<string, string>,
  ) {
    await this.ensureIn(db, userId, { force: true, existingOnly: true, skillLevel, exposureByLesson });
  }

  private async computeDailyPlanItems(
    db: Db,
    userId: string,
    now: Date,
    date: string,
    profile: Awaited<ReturnType<PlanningService['profile']>>,
    placement: { skillResults: unknown; completedAt: Date | null } | null,
    skillLevel: LearningSkillLevel | null,
    existingItems: PlanItem[],
    exposureByLesson?: ReadonlyMap<string, string>,
    preferredSkillsOverride?: PreferredSkill[] | null,
  ): Promise<PlanItem[]> {
    const storedSkills =
      preferredSkillsOverride !== undefined
        ? preferredSkillsOverride
        : await readPreferredSkillsForUser(db, userId, profile.preferredKinds);
    const preferredSkills = resolvePreferredSkills(profile, storedSkills);
    const wantsSpeaking = preferredSkills.includes('SPEAKING') || existingItems.some(i => i.kind === 'SPEAKING');
    const wantsWriting = preferredSkills.includes('WRITING') || existingItems.some(i => i.kind === 'WRITING');
    const [lessons, attempts, speakingTopics, speakingSubmissions, voiceConversations, rawWritingItems, writingHistory] = await Promise.all([
      db.learningLesson.findMany({
        where: { published: true },
        select: PLAN_LESSON_SELECT,
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      }),
      db.learningAttempt.findMany({ where: { userId } }),
      wantsSpeaking && db.speakingPrompt?.findMany
        ? db.speakingPrompt.findMany({
            where: { mode: 'TOPIC', published: true },
            select: { id: true, code: true, title: true, text: true, sortOrder: true },
            orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
          })
        : Promise.resolve([] as PlannedSpeakingTopic[]),
      wantsSpeaking && db.speakingSubmission?.findMany
        ? db.speakingSubmission.findMany({
            where: { userId, status: 'SUCCEEDED' },
            select: { promptId: true, completedAt: true, createdAt: true },
          })
        : Promise.resolve([] as { promptId: string; completedAt: Date | null; createdAt: Date }[]),
      wantsSpeaking && db.voiceConversation?.findMany
        ? db.voiceConversation.findMany({
            where: { userId, endedAt: { not: null } },
            select: { topicId: true, endedAt: true },
          })
        : Promise.resolve([] as { topicId: string; endedAt: Date | null }[]),
      wantsWriting && db.assessmentItem?.findMany
        ? db.assessmentItem.findMany({
            where: { skill: 'WRITING', usageScope: { in: ['PRACTICE', 'ALL'] } },
            select: {
              id: true,
              externalId: true,
              skillCode: true,
              cefrLevel: true,
              prompt: true,
              createdAt: true,
              group: { select: { title: true } },
            },
            orderBy: [{ cefrLevel: 'asc' }, { createdAt: 'asc' }],
          })
        : Promise.resolve(
            [] as {
              id: string;
              externalId: string | null;
              skillCode: string;
              cefrLevel: CefrLevel;
              prompt: string;
              createdAt: Date;
              group: { title: string | null } | null;
            }[],
          ),
      wantsWriting ? readWritingHistoryForUser(db, userId) : Promise.resolve({} as Record<string, string>),
    ]);
    const completedSpeakingIdsToday = new Set<string>();
    const practicedSpeakingAt = new Map<string, number>();
    for (const sub of speakingSubmissions) {
      const stamp = sub.completedAt ?? sub.createdAt;
      if (learningDate(stamp) === date) completedSpeakingIdsToday.add(sub.promptId);
      const prev = practicedSpeakingAt.get(sub.promptId) ?? 0;
      if (stamp.getTime() > prev) practicedSpeakingAt.set(sub.promptId, stamp.getTime());
    }
    for (const conv of voiceConversations) {
      if (!conv.endedAt) continue;
      if (learningDate(conv.endedAt) === date) completedSpeakingIdsToday.add(conv.topicId);
      const prev = practicedSpeakingAt.get(conv.topicId) ?? 0;
      if (conv.endedAt.getTime() > prev) practicedSpeakingAt.set(conv.topicId, conv.endedAt.getTime());
    }
    const writingItems: PlannedWritingItem[] = rawWritingItems.map(row => ({
      id: row.id,
      externalId: row.externalId,
      skillCode: row.skillCode,
      cefrLevel: row.cefrLevel,
      prompt: row.prompt,
      groupTitle: row.group?.title ?? null,
      createdAt: row.createdAt,
    }));
    const completedWritingIdsToday = new Set<string>();
    const practicedWritingAt = new Map<string, number>();
    for (const [key, iso] of Object.entries(writingHistory)) {
      const parsed = new Date(iso);
      if (Number.isNaN(parsed.getTime())) continue;
      if (learningDate(parsed) === date) completedWritingIdsToday.add(key);
      const prev = practicedWritingAt.get(key) ?? 0;
      if (parsed.getTime() > prev) practicedWritingAt.set(key, parsed.getTime());
    }
    const readingTarget: AdaptiveReadingTarget | null = skillLevel
      ? { cefrLevel: skillLevel.cefrLevel, strictCeiling: skillLevel.source === 'ADAPTIVE' }
      : null;
    let readingFocus: ReadingFocusCode | undefined;
    if (skillLevel && attempts.some(attempt => attempt.status === 'COMPLETED')) {
      const resolvedExposure = exposureByLesson ?? new Map((await db.learningAnswerExposure.findMany({
        where: { userId }, select: { lessonId: true, firstAttemptId: true },
      })).map(exposure => [exposure.lessonId, exposure.firstAttemptId]));
      const evidence = selectReadingFocusAttempts(attempts, resolvedExposure, skillLevel, now);
      if (evidence.length >= 2) {
        const answers = await db.learningAttemptAnswer.findMany({
          where: { attemptId: { in: evidence.map(attempt => attempt.id) }, checked: true },
          select: { attemptId: true, questionId: true, isCorrect: true },
        });
        readingFocus = chooseReadingFocus(evidence, answers);
      }
    }
    let plannedLessons: PlannedLesson[] = lessons;
    if (readingFocus && readingTarget) {
      const missingContentIds = lessons
        .filter(
          lesson =>
            lesson.kind === 'READING'
            && lesson.unit?.cefrLevel === readingTarget.cefrLevel
            && (lesson as PlannedLesson).content === undefined,
        )
        .map(lesson => lesson.id);
      if (missingContentIds.length > 0) {
        const contentRows = await db.learningLesson.findMany({
          where: { id: { in: missingContentIds } },
          select: { id: true, content: true },
        });
        const contentById = new Map(contentRows.map(row => [row.id, row.content]));
        plannedLessons = lessons.map(lesson =>
          contentById.has(lesson.id) ? { ...lesson, content: contentById.get(lesson.id) } : lesson,
        );
      }
    }
    return buildDailyRoadmapItems(
      plannedLessons,
      attempts,
      date,
      profile.dailyGoalMinutes,
      preferredSkills,
      existingItems,
      placement?.skillResults as Record<string, unknown> | undefined,
      readingTarget,
      readingFocus,
      speakingTopics,
      completedSpeakingIdsToday,
      practicedSpeakingAt,
      writingItems,
      completedWritingIdsToday,
      practicedWritingAt,
    );
  }

  private async ensureIn(db: Db, userId: string, opts?: {
    force?: boolean;
    existingOnly?: boolean;
    skillLevel?: LearningSkillLevel;
    exposureByLesson?: ReadonlyMap<string, string>;
    preferredSkillsOverride?: PreferredSkill[] | null;
  }) {
    const now = new Date(), date = learningDate(now);
    const existing = await db.learningDayPlan.findUnique({ where: { userId_date: { userId, date } } });
    if (opts?.existingOnly && !existing) return null;
    const [profile, placement] = await Promise.all([
      this.profile(db, userId),
      db.placementSession.findFirst({ where: { userId, status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, select: { skillResults: true, completedAt: true } }),
    ]);
    const resolved = opts?.skillLevel
      ? { skillLevel: opts.skillLevel, upgraded: false }
      : db.learningSkillLevel
        ? await this.resolveReadingSkillLevel(db, userId, placement)
        : null;
    const skillLevel = resolved?.skillLevel ?? null;
    const upgraded = resolved?.upgraded ?? false;
    const planStaleFromPlacement = placement?.completedAt != null && existing != null && existing.updatedAt < placement.completedAt;
    const currentPlan = !upgraded && !planStaleFromPlacement && existing
      && existing.policyVersion === CURRENT_PLAN_POLICY_VERSION
      && existing.preferencesVersion === profile.preferencesVersion
      && existing.dailyGoalMinutes === profile.dailyGoalMinutes;
    // Reconcile against the live curriculum: CMS changes do not alter user preferences.
    // chooseDailyItems retains completed snapshots; deep equality below avoids unnecessary writes.
    const items = await this.computeDailyPlanItems(
      db, userId, now, date, profile, placement, skillLevel,
      existing?.items as unknown as PlanItem[] ?? [],
      opts?.exposureByLesson,
      opts?.preferredSkillsOverride,
    );
    if (currentPlan && isDeepStrictEqual(items, existing.items)) return existing;
    return db.learningDayPlan.upsert({
      where: { userId_date: { userId, date } },
      create: {
        userId, date, dailyGoalMinutes: profile.dailyGoalMinutes, preferencesVersion: profile.preferencesVersion,
        policyVersion: CURRENT_PLAN_POLICY_VERSION, items: items as unknown as Prisma.InputJsonValue,
      },
      update: {
        dailyGoalMinutes: profile.dailyGoalMinutes, preferencesVersion: profile.preferencesVersion,
        policyVersion: CURRENT_PLAN_POLICY_VERSION, items: items as unknown as Prisma.InputJsonValue, version: { increment: 1 },
      },
    });
  }

  async ensureToday(userId: string) {
    const plan = await this.prisma.$transaction(async tx => { await this.lock(tx, userId); return this.ensureIn(tx, userId); });
    return { plan: plan ? await this.planDto(plan) : null };
  }
  async today(userId: string) {
    const now = new Date();
    const date = learningDate(now);
    const existing = await this.prisma.learningDayPlan.findUnique({ where: { userId_date: { userId, date } } });
    if (!existing) return { plan: null };
    const [profile, placement, skillLevel] = await Promise.all([
      this.profile(this.prisma, userId),
      this.prisma.placementSession.findFirst({
        where: { userId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { skillResults: true, completedAt: true },
      }),
      this.prisma.learningSkillLevel?.findUnique({ where: { userId_kind: { userId, kind: 'READING' } } }) ?? Promise.resolve(null),
    ]);
    const placementInit = initialReadingLevel(placement?.skillResults as Record<string, unknown> | undefined, placement?.completedAt);
    const needsSkillSync = Boolean(
      this.prisma.learningSkillLevel && (!skillLevel || this.shouldUpgradeFromPlacement(skillLevel, placementInit)),
    );
    const planStaleFromPlacement = placement?.completedAt != null && existing.updatedAt < placement.completedAt;
    const currentPlan = !needsSkillSync && !planStaleFromPlacement
      && existing.policyVersion === CURRENT_PLAN_POLICY_VERSION
      && existing.preferencesVersion === profile.preferencesVersion
      && existing.dailyGoalMinutes === profile.dailyGoalMinutes;
    if (!currentPlan) return this.ensureToday(userId);
    const items = await this.computeDailyPlanItems(
      this.prisma, userId, now, date, profile, placement, skillLevel,
      existing.items as unknown as PlanItem[],
    );
    if (isDeepStrictEqual(items, existing.items)) return { plan: await this.planDto(existing) };
    return this.ensureToday(userId);
  }
  private async planDto(plan: LearningDayPlan) {
    const rawPlanItems = Array.isArray(plan.items) ? (plan.items as unknown as PlanItem[]) : [];
    const planItems = dedupePlanItems(rawPlanItems);
    const start = learningDayStart(plan.date);
    const end = new Date(start.getTime() + DAY_MS);
    const lessonItemIds = planItems.filter(i => isLessonKind(i.kind)).map(i => i.lessonId);
    const speakingItemIds = planItems.filter(i => i.kind === 'SPEAKING').map(i => i.lessonId);
    const hasWritingItems = planItems.some(i => i.kind === 'WRITING');
    const [attempts, speakingSubs, voiceConvs, writingHistory] = await Promise.all([
      lessonItemIds.length === 0
        ? Promise.resolve(
            [] as {
              id: string;
              lessonId: string;
              status: LearningAttempt['status'];
              submittedAt: Date | null;
              historyHiddenAt: Date | null;
            }[],
          )
        : this.prisma.learningAttempt.findMany({
            where: {
              userId: plan.userId,
              lessonId: { in: lessonItemIds },
              status: 'COMPLETED',
              submittedAt: { gte: start, lt: end },
            },
            select: { id: true, lessonId: true, status: true, submittedAt: true, historyHiddenAt: true },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          }),
      speakingItemIds.length === 0 || !this.prisma.speakingSubmission?.findMany
        ? Promise.resolve([] as { promptId: string }[])
        : this.prisma.speakingSubmission.findMany({
            where: {
              userId: plan.userId,
              promptId: { in: speakingItemIds },
              status: 'SUCCEEDED',
              OR: [
                { completedAt: { gte: start, lt: end } },
                { completedAt: null, createdAt: { gte: start, lt: end } },
              ],
            },
            select: { promptId: true },
          }),
      speakingItemIds.length === 0 || !this.prisma.voiceConversation?.findMany
        ? Promise.resolve([] as { topicId: string }[])
        : this.prisma.voiceConversation.findMany({
            where: {
              userId: plan.userId,
              topicId: { in: speakingItemIds },
              endedAt: { gte: start, lt: end },
            },
            select: { topicId: true },
          }),
      hasWritingItems ? readWritingHistoryForUser(this.prisma, plan.userId) : Promise.resolve({} as Record<string, string>),
    ]);
    const doneSpeakingIds = new Set<string>([
      ...speakingSubs.map(s => s.promptId),
      ...voiceConvs.map(c => c.topicId),
    ]);
    const doneWritingIds = new Set<string>();
    for (const [key, iso] of Object.entries(writingHistory)) {
      const parsed = new Date(iso);
      if (!Number.isNaN(parsed.getTime()) && learningDate(parsed) === plan.date) {
        doneWritingIds.add(key);
      }
    }
    const items = planItems.map(item => {
      if (item.kind === 'SPEAKING') {
        const isDone = doneSpeakingIds.has(item.lessonId) || item.reasonCode === 'COMPLETED_TODAY';
        return {
          ...item,
          completed: isDone,
          activeAttemptId: null,
          completedAttemptId: null,
        };
      }
      if (item.kind === 'WRITING') {
        const isDone = doneWritingIds.has(item.lessonId) || item.reasonCode === 'COMPLETED_TODAY';
        return {
          ...item,
          completed: isDone,
          activeAttemptId: null,
          completedAttemptId: null,
        };
      }
      const completed = attempts.filter(a => a.lessonId === item.lessonId && finishedOn(a, plan.date));
      const visibleAttempt = completed.find(a => a.historyHiddenAt == null);
      const normalized = item.reasonCode === 'RESUME'
        ? { ...item, reasonCode: completed.length ? 'COMPLETED_TODAY' : 'NEW', reason: completed.length ? 'Đã hoàn thành hôm nay' : 'Bài mới' }
        : item;
      return { ...normalized, completed: completed.length > 0, activeAttemptId: null, completedAttemptId: visibleAttempt?.id ?? null };
    });
    const nextLesson = items.find(item => !item.completed && isLessonKind(item.kind));
    return { id: plan.id, date: plan.date, timeZone: LEARNING_TIME_ZONE, version: plan.version, policyVersion: plan.policyVersion, dailyGoalMinutes: plan.dailyGoalMinutes,
      estimatedMinutes: items.reduce((sum, item) => sum + item.estimatedMinutes, 0), completedCount: items.filter(item => item.completed).length,
      totalCount: items.length, items, continueLessonId: nextLesson?.lessonId ?? null, continueAttemptId: null };
  }

  async ensureHomePlan(userId: string) {
    const { plan } = await this.ensureToday(userId);
    return {
      date: plan?.date ?? learningDate(new Date()),
      plan,
      continueLesson: await this.homeLesson(userId, plan?.continueLessonId ?? null),
    };
  }

  private homeLesson(userId: string, lessonId: string | null, useFallback = false) {
    if (!lessonId && !useFallback) return null;
    return this.prisma.learningLesson.findFirst({
      where: {
        published: true,
        ...(lessonId ? { id: lessonId } : { attempts: { none: { userId, status: 'COMPLETED' as const } } }),
      },
      select: { id: true, kind: true, title: true, description: true, estimatedMinutes: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  async home(userId: string) {
    const now = new Date();
    const date = learningDate(now);
    const week = Array.from({ length: 7 }, (_, i) => {
      const from = new Date(learningDayStart(date).getTime() - (6 - i) * DAY_MS);
      return { date: learningDate(from), from, to: new Date(Math.min(from.getTime() + DAY_MS, now.getTime())) };
    });
    const [profile, plans, attempts, completedLessons, first, placement, skill, seconds, unreadNotificationCount] = await Promise.all([
      this.profile(this.prisma, userId),
      this.prisma.learningDayPlan.findMany({ where: { userId, date: { gte: week[0].date, lte: date } } }),
      this.prisma.learningAttempt.findMany({
        where: { userId, status: 'COMPLETED', submittedAt: { gte: week[0].from, lte: now } },
        select: { lessonId: true, submittedAt: true },
      }),
      this.prisma.learningLesson.count({ where: { published: true, attempts: { some: { userId, status: 'COMPLETED' } } } }),
      this.prisma.learningActivitySession.findFirst({ where: { userId }, orderBy: { anchorAt: 'asc' }, select: { anchorAt: true } }),
      this.prisma.placementSession.findFirst({
        where: { userId, status: 'COMPLETED' }, orderBy: { completedAt: 'desc' },
        select: { skillResults: true, completedAt: true },
      }),
      this.prisma.learningSkillLevel.findUnique({ where: { userId_kind: { userId, kind: 'READING' } } }),
      this.homeActiveSeconds(userId, [...week, { from: new Date(0), to: now }]),
      (async () => {
        if (!this.notifications) return 0;
        try {
          await this.notifications.ensureDailyNotifications(userId);
          return await this.notifications.unreadCount(userId);
        } catch {
          return 0;
        }
      })(),
    ]);
    const storedSkills = await readPreferredSkillsForUser(this.prisma, userId, profile.preferredKinds);
    const byDate = new Map(plans.map(plan => [plan.date, plan]));
    const current = byDate.get(date);
    const rawCurrentItems = Array.isArray(current?.items) ? (current.items as unknown as PlanItem[]) : [];
    const hasDuplicateItems = rawCurrentItems.length !== dedupePlanItems(rawCurrentItems).length;
    const initial = initialReadingLevel(placement?.skillResults as Record<string, unknown> | undefined, placement?.completedAt);
    const planStatus = !current ? 'missing' : current.policyVersion !== CURRENT_PLAN_POLICY_VERSION ||
      current.preferencesVersion !== profile.preferencesVersion || current.dailyGoalMinutes !== profile.dailyGoalMinutes ||
      hasDuplicateItems ||
      (placement?.completedAt != null && current.updatedAt < placement.completedAt) ||
      (skill != null && this.shouldUpgradeFromPlacement(skill, initial)) ? 'stale' : 'ready';
    const plan = current && planStatus === 'ready' ? await this.planDto(current) : null;
    const days = week.map((day, index) => {
      const completed = attempts.filter(row => row.submittedAt && learningDate(row.submittedAt) === day.date);
      const activeSeconds = seconds.get(index) ?? 0;
      const dailyGoalMinutes = byDate.get(day.date)?.dailyGoalMinutes ?? (day.date === date ? profile.dailyGoalMinutes : null);
      return {
        date: day.date, dailyGoalMinutes, activeSeconds,
        goalMet: dailyGoalMinutes != null && activeSeconds >= dailyGoalMinutes * 60,
        completedLessonCount: new Set(completed.map(row => row.lessonId)).size,
        completedAttemptCount: completed.length,
        hasActivity: activeSeconds > 0 || completed.length > 0,
        timeMeasured: first != null && learningDate(first.anchorAt) <= day.date,
      };
    });
    return {
      date, planStatus, plan, preferences: this.preferenceDto(profile, storedSkills), today: days[6], days,
      totals: { completedLessonCount: completedLessons, activeSeconds: seconds.get(week.length) ?? 0 },
      continueLesson: await this.homeLesson(userId, plan?.continueLessonId ?? null, plan == null),
      unreadNotificationCount,
    };
  }

  private async homeActiveSeconds(userId: string, windows: { from: Date; to: Date }[], db: Db = this.prisma) {
    if (!windows.length) return new Map<number, number>();
    const values = windows.map(({ from, to }, index) => Prisma.sql`(${index}::int, ${from}::timestamptz, ${to}::timestamptz)`);
    const rows = await db.$queryRaw<{ idx: number; seconds: number }[]>`
      WITH windows(idx, starts, ends) AS (VALUES ${Prisma.join(values)}),
      merged AS (
        SELECT w.idx, range_agg(tstzrange(GREATEST(s.start_at AT TIME ZONE 'UTC', w.starts),
          LEAST(s.end_at AT TIME ZONE 'UTC', w.ends), '[)')) AS spans
        FROM learning_activity_segments s JOIN learning_activity_sessions a ON a.id = s.session_id
        JOIN windows w ON w.starts < w.ends
          AND s.end_at > (w.starts AT TIME ZONE 'UTC')
          AND s.start_at < (w.ends AT TIME ZONE 'UTC')
        WHERE a.user_id = ${userId}::uuid AND s.start_at IS NOT NULL
        GROUP BY w.idx
      )
      SELECT idx, FLOOR(SUM(EXTRACT(EPOCH FROM (upper(span) - lower(span)))))::double precision AS seconds
      FROM merged CROSS JOIN LATERAL unnest(spans) AS pieces(span) GROUP BY idx`;
    return new Map((rows ?? []).map(row => [row.idx, Number(row.seconds ?? 0)]));
  }

  async progress(userId: string) {
    const now = new Date(), today = learningDate(now), start = learningDayStart(today);
    const week = Array.from({ length: 7 }, (_, i) => {
      const from = new Date(start.getTime() - (6 - i) * DAY_MS);
      return { date: learningDate(from), from, to: new Date(Math.min(from.getTime() + DAY_MS, now.getTime())) };
    });
    const [profile, plans, attempts, totalLessons, units, first, placement, skillLevel, seconds] = await Promise.all([
      this.profile(this.prisma, userId),
      this.prisma.learningDayPlan.findMany({
        where: { userId, date: { gte: week[0].date, lte: today } },
        select: { date: true, dailyGoalMinutes: true },
      }),
      this.prisma.learningAttempt.findMany({
        where: { userId },
        select: {
          id: true,
          lessonId: true,
          status: true,
          lessonSnapshot: true,
          correctCount: true,
          totalQuestions: true,
          submittedAt: true,
          historyHiddenAt: true,
        },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.learningLesson.findMany({ where: { published: true }, select: { id: true, unitId: true } }),
      this.prisma.learningUnit.findMany({ orderBy: [{ cefrLevel: 'asc' }, { orderIndex: 'asc' }] }),
      this.prisma.learningActivitySession.findFirst({ where: { userId }, orderBy: { anchorAt: 'asc' }, select: { anchorAt: true } }),
      this.prisma.placementSession.findFirst({ where: { userId, status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, select: { skillResults: true, completedAt: true } }),
      this.prisma.learningSkillLevel?.findUnique({ where: { userId_kind: { userId, kind: 'READING' } } }) ?? Promise.resolve(null),
      this.homeActiveSeconds(userId, [...week, { from: new Date(0), to: now }]),
    ]);
    const goalByDate = new Map(plans.map(p => [p.date, p.dailyGoalMinutes]));
    const days = week.map((day, index) => {
      const completed = attempts.filter(a => finishedOn(a, day.date));
      const activeSeconds = seconds.get(index) ?? 0;
      const target = goalByDate.get(day.date) ?? (day.date === today ? profile.dailyGoalMinutes : null);
      return { date: day.date, dailyGoalMinutes: target, activeSeconds, goalMet: target != null && activeSeconds >= target * 60,
        completedLessonCount: new Set(completed.map(a => a.lessonId)).size, completedAttemptCount: completed.length,
        hasActivity: activeSeconds > 0 || completed.length > 0, timeMeasured: first != null && learningDate(first.anchorAt) <= day.date };
    });
    const completed = attempts.filter(a => a.status === 'COMPLETED');
    const publishedIds = new Set(totalLessons.map(l => l.id));
    const completedPublishedIds = new Set(completed.filter(a => publishedIds.has(a.lessonId)).map(a => a.lessonId));
    const measuredDays = days.filter(d => d.timeMeasured);
    const averageActiveSeconds = measuredDays.length
      ? Math.round(measuredDays.reduce((sum, d) => sum + d.activeSeconds, 0) / measuredDays.length)
      : 0;
    const latestResults = Object.values(LearningKind).flatMap(kind => {
      const a = completed.find(row => row.historyHiddenAt == null && (row.lessonSnapshot as { kind?: string })?.kind === kind);
      return a ? [{ kind, correctCount: a.correctCount!, totalQuestions: a.totalQuestions, scoreRatio: a.correctCount! / a.totalQuestions,
        submittedAt: a.submittedAt, lessonTitle: (a.lessonSnapshot as { title: string }).title }] : [];
    });
    const placementInit = initialReadingLevel(placement?.skillResults as Record<string, unknown> | undefined, placement?.completedAt);
    let activeSkill = skillLevel;
    if (activeSkill && this.shouldUpgradeFromPlacement(activeSkill, placementInit) && this.prisma.$transaction) {
      activeSkill = await this.prisma.$transaction(async tx => {
        await this.lock(tx, userId);
        const { skillLevel: upgradedSkill, upgraded } = await this.resolveReadingSkillLevel(tx, userId, placement);
        const existingPlan = await tx.learningDayPlan.findUnique({
          where: { userId_date: { userId, date: today } },
          select: { id: true },
        });
        if (existingPlan && upgraded) await this.ensureIn(tx, userId, { force: true, skillLevel: upgradedSkill });
        return upgradedSkill;
      });
    }
    const readingLevel = activeSkill
      ? { cefrLevel: activeSkill.cefrLevel, source: activeSkill.source, previousCefr: activeSkill.previousCefr, changedAt: activeSkill.changedAt }
      : { ...placementInit, previousCefr: null };
    return { today: days[6], days, totals: { totalLessons: totalLessons.length,
      completedLessonCount: completedPublishedIds.size,
      completedAttemptCount: completed.length, activeAttemptCount: attempts.filter(a => a.status === 'IN_PROGRESS').length,
      activeSeconds: seconds.get(week.length) ?? 0,
      averageActiveSeconds, averageStudyMinutes: Math.floor(averageActiveSeconds / 60) },
      units: buildProgressUnits(units, totalLessons, completedPublishedIds),
      scoreStats: computeScoreStats(completed, now),
      latestResults, placement: placement?.skillResults ?? null,
      recommendedLevels: { reading: readingLevel },
      trackingStartedAt: first?.anchorAt ?? null };
  }

  async summary(userId: string) {
    const [progress, today] = await Promise.all([this.progress(userId), this.today(userId)]);
    const fresh = today.plan ? null : await this.prisma.learningLesson.findFirst({ where: { published: true,
      attempts: { none: { userId, status: 'COMPLETED' } } }, orderBy: { sortOrder: 'asc' } });
    return { ...progress.totals, continueLessonId: today.plan?.continueLessonId ?? fresh?.id ?? null,
      continueAttemptId: null };
  }

  async openActivity(userId: string, attemptId: string, clientRunId: string) {
    const session = await this.prisma.$transaction(async tx => {
      await this.lock(tx, userId);
      const attempt = await tx.learningAttempt.findFirst({ where: { id: attemptId, userId } });
      if (!attempt) this.missing();
      const old = await tx.learningActivitySession.findUnique({ where: { userId_attemptId_clientRunId: { userId, attemptId, clientRunId } } });
      if (old) return old;
      if (attempt.status !== 'IN_PROGRESS') this.invalid('Lượt đã hoàn thành không mở phiên đo mới.');
      return tx.learningActivitySession.create({ data: { userId, attemptId, clientRunId } });
    });
    return { sessionId: session.id, anchorAt: session.anchorAt, serverNow: new Date(), collectUntil: new Date(session.anchorAt.getTime() + DAY_MS), uploadUntil: new Date(session.anchorAt.getTime() + 7 * DAY_MS) };
  }

  async segments(userId: string, sessionId: string, dto: ActivityBatchDto) {
    return this.prisma.$transaction(async tx => {
      let session = await tx.learningActivitySession.findFirst({ where: { id: sessionId, userId }, include: { attempt: { select: { submittedAt: true } } } });
      if (!session) this.missing();
      await tx.$queryRaw`SELECT id FROM learning_activity_sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
      // Serialize with submit, then reload its boundary: a stale pre-lock read
      // must not accept activity after a concurrently completed attempt.
      await tx.$queryRaw`SELECT id FROM learning_attempts WHERE id = ${session.attemptId}::uuid FOR UPDATE`;
      session = await tx.learningActivitySession.findFirst({ where: { id: sessionId, userId }, include: { attempt: { select: { submittedAt: true } } } });
      if (!session) this.missing();
      const now = new Date(), acks: { seq: number; startAt: Date | null; endAt: Date | null }[] = [];
      let hasNewActiveSegment = false;
      for (const segment of dto.segments) {
        const { seq, startOffsetMs, endOffsetMs } = segment;
        if (endOffsetMs <= startOffsetMs || endOffsetMs - startOffsetMs > 15000 || endOffsetMs > DAY_MS) this.invalid('Khoảng hoạt động không hợp lệ.');
        const old = await tx.learningActivitySegment.findUnique({ where: { sessionId_seq: { sessionId, seq } } });
        if (old) {
          if (old.startOffsetMs !== startOffsetMs || old.endOffsetMs !== endOffsetMs) throw new ConflictException({ code: 'LEARNING_ACTIVITY_CONFLICT', message: 'Receipt hoạt động đã có nội dung khác.' });
          acks.push({ seq, startAt: old.startAt, endAt: old.endAt }); continue;
        }
        if (now.getTime() > session.anchorAt.getTime() + 7 * DAY_MS) throw new GoneException({ code: 'LEARNING_ACTIVITY_UPLOAD_EXPIRED', message: 'Khoảng hoạt động đã hết hạn đồng bộ.' });
        const start = session.anchorAt.getTime() + startOffsetMs;
        const end = Math.min(session.anchorAt.getTime() + endOffsetMs, now.getTime(), session.attempt.submittedAt?.getTime() ?? Infinity);
        const saved = await tx.learningActivitySegment.create({ data: { sessionId, seq, startOffsetMs, endOffsetMs,
          startAt: end > start ? new Date(start) : null, endAt: end > start ? new Date(end) : null } });
        if (saved.startAt != null) hasNewActiveSegment = true;
        acks.push({ seq, startAt: saved.startAt, endAt: saved.endAt });
      }
      let goalJustMet = false;
      if (hasNewActiveSegment && this.notifications) {
        const today = learningDate(now);
        const dayStart = learningDayStart(today);
        const [todayPlan, userProfile, activeMap] = await Promise.all([
          tx.learningDayPlan?.findUnique({
            where: { userId_date: { userId, date: today } },
            select: { dailyGoalMinutes: true },
          }) ?? Promise.resolve(null),
          tx.userProfile?.findUnique({
            where: { userId },
            select: { dailyGoalMinutes: true },
          }) ?? Promise.resolve(null),
          this.homeActiveSeconds(
            userId,
            [{ from: dayStart, to: new Date(Math.min(dayStart.getTime() + DAY_MS, now.getTime())) }],
            tx,
          ),
        ]);
        const dailyGoalMinutes = todayPlan?.dailyGoalMinutes ?? userProfile?.dailyGoalMinutes ?? null;
        const activeSeconds = activeMap.get(0) ?? 0;
        if (dailyGoalMinutes != null && dailyGoalMinutes > 0 && activeSeconds >= dailyGoalMinutes * 60) {
          const { created } = await this.notifications.createNotification(
            {
              userId,
              type: 'DAILY_GOAL_MET',
              title: 'Hoàn thành mục tiêu hôm nay!',
              body: `Bạn đã đạt mục tiêu ${dailyGoalMinutes} phút học hôm nay. Tuyệt vời!`,
              targetType: 'DAILY_PLAN',
              targetPayload: { date: today, dailyGoalMinutes },
              dedupeKey: `daily_goal_met:${today}`,
            },
            tx,
          );
          goalJustMet = created;
        }
      }
      return { acks, serverNow: now, goalJustMet };
    }, { timeout: 10000 });
  }
}
