import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { UserRepository, UserWithProfile } from '../repositories/user.repository';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository';
import { FirebaseAdminService, FirebaseDecodedToken } from '../../security/firebase-admin.service';
import { TokenService } from '../../security/token.service';
import { UserRegisteredEvent } from '../events/user-registered.event';
import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { AuthResult } from './register.use-case';

@Injectable()
export class GoogleLoginUseCase {
  private readonly logger = new Logger(GoogleLoginUseCase.name);

  constructor(
    private readonly userRepository: UserRepository,
    private readonly refreshSessionRepository: RefreshSessionRepository,
    private readonly firebaseAdminService: FirebaseAdminService,
    private readonly tokenService: TokenService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    dto: GoogleLoginDto,
    context?: { ipAddress?: string; deviceIdentifier?: string },
  ): Promise<AuthResult> {
    let decodedToken: FirebaseDecodedToken;
    try {
      decodedToken = await this.firebaseAdminService.verifyIdToken(dto.idToken);
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.warn(`Firebase verifyIdToken failed: ${error instanceof Error ? error.message : error}`);
      throw new UnauthorizedException({
        code: 'AUTH_FIREBASE_INVALID_TOKEN',
        message: 'Firebase ID Token không hợp lệ hoặc đã hết hạn',
      });
    }

    if (!decodedToken.email) {
      throw new BadRequestException({
        code: 'AUTH_EMAIL_MISSING',
        message: 'Tài khoản Google không cung cấp địa chỉ email',
      });
    }

    if (!decodedToken.email_verified) {
      throw new BadRequestException({
        code: 'AUTH_EMAIL_NOT_VERIFIED',
        message: 'Email từ tài khoản Google chưa được xác thực',
      });
    }

    const email = decodedToken.email.toLowerCase().trim();
    const firebaseUid = decodedToken.uid;
    const rawName = (decodedToken.name?.trim() || email.split('@')[0]).trim();
    const name = (rawName || 'Learner').slice(0, 100);
    const avatarUrl =
      decodedToken.picture && decodedToken.picture.startsWith('https://')
        ? decodedToken.picture.slice(0, 500)
        : null;

    let user: UserWithProfile | null = await this.userRepository.findByFirebaseUid(firebaseUid);

    if (user && !user.avatarUrl && avatarUrl) {
      user = await this.userRepository.linkFirebaseUid(user.id, {
        firebaseUid,
        avatarUrl,
      });
    }

    if (!user) {
      user = await this.userRepository.findByEmail(email);

      if (user) {
        if (user.status !== UserStatus.ACTIVE) {
          throw new ForbiddenException({
            code: 'AUTH_USER_SUSPENDED',
            message: 'Tài khoản của bạn đã bị khóa hoặc tạm ngừng hoạt động',
          });
        }

        if (user.role === UserRole.ADMIN) {
          throw new ForbiddenException({
            code: 'AUTH_ADMIN_GOOGLE_LINK_RESTRICTED',
            message: 'Tài khoản Quản trị viên không được phép tự động liên kết qua Google SSO.',
          });
        }

        if (user.firebaseUid && user.firebaseUid !== firebaseUid) {
          throw new ConflictException({
            code: 'AUTH_GOOGLE_ACCOUNT_CONFLICT',
            message: 'Tài khoản này đã được liên kết với một tài khoản Google khác.',
          });
        }

        // Link existing user account to Google UID
        user = await this.userRepository.linkFirebaseUid(user.id, {
          firebaseUid,
          avatarUrl: user.avatarUrl || avatarUrl,
        });
      } else {
        // Auto-provision brand new user
        const rawRefreshToken = this.tokenService.generateRawRefreshToken();
        const tokenHash = this.tokenService.hashToken(rawRefreshToken);
        const sessionExpiresAt = this.tokenService.calculateRefreshTokenExpiry();

        let newUser: UserWithProfile | null = null;
        try {
          newUser = await this.userRepository.createGoogleLearnerWithProfileAndSession({
            email,
            name,
            firebaseUid,
            avatarUrl,
            tokenHash,
            sessionExpiresAt,
            deviceIdentifier: context?.deviceIdentifier,
            ipAddress: context?.ipAddress,
          });

          this.eventEmitter.emit(
            'user.registered',
            new UserRegisteredEvent(
              newUser.id,
              newUser.email,
              newUser.role,
              newUser.createdAt,
            ),
          );

          const accessToken = await this.tokenService.generateAccessToken({
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
          });

          return {
            accessToken,
            refreshToken: rawRefreshToken,
            user: {
              id: newUser.id,
              email: newUser.email,
              name: newUser.name,
              role: newUser.role,
              status: newUser.status,
              avatarUrl: newUser.avatarUrl,
              provider: newUser.provider,
              profile: newUser.profile
                ? {
                    targetCefr: newUser.profile.targetCefr,
                    dailyGoalMinutes: newUser.profile.dailyGoalMinutes,
                    reminderEnabled: newUser.profile.reminderEnabled,
                  }
                : null,
            },
          };
        } catch (error: unknown) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            const existing =
              (await this.userRepository.findByEmail(email)) ||
              (await this.userRepository.findByFirebaseUid(firebaseUid));
            if (existing) {
              if (existing.status !== UserStatus.ACTIVE) {
                throw new ForbiddenException({
                  code: 'AUTH_USER_SUSPENDED',
                  message: 'Tài khoản của bạn đã bị khóa hoặc tạm ngừng hoạt động',
                });
              }

              if (existing.role === UserRole.ADMIN) {
                throw new ForbiddenException({
                  code: 'AUTH_ADMIN_GOOGLE_LINK_RESTRICTED',
                  message: 'Tài khoản Quản trị viên không được phép tự động liên kết qua Google SSO.',
                });
              }

              if (existing.firebaseUid && existing.firebaseUid !== firebaseUid) {
                throw new ConflictException({
                  code: 'AUTH_GOOGLE_ACCOUNT_CONFLICT',
                  message: 'Tài khoản này đã được liên kết với một tài khoản Google khác.',
                });
              }

              user = existing;
              if (!user.firebaseUid) {
                user = await this.userRepository.linkFirebaseUid(user.id, {
                  firebaseUid,
                  avatarUrl: user.avatarUrl || avatarUrl,
                });
              }
            } else {
              throw error;
            }
          } else {
            throw error;
          }
        }
      }
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException({
        code: 'AUTH_USER_SUSPENDED',
        message: 'Tài khoản của bạn đã bị khóa hoặc tạm ngừng hoạt động',
      });
    }

    const rawRefreshToken = this.tokenService.generateRawRefreshToken();
    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const expiresAt = this.tokenService.calculateRefreshTokenExpiry();

    await this.refreshSessionRepository.createSession({
      userId: user.id,
      tokenHash,
      deviceIdentifier: context?.deviceIdentifier,
      ipAddress: context?.ipAddress,
      expiresAt,
    });

    const accessToken = await this.tokenService.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl,
        provider: user.provider,
        profile: user.profile
          ? {
              targetCefr: user.profile.targetCefr,
              dailyGoalMinutes: user.profile.dailyGoalMinutes,
              reminderEnabled: user.profile.reminderEnabled,
            }
          : null,
      },
    };
  }
}
