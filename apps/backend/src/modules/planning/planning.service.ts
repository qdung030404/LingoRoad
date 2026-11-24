import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CefrLevel, LearningAttempt, LearningDayPlan, LearningKind, LearningLesson, LearningSkillLevel, LearningUnit, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityBatchDto, LearningPreferencesDto } from './planning.dto';
import { AdaptiveReadingTarget, decideReadingLevel, initialReadingLevel, isEligibleReadingEvidence } from './skill-level.policy';
import {
  chooseReadingFocus, countFocusQuestions, readingEvidence, READING_FOCUS_LABELS, ReadingFocusCode, selectReadingFocusAttempts,
} from './reading-focus.policy';

export const LEARNING_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const CURRENT_PLAN_POLICY_VERSION = 'adaptive-v2';
const DAY_MS = 86400000;
type Db = Prisma.TransactionClient;
export type SkillLevelChange = { kind: LearningKind; from: CefrLevel; to: CefrLevel; direction: 'UP' | 'DOWN' };
export type PlanItem = {
  id: string; lessonId: string; title: string; kind: LearningKind; estimatedMinutes: number;
  reasonCode: string; reason: string; focusSkillCode?: ReadingFocusCode;
};
export type PlannedLesson = LearningLesson & {
  unit?: { cefrLevel: CefrLevel } | null;
};

const CEFR_RANK: Record<CefrLevel, number> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
};

function skillCefrRank(
  placement: Record<string, unknown> | null | undefined,
  skillKey: 'reading' | 'listening',
): number {
  const entry = placement?.[skillKey];
  if (!entry || typeof entry !== 'object') return 0;
  const estimated = (entry as { estimatedCefr?: unknown }).estimatedCefr;
  if (typeof estimated === 'string' && estimated in CEFR_RANK) {
    return CEFR_RANK[estimated as CefrLevel];
  }
  return 0;
}

/** Filters daily plan suggestions by adaptive READING level (when adjusted) or skill Placement ceiling (minimum A2). */
export function isCefrEligible(
  lesson: PlannedLesson,
  placement?: Record<string, unknown> | null,
  readingTarget?: AdaptiveReadingTarget | null,
): boolean {
  const lessonCefr = lesson.unit?.cefrLevel;
  if (!lessonCefr) return true;

  if (lesson.kind === 'READING' && readingTarget) {
    const targetRank = CEFR_RANK[readingTarget.cefrLevel];
    const maxAllowedRank = readingTarget.strictCeiling
      ? targetRank
      : Math.max(CEFR_RANK.A2, targetRank);
    return CEFR_RANK[lessonCefr] <= maxAllowedRank;
  }

  let userSkillRank = 0;
  if (lesson.kind === 'READING') {
    userSkillRank = skillCefrRank(placement, 'reading');
  } else if (lesson.kind === 'LISTENING') {
    userSkillRank = skillCefrRank(placement, 'listening');
  } else {
    userSkillRank = Math.max(
      skillCefrRank(placement, 'reading'),
      skillCefrRank(placement, 'listening'),
    );
  }

  // Accounts without Placement or estimated at A1 still receive A1-A2 foundation lessons.
  const maxAllowedRank = Math.max(CEFR_RANK.A2, userSkillRank);
  return CEFR_RANK[lessonCefr] <= maxAllowedRank;
}
export type ProgressUnitStatus = 'COMPLETED' | 'IN_PROGRESS' | 'UPCOMING';
export type ProgressUnit = {
  id: string;
  code: string;
  cefrLevel: CefrLevel;
  orderIndex: number;
  title: string;
  description: string;
  totalLessons: number;
  completedLessonCount: number;
  status: ProgressUnitStatus;
};
export type ProgressScoreStats = {
  averageScore: number | null;
  completedAttemptCount: number;
  currentWeekAverage: number | null;
  previousWeekAverage: number | null;
  deltaPercent: number | null;
};
export const learningDate = (now: Date) => new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
export const learningDayStart = (date: string) => new Date(`${date}T00:00:00+07:00`);
const finishedOn = (a: Pick<LearningAttempt, 'status' | 'submittedAt'>, date: string) => a.status === 'COMPLETED' && a.submittedAt != null && learningDate(a.submittedAt) === date;
const recentFinished = (attempts: LearningAttempt[], id: string) => attempts.filter(a => a.lessonId === id && a.status === 'COMPLETED')
  .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0) || b.id.localeCompare(a.id))[0];

