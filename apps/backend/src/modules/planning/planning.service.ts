import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CefrLevel, LearningAttempt, LearningDayPlan, LearningKind, LearningSkillLevel, Prisma } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityBatchDto, LearningPreferencesDto, PreferredSkill } from './planning.dto';
import { decideReadingLevel, initialReadingLevel, isEligibleReadingEvidence } from './skill-level.policy';
import { readingEvidence, ReadingEvidenceAttempt } from './reading-focus.policy';
import {
  CURRENT_PLAN_POLICY_VERSION,
  learningDate,
  PlanItem,
  SkillLevelChange,
} from './planning.helpers';
import {
  buildPlacementNotification,
  buildSkillLevelNotification,
} from './planning-activity.helpers';
import {
  buildPlanDtoHelper,
  computeDailyPlanItemsHelper,
  openActivityOp,
  segmentsOp,
} from './planning-plan-builder.helpers';
import {
  buildHomeResponseHelper,
  buildProgressResponseHelper,
  fetchHomeLessonHelper,
} from './planning-queries.helper';
import {
  readPreferredSkillsForUser,
  resolvePreferredSkills,
  writePreferredSkillsForUser,
} from './planning-receipts.helpers';

export {
  buildCefrMilestones,
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
  MILESTONE_CEFR_ORDER,
} from './planning.helpers';
export {
  PREFERRED_SKILLS_RECEIPT_ID,
  readPreferredSkillsForUser,
  readStoredPreferredSkillsForUser,
  readWritingHistoryForUser,
  recordWritingCompletionForUser,
  resolvePreferredSkills,
  resolvePreferredSkillsWithFallback,
  WRITING_HISTORY_RECEIPT_ID,
  writePreferredSkillsForUser,
} from './planning-receipts.helpers';
export type {
  MilestoneLessonInput,
  PlanItem,
  PlannedLesson,
  PlannedSpeakingTopic,
  PlannedWritingItem,
  ProgressMilestone,
  ProgressScoreStats,
  ProgressUnit,
  ProgressUnitStatus,
  SkillLevelChange,
} from './planning.helpers';

type Db = Prisma.TransactionClient;

const PLAN_ATTEMPT_SELECT = {
  id: true,
  lessonId: true,
  status: true,
  submittedAt: true,
  correctCount: true,
  totalQuestions: true,
  contentVersion: true,
  eligibleForLevelEval: true,
  lessonSnapshot: true,
} as const;

const LESSON_KIND_SET = new Set<string>(Object.values(LearningKind));

