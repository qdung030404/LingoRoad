import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import {
  AdminLoginDto,
  AdminLogoutDto,
  AdminRefreshDto,
} from '../dto/admin-auth.dto';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import {
  AdminAuthResult,
  AdminAuthService,
  AdminUserView,
} from '../services/admin-auth.service';

@Controller(['admin/auth', 'api/v1/admin/auth'])
@UseGuards(AdminJwtGuard)
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<ApiResponse<AdminAuthResult>> {
    const ipAddress = req.ip || req.socket.remoteAddress;
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
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: AdminRefreshDto,
    @Req() req: Request,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<ApiResponse<AdminAuthResult>> {
    const ipAddress = req.ip || req.socket.remoteAddress;
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
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: AdminLogoutDto): Promise<ApiResponse<null>> {
    await this.adminAuthService.logout(dto);
    return {
      success: true,
      message: 'Đăng xuất quản trị thành công',
      data: null,
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
}
