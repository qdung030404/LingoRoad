import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LearningKind } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ClientIpThrottlerGuard } from '../../../common/guards/client-ip-throttler.guard';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import {
  AdminUsersQueryDto,
  CreateAdminUserDto,
  OverrideUserSkillLevelDto,
  ResetPlacementRetakeDto,
  UpdateAdminUserDto,
} from '../dto/admin-users.dto';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminAuditInterceptor } from '../interceptors/admin-audit.interceptor';
import {
  AdminUserDetail,
  AdminUserListItem,
  AdminUserSessionView,
  AdminUsersService,
  PaginatedResult,
  UsersListSummary,
} from '../services/admin-users.service';

@Controller(['admin/users', 'api/v1/admin/users'])
@UseGuards(AdminJwtGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  async listUsers(
    @Query() query: AdminUsersQueryDto,
  ): Promise<
    ApiResponse<PaginatedResult<AdminUserListItem, UsersListSummary>>
  > {
    const data = await this.adminUsersService.listUsers(query);
    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  async getUserDetail(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<AdminUserDetail>> {
    const data = await this.adminUsersService.getUserDetail(id);
    return {
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createUser(
    @Body() dto: CreateAdminUserDto,
  ): Promise<ApiResponse<AdminUserListItem>> {
    const data = await this.adminUsersService.createUser(dto);
    return {
      success: true,
      message: 'Tạo tài khoản người dùng thành công',
      data,
    };
  }

  @Patch(':id')
  async updateUser(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) targetId: string,
    @Body() dto: UpdateAdminUserDto,
  ): Promise<ApiResponse<AdminUserListItem>> {
    const data = await this.adminUsersService.updateUser(adminId, targetId, dto);
    return {
      success: true,
      message: 'Cập nhật người dùng thành công',
      data,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteUser(
    @CurrentUser('sub') adminId: string,
    @Param('id', ParseUUIDPipe) targetId: string,
    @Query('hard') hard?: string,
  ): Promise<
    ApiResponse<{ id: string; action: 'HARD_DELETED' | 'SOFT_DELETED' }>
  > {
    const data = await this.adminUsersService.deleteUser(
      adminId,
      targetId,
      hard === 'true',
    );
    return {
      success: true,
      message:
        data.action === 'HARD_DELETED'
          ? 'Đã xoá vĩnh viễn tài khoản người dùng'
          : 'Đã vô hiệu hóa tài khoản người dùng',
      data,
    };
  }

  @Patch(':id/skill-levels/:kind')
  async overrideSkillLevel(
    @Param('id', ParseUUIDPipe) userId: string,
    @Param('kind', new ParseEnumPipe(LearningKind)) kind: LearningKind,
    @Body() dto: OverrideUserSkillLevelDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.adminUsersService.overrideSkillLevel(userId, kind, dto);
    return {
      success: true,
      message: 'Đã cập nhật trình độ kỹ năng người học',
      data,
    };
  }

  @Get(':id/placements/:sessionId')
  async getPlacementSessionDetail(
    @Param('id', ParseUUIDPipe) userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.adminUsersService.getPlacementSessionDetail(
      userId,
      sessionId,
    );
    return {
      success: true,
      data,
    };
  }

  @Post(':id/placements/reset-retake')
  @HttpCode(HttpStatus.OK)
  async resetPlacementRetake(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: ResetPlacementRetakeDto,
  ): Promise<
    ApiResponse<{
      userId: string;
      abandonedSessionsCount: number;
      resetSkillLevelsCount: number;
    }>
  > {
    const data = await this.adminUsersService.resetPlacementRetake(userId, dto);
    return {
      success: true,
      message: 'Đã mở quyền làm lại bài kiểm tra đầu vào',
      data,
    };
  }

  @Get(':id/sessions')
  async listUserSessions(
    @Param('id', ParseUUIDPipe) userId: string,
  ): Promise<ApiResponse<AdminUserSessionView[]>> {
    const data = await this.adminUsersService.listUserSessions(userId);
    return {
      success: true,
      data,
    };
  }

  @Post(':id/sessions/revoke-all')
  @HttpCode(HttpStatus.OK)
  async revokeAllUserSessions(
    @Param('id', ParseUUIDPipe) userId: string,
  ): Promise<ApiResponse<{ userId: string; revokedSessionsCount: number }>> {
    const data = await this.adminUsersService.revokeAllUserSessions(userId);
    return {
      success: true,
      message: 'Đã thu hồi toàn bộ phiên đăng nhập của người dùng',
      data,
    };
  }

  @Delete(':id/sessions/:sessionId')
  @HttpCode(HttpStatus.OK)
  async revokeUserSession(
    @Param('id', ParseUUIDPipe) userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<ApiResponse<{ id: string; revoked: boolean }>> {
    const data = await this.adminUsersService.revokeUserSession(
      userId,
      sessionId,
    );
    return {
      success: true,
      message: 'Đã thu hồi phiên đăng nhập',
      data,
    };
  }

  @Get(':id/export')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async exportUserData(
    @Param('id', ParseUUIDPipe) userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const result = await this.adminUsersService.exportUserData(userId);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return result.body;
  }
}
