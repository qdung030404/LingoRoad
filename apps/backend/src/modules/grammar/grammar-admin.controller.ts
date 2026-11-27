import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  CreateGrammarTopicDto,
  GrammarPrerequisiteEdgeDto,
  UpdateGrammarTopicDto,
} from './dto/grammar-admin.dto';
import { GrammarDagService } from './services/grammar-dag.service';

@Controller(['api/v1/admin/grammar', 'admin/grammar'])
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class GrammarAdminController {
  constructor(private readonly dagService: GrammarDagService) {}

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
