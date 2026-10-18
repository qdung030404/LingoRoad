import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiResponse } from '../../common/interfaces/api-response.interface';
import {
  PlacementResult,
  PlacementStatusResult,
  StartPlacementResult,
  SubmitAnswerDto,
  SubmitAnswerResult,
} from './interfaces/placement.interface';
import { StartPlacementUseCase } from './use-cases/start-placement.use-case';
import { GetPlacementStatusUseCase } from './use-cases/get-placement-status.use-case';
import { GetPlacementResultUseCase } from './use-cases/get-placement-result.use-case';
import { SubmitAnswerUseCase } from './use-cases/submit-answer.use-case';

@Controller('placement')
@UseGuards(JwtAuthGuard)
export class PlacementController {
  constructor(
    private readonly startPlacementUseCase: StartPlacementUseCase,
    private readonly getPlacementStatusUseCase: GetPlacementStatusUseCase,
    private readonly getPlacementResultUseCase: GetPlacementResultUseCase,
    private readonly submitAnswerUseCase: SubmitAnswerUseCase,
  ) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  async start(
    @CurrentUser('sub') userId: string,
  ): Promise<ApiResponse<StartPlacementResult>> {
    const result = await this.startPlacementUseCase.execute(userId);
    return {
      success: true,
      message: 'Khởi tạo phiên kiểm tra thành công',
      data: result,
    };
  }

  @Get('status')
  @HttpCode(HttpStatus.OK)
  async getStatus(
    @CurrentUser('sub') userId: string,
  ): Promise<ApiResponse<PlacementStatusResult>> {
    const result = await this.getPlacementStatusUseCase.execute(userId);
    return {
      success: true,
      data: result,
    };
  }

  @Post(':sessionId/answer')
  @HttpCode(HttpStatus.OK)
  async submitAnswer(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Body() dto: SubmitAnswerDto,
  ): Promise<ApiResponse<SubmitAnswerResult>> {
    const result = await this.submitAnswerUseCase.execute(sessionId, dto);
    return {
      success: true,
      data: result,
    };
  }

  @Get(':sessionId/result')
  @HttpCode(HttpStatus.OK)
  async getResult(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @CurrentUser('sub') userId: string,
  ): Promise<ApiResponse<PlacementResult>> {
    const result = await this.getPlacementResultUseCase.execute(
      sessionId,
      userId,
    );
    return {
      success: true,
      data: result,
    };
  }
}
