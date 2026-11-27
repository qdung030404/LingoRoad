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
import { CefrLevel } from '@prisma/client';
import { AdminJwtGuard } from '../admin/guards/admin-jwt.guard';
import { AdminAuditInterceptor } from '../admin/interceptors/admin-audit.interceptor';
import {
  CreateGrammarTopicDto,
  GrammarPrerequisiteEdgeDto,
  UpdateGrammarTopicDto,
} from './dto/grammar-admin.dto';
import { GrammarDagService } from './services/grammar-dag.service';

@Controller(['api/v1/admin/grammar', 'admin/grammar'])
@UseGuards(AdminJwtGuard)
@UseInterceptors(AdminAuditInterceptor)
export class GrammarAdminController {
  constructor(private readonly dagService: GrammarDagService) {}

  @Get('topics')
  @HttpCode(HttpStatus.OK)
  async listTopics(
    @Query('cefrLevel') cefrLevel?: CefrLevel,
    @Query('search') search?: string,
    @Query('published') published?: string,
    @Query('isLeaf') isLeaf?: string,
  ) {
    return {
      success: true,
      data: await this.dagService.listAdminTopics({
        cefrLevel: cefrLevel && Object.values(CefrLevel).includes(cefrLevel) ? cefrLevel : undefined,
        search,
        published,
        isLeaf,
      }),
    };
  }

  @Post('topics')
  @HttpCode(HttpStatus.CREATED)
  async createTopic(@Body() dto: CreateGrammarTopicDto) {
    return {
      success: true,
      data: await this.dagService.createTopic(dto),
    };
  }

  @Patch('topics/:id')
  @HttpCode(HttpStatus.OK)
  async updateTopic(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGrammarTopicDto,
  ) {
    return {
      success: true,
      data: await this.dagService.updateTopic(id, dto),
    };
  }

  @Delete('topics/:id')
  @HttpCode(HttpStatus.OK)
  async deleteTopic(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      data: await this.dagService.deleteTopic(id),
    };
  }

  @Post('prerequisites')
  @HttpCode(HttpStatus.CREATED)
  async addPrerequisite(@Body() dto: GrammarPrerequisiteEdgeDto) {
    return {
      success: true,
      data: await this.dagService.addPrerequisite(dto),
    };
  }

  @Delete('prerequisites')
  @HttpCode(HttpStatus.OK)
  async removePrerequisite(@Body() dto: GrammarPrerequisiteEdgeDto) {
    return {
      success: true,
      data: await this.dagService.removePrerequisite(dto),
    };
  }
}
