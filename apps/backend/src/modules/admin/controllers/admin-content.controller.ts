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
} from '@nestjs/common';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import { CanDoDescriptor } from '../../assessment/constants/cefr-can-do-matrix.constant';
import {
  AdminAssessmentItemsQueryDto,
  AdminLessonsQueryDto,
  CreateAdminAssessmentItemDto,
  CreateAdminLessonDto,
  CreateLearningUnitDto,
  UpdateAdminAssessmentItemDto,
  UpdateAdminLessonDto,
} from '../dto/admin-content.dto';
import { ContentImportRequestDto } from '../dto/admin-import.dto';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import {
  AdminAnalyticsService,
  DashboardOverviewResponse,
} from '../services/admin-analytics.service';
import {
  AdminAssessmentItemView,
  AdminContentService,
  AdminLessonDetail,
  AdminLessonSummary,
  AdminUnitItem,
  AssessmentItemsSummary,
  LessonsListSummary,
} from '../services/admin-content.service';
import {
  AdminImportService,
  ImportApplyResult,
  ImportValidationResult,
} from '../services/admin-import.service';
import { PaginatedResult } from '../services/admin-users.service';

@Controller(['admin', 'api/v1/admin'])
@UseGuards(AdminJwtGuard)
export class AdminContentController {
  constructor(
    private readonly adminAnalyticsService: AdminAnalyticsService,
    private readonly adminContentService: AdminContentService,
    private readonly adminImportService: AdminImportService,
  ) {}

  @Get('analytics/dashboard')
  async getDashboard(): Promise<ApiResponse<DashboardOverviewResponse>> {
    const data = await this.adminAnalyticsService.getDashboard();
    return {
      success: true,
      data,
    };
  }

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

  @Get('descriptors')
  listDescriptors(): ApiResponse<readonly CanDoDescriptor[]> {
    return {
      success: true,
      data: this.adminContentService.listDescriptors(),
    };
  }

  @Get('assessment-items')
  async listAssessmentItems(
    @Query() query: AdminAssessmentItemsQueryDto,
  ): Promise<
    ApiResponse<
      PaginatedResult<AdminAssessmentItemView, AssessmentItemsSummary>
    >
  > {
    const data = await this.adminContentService.listAssessmentItems(query);
    return {
      success: true,
      data,
    };
  }

  @Post('assessment-items')
  @HttpCode(HttpStatus.CREATED)
  async createAssessmentItem(
    @Body() dto: CreateAdminAssessmentItemDto,
  ): Promise<ApiResponse<AdminAssessmentItemView>> {
    const data = await this.adminContentService.createAssessmentItem(dto);
    return {
      success: true,
      message: 'Thêm câu hỏi đánh giá thành công',
      data,
    };
  }

  @Patch('assessment-items/:id')
  async updateAssessmentItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminAssessmentItemDto,
  ): Promise<ApiResponse<AdminAssessmentItemView>> {
    const data = await this.adminContentService.updateAssessmentItem(id, dto);
    return {
      success: true,
      message: 'Cập nhật câu hỏi đánh giá thành công',
      data,
    };
  }

  @Delete('assessment-items/:id')
  @HttpCode(HttpStatus.OK)
  async deleteAssessmentItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force') force?: string,
  ): Promise<ApiResponse<{ id: string; action: 'DELETED' }>> {
    const data = await this.adminContentService.deleteAssessmentItem(
      id,
      force === 'true',
    );
    return {
      success: true,
      message: 'Đã xoá câu hỏi đánh giá thành công',
      data,
    };
  }

  @Post('imports/validate')
  @HttpCode(HttpStatus.OK)
  async validateImport(
    @Body() dto: ContentImportRequestDto,
  ): Promise<ApiResponse<ImportValidationResult>> {
    const data = await this.adminImportService.validateBundle(dto.bundle);
    return {
      success: true,
      data,
    };
  }

  @Post('imports/apply')
  @HttpCode(HttpStatus.OK)
  async applyImport(
    @Body() dto: ContentImportRequestDto,
  ): Promise<ApiResponse<ImportApplyResult>> {
    const data = await this.adminImportService.applyBundle(dto.bundle);
    return {
      success: true,
      message: `Đã nạp thành công ${data.preview.totalRecords} bản ghi vào hệ thống`,
      data,
    };
  }
}
