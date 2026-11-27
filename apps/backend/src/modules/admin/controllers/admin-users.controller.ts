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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import {
  AdminUsersQueryDto,
  CreateAdminUserDto,
  UpdateAdminUserDto,
} from '../dto/admin-users.dto';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminAuditInterceptor } from '../interceptors/admin-audit.interceptor';
import {
  AdminUserDetail,
  AdminUserListItem,
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
}
