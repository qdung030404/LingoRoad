import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AssessmentResponse } from '../interfaces/placement.interface';

export interface CreateResponseData {
  sessionId: string;
  itemId: string;
  itemIndex: number;
  selectedOption: string;
  isCorrect: boolean;
  responseTimeMs?: number;
}

@Injectable()
export class AssessmentResponseRepository {
  constructor(readonly prisma: PrismaService) {}

  /**
   * Ghi response trong transaction context bên ngoài (dùng cho atomic idempotency).
   * Truyền `tx` khi gọi từ bên trong `prisma.$transaction()`.
   */
  async create(
    data: CreateResponseData,
    tx?: Prisma.TransactionClient,
  ): Promise<AssessmentResponse> {
    const client = tx ?? this.prisma;
    return client.assessmentResponse.create({
      data: {
        sessionId: data.sessionId,
        itemId: data.itemId,
        itemIndex: data.itemIndex,
        selectedOption: data.selectedOption,
        isCorrect: data.isCorrect,
        responseTimeMs: data.responseTimeMs ?? null,
      },
    }) as Promise<AssessmentResponse>;
  }

  async findBySessionId(sessionId: string): Promise<AssessmentResponse[]> {
    return this.prisma.assessmentResponse.findMany({
      where: { sessionId },
      orderBy: { itemIndex: 'asc' },
    }) as Promise<AssessmentResponse[]>;
  }

  /**
   * Kiểm tra idempotency — trả về true nếu đã có response cho (sessionId, itemIndex).
   * Hỗ trợ transaction context để đảm bảo isolation.
   */
  async existsBySessionAndIndex(
    sessionId: string,
    itemIndex: number,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const client = tx ?? this.prisma;
    const count = await client.assessmentResponse.count({
      where: { sessionId, itemIndex },
    });
    return count > 0;
  }
}
