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
import { CanDoDescriptor } from '../../assessment/constants/cefr-can-do-matrix.constant';
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

  // ===================== DESCRIPTORS & ITEM BANK =====================

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
    ApiResponse<PaginatedResult<AdminAssessmentItemView, AssessmentItemsSummary>>
  > {
    return {
      success: true,
      data: await this.adminContentService.listAssessmentItems(query),
    };
  }

  @Post('assessment-items')
  @HttpCode(HttpStatus.CREATED)
  async createAssessmentItem(
    @Body() dto: CreateAdminAssessmentItemDto,
  ): Promise<ApiResponse<AdminAssessmentItemView>> {
    return {
      success: true,
      message: 'Thêm câu hỏi đánh giá thành công',
      data: await this.adminContentService.createAssessmentItem(dto),
    };
  }

  @Patch('assessment-items/:id')
  async updateAssessmentItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminAssessmentItemDto,
  ): Promise<ApiResponse<AdminAssessmentItemView>> {
    return {
      success: true,
      message: 'Cập nhật câu hỏi đánh giá thành công',
      data: await this.adminContentService.updateAssessmentItem(id, dto),
    };
  }

  @Delete('assessment-items/:id')
  @HttpCode(HttpStatus.OK)
  async deleteAssessmentItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force') force?: string,
  ): Promise<ApiResponse<{ id: string; action: 'DELETED' }>> {
    return {
      success: true,
      message: 'Đã xoá câu hỏi đánh giá thành công',
      data: await this.adminContentService.deleteAssessmentItem(
        id,
        force === 'true',
      ),
    };
  }

  // ===================== ASSESSMENT GROUPS =====================

  @Get('assessment-groups')
  async listAssessmentGroups(
    @Query() query: AdminAssessmentGroupsQueryDto,
  ): Promise<ApiResponse<PaginatedResult<AdminAssessmentGroupView>>> {
    return {
      success: true,
      data: await this.adminContentService.listAssessmentGroups(query),
    };
  }

  @Post('assessment-groups')
  @HttpCode(HttpStatus.CREATED)
  async createAssessmentGroup(
    @Body() dto: CreateAssessmentItemGroupDto,
  ): Promise<ApiResponse<AdminAssessmentGroupView>> {
    return {
      success: true,
      message: 'Tạo nhóm câu hỏi thành công',
      data: await this.adminContentService.createAssessmentGroup(dto),
    };
  }

  @Patch('assessment-groups/:id')
  async updateAssessmentGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssessmentItemGroupDto,
  ): Promise<ApiResponse<AdminAssessmentGroupView>> {
    return {
      success: true,
      message: 'Cập nhật nhóm câu hỏi thành công',
      data: await this.adminContentService.updateAssessmentGroup(id, dto),
    };
  }

  @Delete('assessment-groups/:id')
  @HttpCode(HttpStatus.OK)
  async deleteAssessmentGroup(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<
    ApiResponse<{ id: string; action: 'DELETED'; detachedItemsCount: number }>
  > {
    return {
      success: true,
      message: 'Đã xoá nhóm câu hỏi thành công',
      data: await this.adminContentService.deleteAssessmentGroup(id),
    };
  }
}
