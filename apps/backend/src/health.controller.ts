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
      await this.prisma.$queryRaw`SELECT 1`;
      return { success: true, data: { status: 'ok', database: 'ready' } };
    } catch {
      throw new ServiceUnavailableException({ code: 'DATABASE_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' });
    }
  }
}
