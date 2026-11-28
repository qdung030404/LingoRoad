import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../vocabulary/vocabulary_word_card.dart';
import 'learning_widgets.dart';
import 'sample_audio.dart';
import 'srs_review_page.dart';
import 'word_library.dart';

class MyWordsTab extends StatefulWidget {
  const MyWordsTab({super.key, required this.library, this.onNavigate});
  final WordLibrary library;
  final ValueChanged<int>? onNavigate;
  @override
  State<MyWordsTab> createState() => _MyWordsTabState();
}

class _MyWordsTabState extends State<MyWordsTab> {
  String search = '';
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.library,
    builder: (context, _) {
      final decks = widget.library.decks
          .where(
            (d) => d.name.toLowerCase().contains(search.trim().toLowerCase()),
          )
          .toList();
      return FigmaPage(
        titleStyle: designHeading(18),
        child: ListView(
          key: const PageStorageKey('preview-content-words'),
          primary: false,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
          children: [
            Row(
              children: [
                Expanded(child: learningHeading('Từ của tôi', size: 36)),
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.grey200),
                  ),
                  child: IconButton(
                    key: const Key('addWordDeck'),
                    tooltip: 'Thêm bộ từ',
                    padding: EdgeInsets.zero,
                    icon: const ColorFiltered(
                      colorFilter: ColorFilter.mode(
                        AppColors.grey900,
                        BlendMode.srcIn,
                      ),
                      child: FigmaAsset('my-words/add', size: 20),
                    ),
                    onPressed: () => _addDeck(context),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            TextField(
              key: const Key('wordDeckSearch'),
              onChanged: (v) => setState(() => search = v),
              style: designText(14),
              decoration: InputDecoration(
                hintText: 'Search',
                hintStyle: designText(14, color: AppColors.grey800),
                prefixIcon: const Padding(
                  padding: EdgeInsets.all(12),
                  child: FigmaAsset('my-words/search', size: 24),
                ),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.grey200),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.grey200),
                ),
              ),
            ),
            const SizedBox(height: 24),
            if (decks.isEmpty)
              Padding(
                padding: const EdgeInsets.all(24),
                child: learningBody('Không tìm thấy bộ từ.'),
              ),
            for (final deck in decks) ...[
              WordDeckCard(
                deck: deck,
                library: widget.library,
                onTap: () => previewPush(
                  context,
                  WordListPage(
                    library: widget.library,
                    deckId: deck.id,
                    onNavigate: widget.onNavigate,
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ],
        ),
      );
    },
  );
  Future<void> _addDeck(BuildContext context) async {
    var input = '';
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Tạo bộ từ'),
        content: TextField(
          onChanged: (value) => input = value,
          autofocus: true,
          maxLength: 60,
          decoration: const InputDecoration(labelText: 'Tên bộ từ'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () {
              if (input.trim().isNotEmpty) {
                Navigator.pop(context, input);
              }
            },
            child: const Text('Tạo'),
          ),
        ],
      ),
    );
    if (name != null) {
      try {
        await widget.library.addDeck(name);
      } catch (_) {
        if (context.mounted) {
          previewMessage(context, 'Không lưu được bộ từ. Vui lòng thử lại.');
        }
      }
    }
  }
}

