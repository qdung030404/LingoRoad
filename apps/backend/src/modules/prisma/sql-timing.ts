import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export interface RequestSqlMetrics {
  readonly traceId: string;
  sqlCount: number;
  sqlDurationMs: number;
}

export interface HttpSqlTimingReport {
  event: 'http_sql_timing';
  method: string;
  path: string;
  statusCode: number;
  elapsedMs: number;
  sqlCount: number;
  sqlDurationMs: number;
}

interface EngineSpanPayload {
  trace_id?: string;
  name?: string;
  start_time?: [number, number];
  end_time?: [number, number];
}

interface EngineSpanEvent {
  spans?: EngineSpanPayload[];
}

export interface PrismaTracingHelperLike {
  isEnabled(): boolean;
  getActiveContext(): RequestSqlMetrics | undefined;
  getTraceParent(context?: unknown): string;
  createEngineSpan(spanEvent: EngineSpanEvent): Promise<void>;
  runInChildSpan<T>(options: unknown, callback: () => T): T;
}

interface InternalSqlMetrics extends RequestSqlMetrics {
  pendingEngineSpans: number;
  flushWaiters: Array<() => void>;
}

const UNSAMPLED_TRACEPARENT = '00-10-10-00';
const sqlMetricsStorage = new AsyncLocalStorage<InternalSqlMetrics>();
const activeTraces = new Map<string, InternalSqlMetrics>();
const sqlTimingLogger = new Logger('SqlTiming');
let reportObserver: ((report: HttpSqlTimingReport) => void) | null = null;

export function isSqlTimingEnabled(): boolean {
  return process.env.LINGOROAD_SQL_TIMING === 'true';
}

export function setSqlTimingReportObserver(
  observer: ((report: HttpSqlTimingReport) => void | null) | null,
): void {
  reportObserver = observer;
}

function createMetricsStore(): InternalSqlMetrics {
  return {
    traceId: randomBytes(16).toString('hex'),
    sqlCount: 0,
    sqlDurationMs: 0,
    pendingEngineSpans: 0,
    flushWaiters: [],
  };
}

function notifyFlushWaitersIfIdle(store: InternalSqlMetrics): void {
  if (store.pendingEngineSpans > 0 || store.flushWaiters.length === 0) return;
  const waiters = store.flushWaiters.splice(0, store.flushWaiters.length);
  for (const resolve of waiters) {
    resolve();
  }
}

