import { Injectable, OnModuleInit, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface FirebaseDecodedToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  [key: string]: unknown;
}

interface FirebaseAdminAuth {
  verifyIdToken(idToken: string): Promise<FirebaseDecodedToken>;
}

interface FirebaseAdminApp {
  auth(): FirebaseAdminAuth;
}

interface FirebaseAdminModule {
  apps: FirebaseAdminApp[];
  initializeApp(options: { credential: unknown }): FirebaseAdminApp;
  credential: {
    cert(serviceAccountPathOrObject: {
      projectId: string;
      clientEmail: string;
      privateKey: string;
    }): unknown;
  };
  auth(): FirebaseAdminAuth;
}

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private adminModule: FirebaseAdminModule | null = null;
  private isInitialized = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const rawPrivateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !rawPrivateKey) {
      this.logger.warn(
        'Firebase Admin SDK credentials are missing. Google Auth verification will be disabled until configured.',
      );
      return;
    }

    try {
      // Dynamic import to prevent crash if firebase-admin package is not installed yet
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.adminModule = require('firebase-admin') as FirebaseAdminModule;

      if (!this.adminModule.apps.length) {
        const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
        this.adminModule.initializeApp({
          credential: this.adminModule.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        this.logger.log('Firebase Admin SDK successfully initialized.');
      }
      this.isInitialized = true;
    } catch (error: unknown) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  async verifyIdToken(idToken: string): Promise<FirebaseDecodedToken> {
    if (!this.isInitialized || !this.adminModule) {
      throw new ServiceUnavailableException({
        code: 'AUTH_FIREBASE_NOT_CONFIGURED',
        message: 'Dịch vụ xác thực Google chưa được cấu hình trên máy chủ',
      });
    }

    return this.adminModule.auth().verifyIdToken(idToken);
  }
}
