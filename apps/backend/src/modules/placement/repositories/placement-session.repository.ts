import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PlacementSession,
  PlacementSessionWithResponses,
  SessionStatus,
  CefrLevel,
} from '../interfaces/placement.interface';

@Injectable()
export class PlacementSessionRepository {
  constructor(readonly prisma: PrismaService) {}

  async findActiveByUserId(userId: string): Promise<PlacementSession | null> {
    return this.prisma.placementSession.findFirst({
      where: { userId, status: SessionStatus.IN_PROGRESS },
    }) as Promise<PlacementSession | null>;
  }

  async findLatestCompletedByUserId(
    userId: string,
  ): Promise<PlacementSession | null> {
    return this.prisma.placementSession.findFirst({
      where: { userId, status: SessionStatus.COMPLETED },
      orderBy: { completedAt: 'desc' },
    }) as Promise<PlacementSession | null>;
  }

  async findByIdWithResponses(
    sessionId: string,
  ): Promise<PlacementSessionWithResponses | null> {
    return this.prisma.placementSession.findUnique({
      where: { id: sessionId },
      include: { responses: { orderBy: { itemIndex: 'asc' } } },
    }) as Promise<PlacementSessionWithResponses | null>;
  }

  async findById(sessionId: string): Promise<PlacementSession | null> {
    return this.prisma.placementSession.findUnique({
      where: { id: sessionId },
    }) as Promise<PlacementSession | null>;
  }

  async create(data: {
    userId: string;
    totalItems: number;
  }): Promise<PlacementSession> {
    return this.prisma.placementSession.create({
      data: {
        userId: data.userId,
        totalItems: data.totalItems,
        status: SessionStatus.IN_PROGRESS,
        currentItemIndex: 0,
        correctCount: 0,
      },
    }) as Promise<PlacementSession>;
  }

  /**
   * Tăng currentItemIndex và correctCount (nếu đúng) bên trong transaction context.
   */
  async incrementProgress(
    sessionId: string,
    isCorrect: boolean,
    tx?: Prisma.TransactionClient,
  ): Promise<PlacementSession> {
    const client = tx ?? this.prisma;
    return client.placementSession.update({
      where: { id: sessionId },
      data: {
        currentItemIndex: { increment: 1 },
        correctCount: isCorrect ? { increment: 1 } : undefined,
      },
    }) as Promise<PlacementSession>;
  }

  async markAsCompleted(
    sessionId: string,
    estimatedCefr: CefrLevel,
    confidenceScore: number,
  ): Promise<PlacementSession> {
    return this.prisma.placementSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.COMPLETED,
        estimatedCefr,
        confidenceScore,
        completedAt: new Date(),
      },
    }) as Promise<PlacementSession>;
  }
}
