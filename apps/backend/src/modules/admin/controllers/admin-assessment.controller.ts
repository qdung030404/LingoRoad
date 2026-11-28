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
  AdminAssessmentGroupsQueryDto,
  AdminAssessmentItemsQueryDto,
  CreateAdminAssessmentItemDto,
  CreateAssessmentItemGroupDto,
  UpdateAdminAssessmentItemDto,
  UpdateAssessmentItemGroupDto,
} from '../dto/admin-content.dto';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminAuditInterceptor } from '../interceptors/admin-audit.interceptor';
import {
  AdminAssessmentGroupView,
  AdminAssessmentItemView,
  AdminContentService,
  AssessmentItemsSummary,
} from '../services/admin-content.service';
import { PaginatedResult } from '../services/admin-users.service';

@Controller(['admin', 'api/v1/admin'])
@UseGuards(AdminJwtGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminAssessmentController {
  constructor(private readonly adminContentService: AdminContentService) {}

  // ===================== ITEM BANK =====================

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

  // ===================== ASSESSMENT GROUPS =====================

  @Get('assessment-groups')
  async listAssessmentGroups(
    @Query() query: AdminAssessmentGroupsQueryDto,
  ): Promise<ApiResponse<PaginatedResult<AdminAssessmentGroupView>>> {
    const data = await this.adminContentService.listAssessmentGroups(query);
    return {
      success: true,
      data,
    };
  }

  @Post('assessment-groups')
  @HttpCode(HttpStatus.CREATED)
  async createAssessmentGroup(
    @Body() dto: CreateAssessmentItemGroupDto,
  ): Promise<ApiResponse<AdminAssessmentGroupView>> {
    const data = await this.adminContentService.createAssessmentGroup(dto);
    return {
      success: true,
      message: 'Tạo nhóm câu hỏi thành công',
      data,
    };
  }

  @Patch('assessment-groups/:id')
  async updateAssessmentGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssessmentItemGroupDto,
  ): Promise<ApiResponse<AdminAssessmentGroupView>> {
    const data = await this.adminContentService.updateAssessmentGroup(id, dto);
    return {
      success: true,
      message: 'Cập nhật nhóm câu hỏi thành công',
      data,
    };
  }

  @Delete('assessment-groups/:id')
  @HttpCode(HttpStatus.OK)
  async deleteAssessmentGroup(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<
    ApiResponse<{ id: string; action: 'DELETED'; detachedItemsCount: number }>
  > {
    const data = await this.adminContentService.deleteAssessmentGroup(id);
    return {
      success: true,
      message: 'Đã xoá nhóm câu hỏi thành công',
      data,
    };
  }
}
