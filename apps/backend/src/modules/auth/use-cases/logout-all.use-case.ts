import { Injectable, Logger } from '@nestjs/common';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository';

@Injectable()
export class LogoutAllUseCase {
  private readonly logger = new Logger(LogoutAllUseCase.name);

  constructor(private readonly refreshSessionRepository: RefreshSessionRepository) {}

  async execute(userId: string): Promise<void> {
    await this.refreshSessionRepository.revokeAllUserSessions(userId);
    this.logger.log(`All sessions revoked for user: ${userId}`);
  }
}
