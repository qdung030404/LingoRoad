import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AzureBlobStorageService } from './azure-storage.service';
import { CuratedVocabularyService } from './curated-vocabulary.service';
import { VocabularyService } from './vocabulary.service';
import { VocabularyReviewService } from './vocabulary-review.service';
import { CuratedTopicWordsQueryDto, LookupOnlineQueryDto, VocabularyCreateBatchWordsDto, VocabularyCreateDeckDto, VocabularyCreateWordDto, VocabularyListQuery, VocabularyReviewCommandDto, VocabularyStartDto, VocabularySuggestQueryDto, VocabularyUpdateDeckDto, VocabularyUpdateWordDto, VocabularyVersionDto } from './vocabulary.dto';
const response = (data: unknown) => ({ success: true, data });
@Controller('vocabulary')
@UseGuards(JwtAuthGuard)
export class VocabularyController {
  constructor(
    private readonly library: VocabularyService,
    private readonly reviews: VocabularyReviewService,
    private readonly curated: CuratedVocabularyService,
    private readonly azureStorage: AzureBlobStorageService,
  ) { }
  @Public()
  @Get('curated-topics')
  async curatedTopics() {
    return response(await this.curated.listTopics());
  }

  @Public()
  @Get('curated-topics/:slug/words')
  async curatedTopicWords(
    @Param('slug') slug: string,
    @Query() q: CuratedTopicWordsQueryDto,
  ) {
    return response(await this.curated.getTopicWords(slug, q.page, q.limit, q.search));
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('curated-topics/:slug/clone')
  async cloneTopicToDeck(
    @CurrentUser('sub') userId: string,
    @Param('slug') slug: string,
  ) {
    return response(await this.curated.cloneTopicToUserDeck(userId, slug));
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 40, ttl: 60000 } })
  @Get('suggest')
  async suggestOnline(@Query() q: VocabularySuggestQueryDto) {
    const suggestions = await this.curated.suggestOnline(q.query);
    return response({ suggestions });
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('lookup')
  async lookupOnline(@Query() q: LookupOnlineQueryDto) {
    return response(await this.curated.lookupOnline(q.word));
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file?: { buffer: Buffer; originalname?: string; mimetype?: string; size?: number }) {
    const url = await this.azureStorage.uploadImage(file);
    return response({ url });
  }

  @Get('summary') async summary(@CurrentUser('sub') u: string) { return response(await this.library.summary(u)); }
  @Get('decks') async decks(@CurrentUser('sub') u: string, @Query() q: VocabularyListQuery) { return response(await this.library.decks(u, q)); }
  @Post('decks') async createDeck(@CurrentUser('sub') u: string, @Body() d: VocabularyCreateDeckDto) { return response(await this.library.createDeck(u, d)); }
  @Get('decks/:id') async deck(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string) { return response(await this.library.deck(u, id)); }
  @Patch('decks/:id') async updateDeck(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyUpdateDeckDto) { return response(await this.library.updateDeck(u, id, d)); }
  @Delete('decks/:id') async deleteDeck(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyVersionDto) { return response(await this.library.deleteDeck(u, id, d)); }
  @Get('decks/:id/words') async words(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Query() q: VocabularyListQuery) { return response(await this.library.words(u, id, q)); }
  @Post('decks/:id/words') async createWord(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyCreateWordDto) { return response(await this.library.createWord(u, id, d)); }
  @Post('decks/:id/words/batch') async createBatchWords(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyCreateBatchWordsDto) { return response(await this.library.createBatchWords(u, id, d)); }
  @Patch('words/:id') async updateWord(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyUpdateWordDto) { return response(await this.library.updateWord(u, id, d)); }
  @Delete('words/:id') async deleteWord(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyVersionDto) { return response(await this.library.deleteWord(u, id, d)); }
  @Post('decks/:id/reviews') @HttpCode(200) async start(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyStartDto) { return response(await this.reviews.start(u, id, d)); }
  @Get('reviews/:id') async attempt(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string) { return response(await this.reviews.attempt(u, id)); }
  @Post('reviews/:id/commands') @HttpCode(200) async command(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyReviewCommandDto) { return response(await this.reviews.command(u, id, d)); }
  @Get('history') async history(@CurrentUser('sub') u: string, @Query() q: VocabularyListQuery) { return response(await this.reviews.history(u, q)); }
}
