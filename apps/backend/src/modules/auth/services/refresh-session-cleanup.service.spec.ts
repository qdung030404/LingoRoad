import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository';
import {
  REFRESH_SESSION_CLEANUP_INTERVAL_MS,
  REFRESH_SESSION_CLEANUP_STARTUP_DELAY_MS,
  RefreshSessionCleanupService,
} from './refresh-session-cleanup.service';

describe('RefreshSessionCleanupService', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('drains full batches until a partial batch is returned and logs completion', async () => {
    const deleteExpiredSessions = jest
      .fn()
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 3 })
      .mockResolvedValueOnce({ count: 1 });
    const repo = { deleteExpiredSessions } as unknown as RefreshSessionRepository;
    const service = new RefreshSessionCleanupService(repo, new ConfigService({}));
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const cutoff = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    const result = await service.runSweep({ cutoff, batchSize: 3, maxBatches: 10 });

    expect(result).toEqual({ deletedCount: 7, batches: 3, cutoff });
    expect(deleteExpiredSessions).toHaveBeenCalledTimes(3);
    expect(deleteExpiredSessions).toHaveBeenCalledWith(cutoff, 3);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"refresh_session_cleanup_completed"'),
    );
  });

  it('stops at maxBatches even when every batch is full', async () => {
    const deleteExpiredSessions = jest.fn().mockResolvedValue({ count: 5 });
    const repo = { deleteExpiredSessions } as unknown as RefreshSessionRepository;
    const service = new RefreshSessionCleanupService(repo, new ConfigService({}));
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const result = await service.runSweep({
      cutoff: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      batchSize: 5,
      maxBatches: 2,
    });

    expect(result).toMatchObject({ deletedCount: 10, batches: 2 });
    expect(deleteExpiredSessions).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent in-flight runSweep calls', async () => {
    let resolveBatch!: (value: { count: number }) => void;
    const pendingBatch = new Promise<{ count: number }>((resolve) => {
      resolveBatch = resolve;
    });
    const deleteExpiredSessions = jest.fn(() => pendingBatch);
    const repo = { deleteExpiredSessions } as unknown as RefreshSessionRepository;
    const service = new RefreshSessionCleanupService(repo, new ConfigService({}));
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const first = service.runSweep({ batchSize: 10 });
    const second = service.runSweep({ batchSize: 10 });

    expect(second).toBe(first);
    expect(deleteExpiredSessions).toHaveBeenCalledTimes(1);

    resolveBatch({ count: 2 });
    const [r1, r2] = await Promise.all([first, second]);
    expect(r1).toEqual(r2);
    expect(r1.deletedCount).toBe(2);
  });

  it('does not schedule timers by default in test environment', async () => {
    jest.useFakeTimers();
    const deleteExpiredSessions = jest.fn().mockResolvedValue({ count: 0 });
    const repo = { deleteExpiredSessions } as unknown as RefreshSessionRepository;
    const service = new RefreshSessionCleanupService(
      repo,
      new ConfigService({ NODE_ENV: 'test' }),
    );

    expect(service.isEnabled()).toBe(false);
    service.onApplicationBootstrap();

    await jest.advanceTimersByTimeAsync(REFRESH_SESSION_CLEANUP_INTERVAL_MS * 2);
    expect(deleteExpiredSessions).not.toHaveBeenCalled();
    await service.onModuleDestroy();
  });

  it('schedules unreffed startup and interval timers when REFRESH_SESSION_CLEANUP_ENABLED=true', async () => {
    jest.useFakeTimers();
    const unrefSpy = jest.fn();
    const realSetTimeout = global.setTimeout;
    const realSetInterval = global.setInterval;
    jest.spyOn(global, 'setTimeout').mockImplementation(((fn: (...args: any[]) => void, ms?: number) => {
      const handle = realSetTimeout(fn, ms) as NodeJS.Timeout & { unref?: () => any };
      handle.unref = unrefSpy;
      return handle;
    }) as typeof setTimeout);
    jest.spyOn(global, 'setInterval').mockImplementation(((fn: (...args: any[]) => void, ms?: number) => {
      const handle = realSetInterval(fn, ms) as NodeJS.Timeout & { unref?: () => any };
      handle.unref = unrefSpy;
      return handle;
    }) as typeof setInterval);

    const deleteExpiredSessions = jest.fn().mockResolvedValue({ count: 0 });
    const repo = { deleteExpiredSessions } as unknown as RefreshSessionRepository;
    const service = new RefreshSessionCleanupService(
      repo,
      new ConfigService({
        NODE_ENV: 'test',
        REFRESH_SESSION_CLEANUP_ENABLED: 'true',
      }),
    );
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    expect(service.isEnabled()).toBe(true);
    service.onApplicationBootstrap();
    expect(unrefSpy).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(REFRESH_SESSION_CLEANUP_STARTUP_DELAY_MS);
    expect(deleteExpiredSessions).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(
      REFRESH_SESSION_CLEANUP_INTERVAL_MS - REFRESH_SESSION_CLEANUP_STARTUP_DELAY_MS,
    );
    expect(deleteExpiredSessions).toHaveBeenCalledTimes(2);

    await service.onModuleDestroy();
  });

  it('catches errors and logs a warning without throwing', async () => {
    const deleteExpiredSessions = jest
      .fn()
      .mockRejectedValue(new Error('lock timeout'));
    const repo = { deleteExpiredSessions } as unknown as RefreshSessionRepository;
    const service = new RefreshSessionCleanupService(repo, new ConfigService({}));
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const result = await service.runSweep({ batchSize: 100 });

    expect(result.deletedCount).toBe(0);
    expect(result.batches).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"event":"refresh_session_cleanup_failed"'),
    );
  });

  it('waits for any active in-flight sweep and cancels timers during onModuleDestroy', async () => {
    let resolveBatch!: (value: { count: number }) => void;
    const pendingBatch = new Promise<{ count: number }>((resolve) => {
      resolveBatch = resolve;
    });
    const deleteExpiredSessions = jest.fn(() => pendingBatch);
    const repo = { deleteExpiredSessions } as unknown as RefreshSessionRepository;
    const service = new RefreshSessionCleanupService(
      repo,
      new ConfigService({
        NODE_ENV: 'test',
        REFRESH_SESSION_CLEANUP_ENABLED: 'true',
        REFRESH_SESSION_CLEANUP_STARTUP_DELAY_MS: '60000',
        REFRESH_SESSION_CLEANUP_INTERVAL_MS: '60000',
      }),
    );
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    service.onApplicationBootstrap();
    const sweepPromise = service.runSweep({ batchSize: 2, maxBatches: 5 });

    let destroyResolved = false;
    const destroyPromise = service.onModuleDestroy().then(() => {
      destroyResolved = true;
    });

    await Promise.resolve();
    expect(destroyResolved).toBe(false);

    resolveBatch({ count: 2 });
    await destroyPromise;
    const result = await sweepPromise;

    expect(destroyResolved).toBe(true);
    expect(deleteExpiredSessions).toHaveBeenCalledTimes(1);
    expect(result.deletedCount).toBe(2);
  });

  it('enforces the 7-day minimum retention floor when REFRESH_SESSION_RETENTION_DAYS=1 so a 2-day-expired session remains', async () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const sessions = [
      { id: 'expired-2d', expiresAt: new Date(nowMs - 2 * dayMs) },
      { id: 'expired-8d', expiresAt: new Date(nowMs - 8 * dayMs) },
    ];
    const deleteExpiredSessions = jest.fn(async (cutoff: Date) => {
      const beforeCount = sessions.length;
      for (let i = sessions.length - 1; i >= 0; i -= 1) {
        if (sessions[i].expiresAt.getTime() < cutoff.getTime()) {
          sessions.splice(i, 1);
        }
      }
      return { count: beforeCount - sessions.length };
    });
    const repo = { deleteExpiredSessions } as unknown as RefreshSessionRepository;
    const clampedService = new RefreshSessionCleanupService(
      repo,
      new ConfigService({ REFRESH_SESSION_RETENTION_DAYS: '1' }),
    );
    jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const beforeSweepMs = Date.now();
    const clampedResult = await clampedService.runSweep();
    const afterSweepMs = Date.now();

    expect(clampedResult.deletedCount).toBe(1);
    expect(clampedResult.cutoff.getTime()).toBeGreaterThanOrEqual(
      beforeSweepMs - 7 * dayMs - 50,
    );
    expect(clampedResult.cutoff.getTime()).toBeLessThanOrEqual(
      afterSweepMs - 7 * dayMs + 50,
    );
    expect(sessions.map((s) => s.id)).toEqual(['expired-2d']);

    const fourteenDayService = new RefreshSessionCleanupService(
      repo,
      new ConfigService({ REFRESH_SESSION_RETENTION_DAYS: '14' }),
    );
    const beforeFourteenMs = Date.now();
    const fourteenResult = await fourteenDayService.runSweep();
    const afterFourteenMs = Date.now();

    expect(fourteenResult.deletedCount).toBe(0);
    expect(fourteenResult.cutoff.getTime()).toBeGreaterThanOrEqual(
      beforeFourteenMs - 14 * dayMs - 50,
    );
    expect(fourteenResult.cutoff.getTime()).toBeLessThanOrEqual(
      afterFourteenMs - 14 * dayMs + 50,
    );
  });
});
