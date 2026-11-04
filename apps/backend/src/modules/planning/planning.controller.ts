import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ActivityBatchDto, LearningPreferencesDto, OpenActivityDto } from './planning.dto';
import { PlanningService } from './planning.service';

@Controller('learning') @UseGuards(JwtAuthGuard)
export class PlanningController {
  constructor(private readonly planning: PlanningService) {}
  @Get('preferences') async preferences(@CurrentUser('sub') userId: string) { return { success: true, data: await this.planning.preferences(userId) }; }
  @Patch('preferences') async update(@CurrentUser('sub') userId: string, @Body() dto: LearningPreferencesDto) { return { success: true, data: await this.planning.updatePreferences(userId, dto) }; }
  @Post('plan/today') @HttpCode(200) async ensure(@CurrentUser('sub') userId: string) { return { success: true, data: await this.planning.ensureToday(userId) }; }
  @Get('plan/today') async today(@CurrentUser('sub') userId: string) { return { success: true, data: await this.planning.today(userId) }; }
  @Get('progress') async progress(@CurrentUser('sub') userId: string) { return { success: true, data: await this.planning.progress(userId) }; }
  @Post('attempts/:attemptId/activity-sessions') @HttpCode(200)
  async open(@CurrentUser('sub') userId: string, @Param('attemptId', ParseUUIDPipe) attemptId: string, @Body() dto: OpenActivityDto) {
    return { success: true, data: await this.planning.openActivity(userId, attemptId, dto.clientRunId) };
  }
  @Post('activity-sessions/:sessionId/segments') @HttpCode(200)
  async segments(@CurrentUser('sub') userId: string, @Param('sessionId', ParseUUIDPipe) sessionId: string, @Body() dto: ActivityBatchDto) {
    return { success: true, data: await this.planning.segments(userId, sessionId, dto) };
  }
}
