import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CefrLevel, LearningAttempt, LearningDayPlan, LearningKind, LearningSkillLevel, Prisma } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityBatchDto, LearningPreferencesDto, PreferredSkill } from './planning.dto';
import { AdaptiveReadingTarget, decideReadingLevel, initialReadingLevel, isEligibleReadingEvidence } from './skill-level.policy';
import {
  chooseReadingFocus,
  isReadingFocusCandidate,
  readingEvidence,
  ReadingEvidenceAttempt,
  ReadingFocusAttempt,
  ReadingFocusCode,
  selectReadingFocusAttempts,
} from './reading-focus.policy';
import {
  buildCefrMilestones,
  buildDailyRoadmapItems,
  buildLearningWeekWindows,
  buildProgressUnits,
  buildWeekDaySummaries,
  chooseDailyItems,
  computeScoreStats,
  CURRENT_PLAN_POLICY_VERSION,
  DAY_MS,
  dedupePlanItems,
  learningDate,
  learningDayStart,
  MILESTONE_CEFR_ORDER,
  MilestoneLessonInput,
  PlanItem,
  PlannedLesson,
  PlannedSpeakingTopic,
  resolveGrammarTopicCode,
  SkillLevelChange,
} from './planning.helpers';
import {
  assemblePlanDto,
  buildPlacementNotification,
  buildSkillLevelNotification,
  buildSpeakingPracticeMaps,
  buildWritingPlanPool,
  queryHomeActiveSeconds,
} from './planning-activity.helpers';
import {
  readPreferredSkillsForUser,
  readStoredPreferredSkillsForUser,
  readWritingHistoryForUser,
  recordWritingCompletionForUser,
  resolvePreferredSkills,
  resolvePreferredSkillsWithFallback,
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

const PLAN_LESSON_SELECT = {
  id: true,
  code: true,
  kind: true,
  title: true,
  estimatedMinutes: true,
  sortOrder: true,
  unit: { select: { cefrLevel: true } },
  grammarTopic: { select: { cefrLevel: true } },
} as const;

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

  private async computeDailyPlanItems(
    db: Db,
    userId: string,
    now: Date,
    date: string,
    profile: Awaited<ReturnType<PlanningService['profile']>>,
    placement: { estimatedCefr?: CefrLevel | null; skillResults: unknown; completedAt: Date | null } | null,
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
      db.learningAttempt.findMany({
        where: { userId },
        select: PLAN_ATTEMPT_SELECT,
      }),
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
    const { completedSpeakingIdsToday, practicedSpeakingAt } = buildSpeakingPracticeMaps(
      speakingSubmissions,
      voiceConversations,
      date,
    );
    const { writingItems, completedWritingIdsToday, practicedWritingAt } = buildWritingPlanPool(
      rawWritingItems,
      writingHistory,
      date,
    );
    const readingTarget: AdaptiveReadingTarget | null = skillLevel
      ? { cefrLevel: skillLevel.cefrLevel, strictCeiling: skillLevel.source === 'ADAPTIVE' }
      : null;
    let readingFocus: ReadingFocusCode | undefined;
    if (skillLevel && attempts.some(attempt => attempt.status === 'COMPLETED')) {
      const resolvedExposure = exposureByLesson ?? new Map((await db.learningAnswerExposure.findMany({
        where: { userId }, select: { lessonId: true, firstAttemptId: true },
      })).map(exposure => [exposure.lessonId, exposure.firstAttemptId]));
      const focusCandidates: ReadingFocusAttempt[] = attempts.filter(attempt =>
        isReadingFocusCandidate(attempt, resolvedExposure, skillLevel, now),
      );
      if (focusCandidates.length > 0) {
        const missingSnapshotIds = focusCandidates
          .filter(attempt => attempt.contentSnapshot === undefined)
          .map(attempt => attempt.id);
        let snapshotById = new Map<string, Prisma.JsonValue | null>();
        if (missingSnapshotIds.length > 0) {
          const snapshotRows = await db.learningAttempt.findMany({
            where: { id: { in: missingSnapshotIds } },
            select: { id: true, contentSnapshot: true },
          });
          snapshotById = new Map(
            snapshotRows.map(row => [row.id, (row as { contentSnapshot?: Prisma.JsonValue | null }).contentSnapshot ?? null]),
          );
        }
        const hydratedCandidates = focusCandidates.map(attempt =>
          attempt.contentSnapshot !== undefined
            ? attempt
            : { ...attempt, contentSnapshot: snapshotById.get(attempt.id) ?? null },
        );
        const evidence = selectReadingFocusAttempts(hydratedCandidates, resolvedExposure, skillLevel, now);
        if (evidence.length >= 2) {
          const answers = await db.learningAttemptAnswer.findMany({
            where: { attemptId: { in: evidence.map(attempt => attempt.id) }, checked: true },
            select: { attemptId: true, questionId: true, isCorrect: true },
          });
          readingFocus = chooseReadingFocus(evidence, answers);
        }
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
      placement?.estimatedCefr ?? null,
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
    const items = await this.computeDailyPlanItems(
      db, userId, now, date, profile, placement, skillLevel,
      existing?.items as unknown as PlanItem[] ?? [],
      opts?.exposureByLesson,
      opts?.preferredSkillsOverride,
    );
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
    const [attempts, speakingSubs, voiceConvs, writingHistory, lessonMeta] = await Promise.all([
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
      lessonItemIds.length === 0 || !this.prisma.learningLesson?.findMany
        ? Promise.resolve([] as { id: string; code: string; kind: LearningKind; grammarTopic: { code: string } | null }[])
        : this.prisma.learningLesson.findMany({
            where: { id: { in: lessonItemIds } },
            select: { id: true, code: true, kind: true, grammarTopic: { select: { code: true } } },
          }),
    ]);
    return assemblePlanDto({
      plan,
      planItems,
      attempts,
      speakingSubs,
      voiceConvs,
      writingHistory,
      lessonMeta,
      isLessonKind,
    });
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

  private async homeLesson(
    userId: string,
    lessonId: string | null,
    useFallback = false,
    minimumCefr?: CefrLevel | null,
  ) {
    if (!lessonId && !useFallback) return null;
    const minRank = minimumCefr ? MILESTONE_CEFR_ORDER.indexOf(minimumCefr) : -1;
    const allowedLevels = minRank > 0 ? MILESTONE_CEFR_ORDER.slice(minRank) : null;
    const row = await this.prisma.learningLesson.findFirst({
      where: {
        published: true,
        ...(lessonId
          ? { id: lessonId }
          : {
              attempts: { none: { userId, status: 'COMPLETED' as const } },
              ...(allowedLevels
                ? {
                    OR: [
                      { grammarTopic: { cefrLevel: { in: [...allowedLevels] } } },
                      { grammarTopicId: null, unit: { cefrLevel: { in: [...allowedLevels] } } },
                    ],
                  }
                : {}),
            }),
      },
      select: {
        id: true,
        code: true,
        kind: true,
        title: true,
        description: true,
        estimatedMinutes: true,
        grammarTopic: { select: { code: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    if (!row) return null;
    const grammarTopicCode = resolveGrammarTopicCode(row.kind, row.code, row.grammarTopic?.code);
    return {
      id: row.id,
      code: row.code,
      kind: row.kind,
      title: row.title,
      description: row.description,
      estimatedMinutes: row.estimatedMinutes,
      ...(grammarTopicCode ? { grammarTopicCode } : {}),
    };
  }

  async home(userId: string) {
    const now = new Date();
    const date = learningDate(now);
    const week = buildLearningWeekWindows(now, date);
    const [
      profile,
      plans,
      attempts,
      completedLessons,
      first,
      placement,
      skill,
      seconds,
      unreadNotificationCount,
      storedSkillsRaw,
      milestoneLessons,
      milestoneUnits,
      completedAttemptRows,
    ] = await Promise.all([
      this.profile(this.prisma, userId),
      this.prisma.learningDayPlan.findMany({ where: { userId, date: { gte: week[0].date, lte: date } } }),
      this.prisma.learningAttempt.findMany({
        where: { userId, status: 'COMPLETED', submittedAt: { gte: week[0].from, lte: now } },
        select: { lessonId: true, submittedAt: true },
      }),
      this.prisma.learningLesson.count({ where: { published: true, attempts: { some: { userId, status: 'COMPLETED' } } } }),
      this.prisma.learningActivitySession.findFirst({ where: { userId }, orderBy: { anchorAt: 'asc' }, select: { anchorAt: true } }),
      this.prisma.placementSession.findFirst({
        where: { userId, status: 'COMPLETED' }, orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        select: { estimatedCefr: true, skillResults: true, completedAt: true },
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
      readStoredPreferredSkillsForUser(this.prisma, userId),
      this.prisma.learningLesson?.findMany?.({
        where: { published: true },
        select: { id: true, unitId: true, kind: true, grammarTopicId: true, grammarTopic: { select: { cefrLevel: true } } },
      }) ?? Promise.resolve([] as MilestoneLessonInput[]),
      this.prisma.learningUnit?.findMany?.({
        orderBy: [{ cefrLevel: 'asc' }, { orderIndex: 'asc' }],
        select: { id: true, cefrLevel: true },
      }) ?? Promise.resolve([] as { id: string; cefrLevel: CefrLevel }[]),
      this.prisma.learningAttempt?.findMany?.({
        where: { userId, status: 'COMPLETED' },
        select: { lessonId: true },
        distinct: ['lessonId'],
      }) ?? Promise.resolve([] as { lessonId: string }[]),
    ]);
    const storedSkills = resolvePreferredSkillsWithFallback(
      storedSkillsRaw,
      profile.preferredKinds,
      Boolean(this.prisma.vocabularyCommandReceipt?.findUnique),
    );
    const byDate = new Map(plans.map(plan => [plan.date, plan]));
    const goalByDate = new Map(plans.map(plan => [plan.date, plan.dailyGoalMinutes]));
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
    const days = buildWeekDaySummaries(week, date, profile.dailyGoalMinutes, goalByDate, attempts, seconds, first?.anchorAt ?? null);
    const placementCefr = placement?.estimatedCefr ?? null;
    const completedMilestoneIds = new Set(completedAttemptRows.map(row => row.lessonId));
    const milestones = buildCefrMilestones(milestoneLessons, milestoneUnits, completedMilestoneIds, placementCefr);
    return {
      date, planStatus, plan, preferences: this.preferenceDto(profile, storedSkills), today: days[6], days,
      totals: { completedLessonCount: completedLessons, activeSeconds: seconds.get(week.length) ?? 0 },
      continueLesson: await this.homeLesson(
        userId,
        plan?.continueLessonId ?? null,
        plan == null,
        placement?.estimatedCefr ?? null,
      ),
      unreadNotificationCount,
      placementCefr,
      milestones,
    };
  }

  private async homeActiveSeconds(userId: string, windows: { from: Date; to: Date }[], db: Db = this.prisma) {
    return queryHomeActiveSeconds(db, userId, windows);
  }

  private async progressAttemptSummary(
    userId: string,
    weekStartFrom: Date,
    afterTodayEnd: Date,
    currentWeekStart: Date,
    previousWeekStart: Date,
    now: Date,
  ) {
    const [row] = await this.prisma.$queryRaw<
      Array<{
        completedAttemptCount: number;
        activeAttemptCount: number;
        completedPublishedIds: string[] | null;
        validScoreCount: number;
        allScoreSum: number | null;
        currentWeekCount: number;
        currentWeekSum: number | null;
        previousWeekCount: number;
        previousWeekSum: number | null;
        dailyCounts: Array<{
          date: string;
          completedLessonCount: number;
          completedAttemptCount: number;
        }> | null;
        latestByKind: Array<{
          kind: LearningKind;
          correctCount: number;
          totalQuestions: number;
          submittedAtIso: string | null;
          lessonTitle: string;
        }> | null;
      }>
    >`
      WITH user_attempts AS (
        SELECT
          a.id,
          a.lesson_id,
          a.status,
          a.correct_count,
          a.total_questions,
          a.submitted_at,
          a.history_hidden_at,
          (a.lesson_snapshot ->> 'kind') AS snapshot_kind,
          (a.lesson_snapshot ->> 'title') AS snapshot_title
        FROM learning_attempts a
        WHERE a.user_id = ${userId}::uuid
      ),
      counts_and_scores AS (
        SELECT
          COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_attempt_count,
          COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS active_attempt_count,
          COUNT(*) FILTER (
            WHERE status = 'COMPLETED'
              AND submitted_at IS NOT NULL
              AND correct_count IS NOT NULL
              AND total_questions > 0
          )::int AS valid_score_count,
          SUM(
            ((correct_count::double precision / total_questions::double precision) * 100.0)
            ORDER BY submitted_at DESC, id DESC
          ) FILTER (
            WHERE status = 'COMPLETED'
              AND submitted_at IS NOT NULL
              AND correct_count IS NOT NULL
              AND total_questions > 0
          )::double precision AS all_score_sum,
          COUNT(*) FILTER (
            WHERE status = 'COMPLETED'
              AND submitted_at IS NOT NULL
              AND correct_count IS NOT NULL
              AND total_questions > 0
              AND (submitted_at AT TIME ZONE 'UTC') >= ${currentWeekStart}::timestamptz
              AND (submitted_at AT TIME ZONE 'UTC') <= ${now}::timestamptz
          )::int AS current_week_count,
          SUM(
            ((correct_count::double precision / total_questions::double precision) * 100.0)
            ORDER BY submitted_at DESC, id DESC
          ) FILTER (
            WHERE status = 'COMPLETED'
              AND submitted_at IS NOT NULL
              AND correct_count IS NOT NULL
              AND total_questions > 0
              AND (submitted_at AT TIME ZONE 'UTC') >= ${currentWeekStart}::timestamptz
              AND (submitted_at AT TIME ZONE 'UTC') <= ${now}::timestamptz
          )::double precision AS current_week_sum,
          COUNT(*) FILTER (
            WHERE status = 'COMPLETED'
              AND submitted_at IS NOT NULL
              AND correct_count IS NOT NULL
              AND total_questions > 0
              AND (submitted_at AT TIME ZONE 'UTC') >= ${previousWeekStart}::timestamptz
              AND (submitted_at AT TIME ZONE 'UTC') < ${currentWeekStart}::timestamptz
          )::int AS previous_week_count,
          SUM(
            ((correct_count::double precision / total_questions::double precision) * 100.0)
            ORDER BY submitted_at DESC, id DESC
          ) FILTER (
            WHERE status = 'COMPLETED'
              AND submitted_at IS NOT NULL
              AND correct_count IS NOT NULL
              AND total_questions > 0
              AND (submitted_at AT TIME ZONE 'UTC') >= ${previousWeekStart}::timestamptz
              AND (submitted_at AT TIME ZONE 'UTC') < ${currentWeekStart}::timestamptz
          )::double precision AS previous_week_sum
        FROM user_attempts
      ),
      daily_rows AS (
        SELECT
          to_char(submitted_at + interval '7 hours', 'YYYY-MM-DD') AS day_date,
          COUNT(DISTINCT lesson_id)::int AS completed_lesson_count,
          COUNT(*)::int AS completed_attempt_count
        FROM user_attempts
        WHERE status = 'COMPLETED'
          AND submitted_at IS NOT NULL
          AND (submitted_at AT TIME ZONE 'UTC') >= ${weekStartFrom}::timestamptz
          AND (submitted_at AT TIME ZONE 'UTC') < ${afterTodayEnd}::timestamptz
        GROUP BY 1
      ),
      latest_rows AS (
        SELECT DISTINCT ON (snapshot_kind)
          snapshot_kind AS kind,
          correct_count,
          total_questions,
          CASE
            WHEN submitted_at IS NULL THEN NULL
            ELSE to_char(submitted_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          END AS submitted_at_iso,
          snapshot_title AS lesson_title
        FROM user_attempts
        WHERE status = 'COMPLETED'
          AND history_hidden_at IS NULL
          AND snapshot_kind IN ('GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING')
        ORDER BY snapshot_kind, submitted_at DESC, id DESC
      )
      SELECT
        cs.completed_attempt_count AS "completedAttemptCount",
        cs.active_attempt_count AS "activeAttemptCount",
        ARRAY(
          SELECT DISTINCT ua.lesson_id::text
          FROM user_attempts ua
          INNER JOIN learning_lessons l ON l.id = ua.lesson_id AND l.published = true
          WHERE ua.status = 'COMPLETED'
        ) AS "completedPublishedIds",
        cs.valid_score_count AS "validScoreCount",
        cs.all_score_sum AS "allScoreSum",
        cs.current_week_count AS "currentWeekCount",
        cs.current_week_sum AS "currentWeekSum",
        cs.previous_week_count AS "previousWeekCount",
        cs.previous_week_sum AS "previousWeekSum",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'date', dr.day_date,
                'completedLessonCount', dr.completed_lesson_count,
                'completedAttemptCount', dr.completed_attempt_count
              )
            )
            FROM daily_rows dr
          ),
          '[]'::json
        ) AS "dailyCounts",
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'kind', lr.kind,
                'correctCount', lr.correct_count,
                'totalQuestions', lr.total_questions,
                'submittedAtIso', lr.submitted_at_iso,
                'lessonTitle', lr.lesson_title
              )
            )
            FROM latest_rows lr
          ),
          '[]'::json
        ) AS "latestByKind"
      FROM counts_and_scores cs
    `;
    return row;
  }

  async progress(userId: string, now: Date = new Date()) {
    const today = learningDate(now), start = learningDayStart(today);
    const currentWeekStart = new Date(start.getTime() - 6 * DAY_MS);
    const previousWeekStart = new Date(start.getTime() - 13 * DAY_MS);
    const afterTodayEnd = new Date(start.getTime() + DAY_MS);
    const week = buildLearningWeekWindows(now, today);
    const [profile, plans, attemptStats, totalLessons, units, first, placement, skillLevel, seconds] = await Promise.all([
      this.profile(this.prisma, userId),
      this.prisma.learningDayPlan.findMany({
        where: { userId, date: { gte: week[0].date, lte: today } },
        select: { date: true, dailyGoalMinutes: true },
      }),
      this.progressAttemptSummary(
        userId,
        currentWeekStart,
        afterTodayEnd,
        currentWeekStart,
        previousWeekStart,
        now,
      ),
      this.prisma.learningLesson.findMany({
        where: { published: true },
        select: { id: true, unitId: true, kind: true, grammarTopicId: true, grammarTopic: { select: { cefrLevel: true } } },
      }),
      this.prisma.learningUnit.findMany({ orderBy: [{ cefrLevel: 'asc' }, { orderIndex: 'asc' }] }),
      this.prisma.learningActivitySession.findFirst({ where: { userId }, orderBy: { anchorAt: 'asc' }, select: { anchorAt: true } }),
      this.prisma.placementSession.findFirst({
        where: { userId, status: 'COMPLETED' },
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
        select: { estimatedCefr: true, skillResults: true, completedAt: true },
      }),
      this.prisma.learningSkillLevel?.findUnique({ where: { userId_kind: { userId, kind: 'READING' } } }) ?? Promise.resolve(null),
      this.homeActiveSeconds(userId, [...week, { from: new Date(0), to: now }]),
    ]);
    const goalByDate = new Map(plans.map(p => [p.date, p.dailyGoalMinutes]));
    const dailyByDate = new Map(
      (attemptStats?.dailyCounts ?? []).map(d => [d.date, d]),
    );
    const days = week.map((day, index) => {
      const dayStats = dailyByDate.get(day.date);
      const completedLessonCount = Number(dayStats?.completedLessonCount ?? 0);
      const completedAttemptCount = Number(dayStats?.completedAttemptCount ?? 0);
      const activeSeconds = seconds.get(index) ?? 0;
      const target = goalByDate.get(day.date) ?? (day.date === today ? profile.dailyGoalMinutes : null);
      return {
        date: day.date,
        dailyGoalMinutes: target,
        activeSeconds,
        goalMet: target != null && activeSeconds >= target * 60,
        completedLessonCount,
        completedAttemptCount,
        hasActivity: activeSeconds > 0 || completedAttemptCount > 0,
        timeMeasured: first != null && learningDate(first.anchorAt) <= day.date,
      };
    });
    const completedPublishedIds = new Set<string>(attemptStats?.completedPublishedIds ?? []);
    const measuredDays = days.filter(d => d.timeMeasured);
    const averageActiveSeconds = measuredDays.length
      ? Math.round(measuredDays.reduce((sum, d) => sum + d.activeSeconds, 0) / measuredDays.length)
      : 0;
    const latestByKindMap = new Map(
      (attemptStats?.latestByKind ?? []).map(r => [r.kind, r]),
    );
    const latestResults = Object.values(LearningKind).flatMap(kind => {
      const a = latestByKindMap.get(kind);
      if (!a) return [];
      const correctCount = Number(a.correctCount);
      const totalQuestions = Number(a.totalQuestions);
      return [{
        kind,
        correctCount,
        totalQuestions,
        scoreRatio: correctCount / totalQuestions,
        submittedAt: a.submittedAtIso ? new Date(a.submittedAtIso) : null,
        lessonTitle: a.lessonTitle,
      }];
    });
    const validScoreCount = Number(attemptStats?.validScoreCount ?? 0);
    const currentWeekCount = Number(attemptStats?.currentWeekCount ?? 0);
    const previousWeekCount = Number(attemptStats?.previousWeekCount ?? 0);
    const averageScore = validScoreCount > 0
      ? Math.round(Number(attemptStats?.allScoreSum ?? 0) / validScoreCount)
      : null;
    const currentWeekAverage = currentWeekCount > 0
      ? Math.round(Number(attemptStats?.currentWeekSum ?? 0) / currentWeekCount)
      : null;
    const previousWeekAverage = previousWeekCount > 0
      ? Math.round(Number(attemptStats?.previousWeekSum ?? 0) / previousWeekCount)
      : null;
    const scoreStats = {
      averageScore,
      completedAttemptCount: validScoreCount,
      currentWeekAverage,
      previousWeekAverage,
      deltaPercent:
        currentWeekAverage != null && previousWeekAverage != null
          ? currentWeekAverage - previousWeekAverage
          : null,
    };
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
    const placementCefr = placement?.estimatedCefr ?? null;
    return {
      today: days[6],
      days,
      totals: {
        totalLessons: totalLessons.length,
        completedLessonCount: completedPublishedIds.size,
        completedAttemptCount: Number(attemptStats?.completedAttemptCount ?? 0),
        activeAttemptCount: Number(attemptStats?.activeAttemptCount ?? 0),
        activeSeconds: seconds.get(week.length) ?? 0,
        averageActiveSeconds,
        averageStudyMinutes: Math.floor(averageActiveSeconds / 60),
      },
      units: buildProgressUnits(units, totalLessons, completedPublishedIds),
      milestones: buildCefrMilestones(totalLessons, units, completedPublishedIds, placementCefr),
      scoreStats,
      latestResults,
      placement: placement?.skillResults ?? null,
      placementCefr,
      recommendedLevels: { reading: readingLevel },
      trackingStartedAt: first?.anchorAt ?? null,
    };
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
