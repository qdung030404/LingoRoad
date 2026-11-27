import { Global, Module } from '@nestjs/common';
import { MediaProxyController } from './media-proxy.controller';
import { MediaStorageService } from './media-storage.service';

@Global()
@Module({
  controllers: [MediaProxyController],
  providers: [MediaStorageService],
  exports: [MediaStorageService],
})
export class MediaModule {}
