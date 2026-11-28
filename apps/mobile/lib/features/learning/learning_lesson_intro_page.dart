import 'dart:async';
import 'dart:math' as math;
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

part 'learning_lesson_intro_widgets.dart';

class LearningLessonIntroPage extends StatefulWidget {
  const LearningLessonIntroPage({
    super.key,
    required this.owner,
    required this.lessonId,
    this.skipStudy = false,
  });
  final LearningController owner;
  final String lessonId;
  final bool skipStudy;
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
    if (mounted && widget.owner.active) {
      setState(() => _introContent = content ?? {});
    }
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
    final pageTitle = isListening || isReading
        ? 'Bài tập'
        : lesson == null
        ? 'Bài học'
        : learningKindLabel(lesson.kind);
    final rawCover =
        (_introContent['coverImageUrl'] as String?) ?? lesson?.coverImageUrl;
    final coverImageUrl = rawCover != null && rawCover.trim().isNotEmpty
        ? rawCover.trim()
        : null;
    final hasCoverImage = coverImageUrl != null;
    final topInset = MediaQuery.paddingOf(context).top;
    final bottomInset = math.max(
      32.0,
      MediaQuery.paddingOf(context).bottom + 8,
    );
    final canPop = Navigator.of(context).canPop();

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: AppColors.grey25,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: AppColors.grey25,
        body: Column(
          children: [
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final isNarrow = constraints.maxWidth < 340;
                  final photoHeight =
                      topInset + (isNarrow ? 232.0 : 254.0);
                  final noPhotoHeroHeight =
                      topInset + (isNarrow ? 296.0 : 316.0);

                  return SingleChildScrollView(
                    child: Stack(
                      children: [
                        if (hasCoverImage)
                          _LessonCoverHeroBackdrop(
                            imageKey: ValueKey(
                              isListening
                                  ? 'listening-prep-hero-image'
                                  : 'reading-prep-hero-image',
                            ),
                            coverImageUrl: coverImageUrl,
                            photoHeight: photoHeight,
                          )
                        else
                          Positioned(
                            top: 0,
                            left: 0,
                            right: 0,
                            height: noPhotoHeroHeight,
                            child: const _LessonFallbackHeroBackdrop(),
                          ),
                        SafeArea(
                          bottom: false,
                          child: Align(
                            alignment: Alignment.topCenter,
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 560),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  _LessonIntroTopBar(
                                    title: pageTitle,
                                    canPop: canPop,
                                    onBack: () => Navigator.of(context).pop(),
                                  ),
                                  SizedBox(
                                    height: hasCoverImage
                                        ? (isNarrow ? 104 : 122)
                                        : 16,
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 20,
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.center,
                                      children: [
                                        if (lesson?.cefrLevel != null &&
                                            lesson!.cefrLevel!
                                                .trim()
                                                .isNotEmpty) ...[
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 10,
                                              vertical: 3.5,
                                            ),
                                            decoration: BoxDecoration(
                                              color: const Color(0x2BFFFFFF),
                                              borderRadius: AppRadius.pill,
                                              border: Border.all(
                                                color: const Color(0x47FFFFFF),
                                              ),
                                            ),
                                            child: Text(
                                              'Trình độ ${lesson.cefrLevel}',
                                              style: designText(
                                                11.5,
                                                weight: FontWeight.w700,
                                                color: Colors.white,
                                                height: 1.2,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(height: 10),
                                        ],
                                        Text(
                                          lesson?.title ?? 'Bài học',
                                          textAlign: TextAlign.center,
                                          style:
                                              designHeading(
                                                isNarrow ? 21 : 23.5,
                                                color: Colors.white,
                                                height: 1.28,
                                              ).copyWith(
                                                fontWeight: FontWeight.w700,
                                                shadows: const [
                                                  Shadow(
                                                    color: Color(0x3D091A10),
                                                    blurRadius: 10,
                                                    offset: Offset(0, 2),
                                                  ),
                                                ],
                                              ),
                                        ),
                                        if ((isListening || isReading) &&
                                            lesson!.description.isNotEmpty) ...[
                                          const SizedBox(height: 8),
                                          Text(
                                            lesson.description,
                                            textAlign: TextAlign.center,
                                            style: designText(
                                              14,
                                              weight: FontWeight.w500,
                                              color: const Color(0xEBFFFFFF),
                                              height: 1.45,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.fromLTRB(
                                      16,
                                      20,
                                      16,
                                      16,
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.stretch,
                                      children: [
                                        if (isListening || isReading)
                                          PracticeLessonFacts(lesson: lesson!)
                                        else
                                          LearningCard(
                                            gap: 12,
                                            children: [
                                              if ((lesson?.description ?? '')
                                                  .isNotEmpty)
                                                learningBody(
                                                  lesson!.description,
                                                  size: 14,
                                                ),
                                              Text(
                                                '${lesson?.minutes ?? '—'} phút · ${lesson?.questionCount ?? 5} câu luyện tập',
                                                style: designText(
                                                  14,
                                                  weight: FontWeight.w600,
                                                  color: AppColors.primary700,
                                                ),
                                              ),
                                              if (lesson?.json['audioDurationMs']
                                                  case final num ms)
                                                learningBody(
                                                  'Audio ${(ms / 1000).ceil()} giây',
                                                  size: 14,
                                                ),
                                              learningBody(
                                                'Chọn đáp án rồi bấm Kiểm tra để xem giải thích. Làm đủ câu và bấm Nộp bài để lưu kết quả.',
                                                size: 14,
                                              ),
                                              if (lesson?.kind == 'VOCABULARY')
                                                learningBody(
                                                  'Học 10 từ về gia đình trước phần luyện tập.',
                                                  size: 14,
                                                ),
                                              learningBody(
                                                'Nếu thoát trước khi nộp bài, tiến độ và thời gian lượt này sẽ bị hủy để lần sau làm lại từ đầu.',
                                                size: 13,
                                              ),
                                            ],
                                          ),
                                        if (lesson == null ||
                                            lesson.kind == 'READING' ||
                                            lesson.kind == 'LISTENING')
                                          FutureBuilder<List<Json>>(
                                            future: _keyVocabulary,
                                            builder: (context, snapshot) {
                                              if (snapshot.connectionState !=
                                                  ConnectionState.done) {
                                                return const Padding(
                                                  padding: EdgeInsets.only(
                                                    top: 16,
                                                  ),
                                                  child:
                                                      LinearProgressIndicator(),
                                                );
                                              }
                                              if (snapshot.hasError) {
                                                return Padding(
                                                  padding:
                                                      const EdgeInsets.only(
                                                        top: 16,
                                                      ),
                                                  child: LearningError(
                                                    'Không tải được từ vựng trọng tâm.',
                                                    retry: () => setState(() {
                                                      _keyVocabulary =
                                                          _loadKeyVocabulary();
                                                    }),
                                                  ),
                                                );
                                              }
                                              final items = snapshot.data!;
                                              final preparation =
                                                  _introContent['preparation']
                                                      as Json?;
                                              if (isListening) {
                                                final situation =
                                                    (preparation?['situation']
                                                            as String?) ??
                                                        '';
                                                final objective =
                                                    (preparation?['objective']
                                                            as String?) ??
                                                        '';
                                                final hasPrep =
                                                    situation.isNotEmpty ||
                                                    objective.isNotEmpty;
                                                if (items.isEmpty && !hasPrep) {
                                                  return const SizedBox.shrink();
                                                }
                                                return Padding(
                                                  padding:
                                                      const EdgeInsets.only(
                                                        top: 16,
                                                      ),
                                                  child: ListeningPreparation(
                                                    preparation: preparation,
                                                    words: items,
                                                  ),
                                                );
                                              }
                                              if (items.isEmpty) {
                                                return const SizedBox.shrink();
                                              }
                                              return Padding(
                                                padding: const EdgeInsets.only(
                                                  top: 16,
                                                ),
                                                child: KeyVocabularySection(
                                                  items: items,
                                                  compact: true,
                                                  header: PracticeSectionHeader(
                                                    icon:
                                                        'home-v2/imgVuesaxBulkBook',
                                                    title: 'Từ vựng trọng tâm',
                                                    trailing:
                                                        PracticeCountBadge(
                                                          '${items.length} từ',
                                                        ),
                                                  ),
                                                  savedWordKeysListenable:
                                                      canSaveWords
                                                      ? _savedWordKeys
                                                      : null,
                                                  savingWordKeysListenable:
                                                      canSaveWords
                                                      ? _savingWordKeys
                                                      : null,
                                                  onSaveWord: canSaveWords
                                                      ? _saveReadingWord
                                                      : null,
                                                ),
                                              );
                                            },
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: EdgeInsets.fromLTRB(12, 12, 12, bottomInset),
              child: CustomAppButton(
                key: const Key('learningStart'),
                text: isListening
                    ? 'Bắt đầu luyện nghe'
                    : isReading
                    ? 'Bắt đầu luyện đọc'
                    : widget.skipStudy
                    ? (lesson?.state == 'COMPLETED'
                          ? 'Làm lại bài tập'
                          : 'Bắt đầu luyện tập')
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
                            skipStudy: widget.skipStudy,
                          ),
                        );
                        if (context.mounted) Navigator.pop(context);
                      },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

