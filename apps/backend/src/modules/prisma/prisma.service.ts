import { Injectable, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { attachPrismaSqlTiming, isSqlTimingEnabled } from './sql-timing';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  constructor(@Optional() options?: Prisma.PrismaClientOptions) {
    super(options);
    if (isSqlTimingEnabled()) {
      attachPrismaSqlTiming(this);
    }
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
