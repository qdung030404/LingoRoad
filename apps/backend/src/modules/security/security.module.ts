import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { FirebaseAdminService } from './firebase-admin.service';
import { FirebaseAuthModule } from '../auth/firebase/firebase-auth.module';

@Global()
@Module({
  imports: [
    FirebaseAuthModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>(
          'JWT_SECRET',
          'lingoroad-super-secret-jwt-key-for-development-change-in-production',
        ),
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
