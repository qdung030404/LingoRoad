import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { FirebaseAuthModule } from '../auth/firebase/firebase-auth.module';

export const DEFAULT_DEV_JWT_SECRET =
  'lingoroad-super-secret-jwt-key-for-development-change-in-production';

export function resolveJwtSecret(configService: ConfigService): string {
  const nodeEnv = configService.get<string>('NODE_ENV');
  const configured = configService.get<string>('JWT_SECRET')?.trim();

  if (nodeEnv === 'production') {
    if (
      !configured ||
      configured === DEFAULT_DEV_JWT_SECRET ||
      configured.length < 32
    ) {
      throw new Error(
        'JWT_SECRET must be explicitly configured with a unique cloud secret (>= 32 characters) in production.',
      );
    }
    return configured;
  }

  return configured || DEFAULT_DEV_JWT_SECRET;
}

@Global()
@Module({
  imports: [
    FirebaseAuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: resolveJwtSecret(configService),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [PasswordService, TokenService, FirebaseAdminService],
  exports: [PasswordService, TokenService, FirebaseAdminService, JwtModule],
})
export class SecurityModule {}

