import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Request, Response } from 'express';
import { from, Observable } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';
import { normalizeClientIp } from '../../../common/guards/client-ip-throttler.guard';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import {
  AdminAuditService,
  compactSnapshotForAudit,
} from '../services/admin-audit.service';
import { AdminAuditActor } from '../services/admin-auth.service';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IGNORED_DIFF_KEYS = new Set(['createdAt', 'updatedAt', 'passwordHash']);

type AdminRequest = Request & {
  user?: JwtPayload;
  __auditActor?: AdminAuditActor;
  file?: {
    originalname?: string;
    mimetype?: string;
    size?: number;
  };
};

type AuditRouteKind =
  | 'LOGIN'
  | 'LOGOUT'
  | 'AUTH'
  | 'EXPORT'
  | 'MEDIA'
  | 'MEDIA_CLEANUP'
  | 'IMPORT_VALIDATE'
  | 'IMPORT_APPLY'
  | 'STANDARD';

interface ResolvedAuditMeta {
  resourceType: string;
  resourceId: string | null;
  action: string;
  kind: AuditRouteKind;
  exportEntity?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date)
  );
}

function extractResponseData(responseBody: unknown): Record<string, unknown> | null {
  if (
    isPlainObject(responseBody) &&
    'data' in responseBody &&
    isPlainObject(responseBody.data)
  ) {
    return responseBody.data;
  }
  return null;
}

function normalizeEmailFromBody(body: unknown): string | null {
  if (!isPlainObject(body)) return null;
  if (typeof body.email === 'string' && body.email.trim().length > 0) {
    return body.email.trim().toLowerCase();
  }
  return null;
}

function normalizeAdminSubpath(cleanPath: string): string {
  return cleanPath
    .replace(/^\/api\/v1\/admin\/?/i, '')
    .replace(/^\/admin\/?/i, '')
    .replace(/\/+$/, '');
}

function resolveAuditMetadata(
  req: AdminRequest,
  method: string,
  cleanPath: string,
): ResolvedAuditMeta {
  const normalized = normalizeAdminSubpath(cleanPath);
  const lowerNormalized = normalized.toLowerCase();

  if (method === 'POST' && lowerNormalized === 'auth/login') {
    return {
      resourceType: 'AUTH',
      resourceId: null,
      action: 'ADMIN_LOGIN',
      kind: 'LOGIN',
    };
  }

  if (method === 'POST' && lowerNormalized === 'auth/logout') {
    return {
      resourceType: 'AUTH',
      resourceId: null,
      action: 'ADMIN_LOGOUT',
      kind: 'LOGOUT',
    };
  }

  if (method === 'POST' && lowerNormalized === 'auth/change-password') {
    return {
      resourceType: 'AUTH',
      resourceId: req.user?.sub ?? null,
      action: 'ADMIN_CHANGE_PASSWORD',
      kind: 'AUTH',
    };
  }

  if (method === 'POST' && lowerNormalized === 'auth/logout-all') {
    return {
      resourceType: 'AUTH',
      resourceId: req.user?.sub ?? null,
      action: 'ADMIN_LOGOUT_ALL',
      kind: 'AUTH',
    };
  }

  if (method === 'PATCH' && lowerNormalized === 'auth/me') {
    return {
      resourceType: 'AUTH',
      resourceId: req.user?.sub ?? null,
      action: 'ADMIN_UPDATE_PROFILE',
      kind: 'AUTH',
    };
  }

  if (method === 'POST' && lowerNormalized === 'media/orphans/cleanup') {
    return {
      resourceType: 'MEDIA',
      resourceId: null,
      action: 'CLEANUP_ORPHAN_MEDIA',
      kind: 'MEDIA_CLEANUP',
    };
  }

  const userExportMatch = /^users\/([0-9a-f-]{36})\/export$/i.exec(normalized);
  if (method === 'GET' && userExportMatch) {
    return {
      resourceType: 'EXPORTS',
      resourceId: userExportMatch[1],
      action: 'EXPORT_USER_DATA',
      kind: 'EXPORT',
      exportEntity: 'user-data',
    };
  }

  const exportMatch = /^exports\/([^/]+)$/i.exec(normalized);
  if (method === 'GET' && exportMatch) {
    const entity =
      typeof req.params?.entity === 'string' && req.params.entity.trim()
        ? req.params.entity.trim()
        : exportMatch[1];
    const entityUpper = entity.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    return {
      resourceType: 'EXPORTS',
      resourceId: entity,
      action: `EXPORT_${entityUpper}`,
      kind: 'EXPORT',
      exportEntity: entity,
    };
  }

  if (method === 'POST' && lowerNormalized === 'media/images') {
    return {
      resourceType: 'MEDIA',
      resourceId: null,
      action: 'UPLOAD_MEDIA_IMAGE',
      kind: 'MEDIA',
    };
  }

  if (method === 'POST' && lowerNormalized === 'media/audio') {
    return {
      resourceType: 'MEDIA',
      resourceId: null,
      action: 'UPLOAD_MEDIA_AUDIO',
      kind: 'MEDIA',
    };
  }

  if (method === 'POST' && lowerNormalized === 'imports/validate') {
    return {
      resourceType: 'IMPORTS',
      resourceId: null,
      action: 'VALIDATE_IMPORTS',
      kind: 'IMPORT_VALIDATE',
    };
  }

  if (method === 'POST' && lowerNormalized === 'imports/apply') {
    return {
      resourceType: 'IMPORTS',
      resourceId: null,
      action: 'APPLY_IMPORTS',
      kind: 'IMPORT_APPLY',
    };
  }

  const segments = normalized.split('/').filter(Boolean);
  const first = (segments[0] ?? 'admin').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const second =
    segments[1] && !/^[0-9a-f-]{36}$/i.test(segments[1])
      ? segments[1].toUpperCase().replace(/[^A-Z0-9]+/g, '_')
      : null;
  const third =
    segments[2] && !/^[0-9a-f-]{36}$/i.test(segments[2])
      ? segments[2].toUpperCase().replace(/[^A-Z0-9]+/g, '_')
      : null;
  const resourceType =
    first === 'VOCABULARY' && second === 'TOPICS'
      ? segments.includes('words')
        ? 'VOCABULARY_WORD'
        : 'VOCABULARY_TOPIC'
      : first === 'GRAMMAR' && second
        ? `GRAMMAR_${second}`
        : first === 'USERS' && third
          ? `USER_${third}`
          : first;

  const paramId =
    req.params?.sessionId ||
    req.params?.wordId ||
    req.params?.id ||
    req.params?.topicId ||
    segments.find((segment) => UUID_REGEX.test(segment)) ||
    null;

  const verb =
    method === 'POST'
      ? 'CREATE'
      : method === 'PATCH' || method === 'PUT'
        ? 'UPDATE'
        : method === 'DELETE'
          ? req.query?.force === 'true' || req.query?.hard === 'true'
            ? 'FORCE_DELETE'
            : 'DELETE'
          : method;

  return {
    resourceType,
    resourceId: typeof paramId === 'string' ? paramId : null,
    action: `${verb}_${resourceType}`,
    kind: 'STANDARD',
  };
}

