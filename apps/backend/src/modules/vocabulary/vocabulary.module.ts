import { Module } from '@nestjs/common';
import { VocabularyCommandService } from './vocabulary-command.service';
import { VocabularyController } from './vocabulary.controller';
import { VocabularyReviewService } from './vocabulary-review.service';
import { VocabularyService } from './vocabulary.service';
@Module({ controllers: [VocabularyController], providers: [VocabularyService, VocabularyReviewService, VocabularyCommandService] })
export class VocabularyModule {}
