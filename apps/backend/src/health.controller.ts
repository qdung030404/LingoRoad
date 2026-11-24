import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './modules/prisma/prisma.service';
import { Public } from './common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
      return { success: true, data: { status: 'ok', database: 'ready', schema: 'ready' } };
    } catch {
      throw new ServiceUnavailableException({ code: 'DATABASE_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }
  }
}
