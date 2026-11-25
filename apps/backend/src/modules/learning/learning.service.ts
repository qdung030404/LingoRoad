import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { CefrLevel, LearningAttempt, LearningAttemptAnswer, LearningLesson, Prisma } from '@prisma/client';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { CheckLearningAnswerDto, LearningProgressDto } from './learning.dto';
import { LearningContent, LessonSnapshot, validateLearningContent } from './learning.types';
import { MlClientService } from '../ml/ml-client.service';
import { PlanningService } from '../planning/planning.service';
import { validateListeningAudio } from './listening-media';

export const MAX_READING_EXPLAIN_PASSAGE_CHARS = 4000;
const GLOBAL_READING_SKILLS = new Set([
  'reading.main_idea',
  'reading.text_structure',
  'reading.author_purpose',
  'reading.critical_reading',
]);

function extractBoundedPassage(passage: string, skillCode?: string, questionType?: string, evidence?: string): string | null {
  const clean = passage.trim();
  if (clean.length <= MAX_READING_EXPLAIN_PASSAGE_CHARS) return clean;
  if (questionType === 'TRUE_FALSE_NOT_GIVEN') return null;
  if (skillCode && GLOBAL_READING_SKILLS.has(skillCode)) return null;
  const trimmedEvidence = evidence?.trim();
  if (!trimmedEvidence) return null;
  const idx = clean.indexOf(trimmedEvidence);
  if (idx === -1) return null;
  const half = Math.floor((MAX_READING_EXPLAIN_PASSAGE_CHARS - trimmedEvidence.length) / 2);
  const start = Math.max(0, idx - Math.max(0, half));
  const end = Math.min(clean.length, start + MAX_READING_EXPLAIN_PASSAGE_CHARS);
  const excerpt = clean.slice(start, end);
  return excerpt.includes(trimmedEvidence) ? excerpt : null;
}

type Attempt = LearningAttempt & { answers: LearningAttemptAnswer[] };
interface CatalogueLessonRow {
  id: string;
  code: string;
  kind: LearningLesson['kind'];
  title: string;
  description: string;
  estimatedMinutes: number;
  contentVersion: number;
  questionCount: number;
  audioDurationMs: number | null;
  cefrLevel: CefrLevel | null;
}
const includeAnswers = { answers: true } as const;
const includeUnitLevel = { unit: { select: { cefrLevel: true } } } as const;
type Database = Prisma.TransactionClient;

export function learningMediaRoot(): string {
  return existsSync(join(process.cwd(), 'prisma/schema.prisma'))
    ? join(process.cwd(), 'media/learning')
    : join(process.cwd(), 'apps/backend/media/learning');
}

