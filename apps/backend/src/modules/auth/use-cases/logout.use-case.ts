import { Injectable, Logger } from '@nestjs/common';
import { LogoutDto } from '../dto/logout.dto';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository';
import { TokenService } from '../../security/token.service';

@Injectable()
export class LogoutUseCase {
  private readonly logger = new Logger(LogoutUseCase.name);

  constructor(
    private readonly refreshSessionRepository: RefreshSessionRepository,
    private readonly tokenService: TokenService,
  ) {}

  async execute(dto: LogoutDto): Promise<void> {
    const tokenHash = this.tokenService.hashToken(dto.refreshToken);
    await this.refreshSessionRepository.revokeByTokenHash(tokenHash);
    this.logger.log(`Session with hash ${tokenHash.substring(0, 8)}... revoked.`);
  }
}
