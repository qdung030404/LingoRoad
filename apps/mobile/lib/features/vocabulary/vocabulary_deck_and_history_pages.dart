part of 'vocabulary_pages.dart';

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
  final AudioPlayer _audioPlayer = AudioPlayer();
  String? _playingWordId;
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
    _audioPlayer.dispose();
    timer?.cancel();
    super.dispose();
  }

  Future<void> _playAudio(VocabularyWord word) async {
    final url = word.field('audioUrl');
    if (url.isNotEmpty) {
      try {
        setState(() => _playingWordId = word.id);
        await _audioPlayer.stop();
        await _audioPlayer.play(UrlSource(url));
        _audioPlayer.onPlayerComplete.first.then((_) {
          if (mounted && _playingWordId == word.id) {
            setState(() => _playingWordId = null);
          }
        });
        return;
      } catch (_) {
        if (mounted) setState(() => _playingWordId = null);
      }
    }
    try {
      final lookup = await widget.controller.lookupWord(word.english);
      final remoteAudio = lookup?['audioUrl']?.toString() ?? '';
      if (remoteAudio.isNotEmpty) {
        setState(() => _playingWordId = word.id);
        await _audioPlayer.stop();
        await _audioPlayer.play(UrlSource(remoteAudio));
        _audioPlayer.onPlayerComplete.first.then((_) {
          if (mounted && _playingWordId == word.id) {
            setState(() => _playingWordId = null);
          }
        });
        return;
      }
    } catch (_) {}

    if (mounted) {
      previewMessage(context, 'Chưa có âm thanh phát âm cho từ này.');
    }
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
    if (word == null) {
      final result = await previewPush<bool>(
        context,
        VocabularyBatchAddPage(
          controller: widget.controller,
          deckId: widget.deckId,
        ),
      );
      if (result == true && mounted) load();
      return;
    }
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => VocabularyWordEditDialog(
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
            VocabularyWordCard(
              english: word.english,
              phonetic: word.field('phonetic'),
              partOfSpeech: word.field('partOfSpeech'),
              meaning: word.meaning,
              example: word.field('example'),
              translation: word.field('translation'),
              imageUrl: word.field('imageUrl'),
              learningState: word.learningState,
              isPlaying: _playingWordId == word.id,
              onPlayAudio: () => _playAudio(word),
              topAction: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: AppShadows.level1,
                ),
                child: PopupMenuButton<String>(
                  key: ValueKey('vocabulary-word-menu-${word.id}'),
                  tooltip: 'Quản lý từ',
                  padding: EdgeInsets.zero,
                  icon: const FigmaAsset(
                    'word-list/imgVuesaxOutlineMore',
                    size: 18,
                  ),
                  onSelected: (action) =>
                      action == 'edit' ? editWord(word) : removeWord(word),
                  itemBuilder: (_) => const [
                    PopupMenuItem(
                      value: 'edit',
                      child: Row(
                        children: [
                          Icon(
                            Icons.edit_outlined,
                            size: 18,
                            color: AppColors.grey800,
                          ),
                          SizedBox(width: 8),
                          Text('Chỉnh sửa'),
                        ],
                      ),
                    ),
                    PopupMenuItem(
                      value: 'delete',
                      child: Row(
                        children: [
                          Icon(
                            Icons.delete_outline,
                            size: 18,
                            color: AppColors.error100,
                          ),
                          SizedBox(width: 8),
                          Text(
                            'Xóa',
                            style: TextStyle(color: AppColors.error100),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
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