function spanDurationMs(span: EngineSpanPayload): number {
  const start = span.start_time;
  const end = span.end_time;
  if (!Array.isArray(start) || !Array.isArray(end) || start.length < 2 || end.length < 2) {
    return 0;
  }
  const ms = (end[0] - start[0]) * 1000 + (end[1] - start[1]) / 1_000_000;
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

export const prismaSqlTracingHelper: PrismaTracingHelperLike = {
  isEnabled(): boolean {
    return isSqlTimingEnabled();
  },
  getActiveContext(): RequestSqlMetrics | undefined {
    return sqlMetricsStorage.getStore();
  },
  getTraceParent(context?: unknown): string {
    const candidate =
      context && typeof context === 'object' && 'traceId' in context
        ? (context as InternalSqlMetrics)
        : sqlMetricsStorage.getStore();
    if (!candidate?.traceId) {
      return UNSAMPLED_TRACEPARENT;
    }
    return `00-${candidate.traceId}-${randomBytes(8).toString('hex')}-01`;
  },
  async createEngineSpan(spanEvent: EngineSpanEvent): Promise<void> {
    const spans = spanEvent?.spans;
    if (!Array.isArray(spans)) return;
    for (const span of spans) {
      if (!span.trace_id) continue;
      const store = activeTraces.get(span.trace_id);
      if (!store) continue;
      if (span.name === 'prisma:engine:db_query') {
        store.sqlCount += 1;
        store.sqlDurationMs += spanDurationMs(span);
      } else if (span.name === 'prisma:engine') {
        store.pendingEngineSpans = Math.max(0, store.pendingEngineSpans - 1);
        notifyFlushWaitersIfIdle(store);
      }
    }
  },
  runInChildSpan<T>(_options: unknown, callback: () => T): T {
    return callback();
  },
};

export function attachPrismaSqlTiming(prismaClient: unknown): void {
  if (!isSqlTimingEnabled()) return;
  if (!prismaClient || typeof prismaClient !== 'object') return;
  const internal = prismaClient as {
    _tracingHelper?: PrismaTracingHelperLike;
    _engineConfig?: { tracingHelper?: PrismaTracingHelperLike };
    _engine?: {
      datamodel?: string;
      config?: { tracingHelper?: PrismaTracingHelperLike };
    };
    _requestHandler?: {
      dataloader?: {
        options?: {
          singleLoader?: (req: { otelParentCtx?: InternalSqlMetrics }) => Promise<unknown>;
          batchLoader?: (reqs: Array<{ otelParentCtx?: InternalSqlMetrics }>) => Promise<unknown>;
          batchBy?: (req: { otelParentCtx?: InternalSqlMetrics }) => string | null | undefined;
        };
      };
    };
  };
  internal._tracingHelper = prismaSqlTracingHelper;
  if (internal._engineConfig) {
    internal._engineConfig.tracingHelper = prismaSqlTracingHelper;
  }
  if (internal._engine) {
    if (internal._engine.config) {
      internal._engine.config.tracingHelper = prismaSqlTracingHelper;
    }
    if (
      typeof internal._engine.datamodel === 'string' &&
      !internal._engine.datamodel.includes('previewFeatures')
    ) {
      internal._engine.datamodel = internal._engine.datamodel.replace(
        'provider = "prisma-client-js"',
        'provider = "prisma-client-js"\n  previewFeatures = ["tracing"]',
      );
    }
  }
  const loaderOpts = internal._requestHandler?.dataloader?.options;
  if (loaderOpts && typeof loaderOpts.singleLoader === 'function') {
    const origSingleLoader = loaderOpts.singleLoader;
    loaderOpts.singleLoader = (req: { otelParentCtx?: InternalSqlMetrics }) => {
      const ctx = req?.otelParentCtx ?? sqlMetricsStorage.getStore();
      if (ctx) {
        ctx.pendingEngineSpans += 1;
      }
      return ctx ? sqlMetricsStorage.run(ctx, () => origSingleLoader(req)) : origSingleLoader(req);
    };
  }
  if (loaderOpts && typeof loaderOpts.batchLoader === 'function') {
    const origBatchLoader = loaderOpts.batchLoader;
    loaderOpts.batchLoader = (reqs: Array<{ otelParentCtx?: InternalSqlMetrics }>) => {
      const ctx = reqs?.[0]?.otelParentCtx ?? sqlMetricsStorage.getStore();
      if (ctx) {
        ctx.pendingEngineSpans += 1;
      }
      return ctx ? sqlMetricsStorage.run(ctx, () => origBatchLoader(reqs)) : origBatchLoader(reqs);
    };
  }
  if (loaderOpts && typeof loaderOpts.batchBy === 'function') {
    const origBatchBy = loaderOpts.batchBy;
    loaderOpts.batchBy = (req: { otelParentCtx?: InternalSqlMetrics }) => {
      const key = origBatchBy(req);
      if (!key) return key;
      const traceId = req?.otelParentCtx?.traceId;
      return traceId ? `${key}:${traceId}` : key;
    };
  }
}

export function flushSqlTimingSpans(explicitStore?: InternalSqlMetrics): Promise<void> {
  const store = explicitStore ?? sqlMetricsStorage.getStore();
  return new Promise((resolve) => {
    setImmediate(() => {
      if (!store || store.pendingEngineSpans <= 0) {
        setImmediate(resolve);
        return;
      }
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(safetyTimer);
        resolve();
      };
      const safetyTimer = setTimeout(finish, 250);
      safetyTimer.unref?.();
      store.flushWaiters.push(finish);
      notifyFlushWaitersIfIdle(store);
    });
  });
}

export function recordSqlQuery(durationMs: number): void {
  const store = sqlMetricsStorage.getStore();
  if (!store) return;
  store.sqlCount += 1;
  store.sqlDurationMs += Number(Number.isFinite(durationMs) ? durationMs : 0);
}

export function getCurrentSqlMetrics(): RequestSqlMetrics | undefined {
  return sqlMetricsStorage.getStore();
}

export async function runWithSqlTiming<T>(
  work: () => Promise<T>,
): Promise<{ result: T; metrics: RequestSqlMetrics }> {
  const metrics = createMetricsStore();
  activeTraces.set(metrics.traceId, metrics);
  try {
    const result = await sqlMetricsStorage.run(metrics, async () => await work());
    await flushSqlTimingSpans(metrics);
    return { result, metrics };
  } finally {
    activeTraces.delete(metrics.traceId);
  }
}

export function sqlTimingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!isSqlTimingEnabled() && !reportObserver) {
    next();
    return;
  }
  const metrics = createMetricsStore();
  activeTraces.set(metrics.traceId, metrics);
  if (res.locals && typeof res.locals === 'object') {
    (res.locals as Record<string, unknown>).sqlTiming = metrics;
  }
  const startedAt = process.hrtime.bigint();
  let finalized = false;

  const finalize = (emitLog: boolean): void => {
    if (finalized) return;
    finalized = true;
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const method = req.method;
    const path = req.originalUrl || req.url;
    const statusCode = res.statusCode;
    void flushSqlTimingSpans(metrics).then(() => {
      const report: HttpSqlTimingReport = {
        event: 'http_sql_timing',
        method,
        path,
        statusCode,
        elapsedMs: Number(elapsedMs.toFixed(2)),
        sqlCount: metrics.sqlCount,
        sqlDurationMs: Number(metrics.sqlDurationMs.toFixed(2)),
      };
      if (emitLog) {
        reportObserver?.(report);
        if (isSqlTimingEnabled()) {
          sqlTimingLogger.log(JSON.stringify(report));
        }
      }
      activeTraces.delete(metrics.traceId);
    });
  };

  sqlMetricsStorage.run(metrics, () => {
    res.once('finish', () => finalize(true));
    res.once('close', () => finalize(false));
    next();
  });
}