/** Maps published lessons and distinct completed lesson IDs onto ordered curriculum stages. */
export function buildProgressUnits(
  units: Pick<LearningUnit, 'id' | 'code' | 'cefrLevel' | 'orderIndex' | 'title' | 'description'>[],
  lessons: Pick<LearningLesson, 'id' | 'unitId'>[],
  completedLessonIds: Set<string>,
): ProgressUnit[] {
  const byUnit = new Map<string, string[]>();
  for (const lesson of lessons) {
    if (!lesson.unitId) continue;
    const list = byUnit.get(lesson.unitId) ?? [];
    list.push(lesson.id);
    byUnit.set(lesson.unitId, list);
  }
  let assignedActive = false;
  return units.map((unit) => {
    const lessonIds = byUnit.get(unit.id) ?? [];
    const totalLessons = lessonIds.length;
    const completedLessonCount = lessonIds.filter((id) => completedLessonIds.has(id)).length;
    const isCompleted = totalLessons > 0 && completedLessonCount >= totalLessons;
    let status: ProgressUnitStatus = 'UPCOMING';
    if (isCompleted) {
      status = 'COMPLETED';
    } else if (!assignedActive && totalLessons > 0) {
      status = 'IN_PROGRESS';
      assignedActive = true;
    }
    return {
      id: unit.id,
      code: unit.code,
      cefrLevel: unit.cefrLevel,
      orderIndex: unit.orderIndex,
      title: unit.title,
      description: unit.description,
      totalLessons,
      completedLessonCount,
      status,
    };
  });
}

/** Computes 0-100 practice attempt average and 7-day Vietnam-timezone trend; never alters CEFR. */
export function computeScoreStats(attempts: LearningAttempt[], now: Date): ProgressScoreStats {
  const valid = attempts.filter(
    (a) => a.status === 'COMPLETED' && a.submittedAt != null && a.correctCount != null && a.totalQuestions > 0,
  );
  const average = (rows: LearningAttempt[]): number | null => {
    if (!rows.length) return null;
    const total = rows.reduce((sum, a) => sum + (a.correctCount! / a.totalQuestions) * 100, 0);
    return Math.round(total / rows.length);
  };
  const todayStart = learningDayStart(learningDate(now));
  const currentWeekStart = new Date(todayStart.getTime() - 6 * DAY_MS);
  const previousWeekStart = new Date(todayStart.getTime() - 13 * DAY_MS);
  const currentWeekAverage = average(valid.filter((a) => a.submittedAt! >= currentWeekStart && a.submittedAt! <= now));
  const previousWeekAverage = average(
    valid.filter((a) => a.submittedAt! >= previousWeekStart && a.submittedAt! < currentWeekStart),
  );
  return {
    averageScore: average(valid),
    completedAttemptCount: valid.length,
    currentWeekAverage,
    previousWeekAverage,
    deltaPercent:
      currentWeekAverage != null && previousWeekAverage != null
        ? currentWeekAverage - previousWeekAverage
        : null,
  };
}

