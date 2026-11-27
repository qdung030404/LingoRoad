import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CefrLevel, LearningAttempt, LearningDayPlan, LearningKind, LearningSkillLevel, Prisma } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityBatchDto, LearningPreferencesDto } from './planning.dto';
import { AdaptiveReadingTarget, decideReadingLevel, initialReadingLevel, isEligibleReadingEvidence } from './skill-level.policy';
import {
  chooseReadingFocus, readingEvidence, ReadingFocusCode, selectReadingFocusAttempts,
} from './reading-focus.policy';
import {
  buildProgressUnits,
  chooseDailyItems,
  computeScoreStats,
  CURRENT_PLAN_POLICY_VERSION,
  DAY_MS,
  finishedOn,
  LEARNING_TIME_ZONE,
  learningDate,
  learningDayStart,
  PlanItem,
  PlannedLesson,
  ProgressScoreStats,
  ProgressUnit,
  ProgressUnitStatus,
  SkillLevelChange,
} from './planning.helpers';

export {
  buildProgressUnits,
  chooseDailyItems,
  computeScoreStats,
  CURRENT_PLAN_POLICY_VERSION,
  isCefrEligible,
  LEARNING_TIME_ZONE,
  learningDate,
  learningDayStart,
} from './planning.helpers';
export type {
  PlanItem,
  PlannedLesson,
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

@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService) {}
  private invalid(message: string): never { throw new BadRequestException({ code: 'LEARNING_INVALID_ACTIVITY', message }); }
  private missing(): never { throw new NotFoundException({ code: 'LEARNING_RECORD_NOT_FOUND', message: 'Không tìm thấy dữ liệu học tập.' }); }
  private conflict(): never { throw new ConflictException({ code: 'LEARNING_PREFERENCES_CONFLICT', message: 'Thiết lập đã thay đổi. Hãy tải lại trước khi lưu.' }); }
  private async lock(db: Db, userId: string) { await db.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`; }
  private async profile(db: Db, userId: string) {
    const profile = await db.userProfile.findUnique({ where: { userId } });
    if (!profile) this.missing();
    return profile;
  }
  private preferenceDto(profile: Awaited<ReturnType<PlanningService['profile']>>) {
    return {
      learningPurpose: profile.learningPurpose ?? null,
      targetCefr: profile.targetCefr,
      dailyGoalMinutes: profile.dailyGoalMinutes,
      preferredKinds: profile.preferredKinds,
      version: profile.preferencesVersion,
    };
  }
  async preferences(userId: string) {
    const profile = await this.profile(this.prisma, userId);
    const [skillLevel, placement] = await Promise.all([
      this.prisma.learningSkillLevel?.findUnique({ where: { userId_kind: { userId, kind: 'READING' } } }) ?? Promise.resolve(null),
      this.prisma.placementSession?.findFirst({
        where: { userId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { skillResults: true, completedAt: true },
      }) ?? Promise.resolve(null),
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
    return { ...this.preferenceDto(profile), readingLevel };
  }

  async updatePreferences(userId: string, dto: LearningPreferencesDto) {
    return this.prisma.$transaction(async tx => {
      await this.lock(tx, userId);
      const profile = await this.profile(tx, userId);
      if (profile.preferencesVersion !== dto.expectedVersion) this.conflict();
      const preferredKinds = [...new Set(dto.preferredKinds)];
      const kindsChanged = [...profile.preferredKinds].sort().join() !== [...preferredKinds].sort().join();
      const minutesChanged = profile.dailyGoalMinutes !== dto.dailyGoalMinutes;
      const purposeChanged = dto.learningPurpose !== undefined && dto.learningPurpose !== profile.learningPurpose;
      const cefrChanged = dto.targetCefr !== undefined && dto.targetCefr !== profile.targetCefr;
      const changed = minutesChanged || kindsChanged || purposeChanged || cefrChanged;
      const saved = changed ? await tx.userProfile.update({
        where: { userId },
        data: {
          dailyGoalMinutes: dto.dailyGoalMinutes,
          preferredKinds,
          ...(dto.learningPurpose === undefined ? {} : { learningPurpose: dto.learningPurpose }),
          ...(dto.targetCefr === undefined ? {} : { targetCefr: dto.targetCefr }),
          preferencesVersion: { increment: 1 },
        },
      }) : profile;
      const existing = await tx.learningDayPlan.findUnique({ where: { userId_date: { userId, date: learningDate(new Date()) } } });
      if (existing && changed) await this.ensureIn(tx, userId);
      return this.preferenceDto(saved);
    });
  }

  /** Profile writes share the same revision and replan path without creating a pre-placement plan. */
  async reconcileProfileGoal(userId: string) {
    return this.prisma.$transaction(async tx => {
      await this.lock(tx, userId);
      const existing = await tx.learningDayPlan.findUnique({ where: { userId_date: { userId, date: learningDate(new Date()) } } });
      if (existing) await this.ensureIn(tx, userId);
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
  async onPlacementCompleted(event: { userId?: string }) {
    if (!event?.userId) return;
    await this.prisma.$transaction(async tx => {
      await this.lock(tx, event.userId!);
      const { skillLevel, upgraded } = await this.resolveReadingSkillLevel(tx, event.userId!);
      const existingPlan = await tx.learningDayPlan.findUnique({
        where: { userId_date: { userId: event.userId!, date: learningDate(new Date()) } },
        select: { id: true },
      });
      if (existingPlan && upgraded) {
        await this.ensureIn(tx, event.userId!, { force: true, skillLevel });
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
  ): Promise<PlanItem[]> {
    const [lessons, attempts] = await Promise.all([
      db.learningLesson.findMany({
        where: { published: true },
        select: PLAN_LESSON_SELECT,
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      }),
      db.learningAttempt.findMany({ where: { userId } }),
    ]);
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
    return chooseDailyItems(
      plannedLessons, attempts, date, profile.dailyGoalMinutes, profile.preferredKinds,
      existingItems,
      placement?.skillResults as Record<string, unknown> | undefined,
      readingTarget,
      readingFocus,
    );
  }

  private async ensureIn(db: Db, userId: string, opts?: {
    force?: boolean;
    existingOnly?: boolean;
    skillLevel?: LearningSkillLevel;
    exposureByLesson?: ReadonlyMap<string, string>;
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
    const planItems = plan.items as unknown as PlanItem[];
    const start = learningDayStart(plan.date);
    const attempts = planItems.length === 0 ? [] : await this.prisma.learningAttempt.findMany({
      where: {
        userId: plan.userId, lessonId: { in: planItems.map(item => item.lessonId) }, status: 'COMPLETED',
        submittedAt: { gte: start, lt: new Date(start.getTime() + DAY_MS) },
      },
      select: { id: true, lessonId: true, status: true, submittedAt: true, historyHiddenAt: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    const items = planItems.map(item => {
      const completed = attempts.filter(a => a.lessonId === item.lessonId && finishedOn(a, plan.date));
      const visibleAttempt = completed.find(a => a.historyHiddenAt == null);
      const normalized = item.reasonCode === 'RESUME'
        ? { ...item, reasonCode: completed.length ? 'COMPLETED_TODAY' : 'NEW', reason: completed.length ? 'Đã hoàn thành hôm nay' : 'Bài mới' }
        : item;
      return { ...normalized, completed: completed.length > 0, activeAttemptId: null, completedAttemptId: visibleAttempt?.id ?? null };
    });
    const next = items.find(item => !item.completed);
    return { id: plan.id, date: plan.date, timeZone: LEARNING_TIME_ZONE, version: plan.version, policyVersion: plan.policyVersion, dailyGoalMinutes: plan.dailyGoalMinutes,
      estimatedMinutes: items.reduce((sum, item) => sum + item.estimatedMinutes, 0), completedCount: items.filter(item => item.completed).length,
      totalCount: items.length, items, continueLessonId: next?.lessonId ?? null, continueAttemptId: null };
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
    const [profile, plans, attempts, completedLessons, first, placement, skill, seconds] = await Promise.all([
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
    ]);
    const byDate = new Map(plans.map(plan => [plan.date, plan]));
    const current = byDate.get(date);
    const initial = initialReadingLevel(placement?.skillResults as Record<string, unknown> | undefined, placement?.completedAt);
    const planStatus = !current ? 'missing' : current.policyVersion !== CURRENT_PLAN_POLICY_VERSION ||
      current.preferencesVersion !== profile.preferencesVersion || current.dailyGoalMinutes !== profile.dailyGoalMinutes ||
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
      date, planStatus, plan, preferences: this.preferenceDto(profile), today: days[6], days,
      totals: { completedLessonCount: completedLessons, activeSeconds: seconds.get(week.length) ?? 0 },
      continueLesson: await this.homeLesson(userId, plan?.continueLessonId ?? null, plan == null),
    };
  }

  private async homeActiveSeconds(userId: string, windows: { from: Date; to: Date }[]) {
    if (!windows.length) return new Map<number, number>();
    const values = windows.map(({ from, to }, index) => Prisma.sql`(${index}::int, ${from}::timestamptz, ${to}::timestamptz)`);
    const rows = await this.prisma.$queryRaw<{ idx: number; seconds: number }[]>`
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
    return new Map(rows.map(row => [row.idx, Number(row.seconds ?? 0)]));
  }

  /** UTC ranges are unioned across devices before summing. Time is never inferred from attempts. */
  async activeSeconds(userId: string, from: Date, to: Date): Promise<number> {
    if (from >= to) return 0;
    const rows = await this.prisma.$queryRaw<{ milliseconds: number }[]>`
      WITH merged AS (
        SELECT range_agg(tstzrange(GREATEST(s.start_at AT TIME ZONE 'UTC', ${from}::timestamptz),
          LEAST(s.end_at AT TIME ZONE 'UTC', ${to}::timestamptz), '[)')) AS ranges
        FROM learning_activity_segments s JOIN learning_activity_sessions a ON a.id = s.session_id
        WHERE a.user_id = ${userId}::uuid AND s.start_at IS NOT NULL
          AND s.end_at > (${from}::timestamptz AT TIME ZONE 'UTC')
          AND s.start_at < (${to}::timestamptz AT TIME ZONE 'UTC')
      ), pieces AS (SELECT unnest(ranges) AS span FROM merged)
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (upper(span) - lower(span))) * 1000), 0)::double precision AS milliseconds FROM pieces`;
    return Math.floor((rows[0]?.milliseconds ?? 0) / 1000);
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
        acks.push({ seq, startAt: saved.startAt, endAt: saved.endAt });
      }
      return { acks, serverNow: now };
    }, { timeout: 10000 });
  }
}
