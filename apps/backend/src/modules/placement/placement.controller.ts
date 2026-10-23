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
import { SubmitAnswerDto } from './interfaces/placement.interface';
import { DemoPlacementService } from './services/demo-placement.service';

@Controller('placement')
@UseGuards(JwtAuthGuard)
export class PlacementController {
  constructor(
    private readonly placement: DemoPlacementService,
  ) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  async start(
    @CurrentUser('sub') userId: string,
  ) {
    const result = await this.placement.start(userId);
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
  ) {
    const result = await this.placement.status(userId);
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
    @CurrentUser('sub') userId: string,
  ) {
    const result = await this.placement.answer(sessionId, userId, dto);
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
  ) {
    const result = await this.placement.result(
      sessionId,
      userId,
    );
    return {
      success: true,
      data: result,
    };
  }

  @Get(':sessionId/review')
  async review(@Param('sessionId', ParseUUIDPipe) sessionId: string, @CurrentUser('sub') userId: string) {
    return { success: true, data: await this.placement.review(sessionId, userId) };
  }
}
