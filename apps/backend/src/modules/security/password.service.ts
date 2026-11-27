import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as argon2 from 'argon2';

const MAX_CONCURRENT_ARGON2 = 2;
const MAX_ARGON2_QUEUE = 10;

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private static readonly DUMMY_HASH =
    '$argon2id$v=19$m=65536,t=3,p=4$dGVzdHNhbHRzdHJpbmc$1z9808g0Dsq9iR83Kz59GjGvA23u/r6L3684hP53Z6k';

  private activeCount = 0;
  private readonly waitQueue: Array<() => void> = [];

  private async acquireSlot(): Promise<void> {
    if (this.activeCount < MAX_CONCURRENT_ARGON2) {
      this.activeCount += 1;
      return;
    }

    if (this.waitQueue.length >= MAX_ARGON2_QUEUE) {
      throw new ServiceUnavailableException({
        code: 'AUTH_PASSWORD_BUSY',
        message: 'Hệ thống xác thực đang quá tải, vui lòng thử lại sau ít giây.',
      });
    }

    await new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  private releaseSlot(): void {
    const next = this.waitQueue.shift();
    if (next) {
      next();
    } else {
      this.activeCount = Math.max(0, this.activeCount - 1);
    }
  }

  private async runWithSemaphore<T>(task: () => Promise<T>): Promise<T> {
    await this.acquireSlot();
    try {
      return await task();
    } finally {
      this.releaseSlot();
    }
  }

  async hash(password: string): Promise<string> {
    const isTest = process.env.NODE_ENV === 'test';
    return this.runWithSemaphore(() =>
      argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: isTest ? 4096 : 65536,
        timeCost: isTest ? 2 : 3,
        parallelism: isTest ? 1 : 4,
      }),
    );
  }

  async verify(hashedPassword: string, plainText: string): Promise<boolean> {
    return this.runWithSemaphore(async () => {
      try {
        return await argon2.verify(hashedPassword, plainText);
      } catch (error) {
        this.logger.warn(`Argon2 verification failed unexpectedly: ${(error as Error).message}`);
        return false;
      }
    });
  }

  async dummyVerify(plainText: string): Promise<void> {
    await this.runWithSemaphore(async () => {
      try {
        await argon2.verify(PasswordService.DUMMY_HASH, plainText);
      } catch {
        // Ignored: purpose is timing-attack defense
      }
    });
  }
}
