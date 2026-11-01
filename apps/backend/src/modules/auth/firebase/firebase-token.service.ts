import { Injectable, OnModuleInit, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import type { Auth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseTokenService implements OnModuleInit {
  private auth?: Auth;
  constructor(private readonly config: ConfigService) {}

  get enabled() { return this.config.get<string>('AUTH_PROVIDER', 'firebase') === 'firebase'; }

  onModuleInit() {
    if (!['firebase', 'legacy'].includes(this.config.get('AUTH_PROVIDER', 'firebase'))) {
      throw new Error('AUTH_PROVIDER must be firebase or legacy');
    }
    if (this.config.get('NODE_ENV') === 'production' && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      throw new Error('Firebase Auth Emulator must never be enabled in production');
    }
  }

  private client() {
    if (this.auth) return this.auth;
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    if (!projectId) throw new ServiceUnavailableException({ code: 'AUTH_NOT_CONFIGURED', message: 'Máy chủ chưa được cấu hình Firebase.' });
    const name = `lingoroad-auth-${projectId}`;
    const app = getApps().find((a) => a.name === name) ?? initializeApp({
      projectId,
      ...(process.env.FIREBASE_AUTH_EMULATOR_HOST ? {} : { credential: applicationDefault() }),
    }, name);
    // Load the Admin auth SDK only when Firebase verification is actually used.
    const { getAuth } = require('firebase-admin/auth') as typeof import('firebase-admin/auth');
    this.auth = getAuth(app);
    return this.auth;
  }

  async verify(token: string) {
    try {
      return await this.client().verifyIdToken(token, true);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const code = (error as { code?: string }).code;
      if (['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'].includes(code ?? '')) {
        throw new UnauthorizedException({ code: 'AUTH_INVALID_TOKEN', message: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' });
      }
      throw new ServiceUnavailableException({ code: 'AUTH_SERVICE_UNAVAILABLE', message: 'Không xác thực được phiên đăng nhập. Vui lòng thử lại.' });
    }
  }

  async revoke(uid: string) { await this.client().revokeRefreshTokens(uid); }
}
