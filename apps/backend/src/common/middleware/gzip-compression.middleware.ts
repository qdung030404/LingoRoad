import { NextFunction, Request, Response } from 'express';
import type { OutgoingHttpHeader, OutgoingHttpHeaders } from 'node:http';
import * as zlib from 'node:zlib';

export interface GzipCompressionOptions {
  /** Minimum uncompressed byte length before applying gzip compression. Defaults to 1024. */
  threshold?: number;
}

const DEFAULT_THRESHOLD_BYTES = 1024;
const SKIP_STATUS_CODES = new Set([204, 206, 304]);

function isMediaRequest(req: Request): boolean {
  const rawUrl = req.originalUrl || req.url || '';
  const pathOnly = rawUrl.split('?')[0];
  return pathOnly === '/media' || pathOnly.startsWith('/media/');
}

function acceptsGzipEncoding(req: Request): boolean {
  const header = req.headers['accept-encoding'];
  if (!header) return false;
  const raw = Array.isArray(header) ? header.join(',') : header;

  let explicitGzipQ: number | null = null;
  let wildcardQ: number | null = null;

  for (const part of raw.split(',')) {
    const segments = part.trim().split(';');
    const coding = segments[0]?.trim().toLowerCase();
    if (!coding) continue;

    let q = 1;
    for (let i = 1; i < segments.length; i += 1) {
      const param = segments[i].trim().toLowerCase();
      if (param.startsWith('q=')) {
        const parsed = Number.parseFloat(param.slice(2));
        if (Number.isFinite(parsed)) {
          q = parsed;
        }
      }
    }

    if (coding === 'gzip' || coding === 'x-gzip') {
      explicitGzipQ = explicitGzipQ === null ? q : Math.max(explicitGzipQ, q);
    } else if (coding === '*') {
      wildcardQ = q;
    }
  }

  if (explicitGzipQ !== null) {
    return explicitGzipQ > 0;
  }
  return wildcardQ !== null && wildcardQ > 0;
}

