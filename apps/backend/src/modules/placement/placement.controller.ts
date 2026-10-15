import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import { GetPlacementStatusUseCase } from './use-cases/get-placement-status.use-case';
import { StartAssessmentUseCase } from './use-cases/start-assessment.use-case';
import { SubmitAnswerUseCase } from './use-cases/submit-answer.use-case';
import { GetAssessmentResultUseCase } from './use-cases/get-assessment-result.use-case';
import { ImportItemsUseCase, ImportItemsResult } from './use-cases/import-items.use-case';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { PlacementStatusResponseDto } from './dto/placement-status-response.dto';
import { StartAssessmentResponseDto } from './dto/start-assessment-response.dto';
import { SubmitAnswerResponseDto } from './dto/submit-answer-response.dto';
import { PlacementResultDto } from './dto/placement-result.dto';
import { RawItemDto } from './dto/import-items.dto';
import { InternalAuthGuard } from './guards/internal-auth.guard';

@Controller('placement')
@UseGuards(JwtAuthGuard)
export class PlacementController {
  constructor(
    private readonly getStatusUseCase: GetPlacementStatusUseCase,
    private readonly startAssessmentUseCase: StartAssessmentUseCase,
    private readonly submitAnswerUseCase: SubmitAnswerUseCase,
    private readonly getResultUseCase: GetAssessmentResultUseCase,
    private readonly importItemsUseCase: ImportItemsUseCase,
  ) {}

  @Public()
  @UseGuards(InternalAuthGuard)
  @Post('items/import')
  @HttpCode(HttpStatus.OK)
  async importItems(@Body() items: RawItemDto[]): Promise<ApiResponse<ImportItemsResult>> {
    const data = await this.importItemsUseCase.execute(items);
    return {
      success: true,
      message: `Đã nạp thành công ${data.importedCount} câu hỏi vào Database`,
      data,
    };
  }

  @Get('status')
  async getStatus(@CurrentUser('sub') userId: string): Promise<ApiResponse<PlacementStatusResponseDto>> {
    const data = await this.getStatusUseCase.execute(userId);
    return {
      success: true,
      data,
    };
  }

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  async start(@CurrentUser('sub') userId: string): Promise<ApiResponse<StartAssessmentResponseDto>> {
    const data = await this.startAssessmentUseCase.execute(userId);
    return {
      success: true,
      message: data.isResumed ? 'Khôi phục phiên kiểm tra đang làm dở' : 'Bắt đầu bài kiểm tra đầu vào',
      data,
    };
  }

  @Post(':sessionId/answer')
  @HttpCode(HttpStatus.OK)
  async submitAnswer(
    @CurrentUser('sub') userId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: SubmitAnswerDto,
  ): Promise<ApiResponse<SubmitAnswerResponseDto>> {
    const data = await this.submitAnswerUseCase.execute(userId, sessionId, dto);
    return {
      success: true,
      data,
    };
  }

  @Get(':sessionId/result')
  async getResult(
    @CurrentUser('sub') userId: string,
    @Param('sessionId') sessionId: string,
  ): Promise<ApiResponse<PlacementResultDto>> {
    const data = await this.getResultUseCase.execute(userId, sessionId);
    return {
      success: true,
      data,
    };
  }
}
