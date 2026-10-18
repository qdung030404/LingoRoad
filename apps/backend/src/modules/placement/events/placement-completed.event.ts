import { CefrLevel } from '../interfaces/placement.interface';

/**
 * Domain event phát ra khi người học hoàn thành bài kiểm tra đầu vào.
 * Các domain khác (Learning Path, Gamification) lắng nghe để khởi tạo lộ trình học.
 */
export class PlacementCompletedEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly estimatedCefr: CefrLevel,
    public readonly confidenceScore: number,
    public readonly correctCount: number,
    public readonly totalItems: number,
  ) {}
}
