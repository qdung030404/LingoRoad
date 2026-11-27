import { Controller, Get, Optional, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './modules/prisma/prisma.service';
import { Public } from './common/decorators/public.decorator';
import { MediaStorageService } from './modules/media/media-storage.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly mediaStorage?: MediaStorageService,
  ) {}

  @Public()
  @Get()
  async health() {
    try {
      // LIMIT 0 checks the schema even when these tables contain no rows.
      await this.prisma.$queryRaw`
        SELECT (SELECT history_hidden_at FROM public.learning_attempts LIMIT 0),
               (SELECT history_hidden_at FROM public.speaking_submissions LIMIT 0),
               (SELECT history_hidden_at FROM public.voice_conversations LIMIT 0)
      `;
      const version =
        this.configService?.get<string>('APP_VERSION')?.trim() ||
        process.env.APP_VERSION?.trim() ||
        '1.0.0';
      return {
        success: true,
        data: {
          status: 'ok',
          service: 'backend',
          version,
          storage: this.mediaStorage?.storageMode() ?? 'local',
          database: 'ready',
          schema: 'ready',
          timestamp: new Date().toISOString(),
        },
      };
    } catch {
      throw new ServiceUnavailableException({ code: 'DATABASE_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }
  }
}
