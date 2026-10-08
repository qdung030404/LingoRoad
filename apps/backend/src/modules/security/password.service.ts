import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private static readonly DUMMY_HASH =
    '$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHRzdHJpbmc$1z9808g0Dsq9iR83Kz59GjGvA23u/r6L3684hP53Z6k';

  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  async verify(hashedPassword: string, plainText: string): Promise<boolean> {
    try {
      return await argon2.verify(hashedPassword, plainText);
    } catch (error) {
      this.logger.warn(`Argon2 verification failed unexpectedly: ${(error as Error).message}`);
      return false;
    }
  }

  async dummyVerify(plainText: string): Promise<void> {
    try {
      await argon2.verify(PasswordService.DUMMY_HASH, plainText);
    } catch {
      // Ignored: purpose is timing-attack defense
    }
  }
}
