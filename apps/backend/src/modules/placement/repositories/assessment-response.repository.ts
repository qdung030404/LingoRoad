import { Injectable } from '@nestjs/common';
import { AssessmentResponse, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AssessmentResponseRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: {
      sessionId: string;
      itemId: string;
      itemIndex: number;
      selectedOption: string;
      isCorrect: boolean;
      responseTimeMs?: number;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<AssessmentResponse> {
    const client = tx || this.prisma;
    return client.assessmentResponse.create({
      data: {
        sessionId: data.sessionId,
        itemId: data.itemId,
        itemIndex: data.itemIndex,
        selectedOption: data.selectedOption,
        isCorrect: data.isCorrect,
        responseTimeMs: data.responseTimeMs ?? null,
      },
    });
  }

  async findBySessionId(sessionId: string): Promise<AssessmentResponse[]> {
    return this.prisma.assessmentResponse.findMany({
      where: { sessionId },
      orderBy: { itemIndex: 'asc' },
      include: { item: true },
    });
  }

  async findBySessionAndIndex(sessionId: string, itemIndex: number): Promise<AssessmentResponse | null> {
    return this.prisma.assessmentResponse.findUnique({
      where: {
        sessionId_itemIndex: {
          sessionId,
          itemIndex,
        },
      },
      include: { item: true },
    });
  }
}
