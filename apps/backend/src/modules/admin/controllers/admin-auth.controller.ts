import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import {
  ClientIpThrottlerGuard,
  normalizeClientIp,
} from '../../../common/guards/client-ip-throttler.guard';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import {
  AdminChangePasswordDto,
  AdminLoginDto,
  AdminLogoutDto,
  AdminRefreshDto,
  AdminUpdateProfileDto,
} from '../dto/admin-auth.dto';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminAuditInterceptor } from '../interceptors/admin-audit.interceptor';
import {
  AdminAuditRequest,
  AdminAuthResult,
  AdminAuthService,
  AdminUserView,
} from '../services/admin-auth.service';

@Controller(['admin/auth', 'api/v1/admin/auth'])
@UseGuards(AdminJwtGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Public()
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<ApiResponse<AdminAuthResult>> {
    const ipAddress =
      normalizeClientIp(req.ip || req.socket?.remoteAddress) ?? undefined;
    const data = await this.adminAuthService.login(dto, {
      ipAddress,
      deviceIdentifier: deviceId,
    });
    return {
      success: true,
      message: 'Đăng nhập quản trị thành công',
      data,
    };
  }

  @Public()
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: AdminRefreshDto,
    @Req() req: Request,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<ApiResponse<AdminAuthResult>> {
    const ipAddress =
      normalizeClientIp(req.ip || req.socket?.remoteAddress) ?? undefined;
    const data = await this.adminAuthService.refresh(dto, {
      ipAddress,
      deviceIdentifier: deviceId,
    });
    return {
      success: true,
      message: 'Làm mới phiên quản trị thành công',
      data,
    };
  }

  @Public()
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() dto: AdminLogoutDto,
    @Req() req: AdminAuditRequest,
  ): Promise<ApiResponse<null>> {
    await this.adminAuthService.logout(dto, req);
    return {
      success: true,
      message: 'Đăng xuất quản trị thành công',
      data: null,
    };
  }

  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: AdminChangePasswordDto,
    @Req() req: Request,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<ApiResponse<AdminAuthResult>> {
    const ipAddress =
      normalizeClientIp(req.ip || req.socket?.remoteAddress) ?? undefined;
    const data = await this.adminAuthService.changePassword(userId, dto, {
      ipAddress,
      deviceIdentifier: deviceId,
    });
    return {
      success: true,
      message: 'Đổi mật khẩu quản trị thành công',
      data,
    };
  }

  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser('sub') userId: string,
  ): Promise<ApiResponse<{ revokedSessionsCount: number }>> {
    const data = await this.adminAuthService.logoutAll(userId);
    return {
      success: true,
      message: 'Đã đăng xuất khỏi tất cả phiên quản trị thành công',
      data,
    };
  }

  @Get('me')
  async me(@CurrentUser('sub') userId: string): Promise<ApiResponse<AdminUserView>> {
    const data = await this.adminAuthService.me(userId);
    return {
      success: true,
      data,
    };
  }

  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Patch('me')
  async updateMe(
    @CurrentUser('sub') userId: string,
    @Body() dto: AdminUpdateProfileDto,
  ): Promise<ApiResponse<AdminUserView>> {
    const data = await this.adminAuthService.updateProfile(userId, dto);
    return {
      success: true,
      message: 'Cập nhật hồ sơ quản trị viên thành công',
      data,
    };
  }
}
