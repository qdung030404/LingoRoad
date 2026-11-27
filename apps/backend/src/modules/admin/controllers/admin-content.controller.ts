import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ClientIpThrottlerGuard } from '../../../common/guards/client-ip-throttler.guard';
import { ApiResponse } from '../../../common/interfaces/api-response.interface';
import { CanDoDescriptor } from '../../assessment/constants/cefr-can-do-matrix.constant';
import { AdminAssessmentGroupsQueryDto, AdminAssessmentItemsQueryDto, AdminLessonsQueryDto, BulkPublishDto, CreateAdminAssessmentItemDto, CreateAdminLessonDto, CreateAssessmentItemGroupDto, CreateLearningUnitDto, UpdateAdminAssessmentItemDto, UpdateAdminLessonDto, UpdateAssessmentItemGroupDto, UpdateLearningUnitDto } from '../dto/admin-content.dto';
import { ContentImportRequestDto } from '../dto/admin-import.dto';
import { AdminSpeakingQueryDto, CreateAdminSpeakingPromptDto, UpdateAdminSpeakingPromptDto } from '../dto/admin-speaking.dto';
import { AdminVocabularyWordsQueryDto, CreateAdminCuratedTopicDto, CreateAdminCuratedWordDto, UpdateAdminCuratedTopicDto, UpdateAdminCuratedWordDto } from '../dto/admin-vocabulary.dto';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminAuditInterceptor } from '../interceptors/admin-audit.interceptor';
import { AdminAnalyticsService, DashboardOverviewResponse } from '../services/admin-analytics.service';
import { AdminAuditLogView, AdminAuditService } from '../services/admin-audit.service';
import { AdminAssessmentGroupView, AdminAssessmentItemView, AdminContentService, AdminLessonDetail, AdminLessonSummary, AdminUnitItem, AssessmentItemsSummary, LessonsListSummary } from '../services/admin-content.service';
import { AdminExportService } from '../services/admin-export.service';
import { AdminImportService, ImportApplyResult, ImportValidationResult } from '../services/admin-import.service';
import { AdminSpeakingPromptView, AdminSpeakingService, SpeakingPromptsSummary } from '../services/admin-speaking.service';
import { PaginatedResult } from '../services/admin-users.service';
import { AdminCuratedTopicView, AdminCuratedWordView, AdminVocabularyService } from '../services/admin-vocabulary.service';