function buildComparablePair(
  beforeSnapshot: Record<string, unknown>,
  afterData: Record<string, unknown> | null,
  reqBody: unknown,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const beforeClean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(beforeSnapshot)) {
    if (!IGNORED_DIFF_KEYS.has(key)) {
      beforeClean[key] = val;
    }
  }

  const afterClean: Record<string, unknown> = {};
  const bodyKeys = isPlainObject(reqBody) ? new Set(Object.keys(reqBody)) : new Set<string>();

  if (afterData) {
    for (const [key, val] of Object.entries(afterData)) {
      if (IGNORED_DIFF_KEYS.has(key)) continue;
      if (key in beforeClean || bodyKeys.has(key)) {
        afterClean[key] = val;
      }
    }
    // Retain unchanged keys from beforeClean that aren't echoed in a view DTO
    for (const key of Object.keys(beforeClean)) {
      if (!(key in afterClean)) {
        afterClean[key] = beforeClean[key];
      }
    }
  } else if (isPlainObject(reqBody)) {
    Object.assign(afterClean, beforeClean);
    for (const [key, val] of Object.entries(reqBody)) {
      if (!IGNORED_DIFF_KEYS.has(key)) {
        afterClean[key] = val;
      }
    }
  } else {
    Object.assign(afterClean, beforeClean);
  }

  return { before: beforeClean, after: afterClean };
}

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(
    @Optional() private readonly auditService?: AdminAuditService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.auditService || context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<AdminRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const method = (req.method || '').toUpperCase();
    const cleanPath = (req.originalUrl || req.url || '').split('?')[0];
    const normalizedPath = normalizeAdminSubpath(cleanPath);

    const isExportGet =
      method === 'GET' &&
      (/^exports\/[^/]+$/i.test(normalizedPath) ||
        /^users\/[0-9a-f-]{36}\/export$/i.test(normalizedPath));
    if (!MUTATING_METHODS.has(method) && !isExportGet) {
      return next.handle();
    }

    if (/\/admin\/auth\/refresh$/i.test(cleanPath)) {
      return next.handle();
    }

    const meta = resolveAuditMetadata(req, method, cleanPath);
    const ipAddress = normalizeClientIp(req.ip || req.socket?.remoteAddress);
    const hasQuery = Boolean(req.query && Object.keys(req.query).length > 0);
    const baseSnapshot = {
      ...(hasQuery ? { query: req.query } : {}),
      ...(req.body && typeof req.body === 'object' ? { body: req.body } : {}),
    };

    const shouldCaptureBefore =
      meta.kind === 'STANDARD' &&
      (method === 'PATCH' || method === 'PUT' || method === 'DELETE') &&
      Boolean(meta.resourceId && UUID_REGEX.test(meta.resourceId));

    const runWithBefore = (
      beforeSnapshot: Record<string, unknown> | null,
    ): Observable<unknown> =>
      next.handle().pipe(
        tap({
          next: (responseBody: unknown) => {
            const responseData = extractResponseData(responseBody);
            const dataId =
              responseData && typeof responseData.id === 'string'
                ? responseData.id
                : null;

            let adminUserId: string | null = req.user?.sub ?? null;
            let adminEmail =
              req.user?.email ?? normalizeEmailFromBody(req.body) ?? 'anonymous';
            let resourceId: string | null = meta.resourceId ?? dataId;
            let payloadSnapshot: unknown = baseSnapshot;

            if (meta.kind === 'LOGIN') {
              const loginUser = isPlainObject(responseData?.user)
                ? responseData.user
                : null;
              adminUserId =
                typeof loginUser?.id === 'string' ? loginUser.id : adminUserId;
              adminEmail =
                typeof loginUser?.email === 'string'
                  ? loginUser.email
                  : adminEmail;
              resourceId =
                typeof loginUser?.id === 'string' ? loginUser.id : null;
              payloadSnapshot = { email: adminEmail };
            } else if (meta.kind === 'LOGOUT') {
              adminUserId = req.__auditActor?.userId ?? req.user?.sub ?? null;
              adminEmail =
                req.__auditActor?.email ?? req.user?.email ?? 'anonymous';
              resourceId = adminUserId;
              payloadSnapshot = hasQuery ? { query: req.query } : {};
            } else if (meta.kind === 'EXPORT') {
              if (meta.action === 'EXPORT_USER_DATA') {
                resourceId = meta.resourceId;
                payloadSnapshot = {
                  entity: 'user-data',
                  targetUserId: meta.resourceId,
                  format: 'json',
                };
              } else {
                const safeFormat = req.query?.format === 'csv' ? 'csv' : 'json';
                resourceId = meta.exportEntity ?? meta.resourceId;
                payloadSnapshot = {
                  entity: meta.exportEntity ?? meta.resourceId,
                  format: safeFormat,
                };
              }
            } else if (meta.kind === 'MEDIA') {
              const url =
                typeof responseData?.url === 'string' ? responseData.url : null;
              resourceId = url;
              payloadSnapshot = {
                ...(hasQuery ? { query: req.query } : {}),
                file: {
                  originalname: req.file?.originalname ?? null,
                  mime:
                    (typeof responseData?.mime === 'string'
                      ? responseData.mime
                      : req.file?.mimetype) ?? null,
                  size:
                    (typeof responseData?.size === 'number'
                      ? responseData.size
                      : req.file?.size) ?? null,
                  storage:
                    typeof responseData?.storage === 'string'
                      ? responseData.storage
                      : null,
                  url,
                  ...(typeof responseData?.durationMs === 'number'
                    ? { durationMs: responseData.durationMs }
                    : {}),
                  ...(typeof responseData?.scope === 'string'
                    ? { scope: responseData.scope }
                    : {}),
                },
              };
            } else if (meta.kind === 'MEDIA_CLEANUP') {
              payloadSnapshot = {
                minAgeHours:
                  typeof responseData?.minAgeHours === 'number'
                    ? responseData.minAgeHours
                    : null,
                deletedCount:
                  typeof responseData?.deletedCount === 'number'
                    ? responseData.deletedCount
                    : 0,
                deletedBytes:
                  typeof responseData?.deletedBytes === 'number'
                    ? responseData.deletedBytes
                    : 0,
                skippedCount:
                  typeof responseData?.skippedCount === 'number'
                    ? responseData.skippedCount
                    : 0,
                deletedKeys: Array.isArray(responseData?.deletedKeys)
                  ? responseData.deletedKeys.slice(0, 50)
                  : [],
              };
            } else if (
              meta.kind === 'IMPORT_VALIDATE' ||
              meta.kind === 'IMPORT_APPLY'
            ) {
              const preview = isPlainObject(responseData?.preview)
                ? responseData.preview
                : null;
              const topicWordsMode = isPlainObject(req.body)
                ? req.body.topicWordsMode
                : undefined;
              payloadSnapshot =
                meta.kind === 'IMPORT_VALIDATE'
                  ? {
                      ...(topicWordsMode !== undefined ? { topicWordsMode } : {}),
                      isValid: responseData?.isValid,
                      errorCount: Array.isArray(responseData?.errors)
                        ? responseData.errors.length
                        : 0,
                      totalRecords: preview?.totalRecords ?? 0,
                      counts: preview?.counts,
                    }
                  : {
                      ...(topicWordsMode !== undefined ? { topicWordsMode } : {}),
                      appliedAt: responseData?.appliedAt,
                      totalRecords: preview?.totalRecords ?? 0,
                      counts: preview?.counts,
                    };
            } else if (beforeSnapshot && (method === 'PATCH' || method === 'PUT')) {
              const comparable = buildComparablePair(
                beforeSnapshot,
                responseData,
                req.body,
              );
              const { diff } = this.auditService!.computeCompactDiff(
                comparable.before,
                comparable.after,
              );
              payloadSnapshot = {
                ...(hasQuery ? { query: req.query } : {}),
                diff,
              };
            } else if (beforeSnapshot && method === 'DELETE') {
              payloadSnapshot = {
                ...(hasQuery ? { query: req.query } : {}),
                deletedSnapshot: compactSnapshotForAudit(beforeSnapshot),
              };
            }

            void this.auditService!.record({
              adminUserId,
              adminEmail,
              action: meta.action,
              method,
              path: cleanPath,
              resourceType: meta.resourceType,
              resourceId,
              statusCode: res.statusCode || 200,
              ipAddress,
              payloadSnapshot,
            });

            const shouldEmitDataMutated =
              MUTATING_METHODS.has(method) &&
              meta.resourceType !== 'AUTH' &&
              meta.resourceType !== 'MEDIA' &&
              meta.resourceType !== 'EXPORTS' &&
              meta.action !== 'VALIDATE_IMPORTS';

            if (shouldEmitDataMutated) {
              this.eventEmitter?.emit('admin.data.mutated', {
                resourceType: meta.resourceType,
                action: meta.action,
              });
            }
          },
          error: (err: unknown) => {
            const statusCode =
              err instanceof HttpException ? err.getStatus() : 500;
            const normalizedBodyEmail = normalizeEmailFromBody(req.body);
            const adminUserId =
              meta.kind === 'LOGIN'
                ? null
                : meta.kind === 'LOGOUT'
                  ? (req.__auditActor?.userId ?? req.user?.sub ?? null)
                  : (req.user?.sub ?? null);
            const adminEmail =
              meta.kind === 'LOGIN'
                ? (normalizedBodyEmail ?? 'anonymous')
                : meta.kind === 'LOGOUT'
                  ? (req.__auditActor?.email ?? req.user?.email ?? 'anonymous')
                  : (req.user?.email ?? normalizedBodyEmail ?? 'anonymous');
            const errorMessage = err instanceof Error ? err.message : String(err);

            const errorSnapshot =
              meta.kind === 'EXPORT'
                ? {
                    entity: meta.exportEntity ?? meta.resourceId,
                    ...(meta.action === 'EXPORT_USER_DATA'
                      ? { targetUserId: meta.resourceId, format: 'json' }
                      : { format: req.query?.format === 'csv' ? 'csv' : 'json' }),
                    error: errorMessage,
                  }
                : meta.kind === 'MEDIA'
                  ? {
                      ...(hasQuery ? { query: req.query } : {}),
                      file: req.file
                        ? {
                            originalname: req.file.originalname ?? null,
                            mime: req.file.mimetype ?? null,
                            size: req.file.size ?? null,
                          }
                        : null,
                      error: errorMessage,
                    }
                  : {
                      ...baseSnapshot,
                      error: errorMessage,
                    };

            void this.auditService!.record({
              adminUserId,
              adminEmail,
              action: `${meta.action}_FAILED`,
              method,
              path: cleanPath,
              resourceType: meta.resourceType,
              resourceId: meta.resourceId,
              statusCode,
              ipAddress,
              payloadSnapshot: errorSnapshot,
            });
          },
        }),
      );

    if (shouldCaptureBefore && this.auditService.captureBeforeSnapshot) {
      return from(
        this.auditService.captureBeforeSnapshot(
          meta.resourceType,
          meta.resourceId!,
        ),
      ).pipe(switchMap((beforeSnapshot) => runWithBefore(beforeSnapshot)));
    }

    return runWithBefore(null);
  }
}