function isLessonKind(value: string): value is LearningKind {
  return LESSON_KIND_SET.has(value);
}

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}
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
      (existing.source === 'PLACEMENT' || existing.source === 'ADAPTIVE') &&
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
          buildPlacementNotification(event.userId!, placementKey, estimatedCefr),
          tx,
        );
      }
    });
  }

  /** Evaluates READING CEFR promotion/demotion within a caller transaction already holding `users FOR UPDATE`. */
  async evaluateReadingLevel(
    tx: Db,
    userId: string,
    submittedAttempt: ReadingEvidenceAttempt,
  ): Promise<SkillLevelChange | null> {
    const snapshot = submittedAttempt.lessonSnapshot as { kind?: string };
    if (snapshot?.kind !== 'READING') return null;
    const skillLevel = await this.ensureReadingSkillLevel(tx, userId);
    const [attempts, exposures, readingLessons] = await Promise.all([
      tx.learningAttempt.findMany({
        where: { userId, status: 'COMPLETED' },
        select: PLAN_ATTEMPT_SELECT,
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
      await this.notifications.createNotification(
        buildSkillLevelNotification(userId, submittedAttempt.id, skillLevel.cefrLevel, decision.next, decision.direction),
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
      db.placementSession.findFirst({
        where: { userId, status: 'COMPLETED' },
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        select: { estimatedCefr: true, skillResults: true, completedAt: true },
      }),
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
    const items = await computeDailyPlanItemsHelper({
      db,
      userId,
      now,
      date,
      profile,
      placement,
      skillLevel,
      existingItems: existing?.items as unknown as PlanItem[] ?? [],
      exposureByLesson: opts?.exposureByLesson,
      preferredSkillsOverride: opts?.preferredSkillsOverride,
    });
    if (currentPlan && isDeepStrictEqual(items, existing.items)) return existing;
    const savedPlan = await db.learningDayPlan.upsert({
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
    this.notifications?.invalidateDailyCheck?.(userId);
    return savedPlan;
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
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        select: { estimatedCefr: true, skillResults: true, completedAt: true },
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
    const items = await computeDailyPlanItemsHelper({
      db: this.prisma,
      userId,
      now,
      date,
      profile,
      placement,
      skillLevel,
      existingItems: existing.items as unknown as PlanItem[],
    });
    if (isDeepStrictEqual(items, existing.items)) return { plan: await this.planDto(existing) };
    return this.ensureToday(userId);
  }
  private planDto(plan: LearningDayPlan) {
    return buildPlanDtoHelper(this.prisma, plan, isLessonKind);
  }

  async ensureHomePlan(userId: string) {
    const [{ plan }, placement] = await Promise.all([
      this.ensureToday(userId),
      this.prisma.placementSession?.findFirst?.({
        where: { userId, status: 'COMPLETED' },
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        select: { estimatedCefr: true },
      }) ?? Promise.resolve(null),
    ]);
    return {
      date: plan?.date ?? learningDate(new Date()),
      plan,
      continueLesson: await this.homeLesson(userId, plan?.continueLessonId ?? null, false, placement?.estimatedCefr ?? null),
    };
  }

  private homeLesson(
    userId: string,
    lessonId: string | null,
    useFallback = false,
    minimumCefr?: CefrLevel | null,
  ) {
    return fetchHomeLessonHelper(
      this.prisma,
      userId,
      lessonId,
      useFallback,
      minimumCefr,
    );
  }

  home(userId: string) {
    return buildHomeResponseHelper({
      prisma: this.prisma,
      userId,
      notifications: this.notifications,
      getProfile: (db, uid) => this.profile(db, uid),
      shouldUpgradeFromPlacement: (existing, init) =>
        this.shouldUpgradeFromPlacement(existing, init),
      planDto: (plan) => this.planDto(plan),
      preferenceDto: (profile, storedSkills) =>
        this.preferenceDto(profile, storedSkills),
    });
  }

  progress(userId: string, now: Date = new Date()) {
    return buildProgressResponseHelper({
      prisma: this.prisma,
      userId,
      now,
      getProfile: (db, uid) => this.profile(db, uid),
      shouldUpgradeFromPlacement: (existing, init) =>
        this.shouldUpgradeFromPlacement(existing, init),
      syncPlacementSkillLevel: (uid, today, placement) =>
        this.prisma.$transaction(async (tx) => {
          await this.lock(tx, uid);
          const { skillLevel: upgradedSkill, upgraded } =
            await this.resolveReadingSkillLevel(tx, uid, placement);
          const existingPlan = await tx.learningDayPlan.findUnique({
            where: { userId_date: { userId: uid, date: today } },
            select: { id: true },
          });
          if (existingPlan && upgraded) {
            await this.ensureIn(tx, uid, {
              force: true,
              skillLevel: upgradedSkill,
            });
          }
          return upgradedSkill;
        }),
    });
  }

  async summary(userId: string) {
    const [progress, today] = await Promise.all([this.progress(userId), this.today(userId)]);
    const fresh = today.plan ? null : await this.prisma.learningLesson.findFirst({ where: { published: true,
      attempts: { none: { userId, status: 'COMPLETED' } } }, orderBy: { sortOrder: 'asc' } });
    return { ...progress.totals, continueLessonId: today.plan?.continueLessonId ?? fresh?.id ?? null,
      continueAttemptId: null };
  }

  openActivity(userId: string, attemptId: string, clientRunId: string) {
    return openActivityOp(this.prisma, userId, attemptId, clientRunId);
  }

  segments(userId: string, sessionId: string, dto: ActivityBatchDto) {
    return segmentsOp(this.prisma, userId, sessionId, dto, this.notifications);
  }
}