/** Deterministic baseline; completion is activity, not mastery. */
export function chooseDailyItems(lessons: PlannedLesson[], attempts: LearningAttempt[], date: string,
  minutes: number, preferred: LearningKind[], previous: PlanItem[] = [], placement?: Record<string, unknown> | null,
  readingTarget?: AdaptiveReadingTarget | null, readingFocus?: ReadingFocusCode): PlanItem[] {
  const selected: PlanItem[] = [];
  const seen = new Set<string>();
  const completeToday = new Set(attempts.filter(a => finishedOn(a, date)).map(a => a.lessonId));
  const focusCounts = new Map<string, number>();
  if (readingFocus && readingTarget) {
    for (const lesson of lessons) {
      if (lesson.kind === 'READING' && lesson.unit?.cefrLevel === readingTarget.cefrLevel) {
        focusCounts.set(lesson.id, countFocusQuestions(lesson.content, readingFocus));
      }
    }
  }
  const rankReadingFocus = (candidates: PlannedLesson[]): PlannedLesson[] => {
    if (!focusCounts.size) return candidates;
    const matchingTier = candidates.filter(lesson => focusCounts.has(lesson.id)).sort(
      (a, b) => focusCounts.get(b.id)! - focusCounts.get(a.id)!,
    );
    let index = 0;
    return candidates.map(lesson => focusCounts.has(lesson.id) ? matchingTier[index++] : lesson);
  };
  const add = (lesson: PlannedLesson, reasonCode: string, reason: string, force = false) => {
    if (seen.has(lesson.id)) return false;
    const used = selected.reduce((sum, item) => sum + item.estimatedMinutes, 0);
    if (!force && used + lesson.estimatedMinutes > minutes) return false;
    const old = previous.find(item => item.lessonId === lesson.id);
    if (old && completeToday.has(lesson.id)) {
      selected.push(old);
    } else {
      const focusSkillCode = !completeToday.has(lesson.id) && (focusCounts.get(lesson.id) ?? 0) > 0 ? readingFocus : undefined;
      selected.push({
        id: old?.id ?? randomUUID(), lessonId: lesson.id, title: lesson.title, kind: lesson.kind,
        estimatedMinutes: lesson.estimatedMinutes, reasonCode,
        reason: focusSkillCode ? `Luyện thêm · ${READING_FOCUS_LABELS[focusSkillCode]}` : reason,
        ...(focusSkillCode ? { focusSkillCode } : {}),
      });
    }
    seen.add(lesson.id); return true;
  };
  // Keep already completed snapshots, even if the catalogue was unpublished or ceiling lowered later.
  for (const item of previous) if (completeToday.has(item.lessonId)) { selected.push(item); seen.add(item.lessonId); }
  for (const lesson of lessons) if (completeToday.has(lesson.id)) add(lesson, 'COMPLETED_TODAY', 'Đã hoàn thành hôm nay', true);
  const placementScore = (kind: LearningKind): number => {
    const key = kind === 'READING' ? 'reading' : kind === 'LISTENING' ? 'listening' : null;
    const value = key && placement?.[key] as { correctCount?: number; totalItems?: number } | undefined;
    return value && value.correctCount != null && value.totalItems ? value.correctCount / value.totalItems : 1;
  };
  const targetReadingRank = readingTarget ? CEFR_RANK[readingTarget.cefrLevel] : null;
  const readingDistance = (lesson: PlannedLesson): number => {
    if (lesson.kind !== 'READING' || targetReadingRank == null || !lesson.unit?.cefrLevel) return 0;
    return Math.abs(CEFR_RANK[lesson.unit.cefrLevel] - targetReadingRank);
  };
  // Rank READING strictly by target CEFR distance first, then reassign the group's sortOrder slots
  // so cross-kind sorting maintains strict weak ordering without non-transitive cycles.
  const readingOrderMap = new Map<string, number>();
  if (readingTarget) {
    const readingGroup = lessons
      .filter(l => l.kind === 'READING')
      .sort((a, b) => readingDistance(a) - readingDistance(b) || a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
    const slots = [...readingGroup].map(l => l.sortOrder).sort((x, y) => x - y);
    readingGroup.forEach((l, i) => readingOrderMap.set(l.id, slots[i]));
  }
  const mixOrder = (lesson: PlannedLesson): number => readingOrderMap.get(lesson.id) ?? lesson.sortOrder;
  const newReason = (lesson: PlannedLesson): string =>
    lesson.kind === 'READING' && readingTarget && lesson.unit?.cefrLevel === readingTarget.cefrLevel
      ? `Bài mới · đúng mức ${readingTarget.cefrLevel}`
      : 'Bài mới';
  const ordered = [...lessons].sort((a, b) => Number(!preferred.includes(a.kind)) - Number(!preferred.includes(b.kind))
    || (['READING', 'LISTENING'].includes(a.kind) && ['READING', 'LISTENING'].includes(b.kind) ? placementScore(a.kind) - placementScore(b.kind) : 0)
    || mixOrder(a) - mixOrder(b)
    || a.code.localeCompare(b.code));
  const eligible = ordered.filter(l => isCefrEligible(l, placement, readingTarget));
  const fresh = rankReadingFocus(eligible.filter(l => !recentFinished(attempts, l.id) && !seen.has(l.id)));
  // Reserve an opportunity to progress before offering a review.
  for (const lesson of fresh) if (add(lesson, 'NEW', newReason(lesson))) break;
  const review = eligible.filter(l => {
    const latest = recentFinished(attempts, l.id);
    return latest && latest.correctCount! / latest.totalQuestions < .8 && !seen.has(l.id) && !completeToday.has(l.id);
  }).sort((a, b) => {
    const x = recentFinished(attempts, a.id)!, y = recentFinished(attempts, b.id)!;
    return Number(!preferred.includes(a.kind)) - Number(!preferred.includes(b.kind))
      || x.correctCount! / x.totalQuestions - y.correctCount! / y.totalQuestions
      || x.submittedAt!.getTime() - y.submittedAt!.getTime()
      || mixOrder(a) - mixOrder(b);
  });
  let rotationFallback: PlannedLesson | undefined;
  if (fresh.length) {
    for (const lesson of rankReadingFocus(review)) {
      const result = recentFinished(attempts, lesson.id)!;
      if (add(lesson, 'REVIEW', `Kết quả gần nhất ${result.correctCount}/${result.totalQuestions}`)) break;
    }
    for (const lesson of fresh) add(lesson, 'NEW', newReason(lesson));
  } else {
    const pool = eligible.filter(l => !seen.has(l.id) && !completeToday.has(l.id));
    const practicedAt = (lesson: PlannedLesson): number => recentFinished(attempts, lesson.id)?.submittedAt?.getTime() ?? 0;
    // Prioritize target-tier READING within READING's own practicedAt slots, using oldest practice to break ties within a tier.
    const rotationTimeMap = new Map<string, number>();
    const rotationSubRank = new Map<string, number>();
    if (readingTarget) {
      const readingPool = pool
        .filter(l => l.kind === 'READING')
        .sort((a, b) =>
          readingDistance(a) - readingDistance(b)
          || practicedAt(a) - practicedAt(b)
          || mixOrder(a) - mixOrder(b)
          || a.code.localeCompare(b.code));
      const timeSlots = [...readingPool].map(practicedAt).sort((x, y) => x - y);
      readingPool.forEach((l, i) => {
        rotationTimeMap.set(l.id, timeSlots[i]);
        rotationSubRank.set(l.id, i);
      });
    }
    const rotationTime = (lesson: PlannedLesson): number => rotationTimeMap.get(lesson.id) ?? practicedAt(lesson);
    const rotation = rankReadingFocus(pool.sort((a, b) =>
      Number(!preferred.includes(a.kind)) - Number(!preferred.includes(b.kind))
      || rotationTime(a) - rotationTime(b)
      || (rotationSubRank.get(a.id) ?? 0) - (rotationSubRank.get(b.id) ?? 0)
      || mixOrder(a) - mixOrder(b)
      || a.code.localeCompare(b.code)));
    rotationFallback = rotation[0];
    for (const lesson of rotation) add(lesson, 'ROTATION', 'Luyện lại bài lâu chưa học');
  }
  if (!selected.length) {
    const candidate = fresh[0] ?? rotationFallback ?? eligible[0];
    if (candidate) {
      add(
        candidate,
        fresh.includes(candidate) ? 'NEW' : 'ROTATION',
        fresh.includes(candidate) ? newReason(candidate) : 'Luyện lại bài lâu chưa học',
        true,
      );
    }
  }
  return selected;
}

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
    return { dailyGoalMinutes: profile.dailyGoalMinutes, preferredKinds: profile.preferredKinds, version: profile.preferencesVersion };
  }
  async preferences(userId: string) { return this.preferenceDto(await this.profile(this.prisma, userId)); }

  async updatePreferences(userId: string, dto: LearningPreferencesDto) {
    return this.prisma.$transaction(async tx => {
      await this.lock(tx, userId);
      const profile = await this.profile(tx, userId);
      if (profile.preferencesVersion !== dto.expectedVersion) this.conflict();
      const preferredKinds = [...new Set(dto.preferredKinds)];
      const changed = profile.dailyGoalMinutes !== dto.dailyGoalMinutes || [...profile.preferredKinds].sort().join() !== [...preferredKinds].sort().join();
      const saved = changed ? await tx.userProfile.update({ where: { userId }, data: {
        dailyGoalMinutes: dto.dailyGoalMinutes, preferredKinds, preferencesVersion: { increment: 1 },
      } }) : profile;
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

  async updateAccountProfile<T>(userId: string, write: (db: Db) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async tx => {
      await this.lock(tx, userId);
      const result = await write(tx);
      const existing = await tx.learningDayPlan.findUnique({ where: { userId_date: { userId, date: learningDate(new Date()) } } });
      if (existing) await this.ensureIn(tx, userId);
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
        include: { unit: { select: { cefrLevel: true } } },
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
    if (!opts?.force && currentPlan) return existing;
    const [lessons, attempts] = await Promise.all([
      db.learningLesson.findMany({
        where: { published: true },
        include: { unit: { select: { cefrLevel: true } } },
        orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      }),
      db.learningAttempt.findMany({ where: { userId } }),
    ]);
    const readingTarget: AdaptiveReadingTarget | null = skillLevel
      ? { cefrLevel: skillLevel.cefrLevel, strictCeiling: skillLevel.source === 'ADAPTIVE' }
      : null;
    let readingFocus: ReadingFocusCode | undefined;
    if (skillLevel && attempts.some(attempt => attempt.status === 'COMPLETED')) {
      const exposureByLesson = opts?.exposureByLesson ?? new Map((await db.learningAnswerExposure.findMany({
        where: { userId }, select: { lessonId: true, firstAttemptId: true },
      })).map(exposure => [exposure.lessonId, exposure.firstAttemptId]));
      const evidence = selectReadingFocusAttempts(attempts, exposureByLesson, skillLevel, now);
      if (evidence.length >= 2) {
        const answers = await db.learningAttemptAnswer.findMany({
          where: { attemptId: { in: evidence.map(attempt => attempt.id) }, checked: true },
          select: { attemptId: true, questionId: true, isCorrect: true },
        });
        readingFocus = chooseReadingFocus(evidence, answers);
      }
    }
    const items = chooseDailyItems(
      lessons, attempts, date, profile.dailyGoalMinutes, profile.preferredKinds,
      existing?.items as unknown as PlanItem[] ?? [],
      placement?.skillResults as Record<string, unknown> | undefined,
      readingTarget,
      readingFocus,
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
    const plan = await this.prisma.learningDayPlan.findUnique({ where: { userId_date: { userId, date: learningDate(new Date()) } } });
    if (!plan) return { plan: null };
    const [skillRow, placement] = await Promise.all([
      this.prisma.learningSkillLevel?.findUnique({ where: { userId_kind: { userId, kind: 'READING' } } }) ?? Promise.resolve(null),
      this.prisma.placementSession?.findFirst({
        where: { userId, status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { skillResults: true, completedAt: true },
      }) ?? Promise.resolve(null),
    ]);
    const init = initialReadingLevel(placement?.skillResults as Record<string, unknown> | undefined, placement?.completedAt);
    const needsSkillUpgrade = skillRow != null && this.shouldUpgradeFromPlacement(skillRow, init);
    const staleBeforePlacement = placement?.completedAt != null && plan.updatedAt < placement.completedAt;
    if (plan.policyVersion !== CURRENT_PLAN_POLICY_VERSION || needsSkillUpgrade || staleBeforePlacement) {
      return this.ensureToday(userId);
    }
    return { plan: await this.planDto(plan) };
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
    const values = windows.map(({ from, to }, index) => Prisma.sql`(${index}::int, ${from}::timestamptz, ${to}::timestamptz)`);
    const rows = await this.prisma.$queryRaw<{ idx: number; seconds: number }[]>`
      WITH windows(idx, starts, ends) AS (VALUES ${Prisma.join(values)}),
      merged AS (
        SELECT w.idx, range_agg(tstzrange(GREATEST(s.start_at AT TIME ZONE 'UTC', w.starts),
          LEAST(s.end_at AT TIME ZONE 'UTC', w.ends), '[)')) AS spans
        FROM learning_activity_segments s JOIN learning_activity_sessions a ON a.id = s.session_id
        JOIN windows w ON (s.end_at AT TIME ZONE 'UTC') > w.starts AND (s.start_at AT TIME ZONE 'UTC') < w.ends
        WHERE a.user_id = ${userId}::uuid AND s.start_at IS NOT NULL
        GROUP BY w.idx
      )
      SELECT idx, FLOOR(SUM(EXTRACT(EPOCH FROM (upper(span) - lower(span)))))::double precision AS seconds
      FROM merged CROSS JOIN LATERAL unnest(spans) AS pieces(span) GROUP BY idx`;
    return new Map(rows.map(row => [row.idx, row.seconds]));
  }

  /** UTC ranges are unioned across devices before summing. Time is never inferred from attempts. */
  async activeSeconds(userId: string, from: Date, to: Date): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ milliseconds: number }[]>`
      WITH merged AS (
        SELECT range_agg(tstzrange(GREATEST(s.start_at AT TIME ZONE 'UTC', ${from}::timestamptz),
          LEAST(s.end_at AT TIME ZONE 'UTC', ${to}::timestamptz), '[)')) AS ranges
        FROM learning_activity_segments s JOIN learning_activity_sessions a ON a.id = s.session_id
        WHERE a.user_id = ${userId}::uuid AND s.start_at IS NOT NULL
          AND (s.end_at AT TIME ZONE 'UTC') > ${from}::timestamptz
          AND (s.start_at AT TIME ZONE 'UTC') < ${to}::timestamptz
      ), pieces AS (SELECT unnest(ranges) AS span FROM merged)
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (upper(span) - lower(span))) * 1000), 0)::double precision AS milliseconds FROM pieces`;
    return Math.floor((rows[0]?.milliseconds ?? 0) / 1000);
  }

  async progress(userId: string) {
    const now = new Date(), today = learningDate(now), start = learningDayStart(today);
    const [profile, plans, attempts, totalLessons, units, first, placement, skillLevel] = await Promise.all([
      this.profile(this.prisma, userId), this.prisma.learningDayPlan.findMany({ where: { userId } }),
      this.prisma.learningAttempt.findMany({ where: { userId }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.learningLesson.findMany({ where: { published: true }, select: { id: true, unitId: true } }),
      this.prisma.learningUnit.findMany({ orderBy: [{ cefrLevel: 'asc' }, { orderIndex: 'asc' }] }),
      this.prisma.learningActivitySession.findFirst({ where: { userId }, orderBy: { anchorAt: 'asc' }, select: { anchorAt: true } }),
      this.prisma.placementSession.findFirst({ where: { userId, status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, select: { skillResults: true, completedAt: true } }),
      this.prisma.learningSkillLevel?.findUnique({ where: { userId_kind: { userId, kind: 'READING' } } }) ?? Promise.resolve(null),
    ]);
    const days = await Promise.all(Array.from({ length: 7 }, async (_, i) => {
      const dayStart = new Date(start.getTime() - (6 - i) * DAY_MS), date = learningDate(dayStart);
      const completed = attempts.filter(a => finishedOn(a, date));
      const activeSeconds = await this.activeSeconds(userId, dayStart, new Date(Math.min(dayStart.getTime() + DAY_MS, now.getTime())));
      const target = plans.find(p => p.date === date)?.dailyGoalMinutes ?? (date === today ? profile.dailyGoalMinutes : null);
      return { date, dailyGoalMinutes: target, activeSeconds, goalMet: target != null && activeSeconds >= target * 60,
        completedLessonCount: new Set(completed.map(a => a.lessonId)).size, completedAttemptCount: completed.length,
        hasActivity: activeSeconds > 0 || completed.length > 0, timeMeasured: first != null && learningDate(first.anchorAt) <= date };
    }));
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
      activeSeconds: await this.activeSeconds(userId, new Date(0), now),
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
