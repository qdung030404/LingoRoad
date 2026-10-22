import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UserRepository } from './repositories/user.repository';
import { RefreshSessionRepository } from './repositories/refresh-session.repository';
import { RegisterUseCase } from './use-cases/register.use-case';
import { LoginUseCase } from './use-cases/login.use-case';
import { RefreshTokenUseCase } from './use-cases/refresh-token.use-case';
import { LogoutUseCase } from './use-cases/logout.use-case';
import { LogoutAllUseCase } from './use-cases/logout-all.use-case';
import { ChangePasswordUseCase } from './use-cases/change-password.use-case';
import { ProfileService } from './profile.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    UserRepository,
    RefreshSessionRepository,
    RegisterUseCase,
    LoginUseCase,
    RefreshTokenUseCase,
    LogoutUseCase,
    LogoutAllUseCase,
    ChangePasswordUseCase,
    ProfileService,
  ],
  exports: [UserRepository, RefreshSessionRepository, JwtStrategy],
})
export class AuthModule {}
