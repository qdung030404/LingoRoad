import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VocabularyService } from './vocabulary.service';
import { VocabularyReviewService } from './vocabulary-review.service';
import { VocabularyCreateDeckDto, VocabularyCreateWordDto, VocabularyListQuery, VocabularyReviewCommandDto, VocabularyStartDto, VocabularyUpdateDeckDto, VocabularyUpdateWordDto, VocabularyVersionDto } from './vocabulary.dto';
const response = (data: unknown) => ({ success: true, data });
@Controller('vocabulary')
@UseGuards(JwtAuthGuard)
export class VocabularyController {
  constructor(private readonly library: VocabularyService, private readonly reviews: VocabularyReviewService) {}
  @Get('summary') async summary(@CurrentUser('sub') u: string) { return response(await this.library.summary(u)); }
  @Get('decks') async decks(@CurrentUser('sub') u: string, @Query() q: VocabularyListQuery) { return response(await this.library.decks(u, q)); }
  @Post('decks') async createDeck(@CurrentUser('sub') u: string, @Body() d: VocabularyCreateDeckDto) { return response(await this.library.createDeck(u, d)); }
  @Get('decks/:id') async deck(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string) { return response(await this.library.deck(u, id)); }
  @Patch('decks/:id') async updateDeck(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyUpdateDeckDto) { return response(await this.library.updateDeck(u, id, d)); }
  @Delete('decks/:id') async deleteDeck(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyVersionDto) { return response(await this.library.updateDeck(u, id, d, true)); }
  @Get('decks/:id/words') async words(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Query() q: VocabularyListQuery) { return response(await this.library.words(u, id, q)); }
  @Post('decks/:id/words') async createWord(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyCreateWordDto) { return response(await this.library.createWord(u, id, d)); }
  @Patch('words/:id') async updateWord(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyUpdateWordDto) { return response(await this.library.updateWord(u, id, d)); }
  @Delete('words/:id') async deleteWord(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyVersionDto) { return response(await this.library.updateWord(u, id, d, true)); }
  @Post('decks/:id/reviews') @HttpCode(200) async start(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyStartDto) { return response(await this.reviews.start(u, id, d)); }
  @Get('reviews/:id') async attempt(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string) { return response(await this.reviews.attempt(u, id)); }
  @Post('reviews/:id/commands') @HttpCode(200) async command(@CurrentUser('sub') u: string, @Param('id', ParseUUIDPipe) id: string, @Body() d: VocabularyReviewCommandDto) { return response(await this.reviews.command(u, id, d)); }
  @Get('history') async history(@CurrentUser('sub') u: string, @Query() q: VocabularyListQuery) { return response(await this.reviews.history(u, q)); }
}
