import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../learning/learning_widgets.dart';
import '../learning/learning_pages.dart' show LearningError;
import '../learning/vocabulary_summary.dart';
import 'vocabulary_controller.dart';
import 'vocabulary_models.dart';
import 'vocabulary_review_page.dart';

Future<void> openVocabularyReview(
  BuildContext context,
  VocabularyController controller,
  String deckId, {
  String scope = 'NEEDS_REVIEW',
}) async {
  try {
    final attempt = await controller.startReview(deckId, scope: scope);
    if (!context.mounted || !controller.active) return;
    if (attempt == null) {
      if (scope == 'ALL') {
        previewMessage(context, 'Bộ từ chưa có từ để ôn.');
        await controller.refresh();
        return;
      }
      final all = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Không còn từ cần ôn'),
          content: const Text('Bạn có thể ôn lại tất cả từ trong bộ này.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Đóng'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Ôn tất cả'),
            ),
          ],
        ),
      );
      if (all == true && context.mounted) {
        await openVocabularyReview(context, controller, deckId, scope: 'ALL');
      }
      return;
    }
    await previewPush(
      context,
      VocabularyReviewPage(controller: controller, attemptId: attempt.id),
    );
    if (controller.active) await controller.refresh();
  } catch (e) {
    if (context.mounted && controller.active) {
      previewMessage(context, controller.message(e));
    }
  }
}

