import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { JwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { AdminAuditService } from '../services/admin-audit.service';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

type AdminRequest = Request & { user?: JwtPayload };

function resolveResourceInfo(req: AdminRequest): {
  resourceType: string;
  resourceId: string | null;
  action: string;
} {
  const cleanPath = (req.originalUrl || req.url || '').split('?')[0];
  const normalized = cleanPath
    .replace(/^\/api\/v1\/admin\/?/i, '')
    .replace(/^\/admin\/?/i, '');
  const segments = normalized.split('/').filter(Boolean);
  const first = (segments[0] ?? 'admin').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const second = segments[1] && !/^[0-9a-f-]{36}$/i.test(segments[1])
    ? segments[1].toUpperCase().replace(/[^A-Z0-9]+/g, '_')
    : null;
  const resourceType =
    first === 'VOCABULARY' && second === 'TOPICS'
      ? segments.includes('words')
        ? 'VOCABULARY_WORD'
        : 'VOCABULARY_TOPIC'
      : first === 'GRAMMAR' && second
        ? `GRAMMAR_${second}`
        : first;

  const paramId =
    req.params?.wordId ||
    req.params?.id ||
    req.params?.topicId ||
    null;

  const verb =
    req.method === 'POST'
      ? 'CREATE'
      : req.method === 'PATCH' || req.method === 'PUT'
        ? 'UPDATE'
        : req.method === 'DELETE'
          ? req.query?.force === 'true' || req.query?.hard === 'true'
            ? 'FORCE_DELETE'
            : 'DELETE'
          : req.method;

  return {
    resourceType,
    resourceId: typeof paramId === 'string' ? paramId : null,
    action: `${verb}_${resourceType}`,
  };
}

@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(@Optional() private readonly auditService?: AdminAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.auditService || context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<AdminRequest>();
    const res = context.switchToHttp().getResponse<Response>();
    const method = (req.method || '').toUpperCase();

    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const cleanPath = (req.originalUrl || req.url || '').split('?')[0];
    if (/\/admin\/auth\/refresh$/i.test(cleanPath)) {
      return next.handle();
    }

    const { resourceType, resourceId, action } = resolveResourceInfo(req);
    const ipAddress = req.ip || req.socket?.remoteAddress || null;
    const snapshot = {
      query: req.query && Object.keys(req.query).length > 0 ? req.query : undefined,
      body: req.body && typeof req.body === 'object' ? req.body : undefined,
    };

    return next.handle().pipe(
      tap({
        next: (responseBody: unknown) => {
          const dataId =
            responseBody &&
            typeof responseBody === 'object' &&
            'data' in responseBody &&
            responseBody.data &&
            typeof responseBody.data === 'object' &&
            'id' in responseBody.data &&
            typeof (responseBody.data as { id?: unknown }).id === 'string'
              ? (responseBody.data as { id: string }).id
              : null;

          void this.auditService!.record({
            adminUserId: req.user?.sub ?? null,
            adminEmail: req.user?.email ?? String((req.body as { email?: unknown })?.email ?? 'anonymous'),
            action,
            method,
            path: cleanPath,
            resourceType,
            resourceId: resourceId ?? dataId,
            statusCode: res.statusCode || 200,
            ipAddress,
            payloadSnapshot: snapshot,
          });
        },
        error: (err: unknown) => {
          const statusCode = err instanceof HttpException ? err.getStatus() : 500;
          void this.auditService!.record({
            adminUserId: req.user?.sub ?? null,
            adminEmail: req.user?.email ?? String((req.body as { email?: unknown })?.email ?? 'anonymous'),
            action: `${action}_FAILED`,
            method,
            path: cleanPath,
            resourceType,
            resourceId,
            statusCode,
            ipAddress,
            payloadSnapshot: {
              ...snapshot,
              error: err instanceof Error ? err.message : String(err),
            },
          });
        },
      }),
    );
  }
}
