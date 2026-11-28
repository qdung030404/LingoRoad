import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../learning/learning_pages.dart' show LearningError;
import '../learning/learning_widgets.dart';
import 'curated_topics_widgets.dart' show getTopicIcon;
import 'vocabulary_controller.dart';
import 'vocabulary_word_card.dart';

class CuratedTopicDetailPage extends StatefulWidget {
  const CuratedTopicDetailPage({
    super.key,
    required this.controller,
    required this.topic,
    this.onOpenDeck,
  });

  final VocabularyController controller;
  final Map<String, dynamic> topic;
  final ValueChanged<String>? onOpenDeck;

  @override
  State<CuratedTopicDetailPage> createState() => _CuratedTopicDetailPageState();
}

class _CuratedTopicDetailPageState extends State<CuratedTopicDetailPage> {
  AudioPlayer? _audioPlayer;
  StreamSubscription<void>? _audioCompleteSub;
  final WordPlaybackTracker _audioTracker = WordPlaybackTracker();
  final TextEditingController _searchController = TextEditingController();
  Timer? _searchDebounce;
  List<Map<String, dynamic>> _words = [];
  List<Map<String, dynamic>> _filteredWords = [];
  bool _loading = true;
  String? _error;
  String _search = '';
  bool _isCloning = false;
  final Set<String> _bookmarkedWordIds = {};

  @override
  void initState() {
    super.initState();
    _loadWords();
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    _audioCompleteSub?.cancel();
    _audioPlayer?.dispose();
    _audioTracker.dispose();
    super.dispose();
  }

