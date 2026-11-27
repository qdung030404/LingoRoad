import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ClientIpThrottlerGuard } from '../../../common/guards/client-ip-throttler.guard';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import {
  AdminSpeakingSubmissionsQueryDto,
  AdminVoiceConversationsQueryDto,
} from '../dto/admin-ops.dto';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminAuditInterceptor } from '../interceptors/admin-audit.interceptor';
import {
  AdminOpsService,
  AdminSpeakingSubmissionDetail,
  AdminSpeakingSubmissionItem,
  AdminSpeakingSubmissionsSummary,
  AdminSystemReadinessView,
  AdminVoiceConversationDetail,
  AdminVoiceConversationItem,
  AdminVoiceConversationsSummary,
} from '../services/admin-ops.service';
import { PaginatedResult } from '../services/admin-users.service';

@Controller(['admin', 'api/v1/admin'])
@UseGuards(AdminJwtGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminOpsController {
  constructor(private readonly adminOpsService: AdminOpsService) {}

  // ===================== VOICE CONVERSATIONS =====================

  @Get('voice-conversations')
  async listVoiceConversations(
    @Query() query: AdminVoiceConversationsQueryDto,
  ): Promise<
    ApiResponse<
      PaginatedResult<AdminVoiceConversationItem, AdminVoiceConversationsSummary>
    >
  > {
    const data = await this.adminOpsService.listVoiceConversations(query);
    return {
      success: true,
      data,
    };
  }

  @Get('voice-conversations/:id')
  async getVoiceConversation(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<AdminVoiceConversationDetail>> {
    const data = await this.adminOpsService.getVoiceConversation(id);
    return {
      success: true,
      data,
    };
  }

  @Post('voice-conversations/:id/release-lock')
  @HttpCode(HttpStatus.OK)
  async releaseVoiceConversationLock(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.adminOpsService.releaseVoiceConversationLock(id);
    return {
      success: true,
      message: 'Đã giải phóng khóa phiên hội thoại',
      data,
    };
  }

  @Post('voice-conversations/:id/retry-content')
  @HttpCode(HttpStatus.OK)
  async retryVoiceConversationContent(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.adminOpsService.retryVoiceConversationContent(id);
    return {
      success: true,
      message: 'Đã kích hoạt chấm lại nội dung hội thoại',
      data,
    };
  }

  // ===================== SPEAKING SUBMISSIONS =====================

  @Get('speaking-submissions')
  async listSpeakingSubmissions(
    @Query() query: AdminSpeakingSubmissionsQueryDto,
  ): Promise<
    ApiResponse<
      PaginatedResult<AdminSpeakingSubmissionItem, AdminSpeakingSubmissionsSummary>
    >
  > {
    const data = await this.adminOpsService.listSpeakingSubmissions(query);
    return {
      success: true,
      data,
    };
  }

  @Get('speaking-submissions/:id')
  async getSpeakingSubmission(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<AdminSpeakingSubmissionDetail>> {
    const data = await this.adminOpsService.getSpeakingSubmission(id);
    return {
      success: true,
      data,
    };
  }

  @Post('speaking-submissions/:id/retry-content')
  @HttpCode(HttpStatus.OK)
  async retrySpeakingSubmissionContent(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.adminOpsService.retrySpeakingSubmissionContent(id);
    return {
      success: true,
      message: 'Đã chấm lại nội dung bài nộp luyện nói',
      data,
    };
  }

  @Post('speaking-submissions/:id/expire')
  @HttpCode(HttpStatus.OK)
  async expireSpeakingSubmission(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.adminOpsService.expireSpeakingSubmission(id);
    return {
      success: true,
      message: 'Đã chuyển bài nộp bị treo sang trạng thái UNKNOWN',
      data,
    };
  }

  // ===================== SYSTEM & ML READINESS =====================

  @Get('system/readiness')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async getSystemReadiness(): Promise<ApiResponse<AdminSystemReadinessView>> {
    const data = await this.adminOpsService.getSystemReadiness();
    return {
      success: true,
      data,
    };
  }
}
