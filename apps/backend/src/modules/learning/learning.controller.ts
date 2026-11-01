import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CheckLearningAnswerDto, LearningCatalogueQuery, LearningHistoryQuery, LearningProgressDto, VersionDto } from './learning.dto';
import { LearningService } from './learning.service';

@Controller('learning')
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get('lessons')
  async catalogue(@CurrentUser('sub') userId: string, @Query() query: LearningCatalogueQuery) {
    return { success: true, data: await this.learning.catalogue(userId, query.kind) };
  }

  @Get('lessons/:lessonId')
  async lesson(@CurrentUser('sub') userId: string, @Param('lessonId', ParseUUIDPipe) lessonId: string) {
    return { success: true, data: await this.learning.lesson(userId, lessonId) };
  }

  @Post('lessons/:lessonId/attempts')
  async start(@CurrentUser('sub') userId: string, @Param('lessonId', ParseUUIDPipe) lessonId: string) {
    return { success: true, data: await this.learning.start(userId, lessonId) };
  }

  @Get('attempts/:attemptId')
  async attempt(@CurrentUser('sub') userId: string, @Param('attemptId', ParseUUIDPipe) attemptId: string) {
    return { success: true, data: await this.learning.attempt(userId, attemptId) };
  }

  @Patch('attempts/:attemptId/progress')
  async progress(@CurrentUser('sub') userId: string, @Param('attemptId', ParseUUIDPipe) attemptId: string, @Body() dto: LearningProgressDto) {
    return { success: true, data: await this.learning.progress(userId, attemptId, dto) };
  }

  @Put('attempts/:attemptId/answers/:questionId/check')
  async check(@CurrentUser('sub') userId: string, @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Param('questionId') questionId: string, @Body() dto: CheckLearningAnswerDto) {
    return { success: true, data: await this.learning.check(userId, attemptId, questionId, dto) };
  }

  @Post('attempts/:attemptId/submit') @HttpCode(200)
  async submit(@CurrentUser('sub') userId: string, @Param('attemptId', ParseUUIDPipe) attemptId: string, @Body() dto: VersionDto) {
    return { success: true, data: await this.learning.submit(userId, attemptId, dto.expectedVersion) };
  }

  @Get('history')
  async history(@CurrentUser('sub') userId: string, @Query() query: LearningHistoryQuery) {
    return { success: true, data: await this.learning.history(userId, query.cursor, query.limit) };
  }

  @Get('summary')
  async summary(@CurrentUser('sub') userId: string) {
    return { success: true, data: await this.learning.summary(userId) };
  }
}
