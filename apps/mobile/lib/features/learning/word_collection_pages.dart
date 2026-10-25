import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
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
    padding: const EdgeInsets.all(8),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: AppColors.grey100),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            FigmaAsset('home-v2/$icon', size: 20),
            const SizedBox(width: 4),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: designText(14, weight: FontWeight.w500),
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(value, style: designHeading(18)),
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
  });
  final WordDeck deck;
  final WordLibrary library;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Container(
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
    final split = word.example.toLowerCase().indexOf(word.word.toLowerCase());
    final prefix = split >= 0
        ? word.example.substring(0, split + word.word.length)
        : '';
    final suffix = split >= 0
        ? word.example.substring(split + word.word.length)
        : word.example;
    return FigmaCard(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: const FigmaAsset(
              'word-list/imgFrame',
              width: double.infinity,
              height: 160,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    learningHeading(word.word, size: 24),
                    if (word.phonetic.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      learningBody('${word.phonetic} · danh từ', size: 14),
                    ],
                    const SizedBox(height: 8),
                    Text(
                      'Định nghĩa : ${word.meaning}',
                      style: designText(16, height: 1.5),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (hasAudio)
                SampleAudio(
                  key: ValueKey(word.id),
                  asset: audioKey,
                  dark: true,
                  label: 'Nghe ${word.word}',
                )
              else
                IconButton(
                  tooltip: 'Phát âm',
                  onPressed: () => previewMessage(
                    context,
                    'Từ này chưa có audio trong bản mẫu.',
                  ),
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.grey900,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(48, 48),
                  ),
                  icon: const FigmaAsset(
                    'word-list/imgVuesaxLinearVolumeHigh',
                    size: 20,
                  ),
                ),
            ],
          ),
          if (word.example.isNotEmpty) ...[
            const Divider(height: 32, color: AppColors.grey100),
            Text.rich(
              TextSpan(
                style: designText(16),
                children: [
                  TextSpan(
                    text: prefix,
                    style: const TextStyle(
                      color: AppColors.primary500,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                  TextSpan(text: suffix),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