class VocabularyHomeSection extends StatelessWidget {
  const VocabularyHomeSection({
    super.key,
    required this.controller,
    required this.onWords,
    required this.onDeck,
    required this.onReview,
  });
  final VocabularyController controller;
  final VoidCallback onWords, onReview;
  final ValueChanged<String> onDeck;
  Future<void> review(BuildContext context) async {
    try {
      String? cursor;
      do {
        final history = await controller.history(cursor: cursor);
        if (!controller.active || !context.mounted) return;
        for (final row in vocabularyItems(history['items'])) {
          if (row['status'] == 'IN_PROGRESS') {
            await previewPush(
              context,
              VocabularyReviewPage(
                controller: controller,
                attemptId: row['id'] as String,
              ),
            );
            return;
          }
        }
        cursor = history['nextCursor'] as String?;
      } while (cursor != null);
      if (controller.active) onReview();
    } catch (e) {
      if (context.mounted) previewMessage(context, controller.message(e));
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) {
      final data = controller.summary;
      if (data == null) {
        return LearningCard(
          children: [
            learningHeading('Từ của tôi', size: 24),
            if (controller.loading)
              const Center(child: CircularProgressIndicator()),
            if (controller.error != null)
              LearningError(controller.error!, retry: controller.refresh),
          ],
        );
      }
      final totals = vocabularyJson(data['totals']);
      return Column(
        children: [
          if (controller.stale)
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text('Dữ liệu đã lưu · chưa đồng bộ'),
            ),
          if (controller.error != null)
            LearningError(controller.error!, retry: controller.refresh),
          VocabularySummary(
            totalWords: (totals['totalWords'] as num).toInt(),
            rememberedWords: (totals['rememberedWords'] as num).toInt(),
            realData: true,
            onWords: onWords,
            onReview: () => review(context),
            decks: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
              child: Column(
                children: [
                  if (vocabularyItems(data['decks']).isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(12),
                      child: Text('Tạo bộ từ đầu tiên để bắt đầu.'),
                    ),
                  Align(
                    alignment: Alignment.centerRight,
                    child: OutlinedButton(
                      onPressed: onWords,
                      child: const Text('Xem tất cả'),
                    ),
                  ),
                  for (final row in vocabularyItems(data['decks'])) ...[
                    const SizedBox(height: 12),
                    VocabularyDeckCard(
                      deck: VocabularyDeck(row),
                      onTap: () => onDeck(row['id'] as String),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      );
    },
  );
}

class VocabularyDeckCard extends StatelessWidget {
  const VocabularyDeckCard({
    super.key,
    required this.deck,
    required this.onTap,
  });
  final VocabularyDeck deck;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => LearningCard(
    children: [
      InkWell(
        key: ValueKey('vocabulary-deck-${deck.id}'),
        onTap: onTap,
        child: SizedBox(
          width: double.infinity,
          child: learningHeading(deck.name, size: 22),
        ),
      ),
      Row(
        children: [
          for (final metric in [
            ('Từ', deck.totalWords),
            ('Đã nhớ', deck.rememberedWords),
            ('Cần ôn', deck.needsReviewWords),
          ])
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFFE1E7EF)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(metric.$1, style: designText(12)),
                      const SizedBox(height: 8),
                      Text('${metric.$2}', style: designHeading(20)),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
      CustomAppButton(
        text: deck.activeAttemptId == null ? 'Luyện tập' : 'Tiếp tục học',
        onPressed: onTap,
      ),
    ],
  );
}

class VocabularyPendingNotice extends StatelessWidget {
  const VocabularyPendingNotice({
    super.key,
    required this.controller,
    this.onResolved,
  });
  final VocabularyController controller;
  final VoidCallback? onResolved;
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) => Column(
      children: [
        if (controller.stale)
          const Text('Đang xem dữ liệu đã lưu · chưa đồng bộ'),
        if (controller.pending != null)
          LearningCard(
            children: [
              Text(controller.error ?? 'Có thao tác đang chờ xác nhận.'),
              TextButton(
                onPressed: controller.busy
                    ? null
                    : () async {
                        try {
                          final result = await controller.retryPending();
                          if (!context.mounted || !controller.active) return;
                          onResolved?.call();
                          if (result['attempt'] is Map) {
                            await previewPush(
                              context,
                              VocabularyReviewPage(
                                controller: controller,
                                attemptId:
                                    (result['attempt'] as Map)['id'] as String,
                              ),
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            previewMessage(context, controller.message(e));
                          }
                        }
                      },
                child: const Text('Thử lại thao tác đang chờ'),
              ),
              if (controller.conflict)
                TextButton(
                  onPressed: controller.busy
                      ? null
                      : () async {
                          await controller.resolveConflict();
                          onResolved?.call();
                        },
                  child: const Text('Bỏ thao tác cũ và tải dữ liệu mới'),
                ),
            ],
          ),
      ],
    ),
  );
}

class VocabularyWordsTab extends StatefulWidget {
  const VocabularyWordsTab({super.key, required this.controller});
  final VocabularyController controller;
  @override
  State<VocabularyWordsTab> createState() => _VocabularyWordsTabState();
}

class _VocabularyWordsTabState extends State<VocabularyWordsTab> {
  String search = '';
  String? error;
  bool loading = true;
  Timer? timer;
  int epoch = 0;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load({bool more = false}) async {
    final request = ++epoch;
    setState(() => loading = true);
    try {
      await widget.controller.loadDecks(
        query: search,
        cursor: more ? widget.controller.nextCursor : null,
      );
      if (mounted && request == epoch) setState(() => error = null);
    } catch (e) {
      if (mounted && request == epoch) {
        setState(() => error = widget.controller.message(e));
      }
    } finally {
      if (mounted && request == epoch) setState(() => loading = false);
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) => FigmaPage(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          Row(
            children: [
              Expanded(child: learningHeading('Từ của tôi', size: 32)),
              IconButton(
                key: const Key('vocabularyHistory'),
                tooltip: 'Lịch sử ôn từ',
                onPressed: () => previewPush(
                  context,
                  VocabularyHistoryPage(controller: widget.controller),
                ),
                icon: const Icon(Icons.history),
              ),
              IconButton(
                key: const Key('vocabularyAddDeck'),
                tooltip: 'Tạo bộ từ',
                onPressed: widget.controller.busy
                    ? null
                    : () async {
                        final result = await showDialog<bool>(
                          context: context,
                          builder: (context) =>
                              _DeckForm(controller: widget.controller),
                        );
                        if (result == true && mounted) load();
                      },
                icon: const Icon(Icons.add_circle_outline),
              ),
            ],
          ),
          const SizedBox(height: 16),
          TextField(
            key: const Key('vocabularySearch'),
            decoration: const InputDecoration(
              hintText: 'Tìm bộ từ',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (value) {
              search = value;
              timer?.cancel();
              timer = Timer(const Duration(milliseconds: 300), () => load());
            },
          ),
          const SizedBox(height: 16),
          VocabularyPendingNotice(
            controller: widget.controller,
            onResolved: () => load(),
          ),
          if (error != null) LearningError(error!, retry: () => load()),
          if (loading) const Center(child: CircularProgressIndicator()),
          if (!loading && error == null && widget.controller.decks.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Text('Chưa có bộ từ phù hợp. Bấm + để tạo bộ từ.'),
            ),
          for (final deck in widget.controller.decks) ...[
            VocabularyDeckCard(
              deck: deck,
              onTap: () async {
                await previewPush(
                  context,
                  VocabularyDeckPage(
                    controller: widget.controller,
                    deckId: deck.id,
                  ),
                );
                if (mounted) load();
              },
            ),
            const SizedBox(height: 12),
          ],
          if (widget.controller.nextCursor != null)
            TextButton(
              onPressed: loading ? null : () => load(more: true),
              child: const Text('Xem thêm bộ từ'),
            ),
        ],
      ),
    ),
  );
}

class _DeckForm extends StatefulWidget {
  const _DeckForm({required this.controller, this.deck});
  final VocabularyController controller;
  final VocabularyDeck? deck;
  @override
  State<_DeckForm> createState() => _DeckFormState();
}

class _DeckFormState extends State<_DeckForm> {
  late final name = TextEditingController(text: widget.deck?.name ?? '');
  String? error;
  bool busy = false;
  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (name.text.trim().isEmpty) {
      setState(() => error = 'Nhập tên bộ từ.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (widget.deck == null) {
        await widget.controller.createDeck(name.text.trim());
      } else {
        await widget.controller.updateDeck(widget.deck!, name.text.trim());
      }
      if (mounted && widget.controller.active) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => error = widget.controller.message(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    child: AlertDialog(
      title: Text(widget.deck == null ? 'Tạo bộ từ' : 'Đổi tên bộ từ'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              key: const Key('vocabularyDeckName'),
              controller: name,
              maxLength: 60,
              enabled: !busy,
              decoration: const InputDecoration(labelText: 'Tên bộ từ'),
            ),
            if (error != null)
              Text(error!, style: const TextStyle(color: Colors.red)),
            if (widget.controller.conflict)
              TextButton(
                onPressed: busy
                    ? null
                    : () async {
                        await widget.controller.resolveConflict();
                        if (context.mounted) Navigator.pop(context, true);
                      },
                child: const Text('Bỏ thao tác cũ và tải dữ liệu mới'),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: busy ? null : () => Navigator.pop(context, false),
          child: const Text('Đóng'),
        ),
        TextButton(
          key: const Key('vocabularySaveDeck'),
          onPressed: busy ? null : save,
          child: Text(busy ? 'Đang lưu…' : 'Lưu'),
        ),
      ],
    ),
  );
}

class VocabularyDeckPage extends StatefulWidget {
  const VocabularyDeckPage({
    super.key,
    required this.controller,
    required this.deckId,
  });
  final VocabularyController controller;
  final String deckId;
  @override
  State<VocabularyDeckPage> createState() => _VocabularyDeckPageState();
}

class _VocabularyDeckPageState extends State<VocabularyDeckPage> {
  VocabularyDeck? deck;
  List<VocabularyWord> words = [];
  String? cursor, error;
  bool loading = true;
  String search = '';
  Timer? timer;
  int epoch = 0;
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> load({bool more = false}) async {
    final request = ++epoch;
    setState(() => loading = true);
    try {
      final values = await Future.wait([
        widget.controller.deck(widget.deckId),
        widget.controller.words(
          widget.deckId,
          query: search,
          cursor: more ? cursor : null,
        ),
      ]);
      if (!mounted || !widget.controller.active || request != epoch) return;
      final data = values[1] as Json;
      setState(() {
        deck = values[0] as VocabularyDeck;
        final next = vocabularyItems(
          data['items'],
        ).map(VocabularyWord.new).toList();
        words = more ? [...words, ...next] : next;
        cursor = data['nextCursor'] as String?;
        error = null;
      });
    } catch (e) {
      if (mounted && request == epoch) {
        setState(() => error = widget.controller.message(e));
      }
    } finally {
      if (mounted && request == epoch) setState(() => loading = false);
    }
  }

  Future<void> editWord([VocabularyWord? word]) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (context) => _WordForm(
        controller: widget.controller,
        deckId: widget.deckId,
        word: word,
      ),
    );
    if (result == true && mounted) load();
  }

  Future<void> removeWord(VocabularyWord word) async {
    if (!await vocabularyConfirm(
      context,
      'Xóa từ “${word.english}”?',
      'Lịch sử ôn vẫn được giữ.',
    )) {
      return;
    }
    try {
      await widget.controller.deleteWord(word);
      if (mounted) load();
    } catch (e) {
      if (mounted) setState(() => error = widget.controller.message(e));
    }
  }

  Future<void> manage(String action) async {
    if (action == 'history') {
      await previewPush(
        context,
        VocabularyHistoryPage(
          controller: widget.controller,
          deckId: widget.deckId,
        ),
      );
      return;
    }
    if (action == 'rename') {
      await showDialog<bool>(
        context: context,
        builder: (context) =>
            _DeckForm(controller: widget.controller, deck: deck),
      );
      if (mounted) load();
      return;
    }
    if (action == 'delete' &&
        await vocabularyConfirm(
          context,
          'Xóa bộ từ này?',
          'Các từ sẽ được ẩn khỏi thư viện. Lịch sử ôn vẫn được giữ.',
        )) {
      try {
        await widget.controller.deleteDeck(deck!);
        if (mounted) Navigator.pop(context);
      } catch (e) {
        if (mounted) setState(() => error = widget.controller.message(e));
      }
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: widget.controller,
    builder: (context, _) => FigmaPage(
      title: deck?.name ?? 'Bộ từ',
      trailing: deck == null
          ? null
          : PopupMenuButton<String>(
              key: const Key('vocabularyDeckMenu'),
              tooltip: 'Quản lý bộ từ',
              onSelected: manage,
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'rename', child: Text('Đổi tên bộ từ')),
                PopupMenuItem(value: 'history', child: Text('Lịch sử ôn')),
                PopupMenuItem(value: 'delete', child: Text('Xóa bộ từ')),
              ],
            ),
      bottom: CustomAppButton(
        key: const Key('vocabularyStartReview'),
        text: deck?.activeAttemptId == null ? 'Luyện tập' : 'Tiếp tục học',
        onPressed:
            deck == null || deck!.totalWords == 0 || widget.controller.busy
            ? null
            : () async {
                await openVocabularyReview(
                  context,
                  widget.controller,
                  widget.deckId,
                );
                if (mounted) load();
              },
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${deck?.totalWords ?? 0} từ · ${deck?.rememberedWords ?? 0} đã nhớ',
                  style: designText(16),
                ),
              ),
              IconButton(
                key: const Key('vocabularyAddWord'),
                tooltip: 'Thêm từ',
                onPressed: widget.controller.busy ? null : () => editWord(),
                icon: const Icon(Icons.add_circle_outline),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              hintText: 'Tìm từ hoặc nghĩa',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (value) {
              search = value;
              timer?.cancel();
              timer = Timer(const Duration(milliseconds: 300), () => load());
            },
          ),
          const SizedBox(height: 16),
          VocabularyPendingNotice(
            controller: widget.controller,
            onResolved: () => load(),
          ),
          if (error != null) LearningError(error!, retry: () => load()),
          if (loading) const Center(child: CircularProgressIndicator()),
          if (!loading && words.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Text('Chưa có từ phù hợp. Bấm + để thêm từ.'),
            ),
          for (final word in words) ...[
            LearningCard(
              children: [
                Row(
                  children: [
                    Expanded(child: learningHeading(word.english, size: 24)),
                    PopupMenuButton<String>(
                      key: ValueKey('vocabulary-word-menu-${word.id}'),
                      tooltip: 'Quản lý từ',
                      onSelected: (action) =>
                          action == 'edit' ? editWord(word) : removeWord(word),
                      itemBuilder: (_) => const [
                        PopupMenuItem(value: 'edit', child: Text('Sửa từ')),
                        PopupMenuItem(value: 'delete', child: Text('Xóa từ')),
                      ],
                    ),
                  ],
                ),
                Text(
                  word.meaning,
                  key: ValueKey('vocabulary-word-${word.id}'),
                  style: designText(16),
                ),
                if (word.field('phonetic').isNotEmpty)
                  Text(word.field('phonetic')),
                if (word.field('example').isNotEmpty)
                  Text(word.field('example')),
                Text(
                  word.learningState == 'REMEMBERED' ? 'Đã nhớ' : 'Cần ôn',
                  style: designText(
                    14,
                    color: word.learningState == 'REMEMBERED'
                        ? const Color(0xFF307644)
                        : const Color(0xFF9A6700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          if (cursor != null)
            TextButton(
              onPressed: loading ? null : () => load(more: true),
              child: const Text('Xem thêm từ'),
            ),
        ],
      ),
    ),
  );
}

Future<bool> vocabularyConfirm(
  BuildContext context,
  String title,
  String message,
) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Đồng ý'),
          ),
        ],
      ),
    ) ??
    false;

