import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { LearningAttempt, LearningDayPlan, LearningKind, LearningLesson, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityBatchDto, LearningPreferencesDto } from './planning.dto';

export const LEARNING_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const DAY_MS = 86400000;
type Db = Prisma.TransactionClient;
export type PlanItem = { id: string; lessonId: string; title: string; kind: LearningKind; estimatedMinutes: number; reasonCode: string; reason: string };
export const learningDate = (now: Date) => new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
export const learningDayStart = (date: string) => new Date(`${date}T00:00:00+07:00`);
const finishedOn = (a: LearningAttempt, date: string) => a.status === 'COMPLETED' && a.submittedAt != null && learningDate(a.submittedAt) === date;
const recentFinished = (attempts: LearningAttempt[], id: string) => attempts.filter(a => a.lessonId === id && a.status === 'COMPLETED')
  .sort((a, b) => (b.submittedAt?.getTime() ?? 0) - (a.submittedAt?.getTime() ?? 0) || b.id.localeCompare(a.id))[0];

/** Deterministic baseline; completion is activity, not mastery. */
export function chooseDailyItems(lessons: LearningLesson[], attempts: LearningAttempt[], date: string,
  minutes: number, preferred: LearningKind[], previous: PlanItem[] = [], placement?: Record<string, unknown>): PlanItem[] {
  const selected: PlanItem[] = [];
  const seen = new Set<string>();
  const byId = new Map(lessons.map(l => [l.id, l]));
  const completeToday = new Set(attempts.filter(a => finishedOn(a, date)).map(a => a.lessonId));
  const active = attempts.filter(a => a.status === 'IN_PROGRESS')
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || a.id.localeCompare(b.id));
  const add = (lesson: LearningLesson, reasonCode: string, reason: string, force = false) => {
    if (seen.has(lesson.id)) return false;
    const used = selected.reduce((sum, item) => sum + item.estimatedMinutes, 0);
    if (!force && used + lesson.estimatedMinutes > minutes) return false;
    const old = previous.find(item => item.lessonId === lesson.id);
    selected.push(old ?? { id: randomUUID(), lessonId: lesson.id, title: lesson.title, kind: lesson.kind, estimatedMinutes: lesson.estimatedMinutes, reasonCode, reason });
    seen.add(lesson.id); return true;
  };
  // Keep already completed snapshots, even if the catalogue was unpublished later.
  for (const item of previous) if (completeToday.has(item.lessonId)) { selected.push(item); seen.add(item.lessonId); }
  for (const lesson of lessons) if (completeToday.has(lesson.id)) add(lesson, 'COMPLETED_TODAY', 'Đã hoàn thành hôm nay', true);
  for (const attempt of active) {
    const lesson = byId.get(attempt.lessonId);
    if (lesson && !completeToday.has(lesson.id)) add(lesson, 'RESUME', 'Tiếp tục bài đang học', previous.some(item => item.lessonId === lesson.id));
  }
  const placementScore = (kind: LearningKind): number => {
    const key = kind === 'READING' ? 'reading' : kind === 'LISTENING' ? 'listening' : null;
    const value = key && placement?.[key] as { correctCount?: number; totalItems?: number } | undefined;
    return value && value.correctCount != null && value.totalItems ? value.correctCount / value.totalItems : 1;
  };
  const ordered = [...lessons].sort((a, b) => Number(!preferred.includes(a.kind)) - Number(!preferred.includes(b.kind))
    || (['READING', 'LISTENING'].includes(a.kind) && ['READING', 'LISTENING'].includes(b.kind) ? placementScore(a.kind) - placementScore(b.kind) : 0)
    || a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const fresh = ordered.filter(l => !recentFinished(attempts, l.id) && !seen.has(l.id));
  // Reserve an opportunity to progress before offering a review.
  for (const lesson of fresh) if (add(lesson, 'NEW', 'Bài mới')) break;
  const review = ordered.filter(l => {
    const latest = recentFinished(attempts, l.id);
    return latest && latest.correctCount! / latest.totalQuestions < .8 && !seen.has(l.id) && !completeToday.has(l.id);
  }).sort((a, b) => {
    const x = recentFinished(attempts, a.id)!, y = recentFinished(attempts, b.id)!;
    return Number(!preferred.includes(a.kind)) - Number(!preferred.includes(b.kind)) || x.correctCount! / x.totalQuestions - y.correctCount! / y.totalQuestions
      || x.submittedAt!.getTime() - y.submittedAt!.getTime() || a.sortOrder - b.sortOrder;
  });
  if (fresh.length) {
    for (const lesson of review) {
      const result = recentFinished(attempts, lesson.id)!;
      if (add(lesson, 'REVIEW', `Kết quả gần nhất ${result.correctCount}/${result.totalQuestions}`)) break;
    }
    for (const lesson of fresh) add(lesson, 'NEW', 'Bài mới');
  } else {
    const rotation = ordered.filter(l => !seen.has(l.id) && !completeToday.has(l.id)).sort((a, b) => {
      const x = recentFinished(attempts, a.id), y = recentFinished(attempts, b.id);
      return Number(!preferred.includes(a.kind)) - Number(!preferred.includes(b.kind))
        || (x?.submittedAt?.getTime() ?? 0) - (y?.submittedAt?.getTime() ?? 0) || a.sortOrder - b.sortOrder;
    });
    for (const lesson of rotation) add(lesson, 'ROTATION', 'Luyện lại bài lâu chưa học');
  }
  if (!selected.length && ordered.length) {
    const candidate = active.map(a => byId.get(a.lessonId)).find((l): l is LearningLesson => !!l) ?? fresh[0] ?? ordered[0];
    const inProgress = active.some(a => a.lessonId === candidate.id);
    add(candidate, inProgress ? 'RESUME' : fresh.includes(candidate) ? 'NEW' : 'ROTATION',
      inProgress ? 'Tiếp tục bài đang học' : fresh.includes(candidate) ? 'Bài mới' : 'Luyện lại bài lâu chưa học', true);
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

  private async ensureIn(db: Db, userId: string) {
    const profile = await this.profile(db, userId), date = learningDate(new Date());
    const existing = await db.learningDayPlan.findUnique({ where: { userId_date: { userId, date } } });
    if (existing && existing.preferencesVersion === profile.preferencesVersion && existing.dailyGoalMinutes === profile.dailyGoalMinutes) return existing;
    const [lessons, attempts, placement] = await Promise.all([
      db.learningLesson.findMany({ where: { published: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
      db.learningAttempt.findMany({ where: { userId } }),
      db.placementSession.findFirst({ where: { userId, status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, select: { skillResults: true } }),
    ]);
    const items = chooseDailyItems(lessons, attempts, date, profile.dailyGoalMinutes, profile.preferredKinds,
      existing?.items as unknown as PlanItem[] ?? [], placement?.skillResults as Record<string, unknown> | undefined);
    return db.learningDayPlan.upsert({ where: { userId_date: { userId, date } }, create: {
      userId, date, dailyGoalMinutes: profile.dailyGoalMinutes, preferencesVersion: profile.preferencesVersion, items: items as unknown as Prisma.InputJsonValue,
    }, update: { dailyGoalMinutes: profile.dailyGoalMinutes, preferencesVersion: profile.preferencesVersion, items: items as unknown as Prisma.InputJsonValue, version: { increment: 1 } } });
  }

  async ensureToday(userId: string) {
    const plan = await this.prisma.$transaction(async tx => { await this.lock(tx, userId); return this.ensureIn(tx, userId); });
    return { plan: await this.planDto(plan) };
  }
  async today(userId: string) {
    const plan = await this.prisma.learningDayPlan.findUnique({ where: { userId_date: { userId, date: learningDate(new Date()) } } });
    return { plan: plan ? await this.planDto(plan) : null };
  }
  private async planDto(plan: LearningDayPlan) {
    const attempts = await this.prisma.learningAttempt.findMany({ where: { userId: plan.userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] });
    const items = (plan.items as unknown as PlanItem[]).map(item => {
      const completed = attempts.find(a => a.lessonId === item.lessonId && finishedOn(a, plan.date));
      const active = attempts.find(a => a.lessonId === item.lessonId && a.status === 'IN_PROGRESS');
      return { ...item, completed: !!completed, activeAttemptId: active?.id ?? null, completedAttemptId: completed?.id ?? null };
    });
    const next = items.find(item => !item.completed);
    return { id: plan.id, date: plan.date, timeZone: LEARNING_TIME_ZONE, version: plan.version, dailyGoalMinutes: plan.dailyGoalMinutes,
      estimatedMinutes: items.reduce((sum, item) => sum + item.estimatedMinutes, 0), completedCount: items.filter(item => item.completed).length,
      totalCount: items.length, items, continueLessonId: next?.lessonId ?? null, continueAttemptId: next?.activeAttemptId ?? null };
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
    const [profile, plans, attempts, totalLessons, first, placement] = await Promise.all([
      this.profile(this.prisma, userId), this.prisma.learningDayPlan.findMany({ where: { userId } }),
      this.prisma.learningAttempt.findMany({ where: { userId }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.learningLesson.findMany({ where: { published: true }, select: { id: true } }),
      this.prisma.learningActivitySession.findFirst({ where: { userId }, orderBy: { anchorAt: 'asc' }, select: { anchorAt: true } }),
      this.prisma.placementSession.findFirst({ where: { userId, status: 'COMPLETED' }, orderBy: { completedAt: 'desc' }, select: { skillResults: true } }),
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
    const latestResults = Object.values(LearningKind).flatMap(kind => {
      const a = completed.find(row => (row.lessonSnapshot as { kind?: string })?.kind === kind);
      return a ? [{ kind, correctCount: a.correctCount!, totalQuestions: a.totalQuestions, scoreRatio: a.correctCount! / a.totalQuestions,
        submittedAt: a.submittedAt, lessonTitle: (a.lessonSnapshot as { title: string }).title }] : [];
    });
    return { today: days[6], days, totals: { totalLessons: totalLessons.length,
      completedLessonCount: new Set(completed.filter(a => publishedIds.has(a.lessonId)).map(a => a.lessonId)).size,
      completedAttemptCount: completed.length, activeAttemptCount: attempts.filter(a => a.status === 'IN_PROGRESS').length,
      activeSeconds: await this.activeSeconds(userId, new Date(0), now) }, latestResults,
      placement: placement?.skillResults ?? null, trackingStartedAt: first?.anchorAt ?? null };
  }

  async summary(userId: string) {
    const [progress, today] = await Promise.all([this.progress(userId), this.today(userId)]);
    const fallback = today.plan ? null : await this.prisma.learningAttempt.findFirst({ where: { userId, status: 'IN_PROGRESS' }, orderBy: { updatedAt: 'desc' } });
    const fresh = today.plan || fallback ? null : await this.prisma.learningLesson.findFirst({ where: { published: true,
      attempts: { none: { userId, status: 'COMPLETED' } } }, orderBy: { sortOrder: 'asc' } });
    return { ...progress.totals, continueLessonId: today.plan?.continueLessonId ?? fallback?.lessonId ?? fresh?.id ?? null,
      continueAttemptId: today.plan?.continueAttemptId ?? fallback?.id ?? null };
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