/** All learner mutations use an attempt version; answer locks are permanent. */
@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly planning?: PlanningService,
    @Optional() private readonly ml?: MlClientService,
  ) {}

  private conflict(): never {
    throw new ConflictException({ code: 'LEARNING_STATE_CONFLICT', message: 'Bài học đã thay đổi trên thiết bị khác. Vui lòng tải lại.' });
  }

  private invalid(message: string): never {
    throw new BadRequestException({ code: 'LEARNING_INVALID_INPUT', message });
  }

  private async owned(db: Database, userId: string, attemptId: string): Promise<Attempt> {
    // The same response for unknown and foreign IDs prevents disclosing another learner's history.
    const attempt = await db.learningAttempt.findFirst({
      where: { id: attemptId, userId, historyHiddenAt: null }, include: includeAnswers,
    });
    if (!attempt) throw new NotFoundException({ code: 'LEARNING_ATTEMPT_NOT_FOUND', message: 'Không tìm thấy lượt học.' });
    return attempt;
  }

  private content(attempt: LearningAttempt): LearningContent {
    return attempt.contentSnapshot as unknown as LearningContent;
  }

  private buildLessonSnapshot(
    lesson: Pick<LearningLesson, 'id' | 'code' | 'kind' | 'title' | 'description' | 'estimatedMinutes' | 'contentVersion'>,
    questionCount: number,
    audioDurationMs?: number | null,
    cefrLevel?: CefrLevel | null,
  ): LessonSnapshot {
    return {
      id: lesson.id,
      code: lesson.code,
      kind: lesson.kind,
      title: lesson.title,
      description: lesson.description,
      estimatedMinutes: Number(lesson.estimatedMinutes),
      contentVersion: Number(lesson.contentVersion),
      questionCount: Number(questionCount),
      ...(audioDurationMs ? { audioDurationMs: Number(audioDurationMs) } : {}),
      ...(cefrLevel ? { cefrLevel } : {}),
    };
  }

  private lessonInfo(lesson: Prisma.LearningLessonGetPayload<{ include: typeof includeUnitLevel }>): LessonSnapshot {
    const content = lesson.content as unknown as LearningContent;
    return this.buildLessonSnapshot(
      lesson,
      Array.isArray(content?.questions) ? content.questions.length : 5,
      content?.audioDurationMs,
      lesson.unit?.cefrLevel,
    );
  }

  private publicContent(content: LearningContent, completed: boolean) {
    return {
      steps: content.steps.map((step) => ({ id: step.id, title: step.title, body: step.body,
        ...(step.word ? { word: step.word } : {}), ...(step.phonetic ? { phonetic: step.phonetic } : {}),
        ...(step.meaning ? { meaning: step.meaning } : {}), ...(step.example ? { example: step.example } : {}),
        ...(step.audioUrl ? { audioUrl: step.audioUrl } : {}) })),
      ...(content.listeningVersion !== 1 && content.passage ? { passage: content.passage } : {}),
      ...(content.keyVocabulary?.length ? { keyVocabulary: content.keyVocabulary.map((item) => ({
        id: item.id, word: item.word, meaning: item.meaning,
        ...(item.phonetic ? { phonetic: item.phonetic } : {}),
        ...(item.example ? { example: item.example } : {}),
        ...(item.translation ? { translation: item.translation } : {}),
      })) } : {}),
      ...(content.audioUrl ? { audioUrl: content.audioUrl } : {}),
      ...(content.listeningVersion === 1 ? { listeningVersion: 1,
        audioDurationMs: content.audioDurationMs,
        preparation: { situation: content.preparation?.situation, objective: content.preparation?.objective } } : {}),
      ...(completed && content.transcript ? { transcript: content.transcript } : {}),
      ...(completed && content.transcriptSegments ? { transcriptSegments: content.transcriptSegments.map((segment) => ({
        id: segment.id, speaker: segment.speaker, startMs: segment.startMs, endMs: segment.endMs,
        text: segment.text, translationVi: segment.translationVi,
      })) } : {}),
    };
  }

  private publicQuestions(content: LearningContent) {
    return content.questions.map((question) => ({ id: question.id, type: question.type ?? 'MULTIPLE_CHOICE', prompt: question.prompt,
      ...(question.skillCode ? { skillCode: question.skillCode } : {}),
      options: question.options.map((option) => ({ id: option.id, text: option.text })) }));
  }

  private result(attempt: Pick<LearningAttempt, 'status' | 'correctCount' | 'totalQuestions'>) {
    return attempt.status === 'COMPLETED' ? { correctCount: attempt.correctCount!, totalQuestions: attempt.totalQuestions,
      scoreRatio: attempt.correctCount! / attempt.totalQuestions } : null;
  }

  private summaryItem(attempt: LearningAttempt) {
    const rawLesson = attempt.lessonSnapshot as unknown as LessonSnapshot;
    const lesson: LessonSnapshot = {
      ...rawLesson,
      questionCount: rawLesson.questionCount ?? attempt.totalQuestions,
    };
    return { id: attempt.id, lesson, status: attempt.status,
      position: { phase: attempt.phase, index: attempt.positionIndex }, result: this.result(attempt),
      startedAt: attempt.startedAt, updatedAt: attempt.updatedAt, submittedAt: attempt.submittedAt };
  }

  private publicAttempt(attempt: Attempt) {
    const content = this.content(attempt);
    const answers = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
    return { ...this.summaryItem(attempt), version: attempt.version,
      content: this.publicContent(content, attempt.status === 'COMPLETED'), questions: this.publicQuestions(content),
      answers: content.questions.map((question) => {
        const answer = answers.get(question.id);
        return { questionId: question.id, optionId: answer?.optionId ?? null, checked: answer?.checked ?? false,
          ...(answer?.checked ? { isCorrect: answer.isCorrect, correctOptionId: question.correctOptionId, explanation: question.explanation,
            ...(content.listeningVersion !== 1 && question.evidence ? { evidence: question.evidence } : {}),
            ...(attempt.status === 'COMPLETED' && question.evidenceSegmentIds ? { evidenceSegmentIds: [...question.evidenceSegmentIds] } : {}) } : {}) };
      }),
    };
  }

  async catalogue(userId: string, kind?: LearningLesson['kind']) {
    const kindClause = kind ? Prisma.sql`AND l.kind = ${kind}::"LearningKind"` : Prisma.empty;
    const [lessons, attempts] = await Promise.all([
      this.prisma.$queryRaw<CatalogueLessonRow[]>`
        SELECT
          l.id,
          l.code,
          l.kind::text AS kind,
          l.title,
          l.description,
          l.estimated_minutes AS "estimatedMinutes",
          l.content_version AS "contentVersion",
          CASE
            WHEN jsonb_typeof(l.content -> 'questions') = 'array'
              THEN jsonb_array_length(l.content -> 'questions')
            ELSE 5
          END AS "questionCount",
          CASE
            WHEN jsonb_typeof(l.content -> 'audioDurationMs') = 'number'
              THEN (l.content ->> 'audioDurationMs')::double precision
            ELSE NULL
          END AS "audioDurationMs",
          u.cefr_level::text AS "cefrLevel"
        FROM learning_lessons l
        LEFT JOIN learning_units u ON u.id = l.unit_id
        WHERE l.published = true
          ${kindClause}
        ORDER BY l.sort_order ASC, l.code ASC
      `,
      this.prisma.learningAttempt.findMany({
        where: { userId },
        select: { lessonId: true, status: true, correctCount: true, totalQuestions: true, historyHiddenAt: true },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      }),
    ]);
    return { items: lessons.map((lesson) => {
      const records = attempts.filter((attempt) => attempt.lessonId === lesson.id);
      const completed = records.filter((attempt) => attempt.status === 'COMPLETED');
      const latest = completed.find((attempt) => attempt.historyHiddenAt == null);
      return {
        ...this.buildLessonSnapshot(lesson, lesson.questionCount, lesson.audioDurationMs, lesson.cefrLevel),
        state: completed.length ? 'COMPLETED' : 'NOT_STARTED',
        activeAttemptId: null,
        latestResult: latest ? this.result(latest) : null,
      };
    }) };
  }

  async lesson(userId: string, lessonId: string) {
    const lesson = await this.prisma.learningLesson.findFirst({ where: { id: lessonId, published: true } });
    if (!lesson) throw new NotFoundException({ code: 'LEARNING_LESSON_NOT_FOUND', message: 'Không tìm thấy bài học.' });
    const catalogue = await this.catalogue(userId);
    const content = lesson.content as unknown as LearningContent;
    return { ...catalogue.items.find((item) => item.id === lesson.id)!, content: this.publicContent(content, false), questions: this.publicQuestions(content) };
  }

  async start(userId: string, lessonId: string) {
    const attempt = await this.prisma.$transaction(async (tx) => {
      // Serialize start requests for one account and discard any leftover unfinished attempt.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const lesson = await tx.learningLesson.findFirst({ where: { id: lessonId, published: true }, include: includeUnitLevel });
      if (!lesson) throw new NotFoundException({ code: 'LEARNING_LESSON_NOT_FOUND', message: 'Không tìm thấy bài học.' });
      const content = lesson.content as unknown as LearningContent;
      try {
        validateLearningContent(content, lesson.kind);
        validateListeningAudio(content, learningMediaRoot());
      } catch {
        throw new ServiceUnavailableException({ code: 'LEARNING_CONTENT_UNAVAILABLE', message: 'Nội dung bài học chưa sẵn sàng.' });
      }
      await tx.learningAttempt.deleteMany({ where: { userId, lessonId, status: 'IN_PROGRESS' } });
      const [priorExposure, priorCompleted] = await Promise.all([
        tx.learningAnswerExposure?.findUnique({
          where: { userId_lessonId: { userId, lessonId } },
          select: { id: true },
        }) ?? Promise.resolve(null),
        tx.learningAttempt.findFirst({
          where: { userId, lessonId, status: 'COMPLETED' },
          select: { id: true },
        }),
      ]);
      return tx.learningAttempt.create({ data: { userId, lessonId, phase: content.steps.length ? 'STUDY' : 'QUIZ',
        contentVersion: lesson.contentVersion,
        eligibleForLevelEval: !priorExposure && !priorCompleted,
        totalQuestions: content.questions.length, contentSnapshot: lesson.content as Prisma.InputJsonValue,
        lessonSnapshot: this.lessonInfo(lesson) as unknown as Prisma.InputJsonValue }, include: includeAnswers });
    });
    return this.publicAttempt(attempt);
  }

  async cancel(userId: string, attemptId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const attempt = await this.owned(tx, userId, attemptId);
      if (attempt.status !== 'IN_PROGRESS') {
        throw new ConflictException({ code: 'LEARNING_STATE_CONFLICT', message: 'Bài học đã hoàn thành không thể hủy.' });
      }
      await tx.learningAttempt.delete({ where: { id: attempt.id } });
      return { cancelledAttemptId: attempt.id };
    });
  }

  async attempt(userId: string, attemptId: string) {
    return this.publicAttempt(await this.owned(this.prisma, userId, attemptId));
  }

  private async reserve(tx: Database, attempt: Attempt, expectedVersion: number, data: Prisma.LearningAttemptUpdateManyMutationInput = {}) {
    if (attempt.status !== 'IN_PROGRESS' || attempt.version !== expectedVersion) this.conflict();
    const updated = await tx.learningAttempt.updateMany({ where: { id: attempt.id, userId: attempt.userId, status: 'IN_PROGRESS', version: expectedVersion },
      data: { ...data, version: { increment: 1 } } });
    if (updated.count !== 1) this.conflict();
  }

  async progress(userId: string, attemptId: string, dto: LearningProgressDto) {
    return this.prisma.$transaction(async (tx) => {
      const attempt = await this.owned(tx, userId, attemptId);
      const content = this.content(attempt);
      const length = dto.phase === 'STUDY' ? content.steps.length : content.questions.length;
      if (dto.index >= length) this.invalid('Vị trí trong bài học không hợp lệ.');
      if ((dto.questionId !== undefined) !== (dto.optionId !== undefined)) this.invalid('Cần gửi câu hỏi và lựa chọn cùng nhau.');
      if (dto.questionId !== undefined) {
        const question = content.questions.find((item) => item.id === dto.questionId);
        if (!question || (dto.optionId !== null && !question.options.some((option) => option.id === dto.optionId))) this.invalid('Lựa chọn không hợp lệ.');
        if (attempt.answers.find((answer) => answer.questionId === dto.questionId)?.checked) this.conflict();
      }
      await this.reserve(tx, attempt, dto.expectedVersion, { phase: dto.phase, positionIndex: dto.index });
      if (dto.questionId !== undefined) {
        await tx.learningAttemptAnswer.upsert({ where: { attemptId_questionId: { attemptId, questionId: dto.questionId } },
          create: { attemptId, questionId: dto.questionId, optionId: dto.optionId }, update: { optionId: dto.optionId } });
      }
      return this.publicAttempt(await this.owned(tx, userId, attemptId));
    });
  }

  private async loadSavedLevelChange(tx: Database, attemptId: string) {
    const saved = await (tx.learningSkillLevelEvent?.findUnique({ where: { attemptId } }) ?? Promise.resolve(null));
    if (!saved) return null;
    return {
      kind: saved.kind,
      from: saved.fromCefr,
      to: saved.toCefr,
      direction: saved.direction as 'UP' | 'DOWN',
    };
  }

  async check(userId: string, attemptId: string, questionId: string, dto: CheckLearningAnswerDto) {
    try { return await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const attempt = await this.owned(tx, userId, attemptId);
      const content = this.content(attempt);
      const index = content.questions.findIndex((question) => question.id === questionId);
      const question = content.questions[index];
      if (!question || !question.options.some((option) => option.id === dto.optionId)) this.invalid('Câu hỏi hoặc lựa chọn không hợp lệ.');
      const saved = attempt.answers.find((answer) => answer.questionId === questionId);
      if (saved?.checked) {
        if (saved.optionId !== dto.optionId) this.conflict();
        return this.publicAttempt(attempt); // Safe retry even when the original response was lost.
      }
      let extraUpdate: Prisma.LearningAttemptUpdateManyMutationInput = {};
      if (tx.learningAnswerExposure) {
        const existingExposure = await tx.learningAnswerExposure.findUnique({
          where: { userId_lessonId: { userId, lessonId: attempt.lessonId } },
          select: { firstAttemptId: true },
        });
        if (!existingExposure) {
          await tx.learningAnswerExposure.create({
            data: {
              userId,
              lessonId: attempt.lessonId,
              contentVersion: attempt.contentVersion,
              firstAttemptId: attempt.id,
            },
          });
        } else if (existingExposure.firstAttemptId !== attempt.id && attempt.eligibleForLevelEval) {
          extraUpdate = { eligibleForLevelEval: false };
        }
      }
      await this.reserve(tx, attempt, dto.expectedVersion, { phase: 'QUIZ', positionIndex: index, ...extraUpdate });
      const data = { optionId: dto.optionId, checked: true, isCorrect: dto.optionId === question.correctOptionId, checkedAt: new Date() };
      await tx.learningAttemptAnswer.upsert({ where: { attemptId_questionId: { attemptId, questionId } }, create: { attemptId, questionId, ...data }, update: data });
      return this.publicAttempt(await this.owned(tx, userId, attemptId));
    }); } catch (error) {
      // Concurrent identical checks can race before the first lock is visible.
      if (error instanceof ConflictException) {
        const current = await this.owned(this.prisma, userId, attemptId);
        const answer = current.answers.find((saved) => saved.questionId === questionId);
        if (answer?.checked && answer.optionId === dto.optionId) return this.publicAttempt(current);
      }
      throw error;
    }
  }

  async submit(userId: string, attemptId: string, expectedVersion: number) {
    try { return await this.prisma.$transaction(async (tx) => {
      // Consistent lock order: users -> attempt -> skill level -> day plan.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const attempt = await this.owned(tx, userId, attemptId);
      if (attempt.status === 'COMPLETED') {
        return { ...this.publicAttempt(attempt), levelChange: await this.loadSavedLevelChange(tx, attempt.id) };
      }
      const content = this.content(attempt);
      if (!content.questions.every((question) => attempt.answers.some((answer) => answer.questionId === question.id && answer.checked))) {
        this.invalid('Hãy kiểm tra đầy đủ các câu hỏi trước khi nộp bài.');
      }
      const correctCount = attempt.answers.filter((answer) => answer.checked && answer.isCorrect).length;
      let submittedAt = new Date();
      const kind = (attempt.lessonSnapshot as unknown as LessonSnapshot).kind;
      if (this.planning && kind === 'READING' && tx.learningSkillLevel) {
        const existingSkill = await tx.learningSkillLevel.findUnique({
          where: { userId_kind: { userId, kind: 'READING' } },
          select: { changedAt: true },
        });
        if (existingSkill?.changedAt && submittedAt <= existingSkill.changedAt) {
          submittedAt = new Date(existingSkill.changedAt.getTime() + 1);
        }
      }
      await this.reserve(tx, attempt, expectedVersion, { status: 'COMPLETED', correctCount, submittedAt });
      const savedAttempt = await this.owned(tx, userId, attemptId);
      const levelChange = this.planning ? await this.planning.evaluateReadingLevel(tx, userId, savedAttempt) : null;
      return { ...this.publicAttempt(savedAttempt), levelChange };
    }); } catch (error) {
      if (error instanceof ConflictException) {
        const current = await this.owned(this.prisma, userId, attemptId);
        if (current.status === 'COMPLETED') {
          return { ...this.publicAttempt(current), levelChange: await this.loadSavedLevelChange(this.prisma, current.id) };
        }
      }
      throw error;
    }
  }

  async history(userId: string, cursor?: string, limit = 20, kind?: LearningLesson['kind']) {
    const where: Prisma.LearningAttemptWhereInput = {
      userId,
      status: 'COMPLETED',
      ...(kind ? { lessonSnapshot: { path: ['kind'], equals: kind } } : {}),
    };
    const anchor = cursor ? await this.prisma.learningAttempt.findFirst({
      where: { ...where, id: cursor }, select: { id: true, updatedAt: true },
    }) : null;
    if (cursor && !anchor) {
      throw new NotFoundException({ code: 'LEARNING_ATTEMPT_NOT_FOUND', message: 'Không tìm thấy lượt học.' });
    }
    const attempts = await this.prisma.learningAttempt.findMany({
      where: { ...where, historyHiddenAt: null, ...(anchor ? { OR: [
        { updatedAt: { lt: anchor.updatedAt } },
        { updatedAt: anchor.updatedAt, id: { lt: anchor.id } },
      ] } : {}) },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], take: limit + 1,
    });
    return { items: attempts.slice(0, limit).map((attempt) => this.summaryItem(attempt)), nextCursor: attempts.length > limit ? attempts[limit - 1].id : null };
  }

  async hideHistory(userId: string, attemptId: string) {
    await this.hideHistoryBatch(userId, [attemptId]);
    return { hiddenAttemptId: attemptId };
  }

  async hideHistoryBatch(userId: string, attemptIds: string[]) {
    // UUIDs are case-insensitive in PostgreSQL.
    const ids = [...new Set(attemptIds.map(id => id.toLowerCase()))].sort();
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      const matching = await tx.learningAttempt.count({
        where: { userId, status: 'COMPLETED', id: { in: ids } },
      });
      if (matching !== ids.length) {
        throw new NotFoundException({ code: 'LEARNING_ATTEMPT_NOT_FOUND', message: 'Không tìm thấy một hoặc nhiều lượt học đã hoàn thành.' });
      }
      // Preserve updated_at so previously issued history cursors keep their position.
      await tx.$executeRaw`
        UPDATE learning_attempts SET history_hidden_at = ${new Date()}
        WHERE user_id = ${userId}::uuid AND status = 'COMPLETED' AND history_hidden_at IS NULL
          AND id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))})
      `;
      return { hiddenAttemptIds: ids };
    });
  }

  async summary(userId: string) {
    if (this.planning) return this.planning.summary(userId);
    const [catalogue, attempts] = await Promise.all([this.catalogue(userId), this.prisma.learningAttempt.findMany({ where: { userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] })]);
    const completed = attempts.filter((attempt) => attempt.status === 'COMPLETED');
    const next = catalogue.items.find((lesson) => lesson.state === 'NOT_STARTED');
    return { totalLessons: catalogue.items.length, completedLessonCount: new Set(completed.map((attempt) => attempt.lessonId)).size,
      completedAttemptCount: completed.length, activeAttemptCount: 0,
      continueLessonId: next?.id ?? null, continueAttemptId: null };
  }

  /** Ground explanations in the attempt snapshot and enforce the review visibility rules. */
  async explainAnswer(userId: string, attemptId: string, questionId: string): Promise<{
    questionId: string;
    explanation: string;
    source: 'AI' | 'CURRICULUM';
    retryable?: boolean;
  }> {
    const attempt = await this.owned(this.prisma, userId, attemptId);
    const lesson = attempt.lessonSnapshot as unknown as LessonSnapshot & { cefrLevel?: string };
    const content = this.content(attempt);
    const listening = lesson.kind === 'LISTENING';
    if (!listening && (lesson.kind !== 'READING' || !content.passage?.trim())) {
      this.invalid('Chỉ hỗ trợ giải thích AI cho câu hỏi nghe và đọc hiểu.');
    }
    if (listening && attempt.status !== 'COMPLETED') {
      this.invalid('Hãy nộp bài nghe trước khi hỏi AI giải thích thêm.');
    }
    const question = content.questions.find((item) => item.id === questionId);
    if (!question) this.invalid('Không tìm thấy câu hỏi trong lượt học.');
    const saved = attempt.answers.find((item) => item.questionId === questionId);
    if (!saved?.checked) this.invalid('Hãy kiểm tra đáp án trước khi hỏi AI giải thích thêm.');

    const evidenceIds = new Set(question.evidenceSegmentIds);
    const transcript = content.listeningVersion === 1
      ? content.transcriptSegments?.filter(segment => evidenceIds.has(segment.id))
        .map(segment => `${segment.speaker}: ${segment.text}`).join('\n')
      : content.transcript?.trim();
    const boundedPassage = listening
      ? transcript
      : extractBoundedPassage(content.passage!, question.skillCode, question.type, question.evidence);
    if (!boundedPassage || boundedPassage.length > MAX_READING_EXPLAIN_PASSAGE_CHARS) {
      return { questionId, explanation: question.explanation, source: 'CURRICULUM', retryable: false };
    }
    const retryableFallback = { questionId, explanation: question.explanation, source: 'CURRICULUM' as const, retryable: true };
    if (!this.ml) return retryableFallback;

    const selectedText = question.options.find((option) => option.id === saved.optionId)?.text ?? saved.optionId ?? '';
    const correctText = question.options.find((option) => option.id === question.correctOptionId)?.text ?? question.correctOptionId;
    try {
      const ai = await this.ml.explainReadingAnswer({
        passage: boundedPassage,
        ...(listening ? { source_kind: 'LISTENING' as const } : {}),
        question_prompt: question.prompt,
        question_type: question.type ?? 'MULTIPLE_CHOICE',
        options: question.options.map((option) => option.text),
        selected_option: selectedText,
        correct_option: correctText,
        ...(!listening && question.evidence ? { evidence: question.evidence } : {}),
        curriculum_explanation: question.explanation,
        ...(lesson.cefrLevel ? { cefr: lesson.cefrLevel } : {}),
        locale: 'vi',
      });
      const text = ai?.explanation?.trim();
      return text ? { questionId, explanation: text, source: 'AI' } : retryableFallback;
    } catch {
      return retryableFallback;
    }
  }
}
