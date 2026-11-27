import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminAuditInterceptor } from '../interceptors/admin-audit.interceptor';
import {
  AdminAudioUploadResult,
  AdminImageUploadResult,
  AdminMediaService,
  UploadedAdminFile,
} from '../services/admin-media.service';

@Controller(['admin/media', 'api/v1/admin/media'])
@UseGuards(AdminJwtGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminMediaController {
  constructor(private readonly adminMediaService: AdminMediaService) {}

  @Post('images')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    }),
  )
  async uploadImage(
    @UploadedFile() file?: UploadedAdminFile,
    @Query('slug') slug?: string,
  ): Promise<ApiResponse<AdminImageUploadResult>> {
    const data = await this.adminMediaService.uploadImage(file, slug);
    return {
      success: true,
      message: 'Tải ảnh lên thành công',
      data,
    };
  }

  @Post('audio')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
    }),
  )
  async uploadAudio(
    @UploadedFile() file?: UploadedAdminFile,
    @Query('scope') scope?: string,
    @Query('slug') slug?: string,
  ): Promise<ApiResponse<AdminAudioUploadResult>> {
    const normalizedScope =
      scope === 'placement' ? 'placement' : scope === 'learning' || !scope ? 'learning' : (scope as 'learning');
    const data = await this.adminMediaService.uploadAudio(file, normalizedScope, slug);
    return {
      success: true,
      message: 'Tải tệp âm thanh WAV thành công',
      data,
    };
  }
}
