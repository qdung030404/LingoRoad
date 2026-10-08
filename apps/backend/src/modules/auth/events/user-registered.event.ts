import { UserRole } from '@prisma/client';

export class UserRegisteredEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly role: UserRole,
    public readonly createdAt: Date,
  ) {}
}