class _WordForm extends StatefulWidget {
  const _WordForm({required this.controller, required this.deckId, this.word});
  final VocabularyController controller;
  final String deckId;
  final VocabularyWord? word;
  @override
  State<_WordForm> createState() => _WordFormState();
}

class _WordFormState extends State<_WordForm> {
  late final fields = <String, TextEditingController>{
    for (final field in [
      'english',
      'meaning',
      'phonetic',
      'partOfSpeech',
      'example',
      'translation',
      'aliases',
    ])
      field: TextEditingController(
        text: field == 'aliases'
            ? (widget.word?.json['acceptedAnswers'] as List? ?? []).join('\n')
            : widget.word?.json[field] as String? ?? '',
      ),
  };
  bool busy = false;
  String? error;
  @override
  void dispose() {
    for (final field in fields.values) {
      field.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    if (fields['english']!.text.trim().isEmpty ||
        fields['meaning']!.text.trim().isEmpty) {
      setState(() => error = 'Nhập từ tiếng Anh và nghĩa.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    final body = <String, dynamic>{
      for (final field in fields.entries.where((e) => e.key != 'aliases'))
        field.key: field.value.text.trim(),
      'acceptedAnswers': fields['aliases']!.text
          .split('\n')
          .map((s) => s.trim())
          .where((s) => s.isNotEmpty)
          .toList(),
    };
    try {
      if (widget.word == null) {
        await widget.controller.createWord(widget.deckId, body);
      } else {
        await widget.controller.updateWord(widget.word!, body);
      }
      if (mounted && widget.controller.active) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => error = widget.controller.message(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    child: AlertDialog(
      title: Text(widget.word == null ? 'Thêm từ' : 'Sửa từ'),
      content: SizedBox(
        width: 420,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final field in [
                ('english', 'Từ tiếng Anh', 100),
                ('meaning', 'Nghĩa', 500),
                ('phonetic', 'Phiên âm (không bắt buộc)', 100),
                ('partOfSpeech', 'Từ loại (không bắt buộc)', 50),
                ('example', 'Ví dụ (không bắt buộc)', 1000),
                ('translation', 'Dịch ví dụ (không bắt buộc)', 1000),
                ('aliases', 'Đáp án khác, mỗi dòng một đáp án', 1100),
              ])
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: TextField(
                    key: Key(
                      field.$1 == 'english'
                          ? 'vocabularyEnglish'
                          : field.$1 == 'meaning'
                          ? 'vocabularyMeaning'
                          : 'vocabulary-${field.$1}',
                    ),
                    controller: fields[field.$1],
                    enabled: !busy,
                    maxLength: field.$3,
                    minLines: 1,
                    maxLines:
                        [
                          'meaning',
                          'example',
                          'translation',
                          'aliases',
                        ].contains(field.$1)
                        ? 3
                        : 1,
                    decoration: InputDecoration(
                      labelText: field.$2,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: const BorderSide(
                          color: Color(0xFF59B070),
                          width: 1.5,
                        ),
                      ),
                    ),
                  ),
                ),
              if (error != null)
                Text(error!, style: const TextStyle(color: Colors.red)),
              if (widget.controller.conflict)
                TextButton(
                  onPressed: busy
                      ? null
                      : () async {
                          await widget.controller.resolveConflict();
                          if (context.mounted) Navigator.pop(context, true);
                        },
                  child: const Text('Bỏ thao tác cũ và tải dữ liệu mới'),
                ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: busy ? null : () => Navigator.pop(context, false),
          child: const Text('Đóng'),
        ),
        TextButton(
          key: const Key('vocabularySaveWord'),
          onPressed: busy ? null : save,
          child: Text(busy ? 'Đang lưu…' : 'Lưu'),
        ),
      ],
    ),
  );
}

class VocabularyHistoryPage extends StatefulWidget {
  const VocabularyHistoryPage({
    super.key,
    required this.controller,
    this.deckId,
  });
  final VocabularyController controller;
  final String? deckId;
  @override
  State<VocabularyHistoryPage> createState() => _VocabularyHistoryPageState();
}

class _VocabularyHistoryPageState extends State<VocabularyHistoryPage> {
  List<Json> items = [];
  String? cursor, error;
  bool loading = true;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load({bool more = false}) async {
    setState(() => loading = true);
    try {
      final result = await widget.controller.history(
        deckId: widget.deckId,
        cursor: more ? cursor : null,
      );
      if (!mounted || !widget.controller.active) return;
      setState(() {
        final next = vocabularyItems(result['items']);
        items = more ? [...items, ...next] : next;
        cursor = result['nextCursor'] as String?;
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = widget.controller.message(e));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => FigmaPage(
    title: 'Lịch sử ôn từ',
    child: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (widget.controller.stale)
          const Text('Dữ liệu đã lưu · chưa đồng bộ'),
        if (error != null) LearningError(error!, retry: () => load()),
        if (loading) const Center(child: CircularProgressIndicator()),
        if (!loading && items.isEmpty) const Text('Chưa có lượt ôn từ.'),
        for (final row in items) ...[
          LearningCard(
            children: [
              learningHeading(
                (row['deckSnapshot'] as Map?)?['name'] as String? ?? 'Bộ từ',
                size: 22,
              ),
              Text(
                row['status'] == 'IN_PROGRESS'
                    ? 'Đang ôn'
                    : row['status'] == 'ABANDONED'
                    ? 'Đã dừng sớm'
                    : 'Đã kết thúc lượt',
              ),
              Text(
                '${(row['counts'] as Map?)?['reviewedCount'] ?? 0} từ đã ôn · ${(row['counts'] as Map?)?['skippedCount'] ?? 0} bỏ qua',
              ),
              CustomAppButton(
                key: ValueKey('vocabulary-history-${row['id']}'),
                text: row['status'] == 'IN_PROGRESS'
                    ? 'Tiếp tục'
                    : 'Xem kết quả',
                onPressed: () async {
                  await previewPush(
                    context,
                    VocabularyReviewPage(
                      controller: widget.controller,
                      attemptId: row['id'] as String,
                    ),
                  );
                  if (mounted) load();
                },
              ),
            ],
          ),
          const SizedBox(height: 12),
        ],
        if (cursor != null)
          TextButton(
            onPressed: loading ? null : () => load(more: true),
            child: const Text('Xem thêm lịch sử'),
          ),
      ],
    ),
  );
}