class WordStatistic extends StatelessWidget {
  const WordStatistic(this.label, this.value, this.icon, {super.key});
  final String label, value, icon;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
    decoration: BoxDecoration(
      color: AppColors.grey25,
      border: Border.all(color: AppColors.grey100),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            FigmaAsset('home-v2/$icon', size: 18),
            const SizedBox(width: 5),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: designText(
                  12,
                  weight: FontWeight.w500,
                  color: AppColors.grey700,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        FittedBox(
          alignment: Alignment.centerLeft,
          fit: BoxFit.scaleDown,
          child: Text(
            value,
            style: designHeading(18).copyWith(
              fontWeight: FontWeight.w700,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ),
      ],
    ),
  );
}

class WordDeckCard extends StatelessWidget {
  const WordDeckCard({
    super.key,
    required this.deck,
    required this.library,
    required this.onTap,
    this.compact = false,
  });
  final WordDeck deck;
  final WordLibrary library;
  final VoidCallback onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    if (compact) {
      final total = deck.words.length;
      final remembered = library.remembered(deck).clamp(0, total);
      final ratio = total > 0 ? (remembered / total).clamp(0.0, 1.0) : 0.0;
      return Material(
        color: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: Color(0xFFE6ECF2)),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF8F2),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.style_rounded,
                    size: 22,
                    color: Color(0xFF1E713B),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              deck.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: designHeading(16.5),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 3.5,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFECF9F0),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              'Tiếp tục học',
                              style: designText(
                                12,
                                weight: FontWeight.w700,
                                color: const Color(0xFF1E713B),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(999),
                              child: LinearProgressIndicator(
                                value: ratio,
                                minHeight: 6.5,
                                backgroundColor: const Color(0xFFEAEFF5),
                                color: const Color(0xFF48A860),
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Text(
                            '$remembered/$total từ',
                            style: designText(
                              13,
                              weight: FontWeight.w500,
                              color: const Color(0xFF657482),
                            ).copyWith(
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 22,
                  color: Color(0xFF94A3B8),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: const Color(0xFFE8E8E9)),
      borderRadius: BorderRadius.circular(12),
      boxShadow: const [
        BoxShadow(
          color: Color(0x0D1A2029),
          blurRadius: 3,
          offset: Offset(0, 1),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: onTap,
          child: Text(deck.name, style: designHeading(20)),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: WordStatistic(
                'Từ',
                '${deck.words.length}',
                'imgVuesaxBulkNote2',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: WordStatistic(
                'Đã nhớ',
                '${library.remembered(deck)}',
                'imgVuesaxBulkTickCircle',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: WordStatistic(
                'Cần ôn',
                '${library.due(deck).length}',
                'imgVuesaxBulkInfoCircle',
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 36,
          width: double.infinity,
          child: ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.grey900,
              foregroundColor: Colors.white,
              padding: EdgeInsets.zero,
            ),
            onPressed: onTap,
            child: Text(
              'Tiếp tục học',
              style: designText(
                12,
                weight: FontWeight.w500,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ],
    ),
  );
  }
}

class WordListPage extends StatelessWidget {
  const WordListPage({
    super.key,
    required this.library,
    required this.deckId,
    this.onNavigate,
  });
  final WordLibrary library;
  final String deckId;
  final ValueChanged<int>? onNavigate;
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: library,
    builder: (context, _) {
      final deck = library.decks.firstWhere((d) => d.id == deckId);
      return PreviewSurface(
        child: FigmaPage(
          titleStyle: designHeading(18),
          title: '',
          trailing: IconButton(
            key: const Key('wordListMore'),
            tooltip: 'Thêm từ',
            icon: const FigmaAsset('word-list/imgVuesaxOutlineMore'),
            onPressed: () => _addWord(context),
          ),
          bottom: CustomAppButton(
            key: const Key('practiceWordDeck'),
            text: 'Luyện tập',
            onPressed: deck.words.isEmpty
                ? null
                : () => previewPush(
                    context,
                    SrsReviewPage(
                      library: library,
                      deckId: deckId,
                      onNavigate: onNavigate,
                    ),
                  ),
          ),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(child: learningHeading(deck.name, size: 32)),
                  const SizedBox(width: 8),
                  Text.rich(
                    TextSpan(
                      style: designText(16, weight: FontWeight.w500),
                      children: [
                        const TextSpan(text: 'List có '),
                        TextSpan(
                          text: '${deck.words.length}',
                          style: const TextStyle(color: AppColors.primary600),
                        ),
                        const TextSpan(text: ' từ'),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              if (deck.words.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 48),
                  child: Column(
                    children: [
                      learningBody('Bộ từ chưa có từ vựng.'),
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: () => _addWord(context),
                        child: const Text('Thêm từ đầu tiên'),
                      ),
                    ],
                  ),
                ),
              for (final word in deck.words) ...[
                _WordCard(word: word),
                const SizedBox(height: 12),
              ],
            ],
          ),
        ),
      );
    },
  );

  Future<void> _addWord(BuildContext context) async {
    var english = '', meaning = '';
    final form = GlobalKey<FormState>();
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Thêm từ'),
        content: SingleChildScrollView(
          child: Form(
            key: form,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  onChanged: (value) => english = value,
                  autofocus: true,
                  maxLength: 60,
                  decoration: const InputDecoration(labelText: 'Từ tiếng Anh'),
                  validator: (v) => v == null || v.trim().isEmpty
                      ? 'Nhập từ tiếng Anh'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  onChanged: (value) => meaning = value,
                  maxLength: 120,
                  decoration: const InputDecoration(
                    labelText: 'Nghĩa tiếng Việt',
                  ),
                  validator: (v) => v == null || v.trim().isEmpty
                      ? 'Nhập nghĩa tiếng Việt'
                      : null,
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () {
              if (form.currentState!.validate()) Navigator.pop(context, true);
            },
            child: const Text('Lưu'),
          ),
        ],
      ),
    );
    if (result == true) {
      try {
        await library.addWord(deckId, english, meaning);
      } catch (_) {
        if (context.mounted) {
          previewMessage(context, 'Không lưu được từ. Vui lòng thử lại.');
        }
      }
    }
  }
}

class _WordCard extends StatelessWidget {
  const _WordCard({required this.word});
  final PreviewWord word;
  @override
  Widget build(BuildContext context) {
    final audioKey = word.word.toLowerCase();
    final hasAudio = [
      'mother',
      'father',
      'sister',
      'brother',
      'parents',
      'grandmother',
      'grandfather',
      'daughter',
      'son',
      'family',
    ].contains(audioKey);

    return VocabularyWordCard(
      english: word.word,
      phonetic: word.phonetic,
      partOfSpeech: 'danh từ',
      meaning: word.meaning,
      example: word.example,
      topAction: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Center(
          child: FigmaAsset('word-list/imgVuesaxOutlineMore', size: 18),
        ),
      ),
      onPlayAudio: () {
        if (hasAudio) {
          previewPush(
            context,
            SampleAudio(
              key: ValueKey(word.id),
              asset: audioKey,
              dark: true,
              label: 'Nghe ${word.word}',
            ),
          );
        } else {
          previewMessage(
            context,
            'Từ này chưa có audio trong bản mẫu.',
          );
        }
      },
    );
  }
}
