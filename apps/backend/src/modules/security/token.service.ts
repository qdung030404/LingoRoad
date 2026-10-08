import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { UserRole } from '@prisma/client';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  private readonly refreshTokenExpiresDays: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.refreshTokenExpiresDays = Number(
      this.configService.get<number>('REFRESH_TOKEN_EXPIRES_DAYS', 30),
    );
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateRawRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  calculateRefreshTokenExpiry(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiresDays);
    return expiresAt;
  }

  async generateAccessToken(user: { id: string; email: string; role: UserRole }): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.signAsync(payload);
  }

  async generateTokenPair(user: {
    id: string;
    email: string;
    role: UserRole;
  }): Promise<GeneratedTokens> {
    const rawRefreshToken = this.generateRawRefreshToken();
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = this.calculateRefreshTokenExpiry();
    const accessToken = await this.generateAccessToken(user);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      tokenHash,
      expiresAt,
    };
  }
}
