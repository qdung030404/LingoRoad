import {
  BadRequestException,
  Controller,
  Get,
  Head,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Readable } from 'node:stream';
import { Public } from '../../common/decorators/public.decorator';
import { MediaStorageService } from './media-storage.service';

const LEARNING_IMAGE_FILENAME_REGEX =
  /^[a-z0-9-]+\.(?:jpg|jpeg|png|webp|svg)$/;
const LEARNING_AUDIO_FILENAME_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*\.wav$/;
const PLACEMENT_AUDIO_FILENAME_REGEX = /^[a-zA-Z0-9._-]+\.wav$/;
const VOCABULARY_IMAGE_FILENAME_REGEX =
  /^[a-z0-9-]+\.(?:jpg|jpeg|png|webp|gif)$/;

export type ParsedByteRange =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'valid'; start: number; end: number };

export function parseByteRange(
  rangeHeader: string | undefined,
  totalLength: number,
): ParsedByteRange {
  if (!rangeHeader) return { kind: 'none' };
  const trimmed = rangeHeader.trim();
  if (!trimmed) return { kind: 'none' };

  const match = /^bytes=(\d*)-(\d*)$/i.exec(trimmed);
  if (!match) return { kind: 'invalid' };

  const [, startStr, endStr] = match;
  if (!startStr && !endStr) return { kind: 'invalid' };
  if (totalLength <= 0) return { kind: 'invalid' };

  if (!startStr && endStr) {
    const suffixLength = Number.parseInt(endStr, 10);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return { kind: 'invalid' };
    }
    const start = Math.max(0, totalLength - suffixLength);
    return { kind: 'valid', start, end: totalLength - 1 };
  }

  const start = Number.parseInt(startStr, 10);
  if (!Number.isSafeInteger(start) || start < 0 || start >= totalLength) {
    return { kind: 'invalid' };
  }

  if (!endStr) {
    return { kind: 'valid', start, end: totalLength - 1 };
  }

  const parsedEnd = Number.parseInt(endStr, 10);
  if (!Number.isSafeInteger(parsedEnd) || parsedEnd < start) {
    return { kind: 'invalid' };
  }

  return { kind: 'valid', start, end: Math.min(parsedEnd, totalLength - 1) };
}

