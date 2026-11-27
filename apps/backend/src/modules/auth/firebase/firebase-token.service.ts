import { ConflictException, Injectable, Logger, OnModuleInit, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { applicationDefault, cert, Credential, getApps, initializeApp } from 'firebase-admin/app';
import type { Auth, DecodedIdToken } from 'firebase-admin/auth';

export function maskEmail(email?: string | null): string {
  if (!email) return '<anonymous>';
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : '***';
  return `${maskedLocal}@${domain}`;
}

@Injectable()
export class FirebaseTokenService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseTokenService.name);
  private auth?: Auth;
  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean { return this.config.get<string>('AUTH_PROVIDER', 'firebase') === 'firebase'; }

  onModuleInit(): void {
    if (!['firebase', 'legacy'].includes(this.config.get('AUTH_PROVIDER', 'firebase'))) {
      throw new Error('AUTH_PROVIDER must be firebase or legacy');
    }
    const nodeEnv = this.config.get<string>('NODE_ENV');
    const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    if (emulatorHost && (nodeEnv === 'production' || (nodeEnv !== 'development' && nodeEnv !== 'test'))) {
      throw new Error('Firebase Auth Emulator must never be enabled in production or untrusted environments');
    }
    if (this.enabled && (this.config.get<string>('FIREBASE_PROJECT_ID') || emulatorHost)) {
      try {
        this.client();
      } catch (err) {
        this.logger.warn(`Firebase Admin SDK eager initialization deferred: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  private client(): Auth {
    if (this.auth) return this.auth;
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    if (!projectId) throw new ServiceUnavailableException({ code: 'AUTH_NOT_CONFIGURED', message: 'Máy chủ chưa được cấu hình Firebase.' });
    const name = `lingoroad-auth-${projectId}`;

    let credential: Credential | undefined;
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      credential = undefined;
    } else {
      const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
      const rawPrivateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');
      if (clientEmail && rawPrivateKey) {
        this.logger.log('Khởi tạo Firebase Admin SDK bằng FIREBASE_CLIENT_EMAIL và FIREBASE_PRIVATE_KEY');
        let sanitizedKey = rawPrivateKey.trim();
        if (!sanitizedKey.includes('-----BEGIN') && /^[A-Za-z0-9+/=\s]+$/.test(sanitizedKey)) {
          try {
            const decoded = Buffer.from(sanitizedKey, 'base64').toString('utf8');
            if (decoded.includes('-----BEGIN')) {
              sanitizedKey = decoded;
            }
          } catch {
            // fallback to raw key
          }
        }
        sanitizedKey = sanitizedKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        try {
          credential = cert({
            projectId,
            clientEmail,
            privateKey: sanitizedKey,
          });
        } catch (err) {
          this.logger.error(`Lỗi khi tạo cert credential Firebase: ${err instanceof Error ? err.message : err}`);
          throw new ServiceUnavailableException({
            code: 'AUTH_NOT_CONFIGURED',
            message: 'Cấu hình khóa bí mật Firebase không hợp lệ.',
          });
        }
      } else if (clientEmail || rawPrivateKey) {
        throw new ServiceUnavailableException({
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Cấu hình Firebase thiếu FIREBASE_CLIENT_EMAIL hoặc FIREBASE_PRIVATE_KEY.',
        });
      } else {
        this.logger.log('Khởi tạo Firebase Admin SDK bằng applicationDefault (GOOGLE_APPLICATION_CREDENTIALS)');
        credential = applicationDefault();
      }
    }

    const app = getApps().find((a) => a.name === name) ?? initializeApp({
      projectId,
      ...(credential ? { credential } : {}),
    }, name);
    // Load the Admin auth SDK only when Firebase verification is actually used.
    const { getAuth } = require('firebase-admin/auth') as typeof import('firebase-admin/auth');
    this.auth = getAuth(app);
    return this.auth;
  }

  async verify(token: string, checkRevoked = false): Promise<DecodedIdToken> {
    try {
      this.logger.debug(`Đang xác thực Firebase ID Token (độ dài: ${token.length})...`);
      const decoded = await this.client().verifyIdToken(token, checkRevoked);
      this.logger.debug(`Xác thực Firebase Token thành công cho UID: ${decoded.uid}, email: ${maskEmail(decoded.email)}`);
      return decoded;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const code = (error as { code?: string }).code;
      const isClientTokenError =
        code?.startsWith('auth/') ||
        ['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'].includes(code ?? '') ||
        (error instanceof Error && /token|jwt|signature|decode|format|malformed|argument/i.test(error.message));
      if (isClientTokenError) {
        this.logger.warn(`Lỗi xác thực Firebase ID Token (${code ?? 'client-token-error'}): ${error instanceof Error ? error.message : error}`);
        throw new UnauthorizedException({ code: 'AUTH_INVALID_TOKEN', message: 'Phiên đăng nhập hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.' });
      }
      this.logger.error(`Lỗi xác thực Firebase ID Token: ${error instanceof Error ? error.message : error}`, error instanceof Error ? error.stack : undefined);
      throw new ServiceUnavailableException({ code: 'AUTH_SERVICE_UNAVAILABLE', message: 'Không xác thực được phiên đăng nhập. Vui lòng thử lại.' });
    }
  }

  async revoke(uid: string): Promise<void> { await this.client().revokeRefreshTokens(uid); }

  /** Never attach an existing Firebase account merely because its email matches. */
  async createPasswordUser(uid: string, email: string, password: string, displayName: string): Promise<void> {
    try {
      await this.client().createUser({ uid, email, password, displayName, disabled: true });
    } catch (error) {
      if ((error as { code?: string }).code === 'auth/email-already-exists') {
        throw new ConflictException({ code: 'ADMIN_FIREBASE_EMAIL_EXISTS', message: 'Email đã có tài khoản Firebase. Cần liên kết danh tính đã xác minh trước khi quản lý.' });
      }
      throw new ServiceUnavailableException({ code: 'ADMIN_FIREBASE_CREATE_FAILED', message: 'Không thể tạo danh tính Firebase. Vui lòng thử lại.' });
    }
  }

  async activatePasswordUser(uid: string): Promise<void> {
    await this.client().updateUser(uid, { disabled: false });
  }

  /** Compensation is only used for the UID created by this provisioning request. */
  async removeProvisionedUser(uid: string): Promise<void> {
    await this.client().deleteUser(uid);
  }

  async resetPassword(uid: string, password: string): Promise<void> {
    try {
      await this.client().updateUser(uid, { password });
      await this.revoke(uid);
    } catch {
      throw new ServiceUnavailableException({ code: 'ADMIN_FIREBASE_PASSWORD_FAILED', message: 'Không thể hoàn tất đặt lại mật khẩu Firebase. Vui lòng thử lại.' });
    }
  }
}
