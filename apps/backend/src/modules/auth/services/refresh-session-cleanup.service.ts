import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  clampRefreshSessionBatchSize,
  RefreshSessionRepository,
  REFRESH_SESSION_CLEANUP_BATCH_SIZE,
  REFRESH_SESSION_RETENTION_DAYS,
} from '../repositories/refresh-session.repository';

export const REFRESH_SESSION_MIN_RETENTION_DAYS = REFRESH_SESSION_RETENTION_DAYS;
export const REFRESH_SESSION_CLEANUP_STARTUP_DELAY_MS = 15_000;
export const REFRESH_SESSION_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const REFRESH_SESSION_CLEANUP_MAX_BATCHES = 10;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RefreshSessionSweepOptions {
  cutoff?: Date;
  batchSize?: number;
  maxBatches?: number;
}

export interface RefreshSessionSweepResult {
  deletedCount: number;
  batches: number;
  cutoff: Date;
}

@Injectable()
export class RefreshSessionCleanupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(RefreshSessionCleanupService.name);
  private startupTimer: NodeJS.Timeout | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;
  private inFlightSweep: Promise<RefreshSessionSweepResult> | null = null;
  private stopped = false;

  constructor(
    private readonly refreshSessionRepository: RefreshSessionRepository,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    this.clearTimers();
    this.stopped = false;
    if (!this.isEnabled()) {
      return;
    }

    const startupDelayMs = this.getIntConfig(
      'REFRESH_SESSION_CLEANUP_STARTUP_DELAY_MS',
      REFRESH_SESSION_CLEANUP_STARTUP_DELAY_MS,
      0,
    );
    const intervalMs = this.getIntConfig(
      'REFRESH_SESSION_CLEANUP_INTERVAL_MS',
      REFRESH_SESSION_CLEANUP_INTERVAL_MS,
      1,
    );

    this.startupTimer = setTimeout(() => {
      this.startupTimer = null;
      void this.runSweep();
    }, startupDelayMs);
    this.startupTimer.unref?.();

    this.intervalTimer = setInterval(() => {
      void this.runSweep();
    }, intervalMs);
    this.intervalTimer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    this.clearTimers();
    if (this.inFlightSweep) {
      await this.inFlightSweep;
    }
  }

  /**
   * Executes a bounded multi-batch cleanup sweep, deduplicating concurrent runs.
   */
  runSweep(
    options: RefreshSessionSweepOptions = {},
  ): Promise<RefreshSessionSweepResult> {
    if (this.inFlightSweep) {
      return this.inFlightSweep;
    }

    const sweepPromise = this.executeSweep(options).finally(() => {
      if (this.inFlightSweep === sweepPromise) {
        this.inFlightSweep = null;
      }
    });
    this.inFlightSweep = sweepPromise;
    return sweepPromise;
  }

  isEnabled(): boolean {
    const rawEnabled = this.getConfigValue('REFRESH_SESSION_CLEANUP_ENABLED');
    if (rawEnabled !== undefined && rawEnabled !== '') {
      const normalized = rawEnabled.toLowerCase();
      if (normalized === 'true' || normalized === '1') {
        return true;
      }
      if (normalized === 'false' || normalized === '0') {
        return false;
      }
    }

    const nodeEnv = this.getConfigValue('NODE_ENV') ?? 'development';
    return nodeEnv.toLowerCase() !== 'test';
  }

  private async executeSweep(
    options: RefreshSessionSweepOptions,
  ): Promise<RefreshSessionSweepResult> {
    const retentionDays = this.getIntConfig(
      'REFRESH_SESSION_RETENTION_DAYS',
      REFRESH_SESSION_RETENTION_DAYS,
      REFRESH_SESSION_MIN_RETENTION_DAYS,
    );
    const latestAllowedCutoff = new Date(
      Date.now() - retentionDays * MS_PER_DAY,
    );
    const cutoff =
      options.cutoff &&
      Number.isFinite(options.cutoff.getTime()) &&
      options.cutoff.getTime() <= latestAllowedCutoff.getTime()
        ? options.cutoff
        : latestAllowedCutoff;

    if (this.stopped) {
      return { deletedCount: 0, batches: 0, cutoff };
    }

    const batchSize = clampRefreshSessionBatchSize(
      options.batchSize ??
        this.getIntConfig(
          'REFRESH_SESSION_CLEANUP_BATCH_SIZE',
          REFRESH_SESSION_CLEANUP_BATCH_SIZE,
          1,
        ),
    );
    const configuredMaxBatches = this.getIntConfig(
      'REFRESH_SESSION_CLEANUP_MAX_BATCHES',
      REFRESH_SESSION_CLEANUP_MAX_BATCHES,
      1,
    );
    const maxBatches =
      options.maxBatches !== undefined && Number.isFinite(options.maxBatches)
        ? Math.max(1, Math.trunc(options.maxBatches))
        : configuredMaxBatches;

    let deletedCount = 0;
    let batches = 0;

    try {
      for (let batch = 0; batch < maxBatches; batch += 1) {
        if (this.stopped) {
          break;
        }
        const result =
          await this.refreshSessionRepository.deleteExpiredSessions(
            cutoff,
            batchSize,
          );
        batches += 1;
        deletedCount += result.count;
        if (result.count < batchSize) {
          break;
        }
      }

      this.logger.log(
        JSON.stringify({
          event: 'refresh_session_cleanup_completed',
          deletedCount,
          batches,
          cutoff: cutoff.toISOString(),
        }),
      );
      return { deletedCount, batches, cutoff };
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'refresh_session_cleanup_failed',
          deletedCount,
          batches,
          cutoff: cutoff.toISOString(),
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return { deletedCount, batches, cutoff };
    }
  }

  private clearTimers(): void {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  private getConfigValue(key: string): string | undefined {
    const fromConfig = this.configService?.get<string | number | boolean>(key);
    if (fromConfig !== undefined && fromConfig !== null) {
      return String(fromConfig).trim();
    }
    const fromEnv = process.env[key];
    return fromEnv !== undefined ? fromEnv.trim() : undefined;
  }

  private getIntConfig(
    key: string,
    defaultValue: number,
    minValue: number,
  ): number {
    const raw = this.getConfigValue(key);
    if (raw === undefined || raw === '') {
      return defaultValue;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return defaultValue;
    }
    const truncated = Math.trunc(parsed);
    return truncated < minValue ? defaultValue : truncated;
  }
}
