import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { LearningAttempt, LearningAttemptAnswer, LearningLesson, Prisma } from '@prisma/client';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { CheckLearningAnswerDto, LearningProgressDto } from './learning.dto';
import { LearningContent, LessonSnapshot, validateLearningContent } from './learning.types';
import { PlanningService } from '../planning/planning.service';

type Attempt = LearningAttempt & { answers: LearningAttemptAnswer[] };
const includeAnswers = { answers: true } as const;
type Database = Prisma.TransactionClient;

export function learningMediaRoot(): string {
  return existsSync(join(process.cwd(), 'prisma/schema.prisma'))
    ? join(process.cwd(), 'media/learning')
    : join(process.cwd(), 'apps/backend/media/learning');
}

/** All learner mutations use an attempt version; answer locks are permanent. */
@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly planning?: PlanningService) {}

  private conflict(): never {
    throw new ConflictException({ code: 'LEARNING_STATE_CONFLICT', message: 'Bài học đã thay đổi trên thiết bị khác. Vui lòng tải lại.' });
  }

  private invalid(message: string): never {
    throw new BadRequestException({ code: 'LEARNING_INVALID_INPUT', message });
  }

  private async owned(db: Database, userId: string, attemptId: string): Promise<Attempt> {
    // The same response for unknown and foreign IDs prevents disclosing another learner's history.
    const attempt = await db.learningAttempt.findFirst({ where: { id: attemptId, userId }, include: includeAnswers });
    if (!attempt) throw new NotFoundException({ code: 'LEARNING_ATTEMPT_NOT_FOUND', message: 'Không tìm thấy lượt học.' });
    return attempt;
  }

  private content(attempt: LearningAttempt): LearningContent {
    return attempt.contentSnapshot as unknown as LearningContent;
  }

  private lessonInfo(lesson: LearningLesson): LessonSnapshot {
    return { id: lesson.id, code: lesson.code, kind: lesson.kind, title: lesson.title, description: lesson.description,
      estimatedMinutes: lesson.estimatedMinutes, contentVersion: lesson.contentVersion };
  }

  private publicContent(content: LearningContent, completed: boolean) {
    return {
      steps: content.steps.map((step) => ({ id: step.id, title: step.title, body: step.body,
        ...(step.word ? { word: step.word } : {}), ...(step.phonetic ? { phonetic: step.phonetic } : {}),
        ...(step.meaning ? { meaning: step.meaning } : {}), ...(step.example ? { example: step.example } : {}),
        ...(step.audioUrl ? { audioUrl: step.audioUrl } : {}) })),
      ...(content.passage ? { passage: content.passage } : {}),
      ...(content.audioUrl ? { audioUrl: content.audioUrl } : {}),
      ...(completed && content.transcript ? { transcript: content.transcript } : {}),
    };
  }

  private publicQuestions(content: LearningContent) {
    return content.questions.map((question) => ({ id: question.id, prompt: question.prompt,
      options: question.options.map((option) => ({ id: option.id, text: option.text })) }));
  }

  private result(attempt: LearningAttempt) {
    return attempt.status === 'COMPLETED' ? { correctCount: attempt.correctCount!, totalQuestions: attempt.totalQuestions,
      scoreRatio: attempt.correctCount! / attempt.totalQuestions } : null;
  }

  private summaryItem(attempt: LearningAttempt) {
    return { id: attempt.id, lesson: attempt.lessonSnapshot as unknown as LessonSnapshot, status: attempt.status,
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
          ...(answer?.checked ? { isCorrect: answer.isCorrect, correctOptionId: question.correctOptionId, explanation: question.explanation } : {}) };
      }),
    };
  }

  async catalogue(userId: string, kind?: LearningLesson['kind']) {
    const [lessons, attempts] = await Promise.all([
      this.prisma.learningLesson.findMany({ where: { published: true, ...(kind ? { kind } : {}) }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
      this.prisma.learningAttempt.findMany({ where: { userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] }),
    ]);
    return { items: lessons.map((lesson) => {
      const records = attempts.filter((attempt) => attempt.lessonId === lesson.id);
      const active = records.find((attempt) => attempt.status === 'IN_PROGRESS');
      const latest = records.find((attempt) => attempt.status === 'COMPLETED');
      return { ...this.lessonInfo(lesson), state: active ? 'IN_PROGRESS' : latest ? 'COMPLETED' : 'NOT_STARTED',
        activeAttemptId: active?.id ?? null, latestResult: latest ? this.result(latest) : null };
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
    try {
      const attempt = await this.prisma.$transaction(async (tx) => {
        // Serialize start requests for one account, and retain the partial unique index as the final invariant.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
        const active = await tx.learningAttempt.findFirst({ where: { userId, lessonId, status: 'IN_PROGRESS' }, include: includeAnswers });
        if (active) return active;
        const lesson = await tx.learningLesson.findFirst({ where: { id: lessonId, published: true } });
        if (!lesson) throw new NotFoundException({ code: 'LEARNING_LESSON_NOT_FOUND', message: 'Không tìm thấy bài học.' });
        const content = lesson.content as unknown as LearningContent;
        try { validateLearningContent(content); } catch {
          throw new ServiceUnavailableException({ code: 'LEARNING_CONTENT_UNAVAILABLE', message: 'Nội dung bài học chưa sẵn sàng.' });
        }
        return tx.learningAttempt.create({ data: { userId, lessonId, phase: content.steps.length ? 'STUDY' : 'QUIZ',
          totalQuestions: content.questions.length, contentSnapshot: lesson.content as Prisma.InputJsonValue,
          lessonSnapshot: this.lessonInfo(lesson) as unknown as Prisma.InputJsonValue }, include: includeAnswers });
      });
      return this.publicAttempt(attempt);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.prisma.learningAttempt.findFirst({ where: { userId, lessonId, status: 'IN_PROGRESS' }, include: includeAnswers });
        if (winner) return this.publicAttempt(winner);
      }
      throw error;
    }
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

  async check(userId: string, attemptId: string, questionId: string, dto: CheckLearningAnswerDto) {
    try { return await this.prisma.$transaction(async (tx) => {
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
      await this.reserve(tx, attempt, dto.expectedVersion, { phase: 'QUIZ', positionIndex: index });
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
      const attempt = await this.owned(tx, userId, attemptId);
      if (attempt.status === 'COMPLETED') return this.publicAttempt(attempt);
      const content = this.content(attempt);
      if (!content.questions.every((question) => attempt.answers.some((answer) => answer.questionId === question.id && answer.checked))) {
        this.invalid('Hãy kiểm tra đầy đủ các câu hỏi trước khi nộp bài.');
      }
      const correctCount = attempt.answers.filter((answer) => answer.checked && answer.isCorrect).length;
      await this.reserve(tx, attempt, expectedVersion, { status: 'COMPLETED', correctCount, submittedAt: new Date() });
      return this.publicAttempt(await this.owned(tx, userId, attemptId));
    }); } catch (error) {
      if (error instanceof ConflictException) {
        const current = await this.owned(this.prisma, userId, attemptId);
        if (current.status === 'COMPLETED') return this.publicAttempt(current);
      }
      throw error;
    }
  }

  async history(userId: string, cursor?: string, limit = 20) {
    if (cursor) await this.owned(this.prisma, userId, cursor);
    const attempts = await this.prisma.learningAttempt.findMany({ where: { userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    return { items: attempts.slice(0, limit).map((attempt) => this.summaryItem(attempt)), nextCursor: attempts.length > limit ? attempts[limit - 1].id : null };
  }

  async summary(userId: string) {
    if (this.planning) return this.planning.summary(userId);
    const [catalogue, attempts] = await Promise.all([this.catalogue(userId), this.prisma.learningAttempt.findMany({ where: { userId }, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }] })]);
    const completed = attempts.filter((attempt) => attempt.status === 'COMPLETED');
    const active = attempts.filter((attempt) => attempt.status === 'IN_PROGRESS');
    const next = catalogue.items.find((lesson) => lesson.state === 'NOT_STARTED');
    return { totalLessons: catalogue.items.length, completedLessonCount: new Set(completed.map((attempt) => attempt.lessonId)).size,
      completedAttemptCount: completed.length, activeAttemptCount: active.length,
      continueLessonId: active[0]?.lessonId ?? next?.id ?? null, continueAttemptId: active[0]?.id ?? null };
  }
}
