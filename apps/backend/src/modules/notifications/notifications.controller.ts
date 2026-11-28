import { Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationListQuery } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@CurrentUser('sub') userId: string, @Query() query: NotificationListQuery) {
    return { success: true, data: await this.notifications.list(userId, query) };
  }

  @Patch(':id/read')
  async markRead(@CurrentUser('sub') userId: string, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.notifications.markRead(userId, id) };
  }

  @Post('read-all')
  @HttpCode(200)
  async markAllRead(@CurrentUser('sub') userId: string) {
    return { success: true, data: await this.notifications.markAllRead(userId) };
  }
}
