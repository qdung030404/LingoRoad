export class PlacementCompletedEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
    public readonly estimatedCefr: string,
    public readonly correctCount: number,
    public readonly totalItems: number,
    public readonly completedAt: Date,
  ) {}
}