function headerToString(value: OutgoingHttpHeader | undefined): string {
  if (value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function isCompressibleContentType(contentTypeHeader: OutgoingHttpHeader | undefined): boolean {
  const raw = headerToString(contentTypeHeader).split(';')[0].trim().toLowerCase();
  if (!raw || raw === 'text/event-stream') {
    return false;
  }
  if (raw.startsWith('text/')) {
    return true;
  }
  return (
    raw === 'application/json' ||
    raw.endsWith('+json') ||
    raw === 'application/javascript' ||
    raw === 'application/x-javascript' ||
    raw === 'application/ecmascript' ||
    raw === 'application/xml' ||
    raw.endsWith('+xml') ||
    raw === 'image/svg+xml' ||
    raw === 'application/x-www-form-urlencoded' ||
    raw === 'application/wasm'
  );
}

function hasNoTransformDirective(cacheControlHeader: OutgoingHttpHeader | undefined): boolean {
  return /\bno-transform\b/i.test(headerToString(cacheControlHeader));
}

function appendVaryHeader(res: Response, field: string): void {
  if (res.headersSent) return;
  const existing = res.getHeader('Vary');
  const tokens = (Array.isArray(existing) ? existing : existing != null ? [String(existing)] : [])
    .flatMap((entry) => String(entry).split(','))
    .map((token) => token.trim())
    .filter(Boolean);

  const normalizedTarget = field.toLowerCase();
  const alreadyPresent = tokens.some(
    (token) => token === '*' || token.toLowerCase() === normalizedTarget,
  );
  if (!alreadyPresent) {
    tokens.push(field);
    res.setHeader('Vary', tokens.join(', '));
  }
}

function weakenEtagIfNeeded(res: Response): void {
  const etag = res.getHeader('ETag');
  if (typeof etag === 'string' && etag.length > 0 && !etag.startsWith('W/')) {
    res.setHeader('ETag', `W/${etag}`);
  }
}

function toBuffer(
  chunk: unknown,
  encoding?: BufferEncoding,
): Buffer | null {
  if (chunk === null || chunk === undefined) return null;
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  return Buffer.from(String(chunk), encoding ?? 'utf8');
}

function shouldSkipCompression(res: Response): boolean {
  if (res.headersSent) return true;
  if (
    SKIP_STATUS_CODES.has(res.statusCode) ||
    (res.statusCode >= 100 && res.statusCode < 200)
  ) {
    return true;
  }
  if (res.getHeader('Content-Encoding')) {
    return true;
  }
  if (hasNoTransformDirective(res.getHeader('Cache-Control'))) {
    return true;
  }
  return !isCompressibleContentType(res.getHeader('Content-Type'));
}

/**
 * Zero-dependency HTTP gzip compression middleware built on Node's `node:zlib`.
 * Preserves CORS `Vary: Origin` headers and bypasses `/media/*`, SSE, `no-transform`, and pre-encoded responses.
 */
export function gzipCompressionMiddleware(options: GzipCompressionOptions = {}) {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD_BYTES;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.method === 'HEAD' || req.method === 'OPTIONS' || isMediaRequest(req)) {
      next();
      return;
    }

    const clientAcceptsGzip = acceptsGzipEncoding(req);
    const origWrite = res.write.bind(res) as (
      chunk: unknown,
      encoding?: BufferEncoding | ((error?: Error | null) => void),
      cb?: (error?: Error | null) => void,
    ) => boolean;
    const origEnd = res.end.bind(res) as (
      chunk?: unknown,
      encoding?: BufferEncoding | (() => void),
      cb?: () => void,
    ) => Response;
    const origWriteHead = res.writeHead.bind(res) as (
      statusCode: number,
      reasonOrHeaders?: string | OutgoingHttpHeaders | OutgoingHttpHeader[],
      headers?: OutgoingHttpHeaders | OutgoingHttpHeader[],
    ) => Response;
    const origFlushHeaders =
      typeof res.flushHeaders === 'function' ? res.flushHeaders.bind(res) : undefined;

    let mode: 'pending' | 'passthrough' | 'gzip' = 'pending';
    let bufferedChunks: Buffer[] = [];
    let bufferedBytes = 0;
    let gzipStream: zlib.Gzip | null = null;
    let pendingHead: { statusCode: number; statusMessage?: string } | null = null;
    let headCommitted = false;
    let ended = false;
    let endCallbackPending: (() => void) | undefined;

    const flushPendingHead = (): void => {
      if (!pendingHead || headCommitted || res.headersSent) {
        pendingHead = null;
        return;
      }
      headCommitted = true;
      const { statusCode, statusMessage } = pendingHead;
      pendingHead = null;
      if (statusMessage !== undefined) {
        origWriteHead(statusCode, statusMessage);
      } else {
        origWriteHead(statusCode);
      }
    };

    const maybeAttachVaryHeader = (): void => {
      if (!shouldSkipCompression(res)) {
        appendVaryHeader(res, 'Accept-Encoding');
      }
    };

    const switchToPassthrough = (): void => {
      if (mode !== 'pending') return;
      mode = 'passthrough';
      maybeAttachVaryHeader();
      flushPendingHead();
      for (const chunk of bufferedChunks) {
        origWrite(chunk);
      }
      bufferedChunks = [];
      bufferedBytes = 0;
    };

    const startGzipStream = (): zlib.Gzip => {
      mode = 'gzip';
      if (!res.headersSent) {
        res.removeHeader('Content-Length');
        res.setHeader('Content-Encoding', 'gzip');
        appendVaryHeader(res, 'Accept-Encoding');
        weakenEtagIfNeeded(res);
      }
      flushPendingHead();

      const gzip = zlib.createGzip();
      gzipStream = gzip;

      const onDrain = () => {
        if (!gzip.destroyed) gzip.resume();
      };
      const onClose = () => {
        if (!res.writableEnded && !gzip.destroyed) {
          gzip.destroy();
        }
      };

      res.on('drain', onDrain);
      res.on('close', onClose);

      gzip.on('data', (compressedChunk: Buffer) => {
        if (res.destroyed || res.writableEnded) return;
        const canContinue = origWrite(compressedChunk);
        if (!canContinue) {
          gzip.pause();
        }
      });

      gzip.on('end', () => {
        res.off('drain', onDrain);
        res.off('close', onClose);
        if (!res.destroyed && !res.writableEnded) {
          origEnd(undefined, undefined, endCallbackPending);
        } else {
          endCallbackPending?.();
        }
        endCallbackPending = undefined;
      });

      gzip.on('error', () => {
        res.off('drain', onDrain);
        res.off('close', onClose);
        if (!res.destroyed && !res.writableEnded) {
          origEnd(undefined, undefined, endCallbackPending);
        } else {
          endCallbackPending?.();
        }
        endCallbackPending = undefined;
      });

      for (const chunk of bufferedChunks) {
        gzip.write(chunk);
      }
      bufferedChunks = [];
      bufferedBytes = 0;
      return gzip;
    };

    (res as unknown as { writeHead: typeof res.writeHead }).writeHead = function writeHeadWrapper(
      statusCode: number,
      reasonOrHeaders?: string | OutgoingHttpHeaders | OutgoingHttpHeader[],
      maybeHeaders?: OutgoingHttpHeaders | OutgoingHttpHeader[],
    ): Response {
      if (mode !== 'pending') {
        if (headCommitted || res.headersSent) {
          return res;
        }
        headCommitted = true;
        pendingHead = null;
        return origWriteHead(statusCode, reasonOrHeaders, maybeHeaders);
      }

      let statusMessage: string | undefined;
      let headers: OutgoingHttpHeaders | OutgoingHttpHeader[] | undefined;
      if (typeof reasonOrHeaders === 'string') {
        statusMessage = reasonOrHeaders;
        headers = maybeHeaders;
      } else {
        headers = reasonOrHeaders;
      }

      res.statusCode = statusCode;
      if (statusMessage !== undefined) {
        res.statusMessage = statusMessage;
      }
      if (Array.isArray(headers)) {
        for (let i = 0; i + 1 < headers.length; i += 2) {
          res.setHeader(String(headers[i]), headers[i + 1]);
        }
      } else if (headers && typeof headers === 'object') {
        for (const [key, value] of Object.entries(headers)) {
          if (value !== undefined) {
            res.setHeader(key, value);
          }
        }
      }
      pendingHead = { statusCode, statusMessage };

      if (!clientAcceptsGzip || shouldSkipCompression(res)) {
        switchToPassthrough();
      }
      return res;
    } as typeof res.writeHead;

    if (origFlushHeaders) {
      res.flushHeaders = function flushHeadersWrapper(): void {
        if (mode === 'pending') {
          const contentLengthHeader = Number(res.getHeader('Content-Length'));
          const knownBelowThreshold =
            Number.isFinite(contentLengthHeader) &&
            contentLengthHeader >= 0 &&
            contentLengthHeader < threshold;
          if (!clientAcceptsGzip || shouldSkipCompression(res) || knownBelowThreshold) {
            switchToPassthrough();
          } else {
            startGzipStream();
          }
        }
        origFlushHeaders();
      };
    }

    (res as unknown as { write: typeof res.write }).write = function writeWrapper(
      chunk: unknown,
      encodingOrCb?: BufferEncoding | ((error?: Error | null) => void),
      maybeCb?: (error?: Error | null) => void,
    ): boolean {
      const encoding = typeof encodingOrCb === 'string' ? encodingOrCb : undefined;
      const cb = typeof encodingOrCb === 'function' ? encodingOrCb : maybeCb;
      const buf = toBuffer(chunk, encoding);

      if (mode === 'passthrough') {
        flushPendingHead();
        return origWrite(chunk, encoding, cb);
      }

      if (mode === 'gzip') {
        if (!buf) {
          cb?.();
          return true;
        }
        return gzipStream!.write(buf, cb);
      }

      if (!clientAcceptsGzip || shouldSkipCompression(res)) {
        switchToPassthrough();
        return origWrite(chunk, encoding, cb);
      }

      if (buf && buf.length > 0) {
        bufferedChunks.push(buf);
        bufferedBytes += buf.length;
      }

      const contentLengthHeader = Number(res.getHeader('Content-Length'));
      if (
        bufferedBytes >= threshold ||
        (Number.isFinite(contentLengthHeader) && contentLengthHeader >= threshold)
      ) {
        const gzip = startGzipStream();
        if (cb) {
          gzip.write(Buffer.alloc(0), cb);
        }
        return true;
      }

      cb?.();
      return true;
    } as typeof res.write;

    (res as unknown as { end: typeof res.end }).end = function endWrapper(
      chunkOrCb?: unknown,
      encodingOrCb?: BufferEncoding | (() => void),
      maybeCb?: () => void,
    ): Response {
      if (ended) {
        return res;
      }
      ended = true;

      let rawChunk: unknown;
      let encoding: BufferEncoding | undefined;
      let cb: (() => void) | undefined;

      if (typeof chunkOrCb === 'function') {
        cb = chunkOrCb as () => void;
      } else {
        rawChunk = chunkOrCb;
        if (typeof encodingOrCb === 'function') {
          cb = encodingOrCb;
        } else {
          encoding = encodingOrCb;
          cb = maybeCb;
        }
      }

      const buf = toBuffer(rawChunk, encoding);

      if (mode === 'passthrough') {
        flushPendingHead();
        return origEnd(rawChunk, encoding, cb);
      }

      if (mode === 'gzip') {
        endCallbackPending = cb;
        if (buf && buf.length > 0) {
          gzipStream!.end(buf);
        } else {
          gzipStream!.end();
        }
        return res;
      }

      const totalBytes = bufferedBytes + (buf?.length ?? 0);
      if (!clientAcceptsGzip || shouldSkipCompression(res) || totalBytes < threshold) {
        switchToPassthrough();
        return origEnd(rawChunk, encoding, cb);
      }

      const payload =
        bufferedChunks.length === 0
          ? (buf ?? Buffer.alloc(0))
          : Buffer.concat(buf ? [...bufferedChunks, buf] : bufferedChunks);
      bufferedChunks = [];
      bufferedBytes = 0;

      if (!res.headersSent) {
        res.removeHeader('Content-Length');
        res.setHeader('Content-Encoding', 'gzip');
        appendVaryHeader(res, 'Accept-Encoding');
        weakenEtagIfNeeded(res);
      }

      mode = 'gzip';
      zlib.gzip(payload, (err, compressed) => {
        if (res.destroyed || res.writableEnded) {
          cb?.();
          return;
        }
        if (err) {
          if (!res.headersSent) {
            res.removeHeader('Content-Encoding');
          }
          flushPendingHead();
          origEnd(payload, undefined, cb);
          return;
        }
        flushPendingHead();
        origEnd(compressed, undefined, cb);
      });

      return res;
    } as typeof res.end;

    next();
  };
}
