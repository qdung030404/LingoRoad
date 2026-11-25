import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GrammarAdminController } from './grammar-admin.controller';
import { GrammarController } from './grammar.controller';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { GrammarCatalogService } from './services/grammar-catalog.service';
import { GrammarDagService } from './services/grammar-dag.service';

@Module({
  imports: [PrismaModule],
  controllers: [GrammarController, GrammarAdminController],
  providers: [GrammarCatalogService, GrammarDagService, OptionalJwtAuthGuard],
  exports: [GrammarCatalogService, GrammarDagService],
})
export class GrammarModule {}
