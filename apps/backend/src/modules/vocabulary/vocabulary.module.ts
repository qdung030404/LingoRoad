import { Module } from '@nestjs/common';
import { AzureBlobStorageService } from './azure-storage.service';
import { CuratedVocabularyService } from './curated-vocabulary.service';
import { VocabularyCommandService } from './vocabulary-command.service';
import { VocabularyController } from './vocabulary.controller';
import { VocabularyReviewService } from './vocabulary-review.service';
import { VocabularyService } from './vocabulary.service';
@Module({
  controllers: [VocabularyController],
  providers: [VocabularyService, VocabularyReviewService, VocabularyCommandService, CuratedVocabularyService, AzureBlobStorageService],
  exports: [VocabularyService, CuratedVocabularyService, AzureBlobStorageService],
})
export class VocabularyModule {}
