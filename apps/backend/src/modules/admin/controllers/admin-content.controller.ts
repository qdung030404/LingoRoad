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
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
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
  constructor(private readonly adminContentService: AdminContentService) {}

  // ===================== LEARNING UNITS =====================

  @Get('units')
  async listUnits(): Promise<ApiResponse<AdminUnitItem[]>> {
    return {
      success: true,
      data: await this.adminContentService.listUnits(),
    };
  }

  @Post('units')
  @HttpCode(HttpStatus.CREATED)
  async createUnit(
    @Body() dto: CreateLearningUnitDto,
  ): Promise<ApiResponse<AdminUnitItem>> {
    return {
      success: true,
      message: 'Tạo chương học mới thành công',
      data: await this.adminContentService.createUnit(dto),
    };
  }

  @Patch('units/:id')
  async updateUnit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLearningUnitDto,
  ): Promise<ApiResponse<AdminUnitItem>> {
    return {
      success: true,
      message: 'Cập nhật chương học thành công',
      data: await this.adminContentService.updateUnit(id, dto),
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
    return {
      success: true,
      message: 'Đã xoá chương học thành công',
      data: await this.adminContentService.deleteUnit(id, detach === 'true'),
    };
  }

  // ===================== LEARNING LESSONS =====================

  @Get('lessons')
  async listLessons(
    @Query() query: AdminLessonsQueryDto,
  ): Promise<ApiResponse<PaginatedResult<AdminLessonSummary, LessonsListSummary>>> {
    return {
      success: true,
      data: await this.adminContentService.listLessons(query),
    };
  }

  @Get('lessons/:id')
  async getLesson(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<AdminLessonDetail>> {
    return {
      success: true,
      data: await this.adminContentService.getLesson(id),
    };
  }

  @Post('lessons')
  @HttpCode(HttpStatus.CREATED)
  async createLesson(
    @Body() dto: CreateAdminLessonDto,
  ): Promise<ApiResponse<AdminLessonDetail>> {
    return {
      success: true,
      message: 'Tạo bài tập mới thành công',
      data: await this.adminContentService.createLesson(dto),
    };
  }

  @Patch('lessons/bulk-publish')
  async bulkPublishLessons(
    @Body() dto: BulkPublishDto,
  ): Promise<ApiResponse<{ updatedCount: number; published: boolean; ids: string[] }>> {
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
    return {
      success: true,
      message: 'Cập nhật bài tập thành công',
      data: await this.adminContentService.updateLesson(id, dto),
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
}
