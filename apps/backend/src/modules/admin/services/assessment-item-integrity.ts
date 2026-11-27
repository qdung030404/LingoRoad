import { BadRequestException, ConflictException } from '@nestjs/common';
import { AssessmentItem, Prisma } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { DEMO_BANK_VERSION, isValidPlacementItem } from '../../placement/services/demo-placement.service';

type PlacementCandidate = Pick<AssessmentItem, 'type' | 'options' | 'correctOption' | 'prompt' | 'irtA' | 'irtB' | 'irtC' | 'skill' | 'passage' | 'audioUrl' | 'usageScope'> & { groupId?: string | null };

export function adminPlacementBankVersion(item: PlacementCandidate): string | null {
  const eligible = !item.groupId && (item.usageScope === 'PLACEMENT' || item.usageScope === 'ALL')
    && (item.skill === 'READING' || item.skill === 'LISTENING') && item.type === 'MULTIPLE_CHOICE';
  const valid = eligible && isValidPlacementItem(item);
  if (item.usageScope === 'PLACEMENT' && !valid) {
    throw new BadRequestException({ code: 'ADMIN_INVALID_PLACEMENT_ITEM', message: 'Câu hỏi placement cần 4 lựa chọn khác nhau, đáp án hợp lệ, IRT hợp lệ và đoạn đọc hoặc file audio cục bộ khả dụng.' });
  }
  return valid ? DEMO_BANK_VERSION : null;
}

/** Lock before checking references so a concurrent FK assignment cannot race the check. */
export async function lockAssessmentItem(tx: Prisma.TransactionClient, id: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM assessment_items WHERE id = ${id}::uuid FOR UPDATE`;
}

export function assertReferencedItemUnchanged(
  existing: AssessmentItem & { _count: { responses: number; currentSessions: number } },
  data: Record<string, unknown>,
): void {
  if (!existing._count.responses && !existing._count.currentSessions) return;
  const changed = Object.entries(data).some(([key, value]) => value !== undefined
    && !isDeepStrictEqual(existing[key as keyof AssessmentItem], value === Prisma.JsonNull ? null : value));
  if (changed) throw new ConflictException({ code: 'ADMIN_ITEM_IN_USE', message: 'Câu hỏi đã được sử dụng trong bài kiểm tra. Hãy tạo câu hỏi mới để giữ nguyên nội dung và kết quả đã phát cho học viên.' });
}