function etagMatches(
  ifNoneMatch: string | undefined,
  etag: string | undefined,
): boolean {
  if (!ifNoneMatch || !etag) return false;
  const trimmed = ifNoneMatch.trim();
  if (trimmed === '*') return true;
  const stripWeak = (value: string) => value.trim().replace(/^W\//i, '');
  const target = stripWeak(etag);
  return trimmed.split(',').some((candidate) => stripWeak(candidate) === target);
}

@Controller('media')
@Public()
export class MediaProxyController {
  private readonly logger = new Logger(MediaProxyController.name);

  constructor(private readonly mediaStorage: MediaStorageService) {}

  @Head('learning/v1/images/:filename')
  async headLearningImage(
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.serveWhitelisted(
      filename,
      LEARNING_IMAGE_FILENAME_REGEX,
      `learning/v1/images/${filename}`,
      req,
      res,
      true,
    );
  }

  @Get('learning/v1/images/:filename')
  async getLearningImage(
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.serveWhitelisted(
      filename,
      LEARNING_IMAGE_FILENAME_REGEX,
      `learning/v1/images/${filename}`,
      req,
      res,
      false,
    );
  }

  @Head('learning/v1/:filename')
  async headLearningAudio(
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.serveWhitelisted(
      filename,
      LEARNING_AUDIO_FILENAME_REGEX,
      `learning/v1/${filename}`,
      req,
      res,
      true,
    );
  }

  @Get('learning/v1/:filename')
  async getLearningAudio(
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.serveWhitelisted(
      filename,
      LEARNING_AUDIO_FILENAME_REGEX,
      `learning/v1/${filename}`,
      req,
      res,
      false,
    );
  }

  @Head('placement/:filename')
  async headPlacementAudio(
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.serveWhitelisted(
      filename,
      PLACEMENT_AUDIO_FILENAME_REGEX,
      `placement/${filename}`,
      req,
      res,
      true,
    );
  }

  @Get('placement/:filename')
  async getPlacementAudio(
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.serveWhitelisted(
      filename,
      PLACEMENT_AUDIO_FILENAME_REGEX,
      `placement/${filename}`,
      req,
      res,
      false,
    );
  }

  @Head('vocabulary/:filename')
  async headVocabularyImage(
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.serveWhitelisted(
      filename,
      VOCABULARY_IMAGE_FILENAME_REGEX,
      `vocabulary/${filename}`,
      req,
      res,
      true,
    );
  }

  @Get('vocabulary/:filename')
  async getVocabularyImage(
    @Param('filename') filename: string,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.serveWhitelisted(
      filename,
      VOCABULARY_IMAGE_FILENAME_REGEX,
      `vocabulary/${filename}`,
      req,
      res,
      false,
    );
  }

  private setSecurityAndCacheHeaders(
    res: Response,
    contentType: string,
    etag?: string,
    lastModified?: Date,
  ): void {
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Accept-Ranges', 'bytes');
    if (contentType === 'image/svg+xml') {
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    }
    if (etag) {
      res.setHeader('ETag', etag);
    }
    if (lastModified) {
      res.setHeader('Last-Modified', lastModified.toUTCString());
    }
  }

  private async serveWhitelisted(
    filename: string,
    pattern: RegExp,
    blobKey: string,
    req: Request,
    res: Response,
    headOnly: boolean,
  ): Promise<void> {
    if (
      !filename ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      !pattern.test(filename)
    ) {
      throw new BadRequestException({
        code: 'MEDIA_INVALID_FILENAME',
        message: 'Tên tệp media không hợp lệ.',
      });
    }

    const props = await this.mediaStorage.getBlobProperties(blobKey);
    if (!props) {
      throw new NotFoundException({
        code: 'MEDIA_NOT_FOUND',
        message: 'Không tìm thấy tệp media.',
      });
    }

    const ifNoneMatch =
      typeof req.headers['if-none-match'] === 'string'
        ? req.headers['if-none-match']
        : undefined;

    this.setSecurityAndCacheHeaders(
      res,
      props.contentType,
      props.etag,
      props.lastModified,
    );

    if (etagMatches(ifNoneMatch, props.etag)) {
      res.status(HttpStatus.NOT_MODIFIED).end();
      return;
    }

    if (headOnly) {
      res.setHeader('Content-Length', String(props.contentLength));
      res.status(HttpStatus.OK).end();
      return;
    }

    const rangeHeader =
      typeof req.headers.range === 'string' ? req.headers.range : undefined;
    const parsedRange = parseByteRange(rangeHeader, props.contentLength);

    if (parsedRange.kind === 'invalid') {
      res.setHeader('Content-Range', `bytes */${props.contentLength}`);
      res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE).end();
      return;
    }

    const abortController = new AbortController();
    const byteRange =
      parsedRange.kind === 'valid'
        ? {
            offset: parsedRange.start,
            count: parsedRange.end - parsedRange.start + 1,
          }
        : undefined;

    const streamResult = await this.mediaStorage.getBlobStream(
      blobKey,
      byteRange,
      abortController.signal,
    );
    if (!streamResult) {
      throw new NotFoundException({
        code: 'MEDIA_NOT_FOUND',
        message: 'Không tìm thấy tệp media.',
      });
    }

    if (parsedRange.kind === 'valid') {
      const length = parsedRange.end - parsedRange.start + 1;
      res.setHeader(
        'Content-Range',
        `bytes ${parsedRange.start}-${parsedRange.end}/${props.contentLength}`,
      );
      res.setHeader('Content-Length', String(length));
      res.status(HttpStatus.PARTIAL_CONTENT);
    } else {
      res.setHeader(
        'Content-Length',
        String(streamResult.contentLength ?? props.contentLength),
      );
      res.status(HttpStatus.OK);
    }

    const readable = streamResult.stream;
    const cleanup = () => {
      if (!res.writableEnded) {
        abortController.abort();
        if (typeof (readable as Readable).destroy === 'function') {
          (readable as Readable).destroy();
        }
      }
    };

    req.on('close', cleanup);
    readable.on('error', (err) => {
      this.logger.warn(
        `Lỗi truyền luồng media (${blobKey}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      if (!res.headersSent) {
        res.status(HttpStatus.BAD_GATEWAY).end();
      } else if (!res.writableEnded) {
        res.end();
      }
    });

    readable.pipe(res);
  }
}
