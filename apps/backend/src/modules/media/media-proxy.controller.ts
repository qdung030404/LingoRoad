import { Controller, Get, Head, Logger, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { MediaStorageService } from './media-storage.service';
import {
  LEARNING_AUDIO_FILENAME_REGEX,
  LEARNING_IMAGE_FILENAME_REGEX,
  PLACEMENT_AUDIO_FILENAME_REGEX,
  VOCABULARY_IMAGE_FILENAME_REGEX,
  serveWhitelistedMediaBlob,
} from './media-proxy.helpers';

export { parseByteRange, type ParsedByteRange } from './media-proxy.helpers';

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
    await serveWhitelistedMediaBlob(
      this.mediaStorage,
      this.logger,
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
    await serveWhitelistedMediaBlob(
      this.mediaStorage,
      this.logger,
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
    await serveWhitelistedMediaBlob(
      this.mediaStorage,
      this.logger,
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
    await serveWhitelistedMediaBlob(
      this.mediaStorage,
      this.logger,
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
    await serveWhitelistedMediaBlob(
      this.mediaStorage,
      this.logger,
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
    await serveWhitelistedMediaBlob(
      this.mediaStorage,
      this.logger,
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
    await serveWhitelistedMediaBlob(
      this.mediaStorage,
      this.logger,
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
    await serveWhitelistedMediaBlob(
      this.mediaStorage,
      this.logger,
      filename,
      VOCABULARY_IMAGE_FILENAME_REGEX,
      `vocabulary/${filename}`,
      req,
      res,
      false,
    );
  }
}
