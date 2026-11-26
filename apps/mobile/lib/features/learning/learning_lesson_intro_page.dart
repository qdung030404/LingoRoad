import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/learning_media_image.dart';
import 'learning_controller.dart';
import 'learning_pages.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';
import 'listening_widgets.dart';
import 'practice_widgets.dart';

class LearningLessonIntroPage extends StatefulWidget {
  const LearningLessonIntroPage({
    super.key,
    required this.owner,
    required this.lessonId,
  });
  final LearningController owner;
  final String lessonId;
  @override
  State<LearningLessonIntroPage> createState() =>
      _LearningLessonIntroPageState();
}

class _LearningLessonIntroPageState extends State<LearningLessonIntroPage> {
  final ValueNotifier<Set<String>> _savedWordKeys = ValueNotifier({});
  final ValueNotifier<Set<String>> _savingWordKeys = ValueNotifier({});
  final Set<String> _sessionSavedWordKeys = {};
  bool opening = false;
  Json _introContent = {};
  late Future<List<Json>> _keyVocabulary = _loadKeyVocabulary();

  LearningLesson? get _catalogueLesson {
    for (final lesson in widget.owner.lessons) {
      if (lesson.id == widget.lessonId) return lesson;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    final kind = _catalogueLesson?.kind;
    if (kind == null || kind == 'READING') {
      unawaited(_loadSavedReadingWords());
    }
  }

  Future<List<Json>> _loadKeyVocabulary() async {
    final lesson = await widget.owner.repository.lesson(widget.lessonId);
    final content = lesson['content'] as Json?;
    if (mounted && widget.owner.active) _introContent = content ?? {};
    return learningItems(content?['keyVocabulary']);
  }

  Future<void> _loadSavedReadingWords() async {
    final vocabulary = widget.owner.vocabulary;
    if (vocabulary == null) return;
    try {
      final data = await vocabulary.readingWords();
      if (!mounted || !widget.owner.active) return;
      final items = learningItems(data['items']);
      _savedWordKeys.value = {
        for (final item in items)
          readingWordSaveKey(
            item['english'] as String? ?? '',
            item['meaning'] as String? ?? '',
          ),
        ..._sessionSavedWordKeys,
      };
    } catch (_) {
      // Leave current state untouched if background word sync fails.
    }
  }

  Future<void> _saveReadingWord(Map<String, dynamic> item) async {
    final vocabulary = widget.owner.vocabulary;
    if (vocabulary == null) return;
    final english = (item['word'] as String? ?? '').trim();
    final meaning = (item['meaning'] as String? ?? '').trim();
    if (english.isEmpty || meaning.isEmpty) return;
    final key = readingWordSaveKey(english, meaning);
    if (_savedWordKeys.value.contains(key) ||
        _savingWordKeys.value.contains(key)) {
      return;
    }
    _savingWordKeys.value = {..._savingWordKeys.value, key};
    try {
      await vocabulary.saveReadingWord({
        'english': english,
        'meaning': meaning,
        if (item['phonetic'] case final String phonetic
            when phonetic.trim().isNotEmpty)
          'phonetic': phonetic.trim(),
        if (item['example'] case final String example
            when example.trim().isNotEmpty)
          'example': example.trim(),
        if (item['translation'] case final String translation
            when translation.trim().isNotEmpty)
          'translation': translation.trim(),
      });
      if (!mounted) return;
      _sessionSavedWordKeys.add(key);
      _savedWordKeys.value = {..._savedWordKeys.value, key};
    } catch (e) {
      if (!mounted) return;
      final text = e is ApiFailure
          ? e.message
          : 'Không lưu được từ vựng. Hãy thử lại.';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
    } finally {
      if (mounted) {
        _savingWordKeys.value = {
          for (final existing in _savingWordKeys.value)
            if (existing != key) existing,
        };
      }
    }
  }

  @override
  void dispose() {
    _savedWordKeys.dispose();
    _savingWordKeys.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lesson = _catalogueLesson;
    final canSaveWords = widget.owner.vocabulary != null;
    final isListening = lesson?.kind == 'LISTENING';
    final isReading = lesson?.kind == 'READING';
    return FigmaPage(
      title: isListening || isReading
          ? 'Bài tập'
          : lesson == null
          ? 'Bài học'
          : learningKindLabel(lesson.kind),
      titleStyle: designHeading(18),
      bottom: CustomAppButton(
        key: const Key('learningStart'),
        text: isListening
            ? 'Bắt đầu luyện nghe'
            : isReading
            ? 'Bắt đầu luyện đọc'
            : lesson?.state == 'COMPLETED'
            ? 'Học lại'
            : 'Bắt đầu học',
        isLoading: opening,
        onPressed: opening
            ? null
            : () async {
                setState(() => opening = true);
                await previewPush<void>(
                  context,
                  LearningAttemptPage(
                    owner: widget.owner,
                    lessonId: widget.lessonId,
                  ),
                );
                if (context.mounted) Navigator.pop(context);
              },
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          learningHeading(lesson?.title ?? 'Bài học', size: 28),
          if (isListening || isReading) ...[
            if (lesson!.description.isNotEmpty) ...[
              const SizedBox(height: 6),
              learningBody(lesson.description, size: 14),
            ],
            const SizedBox(height: 16),
            PracticeLessonFacts(lesson: lesson),
          ] else ...[
            const SizedBox(height: 16),
            LearningCard(
              children: [
                if ((lesson?.description ?? '').isNotEmpty)
                  learningBody(lesson!.description),
                learningBody(
                  '${lesson?.minutes ?? '—'} phút · ${lesson?.questionCount ?? 5} câu luyện tập',
                ),
                if (lesson?.json['audioDurationMs'] case final num ms)
                  learningBody('Audio ${(ms / 1000).ceil()} giây'),
                learningBody(
                  'Chọn đáp án rồi bấm Kiểm tra để xem giải thích. Làm đủ câu và bấm Nộp bài để lưu kết quả.',
                ),
                if (lesson?.kind == 'VOCABULARY')
                  learningBody('Học 10 từ về gia đình trước phần luyện tập.'),
                learningBody(
                  'Nếu thoát trước khi nộp bài, tiến độ và thời gian lượt này sẽ bị hủy để lần sau làm lại từ đầu.',
                ),
              ],
            ),
          ],
          if (lesson == null ||
              lesson.kind == 'READING' ||
              lesson.kind == 'LISTENING')
            FutureBuilder<List<Json>>(
              future: _keyVocabulary,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return const Padding(
                    padding: EdgeInsets.only(top: 16),
                    child: LinearProgressIndicator(),
                  );
                }
                if (snapshot.hasError) {
                  return LearningError(
                    'Không tải được từ vựng trọng tâm.',
                    retry: () => setState(() {
                      _keyVocabulary = _loadKeyVocabulary();
                    }),
                  );
                }
                final items = snapshot.data!;
                final preparation = _introContent['preparation'] as Json?;
                final coverImageUrl =
                    (_introContent['coverImageUrl'] as String?) ??
                    lesson?.coverImageUrl;
                if (isListening) {
                  if (items.isEmpty &&
                      preparation == null &&
                      (coverImageUrl == null || coverImageUrl.trim().isEmpty)) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: ListeningPreparation(
                      preparation: preparation,
                      words: items,
                      coverImageUrl: coverImageUrl,
                    ),
                  );
                }
                final heroCover =
                    isReading &&
                        coverImageUrl != null &&
                        coverImageUrl.trim().isNotEmpty
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        child: AspectRatio(
                          aspectRatio: 16 / 9,
                          child: LearningMediaImage(
                            key: const ValueKey('reading-prep-hero-image'),
                            imageUrl: coverImageUrl,
                            width: double.infinity,
                            fit: BoxFit.cover,
                          ),
                        ),
                      )
                    : null;
                if (heroCover == null && items.isEmpty) {
                  return const SizedBox.shrink();
                }
                return Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ?heroCover,
                      if (heroCover != null && items.isNotEmpty)
                        const SizedBox(height: 16),
                      if (items.isNotEmpty)
                        KeyVocabularySection(
                          items: items,
                          compact: true,
                          header: PracticeSectionHeader(
                            icon: 'home-v2/imgVuesaxBulkBook',
                            title: 'Từ vựng trọng tâm',
                            trailing: PracticeCountBadge('${items.length} từ'),
                          ),
                          savedWordKeysListenable: canSaveWords
                              ? _savedWordKeys
                              : null,
                          savingWordKeysListenable: canSaveWords
                              ? _savingWordKeys
                              : null,
                          onSaveWord: canSaveWords ? _saveReadingWord : null,
                        ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}

/// Curriculum audio only: reopen paused at zero; no microphone or play counter.
class LearningAudio extends StatefulWidget {
  const LearningAudio({
    super.key,
    required this.url,
    this.onProgress,
    this.onStopped,
  });
  final String url;
  final VoidCallback? onProgress, onStopped;
  @override
  State<LearningAudio> createState() => _LearningAudioState();
}

class _LearningAudioState extends State<LearningAudio>
    with WidgetsBindingObserver {
  final player = AudioPlayer();
  final subscriptions = <StreamSubscription<dynamic>>[];
  Duration position = Duration.zero, duration = Duration.zero;
  bool busy = false, playing = false;
  String? error;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    subscriptions.add(
      player.onPositionChanged.listen((p) {
        if (playing &&
            p > position &&
            p - position < const Duration(seconds: 3)) {
          widget.onProgress?.call();
        }
        if (mounted) setState(() => position = p);
      }),
    );
    subscriptions.add(
      player.onDurationChanged.listen((d) {
        if (mounted) setState(() => duration = d);
      }),
    );
    subscriptions.add(
      player.onPlayerStateChanged.listen((s) {
        if (s != PlayerState.playing) widget.onStopped?.call();
        if (mounted) setState(() => playing = s == PlayerState.playing);
      }),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) player.pause();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.onStopped?.call();
    for (final s in subscriptions) {
      s.cancel();
    }
    player.dispose();
    super.dispose();
  }

  Future<void> toggle() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (playing) {
        await player.pause();
      } else if (player.state == PlayerState.paused) {
        await player.resume();
      } else {
        await player.play(UrlSource(widget.url));
      }
      final d = await player.getDuration();
      if (mounted && d != null) setState(() => duration = d);
    } catch (_) {
      if (mounted) {
        setState(() => error = 'Không tải được audio. Bấm phát để thử lại.');
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Row(
        children: [
          IconButton(
            tooltip: playing ? 'Tạm dừng' : 'Phát audio',
            onPressed: busy ? null : toggle,
            icon: Icon(
              playing ? Icons.pause_circle : Icons.play_circle,
              size: 40,
              color: AppColors.grey900,
            ),
          ),
          Expanded(
            child: Slider(
              value: position.inMilliseconds.toDouble().clamp(
                0,
                duration.inMilliseconds.toDouble(),
              ),
              max: duration.inMilliseconds > 0
                  ? duration.inMilliseconds.toDouble()
                  : 1,
              onChanged: busy || duration == Duration.zero
                  ? null
                  : (value) async {
                      try {
                        await player.seek(
                          Duration(milliseconds: value.round()),
                        );
                      } catch (_) {
                        if (mounted) {
                          setState(
                            () => error = 'Không tua được audio. Hãy thử lại.',
                          );
                        }
                      }
                    },
            ),
          ),
          Text(
            '${position.inSeconds}s / ${duration.inSeconds}s',
            style: designText(12),
          ),
        ],
      ),
      if (error != null) Text(error!, style: designText(12)),
    ],
  );
}
