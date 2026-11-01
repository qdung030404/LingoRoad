import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FirebaseTokenService } from './firebase-token.service';
import { FirebaseUserService } from './firebase-user.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [FirebaseTokenService, FirebaseUserService],
  exports: [FirebaseTokenService, FirebaseUserService],
})
export class FirebaseAuthModule {}
