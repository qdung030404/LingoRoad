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
import { BulkPublishDto } from '../dto/admin-content.dto';
import {
  AdminSpeakingQueryDto,
  CreateAdminSpeakingPromptDto,
  UpdateAdminSpeakingPromptDto,
} from '../dto/admin-speaking.dto';
import {
  AdminVocabularyWordsQueryDto,
  CreateAdminCuratedTopicDto,
  CreateAdminCuratedWordDto,
  UpdateAdminCuratedTopicDto,
  UpdateAdminCuratedWordDto,
} from '../dto/admin-vocabulary.dto';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminAuditInterceptor } from '../interceptors/admin-audit.interceptor';
import {
  AdminSpeakingPromptView,
  AdminSpeakingService,
  SpeakingPromptsSummary,
} from '../services/admin-speaking.service';
import { PaginatedResult } from '../services/admin-users.service';
import {
  AdminCuratedTopicView,
  AdminCuratedWordView,
  AdminVocabularyService,
} from '../services/admin-vocabulary.service';

@Controller(['admin', 'api/v1/admin'])
@UseGuards(AdminJwtGuard)
@UseInterceptors(AdminAuditInterceptor)
export class AdminVocabularySpeakingController {
  constructor(
    private readonly adminVocabularyService: AdminVocabularyService,
    private readonly adminSpeakingService: AdminSpeakingService,
  ) {}

  // ===================== CURATED VOCABULARY =====================

  @Get('vocabulary/topics')
  async listVocabularyTopics(
    @Query('search') search?: string,
  ): Promise<ApiResponse<AdminCuratedTopicView[]>> {
    const data = await this.adminVocabularyService.listTopics(search);
    return {
      success: true,
      data,
    };
  }

  @Post('vocabulary/topics')
  @HttpCode(HttpStatus.CREATED)
  async createVocabularyTopic(
    @Body() dto: CreateAdminCuratedTopicDto,
  ): Promise<ApiResponse<AdminCuratedTopicView>> {
    const data = await this.adminVocabularyService.createTopic(dto);
    return {
      success: true,
      message: 'Tạo chủ đề từ vựng thành công',
      data,
    };
  }

  @Patch('vocabulary/topics/:id')
  async updateVocabularyTopic(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminCuratedTopicDto,
  ): Promise<ApiResponse<AdminCuratedTopicView>> {
    const data = await this.adminVocabularyService.updateTopic(id, dto);
    return {
      success: true,
      message: 'Cập nhật chủ đề từ vựng thành công',
      data,
    };
  }

  @Delete('vocabulary/topics/:id')
  @HttpCode(HttpStatus.OK)
  async deleteVocabularyTopic(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<
    ApiResponse<{ id: string; action: 'DELETED'; deletedWordsCount: number }>
  > {
    const data = await this.adminVocabularyService.deleteTopic(id);
    return {
      success: true,
      message: 'Đã xoá chủ đề từ vựng thành công',
      data,
    };
  }

  @Get('vocabulary/topics/:topicId/words')
  async listVocabularyWords(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Query() query: AdminVocabularyWordsQueryDto,
  ): Promise<ApiResponse<PaginatedResult<AdminCuratedWordView>>> {
    const data = await this.adminVocabularyService.listTopicWords(
      topicId,
      query,
    );
    return {
      success: true,
      data,
    };
  }

  @Post('vocabulary/topics/:topicId/words')
  @HttpCode(HttpStatus.CREATED)
  async createVocabularyWord(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Body() dto: CreateAdminCuratedWordDto,
  ): Promise<ApiResponse<AdminCuratedWordView>> {
    const data = await this.adminVocabularyService.createWord(topicId, dto);
    return {
      success: true,
      message: 'Thêm từ vựng mới thành công',
      data,
    };
  }

  @Patch('vocabulary/topics/:topicId/words/:wordId')
  async updateVocabularyWord(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Param('wordId', ParseUUIDPipe) wordId: string,
    @Body() dto: UpdateAdminCuratedWordDto,
  ): Promise<ApiResponse<AdminCuratedWordView>> {
    const data = await this.adminVocabularyService.updateWord(
      topicId,
      wordId,
      dto,
    );
    return {
      success: true,
      message: 'Cập nhật từ vựng thành công',
      data,
    };
  }

  @Delete('vocabulary/topics/:topicId/words/:wordId')
  @HttpCode(HttpStatus.OK)
  async deleteVocabularyWord(
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Param('wordId', ParseUUIDPipe) wordId: string,
  ): Promise<ApiResponse<{ id: string; action: 'DELETED' }>> {
    const data = await this.adminVocabularyService.deleteWord(topicId, wordId);
    return {
      success: true,
      message: 'Đã xoá từ vựng thành công',
      data,
    };
  }

  // ===================== SPEAKING PROMPTS =====================

  @Get('speaking-prompts')
  async listSpeakingPrompts(
    @Query() query: AdminSpeakingQueryDto,
  ): Promise<
    ApiResponse<PaginatedResult<AdminSpeakingPromptView, SpeakingPromptsSummary>>
  > {
    const data = await this.adminSpeakingService.listPrompts(query);
    return {
      success: true,
      data,
    };
  }

  @Post('speaking-prompts')
  @HttpCode(HttpStatus.CREATED)
  async createSpeakingPrompt(
    @Body() dto: CreateAdminSpeakingPromptDto,
  ): Promise<ApiResponse<AdminSpeakingPromptView>> {
    const data = await this.adminSpeakingService.createPrompt(dto);
    return {
      success: true,
      message: 'Tạo đề luyện nói thành công',
      data,
    };
  }

  @Patch('speaking-prompts/bulk-publish')
  async bulkPublishSpeakingPrompts(
    @Body() dto: BulkPublishDto,
  ): Promise<
    ApiResponse<{ updatedCount: number; published: boolean; ids: string[] }>
  > {
    const data = await this.adminSpeakingService.bulkPublishPrompts(dto);
    return {
      success: true,
      message: dto.published
        ? `Đã xuất bản ${data.updatedCount} đề luyện nói`
        : `Đã ngừng xuất bản ${data.updatedCount} đề luyện nói`,
      data,
    };
  }

  @Patch('speaking-prompts/:id')
  async updateSpeakingPrompt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminSpeakingPromptDto,
  ): Promise<ApiResponse<AdminSpeakingPromptView>> {
    const data = await this.adminSpeakingService.updatePrompt(id, dto);
    return {
      success: true,
      message: 'Cập nhật đề luyện nói thành công',
      data,
    };
  }

  @Delete('speaking-prompts/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSpeakingPrompt(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('force') force?: string,
  ): Promise<
    ApiResponse<{
      id: string;
      action: 'DELETED' | 'UNPUBLISHED';
      submissionsCount: number;
    }>
  > {
    const data = await this.adminSpeakingService.deletePrompt(
      id,
      force === 'true',
    );
    return {
      success: true,
      message:
        data.action === 'DELETED'
          ? 'Đã xoá đề luyện nói thành công'
          : 'Đề luyện nói đã có bài nộp nên được chuyển sang ngừng xuất bản',
      data,
    };
  }
}
