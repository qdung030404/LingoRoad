import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ClientIpThrottlerGuard } from '../../../common/guards/client-ip-throttler.guard';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import { CanDoDescriptor } from '../../assessment/constants/cefr-can-do-matrix.constant';
import {
  AdminLessonsQueryDto,
  BulkPublishDto,
  CreateAdminLessonDto,
  CreateLearningUnitDto,
  UpdateAdminLessonDto,
  UpdateLearningUnitDto,
} from '../dto/admin-content.dto';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminAuditInterceptor } from '../interceptors/admin-audit.interceptor';
import {
  AdminAnalyticsService,
  DashboardOverviewResponse,
} from '../services/admin-analytics.service';
import {
  AdminContentService,
  AdminLessonDetail,
  AdminLessonSummary,
  AdminUnitItem,
  LessonsListSummary,
} from '../services/admin-content.service';
import { PaginatedResult } from '../services/admin-users.service';

@Controller(['admin', 'api/v1/admin'])
@UseGuards(AdminJwtGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminContentController {
  constructor(
    private readonly adminAnalyticsService: AdminAnalyticsService,
    private readonly adminContentService: AdminContentService,
  ) {}

  @Get('analytics/dashboard')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getDashboard(
    @Query('timeframe') timeframe?: string,
    @Query('forceRefresh') forceRefresh?: string,
  ): Promise<ApiResponse<DashboardOverviewResponse>> {
    const data = await this.adminAnalyticsService.getDashboard(
      timeframe,
      forceRefresh === 'true',
    );
    return {
      success: true,
      data,
    };
  }

  // ===================== LEARNING UNITS =====================

  @Get('units')
  async listUnits(): Promise<ApiResponse<AdminUnitItem[]>> {
    const data = await this.adminContentService.listUnits();
    return {
      success: true,
      data,
    };
  }

  @Post('units')
  @HttpCode(HttpStatus.CREATED)
  async createUnit(
    @Body() dto: CreateLearningUnitDto,
  ): Promise<ApiResponse<AdminUnitItem>> {
    const data = await this.adminContentService.createUnit(dto);
    return {
      success: true,
      message: 'Tạo chương học mới thành công',
      data,
    };
  }

  @Patch('units/:id')
  async updateUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLearningUnitDto,
  ): Promise<ApiResponse<AdminUnitItem>> {
    const data = await this.adminContentService.updateUnit(id, dto);
    return {
      success: true,
      message: 'Cập nhật chương học thành công',
      data,
    };
  }

  @Delete('units/:id')
  @HttpCode(HttpStatus.OK)
  async deleteUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('detach') detach?: string,
  ): Promise<
    ApiResponse<{ id: string; action: 'DELETED'; detachedLessonsCount: number }>
  > {
    const data = await this.adminContentService.deleteUnit(
      id,
      detach === 'true',
    );
    return {
      success: true,
      message: 'Đã xoá chương học thành công',
      data,
    };
  }

  // ===================== LEARNING LESSONS =====================

  @Get('lessons')
  async listLessons(
    @Query() query: AdminLessonsQueryDto,
  ): Promise<
    ApiResponse<PaginatedResult<AdminLessonSummary, LessonsListSummary>>
  > {
    const data = await this.adminContentService.listLessons(query);
    return {
      success: true,
      data,
    };
  }

  @Get('lessons/:id')
  async getLesson(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<AdminLessonDetail>> {
    const data = await this.adminContentService.getLesson(id);
    return {
      success: true,
      data,
    };
  }

  @Post('lessons')
  @HttpCode(HttpStatus.CREATED)
  async createLesson(
    @Body() dto: CreateAdminLessonDto,
  ): Promise<ApiResponse<AdminLessonDetail>> {
    const data = await this.adminContentService.createLesson(dto);
    return {
      success: true,
      message: 'Tạo bài tập mới thành công',
      data,
    };
  }

  @Patch('lessons/bulk-publish')
  async bulkPublishLessons(
    @Body() dto: BulkPublishDto,
  ): Promise<
    ApiResponse<{ updatedCount: number; published: boolean; ids: string[] }>
  > {
    const data = await this.adminContentService.bulkPublishLessons(dto);
    return {
      success: true,
      message: dto.published
        ? `Đã xuất bản ${data.updatedCount} bài tập`
        : `Đã ngừng xuất bản ${data.updatedCount} bài tập`,
      data,
    };
  }

  @Patch('lessons/:id')
  async updateLesson(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminLessonDto,
  ): Promise<ApiResponse<AdminLessonDetail>> {
    const data = await this.adminContentService.updateLesson(id, dto);
    return {
      success: true,
      message: 'Cập nhật bài tập thành công',
      data,
    };
  }

  @Delete('lessons/:id')
  @HttpCode(HttpStatus.OK)
  async deleteLesson(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force') force?: string,
  ): Promise<
    ApiResponse<{
      id: string;
      action: 'DELETED' | 'UNPUBLISHED';
      attemptsCount: number;
    }>
  > {
    const data = await this.adminContentService.deleteLesson(
      id,
      force === 'true',
    );
    return {
      success: true,
      message:
        data.action === 'DELETED'
          ? 'Đã xoá bài tập thành công'
          : 'Bài tập đã có người học nên được chuyển sang trạng thái ngừng xuất bản',
      data,
    };
  }

  // ===================== DESCRIPTORS =====================

  @Get('descriptors')
  listDescriptors(): ApiResponse<readonly CanDoDescriptor[]> {
    return {
      success: true,
      data: this.adminContentService.listDescriptors(),
    };
  }
}
