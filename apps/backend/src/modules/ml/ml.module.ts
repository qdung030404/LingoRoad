import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { MlClientService } from './ml-client.service';
import { InProcessCatFallback } from './fallbacks/in-process-cat.fallback';

@Global()
@Module({
  imports: [
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 3,
    }),
    ConfigModule,
  ],
  providers: [MlClientService, InProcessCatFallback],
  exports: [MlClientService, InProcessCatFallback],
})
export class MlModule {}
