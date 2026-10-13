import { Injectable } from '@nestjs/common';
import { CefrLevel, PlacementSession, Prisma, SessionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type PlacementSessionWithResponses = Prisma.PlacementSessionGetPayload<{
  include: {
    responses: {
      include: { item: true };
    };
  };
}>;

@Injectable()
export class PlacementSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByUserId(userId: string): Promise<PlacementSession | null> {
    return this.prisma.placementSession.findFirst({
      where: {
        userId,
        status: SessionStatus.IN_PROGRESS,
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  async findLatestCompletedByUserId(userId: string): Promise<PlacementSession | null> {
    return this.prisma.placementSession.findFirst({
      where: {
        userId,
        status: SessionStatus.COMPLETED,
      },
      orderBy: { completedAt: 'desc' },
    });
  }

  async findByIdWithResponses(id: string): Promise<PlacementSessionWithResponses | null> {
    return this.prisma.placementSession.findUnique({
      where: { id },
      include: {
        responses: {
          orderBy: { itemIndex: 'asc' },
          include: { item: true },
        },
      },
    });
  }

  async create(userId: string, totalItems = 15): Promise<PlacementSession> {
    return this.prisma.placementSession.create({
      data: {
        userId,
        totalItems,
        status: SessionStatus.IN_PROGRESS,
        currentItemIndex: 0,
        correctCount: 0,
      },
    });
  }

  async updateProgress(
    id: string,
    currentItemIndex: number,
    correctCount: number,
    tx?: Prisma.TransactionClient,
  ): Promise<PlacementSession> {
    const client = tx || this.prisma;
    return client.placementSession.update({
      where: { id },
      data: {
        currentItemIndex,
        correctCount,
      },
    });
  }

  async completeSession(
    id: string,
    estimatedCefr: CefrLevel,
    confidenceScore: number,
    correctCount: number,
    tx?: Prisma.TransactionClient,
  ): Promise<PlacementSession> {
    const client = tx || this.prisma;
    return client.placementSession.update({
      where: { id },
      data: {
        status: SessionStatus.COMPLETED,
        estimatedCefr,
        confidenceScore,
        correctCount,
        completedAt: new Date(),
      },
    });
  }
}
