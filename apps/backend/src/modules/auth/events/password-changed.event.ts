export class PasswordChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly changedAt: Date,
  ) {}
}
