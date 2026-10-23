import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AssessmentItem, AssessmentResponse, AssessmentSkill, CefrLevel, PlacementSession, Prisma, SessionStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { existsSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { MlClientService } from '../../ml/ml-client.service';
import { SubmitAnswerDto } from '../interfaces/placement.interface';
import { PlacementCompletedEvent } from '../events/placement-completed.event';

export const DEMO_BANK_VERSION = 'demo-v1';
export const DEMO_TEST_VERSION = 'READING_LISTENING_V1';
export const SECTION_TOTAL = 5;
export const PLACEMENT_TOTAL = 10;

export function placementMediaRoot() {
  // Works with `npm --prefix apps/backend start` and launches from repository root.
  return existsSync(join(process.cwd(), 'prisma', 'schema.prisma'))
    ? join(process.cwd(), 'media', 'placement')
    : join(process.cwd(), 'apps', 'backend', 'media', 'placement');
}

export function provisionalCefr(correct: number, total: number): CefrLevel {
  const ratio = total > 0 ? correct / total : 0;
  return ratio >= 0.85 ? CefrLevel.B2 : ratio >= 0.65 ? CefrLevel.B1 : ratio >= 0.4 ? CefrLevel.A2 : CefrLevel.A1;
}

type Session = PlacementSession & {
  currentItem: AssessmentItem | null;
  responses: (AssessmentResponse & { item: AssessmentItem })[];
};
const sessionInclude = { currentItem: true, responses: { include: { item: true }, orderBy: { itemIndex: 'asc' as const } } };

@Injectable()
export class DemoPlacementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ml: MlClientService,
    private readonly events: EventEmitter2,
  ) {}

  private unavailable(message = 'Ngân hàng câu hỏi chưa sẵn sàng. Vui lòng thử lại sau.'): never {
    throw new ServiceUnavailableException({ code: 'PLACEMENT_BANK_UNAVAILABLE', message });
  }

  private conflict(message = 'Câu trả lời đã được khóa hoặc phiên đã thay đổi. Vui lòng tải lại.'): never {
    throw new ConflictException({ code: 'PLACEMENT_STATE_CONFLICT', message });
  }

  private skill(index: number): AssessmentSkill {
    return index < SECTION_TOTAL ? AssessmentSkill.READING : AssessmentSkill.LISTENING;
  }

  private publicItem(item: AssessmentItem, index: number) {
    return {
      id: item.id, index, type: item.type, prompt: item.prompt,
      passage: item.passage, options: item.options as string[], mediaUrl: item.audioUrl,
      skill: item.skill, sectionIndex: index % SECTION_TOTAL, sectionTotal: SECTION_TOTAL,
    };
  }

  private validItem(item: AssessmentItem): boolean {
    const options = item.options;
    const base = item.type === 'MULTIPLE_CHOICE' && Array.isArray(options) && options.length === 4
      && options.every((o) => typeof o === 'string' && o.trim().length > 0)
      && new Set(options).size === 4 && options.filter((o) => o === item.correctOption).length === 1
      && item.prompt.trim().length > 0 && Number.isFinite(item.irtA) && item.irtA > 0
      && Number.isFinite(item.irtB) && Number.isFinite(item.irtC) && item.irtC >= 0 && item.irtC < 1;
    if (!base) return false;
    if (item.skill === AssessmentSkill.READING) return !!item.passage?.trim();
    if (item.skill !== AssessmentSkill.LISTENING || !item.audioUrl) return false;
    const match = /^\/media\/placement\/([a-zA-Z0-9._-]+\.wav)$/.exec(item.audioUrl);
    return !!match && existsSync(join(placementMediaRoot(), match[1]));
  }

  private async bank(bankVersion = DEMO_BANK_VERSION) {
    const items = await this.prisma.assessmentItem.findMany({ where: { bankVersion }, orderBy: { externalId: 'asc' } });
    return items.filter((item) => this.validItem(item));
  }

  private async owned(sessionId: string, userId: string): Promise<Session> {
    const session = await this.prisma.placementSession.findUnique({ where: { id: sessionId }, include: sessionInclude });
    if (!session) throw new NotFoundException({ code: 'PLACEMENT_NOT_FOUND', message: 'Không tìm thấy phiên kiểm tra.' });
    if (session.userId !== userId) throw new ForbiddenException({ code: 'PLACEMENT_FORBIDDEN', message: 'Bạn không có quyền truy cập phiên này.' });
    return session;
  }

  private startState(session: Session) {
    if (session.status !== SessionStatus.IN_PROGRESS) this.conflict('Bạn đã hoàn tất bài kiểm tra. Vui lòng xem kết quả.');
    if (!session.currentItem || !this.validItem(session.currentItem)) this.unavailable();
    return {
      sessionId: session.id, totalItems: session.totalItems,
      currentIndex: session.currentItemIndex, currentSkill: this.skill(session.currentItemIndex),
      sectionIndex: session.currentItemIndex % SECTION_TOTAL, sectionTotal: SECTION_TOTAL,
      firstItem: this.publicItem(session.currentItem, session.currentItemIndex),
    };
  }

  async start(userId: string) {
    const active = await this.prisma.placementSession.findFirst({ where: { userId, status: SessionStatus.IN_PROGRESS }, include: sessionInclude });
    if (active) return this.startState(active);
    const completed = await this.prisma.placementSession.findFirst({ where: { userId, status: SessionStatus.COMPLETED } });
    if (completed) this.conflict('Bạn đã hoàn tất bài kiểm tra. Vui lòng xem kết quả.');
    const bank = await this.bank();
    for (const skill of [AssessmentSkill.READING, AssessmentSkill.LISTENING]) {
      const candidates = bank.filter((i) => i.skill === skill);
      if (candidates.length < SECTION_TOTAL || !candidates.some((i) => i.cefrLevel === CefrLevel.A2)) this.unavailable();
    }
    const first = await this.select(bank, [], 0);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Serialize starts for this account; recheck after CAT so a concurrent
        // completed session cannot accidentally become a new test attempt.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
        const existing = await tx.placementSession.findFirst({ where: { userId, status: SessionStatus.IN_PROGRESS }, include: sessionInclude });
        if (existing) return existing;
        const done = await tx.placementSession.findFirst({ where: { userId, status: SessionStatus.COMPLETED } });
        if (done) this.conflict('Bạn đã hoàn tất bài kiểm tra. Vui lòng xem kết quả.');
        return tx.placementSession.create({
          data: { userId, totalItems: PLACEMENT_TOTAL, testVersion: DEMO_TEST_VERSION, bankVersion: DEMO_BANK_VERSION, currentItemId: first.id },
          include: sessionInclude,
        });
      });
      return this.startState(created);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const winner = await this.prisma.placementSession.findFirst({ where: { userId, status: SessionStatus.IN_PROGRESS }, include: sessionInclude });
      if (!winner) this.conflict();
      return this.startState(winner);
    }
  }

  async status(userId: string) {
    const active = await this.prisma.placementSession.findFirst({ where: { userId, status: SessionStatus.IN_PROGRESS } });
    const completed = await this.prisma.placementSession.findFirst({ where: { userId, status: SessionStatus.COMPLETED }, orderBy: { completedAt: 'desc' } });
    const session = active ?? completed;
    return {
      hasCompleted: !!completed, currentSessionId: session?.id ?? null,
      status: session?.status ?? null, currentIndex: session?.currentItemIndex ?? 0,
      totalItems: session?.totalItems ?? PLACEMENT_TOTAL,
    };
  }

  private async select(bank: AssessmentItem[], history: { itemId: string; isCorrect: boolean }[], index: number) {
    const skill = this.skill(index);
    const skillBank = bank.filter((i) => i.skill === skill);
    const skillHistory = history.filter((r) => skillBank.some((i) => i.id === r.itemId));
    let remaining = skillBank.filter((i) => !history.some((r) => r.itemId === i.id));
    if (skillHistory.length === 0) remaining = remaining.filter((i) => i.cefrLevel === CefrLevel.A2);
    if (remaining.length === 0) this.unavailable();
    try {
      const selected = await this.ml.selectNextCatItem(
        skillHistory.map((r) => {
          const item = skillBank.find((i) => i.id === r.itemId)!;
          return { a: item.irtA, b: item.irtB, c: item.irtC, correct: r.isCorrect };
        }),
        remaining.map((i) => ({ item_id: i.id, a: i.irtA, b: i.irtB, c: i.irtC })),
      );
      const item = remaining.find((i) => i.id === selected.next_item_id);
      if (!item) throw new Error('CAT selected an unavailable item');
      return item;
    } catch {
      throw new ServiceUnavailableException({ code: 'PLACEMENT_CAT_UNAVAILABLE', message: 'Chưa thể chọn câu tiếp theo. Câu hiện tại vẫn được giữ, vui lòng thử lại.' });
    }
  }

  private skillResults(responses: { isCorrect: boolean; item: AssessmentItem }[]) {
    const score = (skill: AssessmentSkill) => {
      const answers = responses.filter((r) => r.item.skill === skill);
      const correctCount = answers.filter((r) => r.isCorrect).length;
      return { estimatedCefr: provisionalCefr(correctCount, SECTION_TOTAL), correctCount, totalItems: SECTION_TOTAL, status: 'PROVISIONAL' };
    };
    return {
      reading: score(AssessmentSkill.READING), listening: score(AssessmentSkill.LISTENING),
      speaking: { estimatedCefr: null, status: 'NOT_ASSESSED' }, writing: { estimatedCefr: null, status: 'NOT_ASSESSED' },
    };
  }

  private resultState(session: Session) {
    if (session.status !== SessionStatus.COMPLETED || !session.completedAt || !session.estimatedCefr) {
      throw new BadRequestException({ code: 'PLACEMENT_NOT_COMPLETED', message: 'Bài kiểm tra chưa hoàn tất.' });
    }
    return {
      sessionId: session.id, estimatedCefr: session.estimatedCefr, confidenceScore: null,
      completionRate: 1, resultStatus: 'PROVISIONAL', scoringMethod: 'PROVISIONAL_RATIO_V1',
      correctCount: session.correctCount, totalItems: session.totalItems, completedAt: session.completedAt,
      skills: session.skillResults ?? this.skillResults(session.responses),
    };
  }

  private answerState(session: Session) {
    if (session.status === SessionStatus.COMPLETED) return { isFinished: true, nextItem: null, result: this.resultState(session) };
    if (session.status !== SessionStatus.IN_PROGRESS) this.conflict();
    if (!session.currentItem || !this.validItem(session.currentItem)) this.unavailable();
    return { isFinished: false, nextItem: this.publicItem(session.currentItem, session.currentItemIndex), result: null };
  }

  private replay(session: Session, dto: SubmitAnswerDto) {
    const existing = session.responses.find((r) => r.itemIndex === dto.itemIndex || r.itemId === dto.itemId);
    if (!existing) return null;
    if (existing.itemId !== dto.itemId || existing.itemIndex !== dto.itemIndex || existing.selectedOption !== dto.selectedOption) this.conflict();
    return this.answerState(session);
  }

  async answer(sessionId: string, userId: string, dto: SubmitAnswerDto) {
    const session = await this.owned(sessionId, userId);
    const replay = this.replay(session, dto);
    if (replay) return replay;
    if (session.status !== SessionStatus.IN_PROGRESS || session.currentItemId !== dto.itemId || session.currentItemIndex !== dto.itemIndex) this.conflict();
    const item = session.currentItem;
    if (!item || !this.validItem(item)) this.unavailable();
    if (!(item.options as string[]).includes(dto.selectedOption)) {
      throw new BadRequestException({ code: 'PLACEMENT_INVALID_OPTION', message: 'Lựa chọn không thuộc câu hỏi hiện tại.' });
    }
    const isCorrect = item.correctOption === dto.selectedOption;
    const nextIndex = session.currentItemIndex + 1;
    const finished = nextIndex === session.totalItems;
    const responses = [...session.responses, { itemId: item.id, isCorrect, item }];
    // External CAT work is completed before any mutation. A failure leaves the delivered question intact.
    const next = finished ? null : await this.select(await this.bank(session.bankVersion), responses, nextIndex);
    const correctCount = session.correctCount + (isCorrect ? 1 : 0);
    const estimatedCefr = finished ? provisionalCefr(correctCount, session.totalItems) : null;
    const committed = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.placementSession.updateMany({
        where: { id: session.id, userId, status: SessionStatus.IN_PROGRESS, version: session.version, currentItemId: item.id, currentItemIndex: dto.itemIndex },
        data: {
          version: { increment: 1 }, currentItemIndex: nextIndex, currentItemId: next?.id ?? null, correctCount,
          ...(finished ? { status: SessionStatus.COMPLETED, completedAt: new Date(), estimatedCefr, confidenceScore: null, skillResults: this.skillResults(responses) } : {}),
        },
      });
      if (claimed.count !== 1) return false;
      await tx.assessmentResponse.create({ data: { sessionId, itemId: item.id, itemIndex: dto.itemIndex, selectedOption: dto.selectedOption, isCorrect, responseTimeMs: dto.responseTimeMs } });
      return true;
    });
    const latest = await this.owned(sessionId, userId);
    if (!committed) {
      const concurrentReplay = this.replay(latest, dto);
      if (concurrentReplay) return concurrentReplay;
      this.conflict();
    }
    if (finished) this.events.emit('placement.completed', new PlacementCompletedEvent(userId, sessionId, estimatedCefr!, null, correctCount, session.totalItems));
    return this.answerState(latest);
  }

  async result(sessionId: string, userId: string) {
    return this.resultState(await this.owned(sessionId, userId));
  }

  async review(sessionId: string, userId: string) {
    const session = await this.owned(sessionId, userId);
    const reveal = session.status === SessionStatus.COMPLETED;
    return {
      sessionId, status: session.status,
      items: session.responses.map((r) => ({
        ...this.publicItem(r.item, r.itemIndex), selectedOption: r.selectedOption,
        ...(reveal ? { isCorrect: r.isCorrect, correctOption: r.item.correctOption, explanation: r.item.explanation } : {}),
      })),
    };
  }
}
