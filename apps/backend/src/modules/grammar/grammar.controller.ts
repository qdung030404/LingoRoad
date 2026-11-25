import { Controller, Get, HttpCode, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  GrammarPracticeItemsQueryDto,
  GrammarTopicsQueryDto,
  GrammarTreeQueryDto,
} from './dto/grammar-query.dto';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { GrammarCatalogService } from './services/grammar-catalog.service';

@Controller(['api/v1/grammar', 'grammar'])
@UseGuards(ThrottlerGuard)
export class GrammarController {
  constructor(private readonly catalog: GrammarCatalogService) {}

  @Get('levels')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getLevels(@CurrentUser('sub') userId?: string | null) {
    return {
      success: true,
      data: await this.catalog.getLevelsOverview(userId ?? undefined),
    };
  }

  @Get('tree')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getTree(
    @Query() query: GrammarTreeQueryDto,
    @CurrentUser('sub') userId?: string | null,
  ) {
    return {
      success: true,
      data: await this.catalog.getGrammarTree(query, userId ?? undefined),
    };
  }

  @Get('topics')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async listTopics(
    @Query() query: GrammarTopicsQueryDto,
    @CurrentUser('sub') userId?: string | null,
  ) {
    const result = await this.catalog.listTopics(query, userId ?? undefined);
    return {
      success: true,
      data: { items: result.items },
      meta: result.meta,
    };
  }

  @Get('topics/:code')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getTopicDetail(
    @Param('code') code: string,
    @CurrentUser('sub') userId?: string | null,
  ) {
    return {
      success: true,
      data: await this.catalog.getTopicDetail(code, userId ?? undefined),
    };
  }

  @Get('topics/:code/practice-items')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getPracticeItems(
    @Param('code') code: string,
    @Query() query: GrammarPracticeItemsQueryDto,
  ) {
    const result = await this.catalog.getTopicPracticeItems(code, query);
    return {
      success: true,
      data: {
        topicCode: result.topicCode,
        cefrLevel: result.cefrLevel,
        items: result.items,
      },
      meta: result.meta,
    };
  }
}