  void _recomputeFilteredWords() {
    final q = _search.trim().toLowerCase();
    if (q.isEmpty) {
      _filteredWords = _words;
      return;
    }
    _filteredWords = _words.where((w) {
      final word = (w['word']?.toString() ?? '').toLowerCase();
      final meaning = (w['meaningVi']?.toString() ?? '').toLowerCase();
      return word.contains(q) || meaning.contains(q);
    }).toList();
  }

  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 220), () {
      if (!mounted || _search == value) return;
      setState(() {
        _search = value;
        _recomputeFilteredWords();
      });
    });
  }

  AudioPlayer _ensureAudioPlayer() {
    final existing = _audioPlayer;
    if (existing != null) return existing;
    final created = AudioPlayer();
    _audioPlayer = created;
    _audioCompleteSub = created.onPlayerComplete.listen((_) {
      if (mounted) {
        _audioTracker.setPlaying(null);
      }
    });
    return created;
  }

  Future<void> _loadWords() async {
    final slug = widget.topic['slug']?.toString() ?? '';
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await widget.controller.loadCuratedTopicWords(
        slug,
        limit: 100,
      );
      if (!mounted) return;
      if (res['items'] is List) {
        setState(() {
          _words = (res['items'] as List)
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
          _recomputeFilteredWords();
          _loading = false;
        });
      } else {
        setState(() {
          _words = [];
          _filteredWords = [];
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = widget.controller.message(e);
          _loading = false;
        });
      }
    }
  }

  Future<void> _playAudio(Map<String, dynamic> word) async {
    final url = word['audioUrl']?.toString();
    final wordId = word['id']?.toString();
    if (url == null || url.isEmpty || wordId == null) return;

    try {
      _audioTracker.setPlaying(wordId);
      final player = _ensureAudioPlayer();
      await player.stop();
      await player.play(UrlSource(url));
    } catch (_) {
      if (mounted && _audioTracker.currentId == wordId) {
        _audioTracker.setPlaying(null);
      }
    }
  }

  Future<void> _bookmarkWord(Map<String, dynamic> word) async {
    final ctrl = widget.controller;
    if (!ctrl.active) {
      previewMessage(context, 'Vui lòng đăng nhập để lưu từ vào bộ từ cá nhân.');
      return;
    }
    final wordId = word['id']?.toString() ?? '';
    final eng = word['word']?.toString() ?? '';
    if (eng.isEmpty) return;

    if (ctrl.decks.isEmpty) {
      try {
        await ctrl.loadDecks();
      } catch (_) {}
    }

    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: AppRadius.bottomSheetRadius,
      ),
      builder: (bottomSheetContext) => _SaveWordToDeckSheet(
        controller: ctrl,
        word: word,
        onSaved: (deckId, deckName) {
          setState(() => _bookmarkedWordIds.add(wordId));
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Đã lưu "$eng" vào bộ từ "$deckName"!'),
              backgroundColor: AppColors.primary700,
              action: widget.onOpenDeck != null
                  ? SnackBarAction(
                      label: 'Mở bộ từ',
                      textColor: Colors.white,
                      onPressed: () => widget.onOpenDeck!(deckId),
                    )
                  : null,
            ),
          );
        },
      ),
    );
  }

  Future<void> _cloneTopic() async {
    final slug = widget.topic['slug']?.toString() ?? '';
    if (slug.isEmpty || _isCloning) return;

    setState(() => _isCloning = true);
    try {
      final res = await widget.controller.cloneCuratedTopic(slug);
      if (!mounted) return;
      final deckId = res['deckId']?.toString();
      final count = res['importedWordsCount'] ?? widget.topic['totalWords'];
      final name = res['deckName'] ?? widget.topic['titleVi'];

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Đã thêm $count từ vào bộ từ "$name"!'),
          backgroundColor: AppColors.primary700,
          action: deckId != null && widget.onOpenDeck != null
              ? SnackBarAction(
                  label: 'Mở bộ từ',
                  textColor: Colors.white,
                  onPressed: () {
                    widget.onOpenDeck!(deckId);
                  },
                )
              : null,
        ),
      );
    } catch (e) {
      if (mounted) {
        previewMessage(context, widget.controller.message(e));
      }
    } finally {
      if (mounted) setState(() => _isCloning = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final titleVi = widget.topic['titleVi']?.toString() ?? '';
    final titleEn = widget.topic['titleEn']?.toString() ?? '';
    final description = widget.topic['description']?.toString() ?? '';
    final totalWords = widget.topic['totalWords']?.toString() ?? '0';
    final slug = widget.topic['slug']?.toString() ?? '';
    final isCloned = widget.controller.isTopicCloned(titleVi);
    final clonedDeckId = widget.controller.getClonedDeckId(titleVi);
    final filtered = _filteredWords;

    return Scaffold(
      backgroundColor: AppColors.grey25,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: AppColors.grey900),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(
          titleVi,
          style: designHeading(18),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(
              child: LearningPill('$totalWords từ', small: true),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: CustomScrollView(
                slivers: [
                  SliverPadding(
                    padding: EdgeInsets.fromLTRB(
                      AppSpacing.md,
                      AppSpacing.md,
                      AppSpacing.md,
                      !_loading && _error == null && filtered.isNotEmpty
                          ? 0
                          : AppSpacing.md,
                    ),
                    sliver: SliverToBoxAdapter(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Container(
                            padding: AppSpacing.allMd,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: AppRadius.cardRadius,
                              border: Border.all(color: AppColors.grey200),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  decoration: const BoxDecoration(
                                    color: AppColors.primary25,
                                    borderRadius: AppRadius.cardSm,
                                  ),
                                  child: Icon(
                                    getTopicIcon(slug),
                                    color: AppColors.primary700,
                                    size: 24,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        titleEn,
                                        style: designHeading(15, color: AppColors.grey700),
                                      ),
                                      if (description.isNotEmpty) ...[
                                        const SizedBox(height: 4),
                                        Text(
                                          description,
                                          style: designText(13, color: AppColors.grey600),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          TextField(
                            controller: _searchController,
                            onChanged: _onSearchChanged,
                            style: designText(14),
                            decoration: InputDecoration(
                              hintText: 'Tìm từ trong chủ đề...',
                              hintStyle: designText(14, color: AppColors.grey500),
                              prefixIcon: const Icon(Icons.search, color: AppColors.grey500),
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 12,
                              ),
                              filled: true,
                              fillColor: Colors.white,
                              border: const OutlineInputBorder(
                                borderRadius: AppRadius.inputRadius,
                                borderSide: BorderSide(color: AppColors.grey200),
                              ),
                              enabledBorder: const OutlineInputBorder(
                                borderRadius: AppRadius.inputRadius,
                                borderSide: BorderSide(color: AppColors.grey200),
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                          if (_loading)
                            const Center(
                              child: Padding(
                                padding: EdgeInsets.symmetric(vertical: 36),
                                child: CircularProgressIndicator(color: AppColors.primary500),
                              ),
                            )
                          else if (_error != null)
                            LearningError(_error!, retry: _loadWords)
                          else if (filtered.isEmpty)
                            Padding(
                              padding: AppSpacing.allLg,
                              child: Center(
                                child: Text(
                                  _search.isEmpty
                                      ? 'Chưa có từ nào trong chủ đề này.'
                                      : 'Không tìm thấy từ phù hợp.',
                                  style: designText(14, color: AppColors.grey600),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  if (!_loading && _error == null && filtered.isNotEmpty)
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.md,
                        0,
                        AppSpacing.md,
                        AppSpacing.md,
                      ),
                      sliver: SliverList.builder(
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          final word = filtered[index];
                          final wordId = word['id']?.toString() ?? 'idx-$index';
                          final hasAudio = word['audioUrl'] != null &&
                              word['audioUrl'].toString().isNotEmpty;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: ValueListenableBuilder<bool>(
                              valueListenable: _audioTracker.listen(wordId),
                              builder: (context, isPlaying, _) => VocabularyWordCard(
                                english: word['word']?.toString() ?? '',
                                phonetic: word['phonetic']?.toString(),
                                partOfSpeech: word['partOfSpeech']?.toString(),
                                meaning: word['meaningVi']?.toString() ?? '',
                                example: word['exampleEn']?.toString(),
                                translation: word['exampleVi']?.toString(),
                                imageUrl: word['imageUrl']?.toString(),
                                isPlaying: isPlaying,
                                onPlayAudio: hasAudio ? () => _playAudio(word) : null,
                                isBookmarked: isCloned ||
                                    _bookmarkedWordIds.contains(wordId),
                                onBookmark: () => _bookmarkWord(word),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: AppShadows.level2,
                border: const Border(top: BorderSide(color: AppColors.grey200)),
              ),
              child: isCloned
                  ? Row(
                      children: [
                        Expanded(
                          child: CustomAppButton(
                            text: 'Học bộ từ này ngay',
                            onPressed: clonedDeckId != null && widget.onOpenDeck != null
                                ? () => widget.onOpenDeck!(clonedDeckId)
                                : null,
                          ),
                        ),
                        const SizedBox(width: 12),
                        IconButton(
                          tooltip: 'Lưu bản sao mới',
                          style: IconButton.styleFrom(
                            backgroundColor: AppColors.grey100,
                            foregroundColor: AppColors.grey800,
                          ),
                          icon: const Icon(Icons.copy_rounded, size: 20),
                          onPressed: _isCloning ? null : _cloneTopic,
                        ),
                      ],
                    )
                  : CustomAppButton(
                      text: 'Thêm vào Từ của tôi',
                      isLoading: _isCloning,
                      icon: const Icon(Icons.bookmark_add_outlined, color: Colors.white),
                      onPressed: _cloneTopic,
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SaveWordToDeckSheet extends StatefulWidget {
  const _SaveWordToDeckSheet({
    required this.controller,
    required this.word,
    required this.onSaved,
  });

  final VocabularyController controller;
  final Map<String, dynamic> word;
  final void Function(String deckId, String deckName) onSaved;

  @override
  State<_SaveWordToDeckSheet> createState() => _SaveWordToDeckSheetState();
}

class _SaveWordToDeckSheetState extends State<_SaveWordToDeckSheet> {
  String? _savingDeckId;
  String? _error;

  Future<void> _saveToDeck(String deckId, String deckName) async {
    if (_savingDeckId != null) return;
    setState(() {
      _savingDeckId = deckId;
      _error = null;
    });

    final w = widget.word;
    final eng = w['word']?.toString() ?? '';
    final meaning = w['meaningVi']?.toString() ?? '';
    final phonetic = w['phonetic']?.toString();
    final pos = w['partOfSpeech']?.toString();
    final example = w['exampleEn']?.toString();
    final translation = w['exampleVi']?.toString();
    final imageUrl = w['imageUrl']?.toString();

    try {
      await widget.controller.createWord(deckId, {
        'english': eng,
        'meaning': meaning,
        if (phonetic != null && phonetic.isNotEmpty) 'phonetic': phonetic,
        if (pos != null && pos.isNotEmpty) 'partOfSpeech': pos,
        if (example != null && example.isNotEmpty) 'example': example,
        if (translation != null && translation.isNotEmpty)
          'translation': translation,
        if (imageUrl != null && imageUrl.isNotEmpty) 'imageUrl': imageUrl,
        'acceptedAnswers': [eng.toLowerCase()],
      });
      if (!mounted) return;
      Navigator.of(context).pop();
      widget.onSaved(deckId, deckName);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = widget.controller.message(e);
          _savingDeckId = null;
        });
      }
    }
  }

  Future<void> _createNewDeck() async {
    final nameCtrl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Tạo bộ từ mới'),
        content: TextField(
          controller: nameCtrl,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Nhập tên bộ từ (ví dụ: Từ cần nhớ)',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Hủy'),
          ),
          TextButton(
            onPressed: () {
              if (nameCtrl.text.trim().isNotEmpty) {
                Navigator.of(ctx).pop(true);
              }
            },
            child: const Text('Tạo và lưu'),
          ),
        ],
      ),
    );

    if (confirmed == true && nameCtrl.text.trim().isNotEmpty && mounted) {
      final name = nameCtrl.text.trim();
      try {
        final res = await widget.controller.createDeck(name);
        final deckId = res['deck']?['id']?.toString() ??
            res['receipt']?['commandId']?.toString();
        await widget.controller.loadDecks();
        final found =
            widget.controller.decks.where((d) => d.name == name).firstOrNull;
        final targetId = found?.id ?? deckId;
        if (targetId != null) {
          await _saveToDeck(targetId, name);
        }
      } catch (e) {
        if (mounted) setState(() => _error = widget.controller.message(e));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final eng = widget.word['word']?.toString() ?? '';
    final decks = widget.controller.decks;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: AppColors.grey200,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Lưu từ vào bộ từ',
                        style: designHeading(18),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Lưu "$eng" vào kho từ vựng cá nhân của bạn',
                        style: designText(13, color: AppColors.grey600),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(_error!,
                    style: designText(13, color: AppColors.error100)),
              ),
            if (decks.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Column(
                    children: [
                      Text(
                        'Bạn chưa có bộ từ nào.',
                        style: designText(14, color: AppColors.grey600),
                      ),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.add),
                        label: const Text('Tạo bộ từ đầu tiên'),
                        onPressed: _createNewDeck,
                      ),
                    ],
                  ),
                ),
              )
            else
              ConstrainedBox(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.sizeOf(context).height * 0.4,
                ),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: decks.length,
                  separatorBuilder: (context, index) =>
                      const Divider(height: 1, color: AppColors.grey100),
                  itemBuilder: (context, i) {
                    final d = decks[i];
                    final isSavingThis = _savingDeckId == d.id;
                    return ListTile(
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                      leading: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.primary25,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.folder_outlined,
                            color: AppColors.primary700, size: 22),
                      ),
                      title:
                          Text(d.name, style: designText(15, weight: FontWeight.w600)),
                      subtitle: Text('${d.totalWords} từ',
                          style: designText(13, color: AppColors.grey600)),
                      trailing: isSavingThis
                          ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: AppColors.primary600),
                            )
                          : const Icon(Icons.bookmark_add_outlined,
                              color: AppColors.primary600),
                      onTap: _savingDeckId != null
                          ? null
                          : () => _saveToDeck(d.id, d.name),
                    );
                  },
                ),
              ),
            const SizedBox(height: 12),
            if (decks.isNotEmpty)
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(44),
                  shape: const RoundedRectangleBorder(
                      borderRadius: AppRadius.buttonRadius),
                ),
                icon: const Icon(Icons.add),
                label: const Text('Tạo bộ từ mới'),
                onPressed: _savingDeckId != null ? null : _createNewDeck,
              ),
          ],
        ),
      ),
    );
  }
}
