import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UserRepository } from '../repositories/user.repository';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository';
import { PasswordService } from '../../security/password.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordChangedEvent } from '../events/password-changed.event';

@Injectable()
export class ChangePasswordUseCase {
  private readonly logger = new Logger(ChangePasswordUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshSessionRepository: RefreshSessionRepository,
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException({
        code: 'AUTH_USER_NOT_FOUND',
        message: 'Không tìm thấy thông tin tài khoản.',
      });
    }

    const isOldMatch = await this.passwordService.verify(user.passwordHash, dto.oldPassword);
    if (!isOldMatch) {
      throw new BadRequestException({
        code: 'AUTH_PASSWORD_MISMATCH',
        message: 'Mật khẩu hiện tại không chính xác.',
      });
    }

    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException({
        code: 'AUTH_PASSWORD_UNCHANGED',
        message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.',
      });
    }

    const newPasswordHash = await this.passwordService.hash(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await this.userRepository.updatePassword(userId, newPasswordHash, tx);
      await this.refreshSessionRepository.revokeAllUserSessions(userId, tx);
    });

    const changedAt = new Date();
    this.eventEmitter.emit('user.password_changed', new PasswordChangedEvent(userId, changedAt));

    this.logger.log(`Password changed successfully for user: ${userId}. All sessions revoked.`);
  }
}
