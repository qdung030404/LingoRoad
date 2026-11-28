import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ClientIpThrottlerGuard } from '../../../common/guards/client-ip-throttler.guard';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminAuditInterceptor } from '../interceptors/admin-audit.interceptor';
import {
  AdminAudioUploadResult,
  AdminImageUploadResult,
  AdminMediaService,
  AdminOrphanMediaCleanupResult,
  AdminOrphanMediaScanResult,
  UploadedAdminFile,
} from '../services/admin-media.service';

export class CleanupOrphanMediaDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  keys?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  minAgeHours?: number;
}

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
      scope === 'placement'
        ? 'placement'
        : scope === 'learning' || !scope
          ? 'learning'
          : (scope as 'learning');
    const data = await this.adminMediaService.uploadAudio(
      file,
      normalizedScope,
      slug,
    );
    return {
      success: true,
      message: 'Tải tệp âm thanh WAV thành công',
      data,
    };
  }

  @Get('orphans')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  async scanOrphans(
    @Query('minAgeHours') minAgeHours?: string,
  ): Promise<ApiResponse<AdminOrphanMediaScanResult>> {
    const parsedHours =
      minAgeHours !== undefined && minAgeHours.trim() !== ''
        ? Number(minAgeHours)
        : undefined;
    const data = await this.adminMediaService.scanOrphanMedia(parsedHours);
    return {
      success: true,
      data,
    };
  }

  @Post('orphans/cleanup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async cleanupOrphans(
    @Body() dto: CleanupOrphanMediaDto,
  ): Promise<ApiResponse<AdminOrphanMediaCleanupResult>> {
    const data = await this.adminMediaService.cleanupOrphanMedia(dto);
    return {
      success: true,
      message: `Đã dọn dẹp ${data.deletedCount} tệp media mồ côi`,
      data,
    };
  }
}