@Controller(['admin', 'api/v1/admin'])
@UseGuards(AdminJwtGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminContentController {
  constructor(
    private readonly adminAnalyticsService: AdminAnalyticsService,
    private readonly adminContentService: AdminContentService,
    private readonly adminImportService: AdminImportService,
    private readonly adminVocabularyService: AdminVocabularyService,
    private readonly adminSpeakingService: AdminSpeakingService,
    private readonly adminAuditService: AdminAuditService,
    private readonly adminExportService: AdminExportService,
  ) {}

  @Get('analytics/dashboard')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async getDashboard(@Query('timeframe') timeframe?: string, @Query('forceRefresh') forceRefresh?: string): Promise<ApiResponse<DashboardOverviewResponse>> {
    return { success: true, data: await this.adminAnalyticsService.getDashboard(timeframe, forceRefresh === 'true') };
  }

  // ===================== LEARNING UNITS =====================

  @Get('units')
  async listUnits(): Promise<ApiResponse<AdminUnitItem[]>> {
    return { success: true, data: await this.adminContentService.listUnits() };
  }

  @Post('units')
  @HttpCode(HttpStatus.CREATED)
  async createUnit(@Body() dto: CreateLearningUnitDto): Promise<ApiResponse<AdminUnitItem>> {
    return { success: true, message: 'Tạo chương học mới thành công', data: await this.adminContentService.createUnit(dto) };
  }

  @Patch('units/:id')
  async updateUnit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLearningUnitDto): Promise<ApiResponse<AdminUnitItem>> {
    return { success: true, message: 'Cập nhật chương học thành công', data: await this.adminContentService.updateUnit(id, dto) };
  }

  @Delete('units/:id')
  @HttpCode(HttpStatus.OK)
  async deleteUnit(@Param('id', ParseUUIDPipe) id: string, @Query('detach') detach?: string): Promise<ApiResponse<{ id: string; action: 'DELETED'; detachedLessonsCount: number }>> {
    return { success: true, message: 'Đã xoá chương học thành công', data: await this.adminContentService.deleteUnit(id, detach === 'true') };
  }

  // ===================== LEARNING LESSONS =====================

  @Get('lessons')
  async listLessons(@Query() query: AdminLessonsQueryDto): Promise<ApiResponse<PaginatedResult<AdminLessonSummary, LessonsListSummary>>> {
    return { success: true, data: await this.adminContentService.listLessons(query) };
  }

  @Get('lessons/:id')
  async getLesson(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<AdminLessonDetail>> {
    return { success: true, data: await this.adminContentService.getLesson(id) };
  }

  @Post('lessons')
  @HttpCode(HttpStatus.CREATED)
  async createLesson(@Body() dto: CreateAdminLessonDto): Promise<ApiResponse<AdminLessonDetail>> {
    return { success: true, message: 'Tạo bài tập mới thành công', data: await this.adminContentService.createLesson(dto) };
  }

  @Patch('lessons/bulk-publish')
  async bulkPublishLessons(@Body() dto: BulkPublishDto): Promise<ApiResponse<{ updatedCount: number; published: boolean; ids: string[] }>> {
    const data = await this.adminContentService.bulkPublishLessons(dto);
    return { success: true, message: dto.published ? `Đã xuất bản ${data.updatedCount} bài tập` : `Đã ngừng xuất bản ${data.updatedCount} bài tập`, data };
  }

  @Patch('lessons/:id')
  async updateLesson(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdminLessonDto): Promise<ApiResponse<AdminLessonDetail>> {
    return { success: true, message: 'Cập nhật bài tập thành công', data: await this.adminContentService.updateLesson(id, dto) };
  }

  @Delete('lessons/:id')
  @HttpCode(HttpStatus.OK)
  async deleteLesson(@Param('id', ParseUUIDPipe) id: string, @Query('force') force?: string): Promise<ApiResponse<{ id: string; action: 'DELETED' | 'UNPUBLISHED'; attemptsCount: number }>> {
    const data = await this.adminContentService.deleteLesson(id, force === 'true');
    return { success: true, message: data.action === 'DELETED' ? 'Đã xoá bài tập thành công' : 'Bài tập đã có người học nên được chuyển sang trạng thái ngừng xuất bản', data };
  }

  // ===================== DESCRIPTORS & ITEM BANK =====================

  @Get('descriptors')
  listDescriptors(): ApiResponse<readonly CanDoDescriptor[]> {
    return { success: true, data: this.adminContentService.listDescriptors() };
  }

  @Get('assessment-items')
  async listAssessmentItems(@Query() query: AdminAssessmentItemsQueryDto): Promise<ApiResponse<PaginatedResult<AdminAssessmentItemView, AssessmentItemsSummary>>> {
    return { success: true, data: await this.adminContentService.listAssessmentItems(query) };
  }

  @Post('assessment-items')
  @HttpCode(HttpStatus.CREATED)
  async createAssessmentItem(@Body() dto: CreateAdminAssessmentItemDto): Promise<ApiResponse<AdminAssessmentItemView>> {
    return { success: true, message: 'Thêm câu hỏi đánh giá thành công', data: await this.adminContentService.createAssessmentItem(dto) };
  }

  @Patch('assessment-items/:id')
  async updateAssessmentItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdminAssessmentItemDto): Promise<ApiResponse<AdminAssessmentItemView>> {
    return { success: true, message: 'Cập nhật câu hỏi đánh giá thành công', data: await this.adminContentService.updateAssessmentItem(id, dto) };
  }

  @Delete('assessment-items/:id')
  @HttpCode(HttpStatus.OK)
  async deleteAssessmentItem(@Param('id', ParseUUIDPipe) id: string, @Query('force') force?: string): Promise<ApiResponse<{ id: string; action: 'DELETED' }>> {
    return { success: true, message: 'Đã xoá câu hỏi đánh giá thành công', data: await this.adminContentService.deleteAssessmentItem(id, force === 'true') };
  }

  // ===================== ASSESSMENT GROUPS =====================

  @Get('assessment-groups')
  async listAssessmentGroups(@Query() query: AdminAssessmentGroupsQueryDto): Promise<ApiResponse<PaginatedResult<AdminAssessmentGroupView>>> {
    return { success: true, data: await this.adminContentService.listAssessmentGroups(query) };
  }

  @Post('assessment-groups')
  @HttpCode(HttpStatus.CREATED)
  async createAssessmentGroup(@Body() dto: CreateAssessmentItemGroupDto): Promise<ApiResponse<AdminAssessmentGroupView>> {
    return { success: true, message: 'Tạo nhóm câu hỏi thành công', data: await this.adminContentService.createAssessmentGroup(dto) };
  }

  @Patch('assessment-groups/:id')
  async updateAssessmentGroup(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAssessmentItemGroupDto): Promise<ApiResponse<AdminAssessmentGroupView>> {
    return { success: true, message: 'Cập nhật nhóm câu hỏi thành công', data: await this.adminContentService.updateAssessmentGroup(id, dto) };
  }

  @Delete('assessment-groups/:id')
  @HttpCode(HttpStatus.OK)
  async deleteAssessmentGroup(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<{ id: string; action: 'DELETED'; detachedItemsCount: number }>> {
    return { success: true, message: 'Đã xoá nhóm câu hỏi thành công', data: await this.adminContentService.deleteAssessmentGroup(id) };
  }

  // ===================== CURATED VOCABULARY =====================

  @Get('vocabulary/topics')
  async listVocabularyTopics(@Query('search') search?: string): Promise<ApiResponse<AdminCuratedTopicView[]>> {
    return { success: true, data: await this.adminVocabularyService.listTopics(search) };
  }

  @Post('vocabulary/topics')
  @HttpCode(HttpStatus.CREATED)
  async createVocabularyTopic(@Body() dto: CreateAdminCuratedTopicDto): Promise<ApiResponse<AdminCuratedTopicView>> {
    return { success: true, message: 'Tạo chủ đề từ vựng thành công', data: await this.adminVocabularyService.createTopic(dto) };
  }

  @Patch('vocabulary/topics/:id')
  async updateVocabularyTopic(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdminCuratedTopicDto): Promise<ApiResponse<AdminCuratedTopicView>> {
    return { success: true, message: 'Cập nhật chủ đề từ vựng thành công', data: await this.adminVocabularyService.updateTopic(id, dto) };
  }

  @Delete('vocabulary/topics/:id')
  @HttpCode(HttpStatus.OK)
  async deleteVocabularyTopic(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<{ id: string; action: 'DELETED'; deletedWordsCount: number }>> {
    return { success: true, message: 'Đã xoá chủ đề từ vựng thành công', data: await this.adminVocabularyService.deleteTopic(id) };
  }

  @Get('vocabulary/topics/:topicId/words')
  async listVocabularyWords(@Param('topicId', ParseUUIDPipe) topicId: string, @Query() query: AdminVocabularyWordsQueryDto): Promise<ApiResponse<PaginatedResult<AdminCuratedWordView>>> {
    return { success: true, data: await this.adminVocabularyService.listTopicWords(topicId, query) };
  }

  @Post('vocabulary/topics/:topicId/words')
  @HttpCode(HttpStatus.CREATED)
  async createVocabularyWord(@Param('topicId', ParseUUIDPipe) topicId: string, @Body() dto: CreateAdminCuratedWordDto): Promise<ApiResponse<AdminCuratedWordView>> {
    return { success: true, message: 'Thêm từ vựng mới thành công', data: await this.adminVocabularyService.createWord(topicId, dto) };
  }

  @Patch('vocabulary/topics/:topicId/words/:wordId')
  async updateVocabularyWord(@Param('topicId', ParseUUIDPipe) topicId: string, @Param('wordId', ParseUUIDPipe) wordId: string, @Body() dto: UpdateAdminCuratedWordDto): Promise<ApiResponse<AdminCuratedWordView>> {
    return { success: true, message: 'Cập nhật từ vựng thành công', data: await this.adminVocabularyService.updateWord(topicId, wordId, dto) };
  }

  @Delete('vocabulary/topics/:topicId/words/:wordId')
  @HttpCode(HttpStatus.OK)
  async deleteVocabularyWord(@Param('topicId', ParseUUIDPipe) topicId: string, @Param('wordId', ParseUUIDPipe) wordId: string): Promise<ApiResponse<{ id: string; action: 'DELETED' }>> {
    return { success: true, message: 'Đã xoá từ vựng thành công', data: await this.adminVocabularyService.deleteWord(topicId, wordId) };
  }

  // ===================== SPEAKING PROMPTS =====================

  @Get('speaking-prompts')
  async listSpeakingPrompts(@Query() query: AdminSpeakingQueryDto): Promise<ApiResponse<PaginatedResult<AdminSpeakingPromptView, SpeakingPromptsSummary>>> {
    return { success: true, data: await this.adminSpeakingService.listPrompts(query) };
  }

  @Post('speaking-prompts')
  @HttpCode(HttpStatus.CREATED)
  async createSpeakingPrompt(@Body() dto: CreateAdminSpeakingPromptDto): Promise<ApiResponse<AdminSpeakingPromptView>> {
    return { success: true, message: 'Tạo đề luyện nói thành công', data: await this.adminSpeakingService.createPrompt(dto) };
  }

  @Patch('speaking-prompts/bulk-publish')
  async bulkPublishSpeakingPrompts(@Body() dto: BulkPublishDto): Promise<ApiResponse<{ updatedCount: number; published: boolean; ids: string[] }>> {
    const data = await this.adminSpeakingService.bulkPublishPrompts(dto);
    return { success: true, message: dto.published ? `Đã xuất bản ${data.updatedCount} đề luyện nói` : `Đã ngừng xuất bản ${data.updatedCount} đề luyện nói`, data };
  }

  @Patch('speaking-prompts/:id')
  async updateSpeakingPrompt(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAdminSpeakingPromptDto): Promise<ApiResponse<AdminSpeakingPromptView>> {
    return { success: true, message: 'Cập nhật đề luyện nói thành công', data: await this.adminSpeakingService.updatePrompt(id, dto) };
  }

  @Delete('speaking-prompts/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSpeakingPrompt(@Param('id', ParseUUIDPipe) id: string, @Query('force') force?: string): Promise<ApiResponse<{ id: string; action: 'DELETED' | 'UNPUBLISHED'; submissionsCount: number }>> {
    const data = await this.adminSpeakingService.deletePrompt(id, force === 'true');
    return { success: true, message: data.action === 'DELETED' ? 'Đã xoá đề luyện nói thành công' : 'Đề luyện nói đã có bài nộp nên được chuyển sang ngừng xuất bản', data };
  }

  // ===================== AUDIT LOGS & EXPORTS =====================

  @Get('audit-logs')
  async listAuditLogs(@Query('page') page?: string, @Query('limit') limit?: string, @Query('adminEmail') adminEmail?: string, @Query('resourceType') resourceType?: string, @Query('action') action?: string, @Query('from') from?: string, @Query('to') to?: string): Promise<ApiResponse<PaginatedResult<AdminAuditLogView>>> {
    return { success: true, data: await this.adminAuditService.listLogs({ page: page ? Number(page) : 1, limit: limit ? Number(limit) : 20, adminEmail, resourceType, action, from, to }) };
  }

  @Get('exports/:entity')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async exportEntity(@Param('entity') entity: string, @Query('format') format: string | undefined, @Res({ passthrough: true }) res: Response): Promise<string> {
    const safeFormat = format === 'csv' ? 'csv' : 'json';
    const result = await this.adminExportService.exportEntity(entity, safeFormat);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
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
  async validateImport(@Body() dto: ContentImportRequestDto): Promise<ApiResponse<ImportValidationResult>> {
    return { success: true, data: await this.adminImportService.validateBundle(dto.bundle, { topicWordsMode: dto.topicWordsMode }) };
  }

  @Post('imports/apply')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async applyImport(@Body() dto: ContentImportRequestDto): Promise<ApiResponse<ImportApplyResult>> {
    const data = await this.adminImportService.applyBundle(dto.bundle, { topicWordsMode: dto.topicWordsMode });
    return { success: true, message: `Đã nạp thành công ${data.preview.totalRecords} bản ghi vào hệ thống`, data };
  }
}
