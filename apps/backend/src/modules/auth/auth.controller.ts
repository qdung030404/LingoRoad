import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Headers,
  Get,
  Patch,
} from '@nestjs/common';
import { Request } from 'express';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RegisterUseCase, AuthResult } from './use-cases/register.use-case';
import { LoginUseCase } from './use-cases/login.use-case';
import { RefreshTokenUseCase, RefreshResult } from './use-cases/refresh-token.use-case';
import { LogoutUseCase } from './use-cases/logout.use-case';
import { LogoutAllUseCase } from './use-cases/logout-all.use-case';
import { ChangePasswordUseCase } from './use-cases/change-password.use-case';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { ProfileService } from './profile.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly logoutAllUseCase: LogoutAllUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly profileService: ProfileService,
  ) {}

  @Get('me')
  async me(@CurrentUser('sub') userId: string) {
    return { success: true, data: await this.profileService.get(userId) };
  }

  @Patch('me')
  async updateMe(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return { success: true, data: await this.profileService.update(userId, dto) };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<ApiResponse<AuthResult>> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const result = await this.registerUseCase.execute(dto, {
      ipAddress,
      deviceIdentifier: deviceId,
    });

    return {
      success: true,
      message: 'Đăng ký tài khoản thành công',
      data: result,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<ApiResponse<AuthResult>> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const result = await this.loginUseCase.execute(dto, {
      ipAddress,
      deviceIdentifier: deviceId,
    });

    return {
      success: true,
      message: 'Đăng nhập thành công',
      data: result,
    };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Headers('x-device-id') deviceId?: string,
  ): Promise<ApiResponse<RefreshResult>> {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const result = await this.refreshTokenUseCase.execute(dto, {
      ipAddress,
      deviceIdentifier: deviceId,
    });

    return {
      success: true,
      message: 'Làm mới phiên làm việc thành công',
      data: result,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body() dto: LogoutDto): Promise<ApiResponse<null>> {
    await this.logoutUseCase.execute(dto);
    return {
      success: true,
      message: 'Đăng xuất thành công',
      data: null,
    };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser('sub') userId: string): Promise<ApiResponse<null>> {
    await this.logoutAllUseCase.execute(userId);
    return {
      success: true,
      message: 'Đã đăng xuất khỏi tất cả các thiết bị',
      data: null,
    };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<ApiResponse<null>> {
    await this.changePasswordUseCase.execute(userId, dto);
    return {
      success: true,
      message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.',
      data: null,
    };
  }
}
