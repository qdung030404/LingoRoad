import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ClientIpThrottlerGuard } from '../../../common/guards/client-ip-throttler.guard';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import { ContentImportRequestDto } from '../dto/admin-import.dto';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminAuditInterceptor } from '../interceptors/admin-audit.interceptor';
import {
  AdminAnalyticsService,
  DashboardOverviewResponse,
} from '../services/admin-analytics.service';
import { AdminAuditLogView, AdminAuditService } from '../services/admin-audit.service';
import { AdminExportService } from '../services/admin-export.service';
import {
  AdminImportService,
  ImportApplyResult,
  ImportValidationResult,
} from '../services/admin-import.service';
import { PaginatedResult } from '../services/admin-users.service';

@Controller(['admin', 'api/v1/admin'])
@UseGuards(AdminJwtGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminReportingController {
  constructor(
    private readonly adminAnalyticsService: AdminAnalyticsService,
    private readonly adminImportService: AdminImportService,
    private readonly adminAuditService: AdminAuditService,
    private readonly adminExportService: AdminExportService,
  ) {}

  @Get('analytics/dashboard')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getDashboard(
    @Query('timeframe') timeframe?: string,
    @Query('forceRefresh') forceRefresh?: string,
  ): Promise<ApiResponse<DashboardOverviewResponse>> {
    return {
      success: true,
      data: await this.adminAnalyticsService.getDashboard(
        timeframe,
        forceRefresh === 'true',
      ),
    };
  }

  // ===================== AUDIT LOGS & EXPORTS =====================

  @Get('audit-logs')
  async listAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('adminEmail') adminEmail?: string,
    @Query('resourceType') resourceType?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ApiResponse<PaginatedResult<AdminAuditLogView>>> {
    return {
      success: true,
      data: await this.adminAuditService.listLogs({
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
        adminEmail,
        resourceType,
        action,
        from,
        to,
      }),
    };
  }

  @Get('exports/:entity')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async exportEntity(
    @Param('entity') entity: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const safeFormat = format === 'csv' ? 'csv' : 'json';
    const result = await this.adminExportService.exportEntity(entity, safeFormat);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Export-Count', String(result.count));
    res.setHeader('X-Export-Truncated', String(result.truncated));
    return result.body;
  }

  // ===================== BATCH IMPORT =====================

  @Post('imports/validate')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async validateImport(
    @Body() dto: ContentImportRequestDto,
  ): Promise<ApiResponse<ImportValidationResult>> {
    return {
      success: true,
      data: await this.adminImportService.validateBundle(dto.bundle, {
        topicWordsMode: dto.topicWordsMode,
      }),
    };
  }

  @Post('imports/apply')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async applyImport(
    @Body() dto: ContentImportRequestDto,
  ): Promise<ApiResponse<ImportApplyResult>> {
    const data = await this.adminImportService.applyBundle(dto.bundle, {
      topicWordsMode: dto.topicWordsMode,
    });
    return {
      success: true,
      message: `Đã nạp thành công ${data.preview.totalRecords} bản ghi vào hệ thống`,
      data,
    };
  }
}
