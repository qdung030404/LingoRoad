import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/history_controls.dart';
import 'learning_controller.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';
import 'activity_collector.dart';
import 'listening_audio.dart';
import 'listening_widgets.dart';
import 'practice_widgets.dart';

String learningKindLabel(String kind) => switch (kind) {
  'GRAMMAR' => 'Ngữ pháp',
  'VOCABULARY' => 'Từ vựng',
  'READING' => 'Đọc',
  'LISTENING' => 'Nghe',
  _ => kind,
};

Future<void> openLearningLesson(
  BuildContext context,
  LearningController controller, {
  String? lessonId,
  String? attemptId,
}) async {
  await previewPush<void>(
    context,
    attemptId == null && lessonId != null
        ? LearningLessonIntroPage(owner: controller, lessonId: lessonId)
        : LearningAttemptPage(
            owner: controller,
            lessonId: lessonId,
            attemptId: attemptId,
          ),
  );
  if (controller.active) await controller.refresh();
}

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
                if (isListening) {
                  if (items.isEmpty && preparation == null) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: ListeningPreparation(
                      preparation: preparation,
                      words: items,
                    ),
                  );
                }
                if (items.isEmpty) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: KeyVocabularySection(
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
                );
              },
            ),
        ],
      ),
    );
  }
}

class LearningCatalogue extends StatefulWidget {
  const LearningCatalogue({
    super.key,
    required this.controller,
    required this.kinds,
    this.onOpenHistory,
  });
  final LearningController controller;
  final List<String> kinds;
  final VoidCallback? onOpenHistory;

  @override
  State<LearningCatalogue> createState() => _LearningCatalogueState();
}

class _LearningCatalogueState extends State<LearningCatalogue> {
  String? selectedLevel;

  Widget _levelDropdown(List<String> levels, String? level) {
    final foreground = level == null ? AppColors.grey900 : Colors.white;
    return PopupMenuButton<String>(
      key: const ValueKey('practice-level-dropdown'),
      tooltip: 'Chọn cấp độ',
      position: PopupMenuPosition.under,
      offset: const Offset(0, 6),
      color: AppColors.grey0,
      shape: const RoundedRectangleBorder(borderRadius: AppRadius.cardSm),
      borderRadius: AppRadius.tagRadius,
      initialValue: level ?? '',
      onSelected: (value) =>
          setState(() => selectedLevel = value.isEmpty ? null : value),
      itemBuilder: (context) => [
        for (final option in <String?>[null, ...levels])
          CheckedPopupMenuItem<String>(
            value: option ?? '',
            checked: option == level,
            child: Text(option ?? 'Tất cả cấp độ'),
          ),
      ],
      child: Ink(
        decoration: BoxDecoration(
          color: level == null ? AppColors.grey0 : AppColors.primary700,
          borderRadius: AppRadius.tagRadius,
          border: Border.all(
            color: level == null ? AppColors.grey200 : AppColors.primary700,
          ),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              spacing: 8,
              children: [
                Icon(Icons.tune_rounded, size: 18, color: foreground),
                Flexible(
                  child: Text(
                    level == null ? 'Tất cả cấp độ' : 'Cấp độ $level',
                    overflow: TextOverflow.ellipsis,
                    style: designText(
                      14,
                      weight: FontWeight.w600,
                      color: foreground,
                    ),
                  ),
                ),
                Icon(Icons.expand_more_rounded, size: 18, color: foreground),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final lessons = controller.lessons.where(
      (lesson) => widget.kinds.contains(lesson.kind),
    );
    final isReading =
        widget.kinds.length == 1 && widget.kinds.single == 'READING';
    final isListening =
        widget.kinds.length == 1 && widget.kinds.single == 'LISTENING';
    final levels = isReading || isListening
        ? (lessons
              .map((lesson) => lesson.cefrLevel)
              .whereType<String>()
              .toSet()
              .toList()
            ..sort())
        : <String>[];
    final level = levels.contains(selectedLevel) ? selectedLevel : null;
    final visible = level == null
        ? lessons
        : lessons.where((lesson) => lesson.cefrLevel == level);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (controller.catalogueError != null)
          LearningError(
            controller.catalogueError!,
            retry: controller.loadCatalogue,
          )
        else if (controller.error != null)
          LearningError(controller.error!, retry: controller.refresh),
        if (levels.isNotEmpty || widget.onOpenHistory != null) ...[
          Row(
            children: [
              Expanded(
                child: Align(
                  alignment: AlignmentDirectional.centerStart,
                  child: levels.isEmpty
                      ? const SizedBox.shrink()
                      : _levelDropdown(levels, level),
                ),
              ),
              if (widget.onOpenHistory case final openHistory?) ...[
                const SizedBox(width: 8),
                IconButton.filledTonal(
                  key: const ValueKey('practice-history'),
                  tooltip: 'Lịch sử làm bài',
                  onPressed: openHistory,
                  icon: const Icon(Icons.history_rounded, size: 24),
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.primary25,
                    foregroundColor: AppColors.primary800,
                    minimumSize: const Size.square(48),
                    padding: EdgeInsets.zero,
                    shape: RoundedRectangleBorder(
                      borderRadius: AppRadius.tagRadius,
                      side: const BorderSide(color: AppColors.primary100),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
        ],
        if ((controller.catalogueLoading || controller.loading) &&
            controller.lessons.isEmpty &&
            controller.catalogueError == null &&
            controller.error == null)
          const Center(child: CircularProgressIndicator()),
        for (final lesson in visible) ...[
          if (isListening || isReading)
            _practiceLessonCard(lesson, isReading: isReading)
          else
            LearningCard(
              key: ValueKey('learning-lesson-${lesson.id}'),
              onTap: () =>
                  openLearningLesson(context, controller, lessonId: lesson.id),
              children: [
                learningHeading(lesson.title),
                learningBody(lesson.description),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    LearningPill(learningKindLabel(lesson.kind), small: true),
                    LearningPill('${lesson.minutes} phút', small: true),
                    LearningPill(
                      lesson.state == 'COMPLETED' ? 'Hoàn thành' : 'Chưa học',
                      small: true,
                      selected: lesson.state == 'COMPLETED',
                    ),
                  ],
                ),
                if (lesson.json['latestResult'] case final Map result)
                  learningBody(
                    'Lần gần nhất: ${result['correctCount']}/${result['totalQuestions']} câu đúng',
                    size: 14,
                  ),
              ],
            ),
          const SizedBox(height: 12),
        ],
        if (lessons.isEmpty &&
            controller.catalogueLoaded &&
            !controller.catalogueLoading &&
            !controller.loading &&
            controller.catalogueError == null &&
            controller.error == null)
          learningBody('Chưa có bài học được xuất bản.'),
        if ((isListening || isReading) && lessons.isNotEmpty && visible.isEmpty)
          learningBody(
            isReading
                ? 'Chưa có bài đọc ở cấp độ này.'
                : 'Chưa có bài nghe ở cấp độ này.',
          ),
      ],
    );
  }

  Widget _practiceLessonCard(LearningLesson lesson, {required bool isReading}) {
    final complete = lesson.state == 'COMPLETED';
    final inProgress = lesson.state == 'IN_PROGRESS';
    final levelBadge = lesson.cefrLevel ?? (isReading ? 'Đọc' : null);
    return Material(
      color: AppColors.grey5,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.cardRadius,
        side: const BorderSide(color: AppColors.grey100),
      ),
      child: InkWell(
        key: ValueKey('learning-lesson-${lesson.id}'),
        borderRadius: AppRadius.cardRadius,
        onTap: () =>
            openLearningLesson(context, widget.controller, lessonId: lesson.id),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              learningHeading(lesson.title, size: 20),
              if (lesson.description.isNotEmpty) ...[
                const SizedBox(height: 8),
                learningBody(lesson.description, size: 15),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        if (!complete)
                          LearningPill(
                            inProgress ? 'Đang học' : 'Chưa học',
                            small: true,
                            fill: inProgress ? AppColors.warning0 : null,
                            color: inProgress
                                ? const Color(0xFFE28A00)
                                : AppColors.grey900,
                          ),
                        LearningPill(
                          '${lesson.minutes} phút',
                          small: true,
                          icon: const FigmaAsset(
                            'practice/imgVuesaxLinearTimer',
                            size: 18,
                          ),
                        ),
                        if (levelBadge case final String level)
                          LearningPill(
                            level,
                            small: true,
                            fill: AppColors.primary25,
                            color: AppColors.primary700,
                          ),
                        if (lesson.json['latestResult'] case final Map result)
                          LearningPill(
                            '${result['correctCount']}/${result['totalQuestions']} câu đúng',
                            small: true,
                            color: AppColors.grey800,
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (complete)
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: AppColors.primary600,
                          width: 2.4,
                        ),
                      ),
                      child: CustomPaint(painter: _BoldCheckPainter()),
                    )
                  else
                    FigmaAsset(
                      'practice/imgFrame${inProgress ? 75 : 76}',
                      size: 28,
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BoldCheckPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.primary600
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final path = Path()
      ..moveTo(size.width * 0.28, size.height * 0.52)
      ..lineTo(size.width * 0.44, size.height * 0.67)
      ..lineTo(size.width * 0.72, size.height * 0.35);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class LearningError extends StatelessWidget {
  const LearningError(this.message, {super.key, required this.retry});
  final String message;
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(message, style: designText(14, color: AppColors.grey800)),
        TextButton(onPressed: retry, child: const Text('Thử lại')),
      ],
    ),
  );
}

class LearningAttemptPage extends StatefulWidget {
  const LearningAttemptPage({
    super.key,
    required this.owner,
    this.lessonId,
    this.attemptId,
    this.audioEngineFactory,
  });
  final LearningController owner;
  final String? lessonId, attemptId;
  final ListeningAudioEngine Function()? audioEngineFactory;
  @override
  State<LearningAttemptPage> createState() => _LearningAttemptPageState();
}

class _LearningAttemptPageState extends State<LearningAttemptPage>
    with WidgetsBindingObserver {
  late final controller = LearningAttemptController(owner: widget.owner);
  ActivityCollector? activity;
  ListeningAudioController? _audio;
  String? _audioIdentity;
  bool _leaving = false;
  bool _viewingPassage = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    controller.addListener(_attemptChanged);
    controller.load(lessonId: widget.lessonId, attemptId: widget.attemptId);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) {
      controller.flush();
      activity?.pause();
      unawaited(_audio?.pause());
    } else {
      activity?.resume();
    }
  }

  void _attemptChanged() {
    final attempt = controller.attempt;
    if (attempt == null || controller.loading) return;
    _syncAudio(attempt);
    if (attempt.completed) {
      activity?.finish();
      return;
    }
    if (activity?.attemptId == attempt.id) return;
    activity?.dispose();
    final outbox = widget.owner.activity;
    if (outbox == null) return;
    activity = ActivityCollector(
      outbox: outbox,
      attemptId: attempt.id,
      isEligible: () =>
          mounted &&
          (_viewingPassage || ModalRoute.of(context)?.isCurrent == true) &&
          !controller.loading &&
          controller.attempt?.completed == false,
    );
    activity!.addListener(_activityChanged);
    activity!.start();
  }

  void _syncAudio(LearningAttempt attempt) {
    final url = attempt.content['audioUrl'];
    if (attempt.lesson.kind != 'LISTENING' || url is! String) return;
    final identity = '${attempt.id}-${attempt.completed}-$url';
    if (_audioIdentity == identity) return;
    _audio?.removeListener(_audioChanged);
    _audio?.dispose();
    _audioIdentity = identity;
    _audio = ListeningAudioController(
      url: widget.owner.repository.audioUrl(url),
      isCurrent: () => mounted && widget.owner.active,
      engine: widget.audioEngineFactory?.call(),
      durationMs: (attempt.content['audioDurationMs'] as num?)?.toInt(),
      onProgress: () {
        if (controller.attempt?.completed == false) activity?.audioAdvanced();
      },
      onStopped: () => activity?.audioStopped(),
    )..addListener(_audioChanged);
    if (attempt.completed) unawaited(widget.owner.refresh());
  }

  void _audioChanged() {
    if (mounted && widget.owner.active) setState(() {});
  }

  void _activityChanged() {
    if (mounted) setState(() {});
  }

  Future<void> _checkpointActivity() async {
    try {
      await activity?.checkpoint().timeout(const Duration(seconds: 2));
    } on TimeoutException {
      /* Durable outbox continues uploading independently. */
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    controller.removeListener(_attemptChanged);
    _audio?.removeListener(_audioChanged);
    _audio?.dispose();
    activity?.dispose();
    controller.dispose();
    super.dispose();
  }

  Future<void> leave() async {
    if (_leaving) return;
    await _audio?.pause();
    if (!mounted) return;
    final current = controller.attempt;
    if (current == null || current.completed) {
      _leaving = true;
      try {
        await _checkpointActivity();
        await controller.flush();
        if (mounted) Navigator.pop(context);
      } finally {
        _leaving = false;
      }
      return;
    }
    _leaving = true;
    try {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: const Text('Hủy bài đang làm?'),
          content: const Text(
            'Nếu thoát bây giờ, tiến độ đang làm và thời gian học của lượt này sẽ bị hủy. Lần sau bạn sẽ làm lại từ đầu.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Ở lại'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Hủy bài & thoát'),
            ),
          ],
        ),
      );
      if (!mounted || confirmed != true) return;
      await activity?.discard();
      final cancelled = await controller.cancel();
      if (!mounted) return;
      if (!cancelled) {
        if (controller.attempt?.completed == true) return;
        activity?.dispose();
        activity = null;
        _attemptChanged();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              controller.error ?? 'Không hủy được bài học. Hãy thử lại.',
            ),
          ),
        );
        return;
      }
      Navigator.pop(context);
    } finally {
      _leaving = false;
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) {
      final attempt = controller.attempt;
      if (attempt == null) {
        return FigmaPage(
          title: 'Bài học',
          leading: IconButton(
            onPressed: leave,
            icon: const Icon(Icons.arrow_back),
          ),
          child: Center(
            child: controller.loading
                ? const CircularProgressIndicator()
                : Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      LearningError(
                        controller.error ?? 'Không tải được bài học.',
                        retry: () => controller.load(
                          lessonId: widget.lessonId,
                          attemptId: widget.attemptId,
                        ),
                      ),
                      if (widget.attemptId == null &&
                          widget.owner.lessons.any(
                            (l) =>
                                l.id == widget.lessonId &&
                                l.kind == 'LISTENING',
                          ))
                        const Padding(
                          padding: EdgeInsets.all(16),
                          child: Text(
                            'Thử lại sẽ tạo lượt học mới và có thể thay thế lượt chưa nộp của bài này.',
                          ),
                        ),
                    ],
                  ),
          ),
        );
      }
      if (attempt.completed) return _result(attempt);
      final study = controller.phase == 'STUDY' && attempt.steps.isNotEmpty;
      final items = study ? attempt.steps : attempt.questions;
      final index = controller.index.clamp(0, items.length - 1);
      final item = items[index];
      final passage = study ? null : attempt.content['passage'] as String?;
      final isReadingLesson = attempt.lesson.kind == 'READING';
      final listening = attempt.lesson.kind == 'LISTENING';
      final reading = passage != null && isReadingLesson;
      final options = study ? const <Json>[] : learningItems(item['options']);
      final questionId = study ? null : item['id'] as String;
      final answer = questionId == null ? null : attempt.answer(questionId);
      final checked = answer?['checked'] == true;
      final blocked = controller.busy;
      final last = index == items.length - 1;
      return Listener(
        onPointerDown: (_) => activity?.touch(),
        onPointerMove: (_) => activity?.touch(),
        onPointerSignal: (_) => activity?.touch(),
        child: PopScope(
          canPop: false,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) leave();
          },
          child: FigmaPage(
            title: listening
                ? 'Luyện nghe'
                : reading
                ? 'Luyện Đọc'
                : attempt.lesson.title,
            titleStyle: designHeading(18),
            leading: IconButton(
              tooltip: 'Thoát',
              onPressed: leave,
              icon: listening || reading
                  ? FigmaAsset(
                      listening
                          ? 'listening/imgVuesaxLinearArrowLeft'
                          : 'reading/imgVuesaxLinearArrowLeft',
                      size: 24,
                    )
                  : const Icon(Icons.arrow_back),
            ),
            bottom: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (!isReadingLesson && !listening) ...[
                  if (controller.unsynced && controller.error != null)
                    Text(
                      'Chưa đồng bộ · Bản nháp đã giữ trên thiết bị',
                      style: designText(12, color: AppColors.grey800),
                    ),
                  if ((widget.owner.activity?.pendingSeconds ?? 0) > 0)
                    Text(
                      'Chờ đồng bộ thời gian: ${widget.owner.activity!.pendingSeconds} giây',
                      key: const Key('activityPending'),
                      style: designText(12),
                    ),
                ],
                if (listening &&
                    controller.error == null &&
                    (activity?.error != null ||
                        widget.owner.activity?.error != null))
                  LearningError(
                    'Chưa lưu được tiến độ. Bạn thử lại nhé.',
                    retry: () {
                      if (activity?.error != null) {
                        activity?.start();
                      } else {
                        widget.owner.activity?.flush();
                      }
                    },
                  ),
                if (!listening && activity?.error != null)
                  LearningError(activity!.error!, retry: activity!.start),
                if (!listening && widget.owner.activity?.error != null)
                  LearningError(
                    widget.owner.activity!.error!,
                    retry: () => widget.owner.activity!.flush(),
                  ),
                if (controller.error != null)
                  LearningError(controller.error!, retry: controller.retry),
                if (controller.notice != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      listening
                          ? 'Bài làm vừa được cập nhật. Hãy kiểm tra lại đáp án.'
                          : controller.notice!,
                      style: designText(12, color: AppColors.grey800),
                    ),
                  ),
                Row(
                  children: [
                    SizedBox(
                      width: 48,
                      child: CustomAppButton(
                        text: '',
                        isSecondary: true,
                        borderRadius: reading || listening
                            ? AppRadius.tagRadius
                            : null,
                        icon: listening || reading
                            ? Opacity(
                                opacity: blocked || index == 0 ? 0.35 : 1,
                                child: FigmaAsset(
                                  listening
                                      ? 'listening/imgVuesaxLinearArrowLeft1'
                                      : 'reading/imgVuesaxLinearArrowLeft1',
                                  size: 20,
                                ),
                              )
                            : const Icon(Icons.chevron_left),
                        onPressed: blocked || index == 0
                            ? null
                            : () => controller.move(
                                study ? 'STUDY' : 'QUIZ',
                                index - 1,
                              ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (reading && !study) ...[
                      Expanded(
                        child: CustomAppButton(
                          text: '${index + 1}/${items.length}',
                          isSecondary: true,
                          borderRadius: AppRadius.tagRadius,
                          icon: const FigmaAsset(
                            'reading/imgVuesaxBoldCategory',
                            size: 20,
                          ),
                          onPressed: blocked
                              ? null
                              : () => _chooseQuestion(attempt, index),
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    Expanded(
                      child: CustomAppButton(
                        key: const Key('learningPrimaryAction'),
                        isLoading: controller.busy,
                        borderRadius: reading || listening
                            ? AppRadius.tagRadius
                            : null,
                        text: study
                            ? (last ? 'Bắt đầu luyện tập' : 'Tiếp theo')
                            : (!checked
                                  ? 'Kiểm tra'
                                  : (last ? 'Nộp bài' : 'Tiếp theo')),
                        onPressed:
                            blocked ||
                                (!study &&
                                    !checked &&
                                    (controller.selected(questionId!) == null ||
                                        (attempt.lesson.kind == 'LISTENING' &&
                                            _audio?.loaded != true))) ||
                                (!study &&
                                    checked &&
                                    last &&
                                    !attempt.allChecked)
                            ? null
                            : () async {
                                await activity?.touch();
                                if (study) {
                                  controller.move(
                                    last ? 'QUIZ' : 'STUDY',
                                    last ? 0 : index + 1,
                                  );
                                } else if (!checked) {
                                  controller.check(questionId!);
                                } else if (last) {
                                  await _checkpointActivity();
                                  await controller.submit();
                                } else {
                                  controller.move('QUIZ', index + 1);
                                }
                              },
                      ),
                    ),
                  ],
                ),
              ],
            ),
            child: ListView(
              key: reading || listening ? ValueKey(questionId) : null,
              padding: const EdgeInsets.all(16),
              children: [
                if (listening || reading) ...[
                  ClipRRect(
                    borderRadius: AppRadius.pill,
                    child: LinearProgressIndicator(
                      value: (index + 1) / items.length,
                      minHeight: 4,
                      backgroundColor: AppColors.grey200,
                      color: AppColors.primary500,
                      semanticsLabel:
                          'Tiến độ bài luyện tập, câu ${index + 1} trên ${items.length}',
                    ),
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          attempt.lesson.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: designText(
                            14,
                            weight: FontWeight.w500,
                            color: AppColors.grey800,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                        'Câu ${index + 1}/${items.length}',
                        style: designText(13, weight: FontWeight.w600),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                ] else
                  PreviewProgress(
                    index: index,
                    total: items.length,
                    label:
                        '${study ? 'Học' : 'Câu'} ${index + 1}/${items.length}',
                  ),
                if (study)
                  LearningCard(
                    children: [
                      learningHeading(
                        item['word'] as String? ?? item['title'] as String,
                        size: 28,
                      ),
                      if (item['phonetic'] case final String text)
                        learningBody(text),
                      if (item['audioUrl'] case final String url)
                        LearningAudio(
                          key: ValueKey('${attempt.id}-step-${item['id']}'),
                          url: widget.owner.repository.audioUrl(url),
                          onProgress: () => activity?.audioAdvanced(),
                          onStopped: () => activity?.audioStopped(),
                        ),
                      if (item['meaning'] case final String text)
                        learningHeading(text),
                      learningBody(item['body'] as String? ?? '', size: 18),
                      if (item['example'] case final String text)
                        learningBody(text, size: 18),
                    ],
                  )
                else ...[
                  if (reading) ...[
                    _passageCard(
                      passage,
                      highlightText: checked
                          ? (answer!['evidence'] as String?)
                          : null,
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (attempt.content['audioUrl'] case final String url) ...[
                    if (listening && _audio != null)
                      FigmaCard(
                        padding: const EdgeInsets.all(16),
                        child: ListeningAudioControls(controller: _audio!),
                      )
                    else
                      LearningCard(
                        children: [
                          LearningAudio(
                            key: ValueKey('${attempt.id}-$questionId'),
                            url: widget.owner.repository.audioUrl(url),
                            onProgress: () => activity?.audioAdvanced(),
                            onStopped: () => activity?.audioStopped(),
                          ),
                          learningBody(
                            'Nghe lại và tua không giới hạn.',
                            size: 12,
                          ),
                        ],
                      ),
                    const SizedBox(height: 16),
                  ],
                  if (reading || listening)
                    Text(
                      item['prompt'] as String,
                      style: designHeading(20, height: 1.35),
                    )
                  else
                    learningHeading(item['prompt'] as String, size: 24),
                  const SizedBox(height: 16),
                  for (final (optionIndex, option) in options.indexed) ...[
                    if (reading)
                      AnswerOption(
                        key: ValueKey('learning-option-${option['id']}'),
                        index: optionIndex,
                        text: option['text'] as String,
                        selected:
                            controller.selected(questionId!) == option['id'],
                        showSelectionCheck: false,
                        compact: true,
                        chosen: answer?['optionId'] == option['id'],
                        correct: checked
                            ? answer!['correctOptionId'] == option['id']
                            : null,
                        onTap: checked || blocked
                            ? null
                            : () => controller.select(
                                questionId,
                                option['id'] as String,
                              ),
                      )
                    else if (listening)
                      _listeningAnswerOption(
                        option,
                        optionIndex,
                        questionId!,
                        answer,
                        blocked,
                      )
                    else
                      _answerOption(option, questionId!, answer, blocked),
                    SizedBox(height: reading || listening ? 8 : 12),
                  ],
                  if (checked) ...[
                    ReadingAnswerFeedbackCard(
                      isCorrect: answer!['isCorrect'] == true,
                      explanation: answer['explanation'] as String? ?? '',
                      evidence: answer['evidence'] as String?,
                    ),
                    if (reading) ...[
                      const SizedBox(height: 12),
                      PracticeAiExplainCard(
                        questionId: questionId!,
                        originalExplanation:
                            answer['explanation'] as String? ?? '',
                        ai: controller.aiExplanation(questionId),
                        explaining: controller.isExplaining(questionId),
                        errorText: controller.explainError(questionId),
                        onExplain: () => controller.explainQuestion(questionId),
                      ),
                    ],
                  ],
                ],
              ],
            ),
          ),
        ),
      );
    },
  );

  Widget _listeningAnswerOption(
    Json option,
    int optionIndex,
    String questionId,
    Json? answer,
    bool blocked,
  ) {
    final selected = controller.selected(questionId) == option['id'];
    final checked = answer?['checked'] == true;
    final correct = checked && answer?['correctOptionId'] == option['id'];
    final wrong = checked && selected && answer?['isCorrect'] != true;
    return PracticeAnswerTile(
      key: ValueKey('learning-option-${option['id']}'),
      index: optionIndex,
      text: option['text'] as String,
      selected: selected,
      correct: correct,
      wrong: wrong,
      label: correct
          ? 'Đúng'
          : wrong
          ? 'Sai'
          : null,
      onTap: checked || blocked
          ? null
          : () => controller.select(questionId, option['id'] as String),
    );
  }

  Widget _answerOption(
    Json option,
    String questionId,
    Json? answer,
    bool blocked,
  ) {
    final selected = controller.selected(questionId) == option['id'];
    final checked = answer?['checked'] == true;
    final correct = checked && answer?['correctOptionId'] == option['id'];
    final wrong = checked && selected && answer?['isCorrect'] != true;
    return Material(
      color: correct
          ? AppColors.primary25
          : wrong
          ? const Color(0xFFFFEEEE)
          : selected
          ? AppColors.grey50
          : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.cardSm,
        side: BorderSide(
          color: correct
              ? AppColors.primary500
              : wrong
              ? Colors.redAccent
              : selected
              ? AppColors.grey900
              : AppColors.grey200,
        ),
      ),
      child: InkWell(
        key: ValueKey('learning-option-${option['id']}'),
        borderRadius: AppRadius.cardSm,
        onTap: checked || blocked
            ? null
            : () => controller.select(questionId, option['id'] as String),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(
                correct
                    ? Icons.check_circle
                    : selected
                    ? Icons.radio_button_checked
                    : Icons.radio_button_unchecked,
                color: correct ? AppColors.primary500 : AppColors.grey800,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(option['text'] as String, style: designText(16)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _practiceResult(LearningAttempt attempt) {
    final result = attempt.json['result'] as Map;
    final isListening = attempt.lesson.kind == 'LISTENING';
    final nextLessons = widget.owner.lessons.where(
      (lesson) =>
          lesson.kind == attempt.lesson.kind &&
          lesson.id != attempt.lesson.id &&
          lesson.cefrLevel == attempt.lesson.cefrLevel &&
          lesson.state != 'COMPLETED',
    );
    final next = nextLessons.isNotEmpty ? nextLessons.first : null;
    final levelChange = attempt.levelChange;
    return FigmaPage(
      title: 'Kết quả bài học',
      titleStyle: designHeading(18),
      leading: IconButton(
        tooltip: 'Quay lại',
        onPressed: leave,
        icon: isListening
            ? const FigmaAsset('intro/imgVuesaxLinearArrowLeft', size: 24)
            : const Icon(Icons.arrow_back),
      ),
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CustomAppButton(
            text: 'Xem lại đáp án',
            onPressed: controller.loading
                ? null
                : () => previewPush<void>(
                    context,
                    PracticeReviewPage(
                      attempt: attempt,
                      audio: _audio,
                      controller: controller,
                    ),
                  ),
          ),
          const SizedBox(height: 8),
          LayoutBuilder(
            builder: (context, constraints) {
              final retry = CustomAppButton(
                text: 'Làm lại',
                fontSize: 14,
                isSecondary: true,
                onPressed: controller.loading
                    ? null
                    : () => controller.load(lessonId: attempt.lesson.id),
              );
              final nextAction = CustomAppButton(
                text: next == null ? 'Về danh sách' : 'Bài tiếp theo',
                fontSize: 14,
                isSecondary: true,
                onPressed: controller.loading
                    ? null
                    : () async {
                        if (next == null) {
                          await leave();
                          return;
                        }
                        await openLearningLesson(
                          context,
                          widget.owner,
                          lessonId: next.id,
                        );
                      },
              );
              if (constraints.maxWidth < 328 ||
                  MediaQuery.textScalerOf(context).scale(14) > 20) {
                return Column(spacing: 8, children: [retry, nextAction]);
              }
              return Row(
                spacing: 8,
                children: [
                  Expanded(child: retry),
                  Expanded(child: nextAction),
                ],
              );
            },
          ),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (controller.error != null)
            LearningError(
              controller.error!,
              retry: () => controller.load(lessonId: attempt.lesson.id),
            ),
          if (levelChange != null) ...[
            _levelChangeBanner(levelChange),
            const SizedBox(height: 16),
          ],
          learningHeading(attempt.lesson.title, size: 28),
          const SizedBox(height: 6),
          learningBody(
            isListening
                ? 'Kết quả lượt luyện tập đã được lưu. Bạn có thể xem lại đáp án và nghe lại từng đoạn hội thoại.'
                : 'Kết quả lượt luyện tập đã được lưu. Bạn có thể xem lại đáp án và dẫn chứng trong bài.',
            size: 14,
          ),
          const SizedBox(height: 16),
          FigmaCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(
                        color: AppColors.primary25,
                        shape: BoxShape.circle,
                      ),
                      child: const FigmaAsset('practice/imgFrame74', size: 40),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Đã hoàn thành',
                            style: designText(
                              14,
                              weight: FontWeight.w500,
                              color: AppColors.primary700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          learningHeading(
                            '${result['correctCount']}/${result['totalQuestions']} câu đúng',
                            size: 26,
                          ),
                        ],
                      ),
                    ),
                    if (attempt.lesson.cefrLevel case final String level) ...[
                      const SizedBox(width: 12),
                      PreviewLevelBadge(label: level),
                    ],
                  ],
                ),
                if (attempt.questions.isNotEmpty) ...[
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Divider(height: 1, color: AppColors.grey100),
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final (qIdx, q) in attempt.questions.indexed)
                        _resultQuestionChip(
                          qIdx + 1,
                          attempt.answer(q['id'] as String)?['isCorrect'] ==
                              true,
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          FigmaCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 12,
              children: isListening
                  ? [
                      _resultGuideRow(
                        'listen-intro/imgVuesaxBulkRefresh',
                        22,
                        'Nghe lại từng đoạn dẫn chứng theo câu hỏi',
                      ),
                      _resultGuideRow(
                        'practice/imgVuesaxLinearHeadphone',
                        20,
                        'Đối chiếu bản chép lời và bản dịch tiếng Việt',
                      ),
                      _resultGuideRow(
                        'reading/imgVuesaxLinearMessageQuestion',
                        20,
                        'Hỏi AI vì sao đáp án đúng và đối chiếu với lựa chọn của bạn',
                      ),
                    ]
                  : [
                      _resultGuideRow(
                        'home-v2/imgVuesaxBulkBook',
                        22,
                        'Xem lại đoạn dẫn chứng được đánh dấu trong bài đọc',
                      ),
                      _resultGuideRow(
                        'reading/imgVuesaxLinearMessageQuestion',
                        20,
                        'Đọc lời giải chi tiết và sử dụng Giải thích AI từng câu',
                      ),
                    ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _resultQuestionChip(int number, bool isRight) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      color: isRight ? AppColors.primary25 : AppColors.warning0,
      borderRadius: AppRadius.tagRadius,
      border: Border.all(
        color: isRight ? AppColors.primary200 : const Color(0xFFFFCC01),
      ),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        FigmaAsset(
          isRight
              ? 'review/imgVuesaxLinearTickCircle'
              : 'review/imgVuesaxLinearInfoCircle',
          size: 16,
        ),
        const SizedBox(width: 6),
        Text(
          'Câu $number',
          style: designText(
            13,
            weight: FontWeight.w500,
            color: isRight ? const Color(0xFF0A5D21) : const Color(0xFFCA8A04),
          ),
        ),
      ],
    ),
  );

  Widget _resultGuideRow(String asset, double iconSize, String text) => Row(
    children: [
      Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: AppColors.primary25,
          shape: BoxShape.circle,
        ),
        child: FigmaAsset(asset, size: iconSize),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Text(
          text,
          style: designText(
            14,
            weight: FontWeight.w500,
            color: AppColors.grey900,
            height: 1.4,
          ),
        ),
      ),
    ],
  );

  Widget _result(LearningAttempt attempt) {
    if (attempt.lesson.kind == 'LISTENING' ||
        attempt.lesson.kind == 'READING') {
      return _practiceResult(attempt);
    }
    final result = attempt.json['result'] as Map;
    final levelChange = attempt.levelChange;
    return FigmaPage(
      title: 'Kết quả bài học',
      leading: IconButton(onPressed: leave, icon: const Icon(Icons.arrow_back)),
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CustomAppButton(
            text: 'Làm lại',
            isLoading: controller.loading,
            onPressed: controller.loading
                ? null
                : () async {
                    final lessonId = attempt.lesson.id;
                    await _audio?.pause();
                    if (!mounted) return;
                    await controller.load(lessonId: lessonId);
                  },
          ),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (controller.error != null)
            LearningError(
              controller.error!,
              retry: () => controller.load(lessonId: attempt.lesson.id),
            ),
          if (levelChange != null) ...[
            _levelChangeBanner(levelChange),
            const SizedBox(height: 16),
          ],
          learningHeading(attempt.lesson.title, size: 28),
          const SizedBox(height: 16),
          if (attempt.content['passage'] case final String passage) ...[
            _passageCard(passage),
            const SizedBox(height: 16),
          ],
          LearningCard(
            children: [
              learningHeading('Đã hoàn thành', size: 24),
              learningHeading(
                '${result['correctCount']}/${result['totalQuestions']} câu đúng',
                size: 28,
              ),
              learningBody(
                'Kết quả đã lưu vào lịch sử học tập. Bài luyện tập không thay đổi mức CEFR đầu vào.',
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (attempt.content['transcript'] case final String transcript) ...[
            LearningCard(
              children: [
                learningHeading('Bản chép lời'),
                learningBody(transcript),
              ],
            ),
            const SizedBox(height: 16),
          ],
          for (final (qIndex, q) in attempt.questions.indexed) ...[
            LearningResultQuestionCard(
              index: qIndex,
              prompt: q['prompt'] as String,
              options: learningItems(q['options']),
              answer: attempt.answer(q['id'] as String),
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }

  Widget _levelChangeBanner(Json change) {
    final isUp = change['direction'] == 'UP';
    final kindLabel = learningKindLabel(change['kind'] as String? ?? 'READING');
    final toCefr = change['to'] as String? ?? '';
    return Container(
      key: const Key('learningLevelChangeBanner'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isUp ? AppColors.primary25 : const Color(0xFFFFF8E6),
        borderRadius: AppRadius.cardRadius,
        border: Border.all(
          color: isUp ? AppColors.primary300 : const Color(0xFFF3C669),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isUp ? Icons.trending_up_rounded : Icons.trending_down_rounded,
            color: isUp ? AppColors.primary700 : const Color(0xFF9A6700),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isUp
                      ? 'Mức luyện tập đề xuất: $kindLabel $toCefr ↑'
                      : 'Điều chỉnh mức luyện tập đề xuất: $kindLabel $toCefr ↓',
                  style: designText(
                    16,
                    weight: FontWeight.w700,
                    color: AppColors.grey900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isUp
                      ? '2 bài Đọc khác nhau đạt từ 80%. Kế hoạch tiếp theo sẽ ưu tiên mức $toCefr.'
                      : '2 bài Đọc khác nhau đạt dưới 50%. Hệ thống ưu tiên củng cố mức $toCefr.',
                  style: designText(14, color: AppColors.grey800, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _passageCard(String passage, {String? highlightText}) {
    return PassageCard(
      passage: passage,
      highlightText: highlightText,
      practice: true,
      onExpandedChanged: (expanded) => _viewingPassage = expanded,
      onInteraction: () => activity?.touch(),
    );
  }

  Future<void> _chooseQuestion(LearningAttempt attempt, int current) async {
    final questions = attempt.questions;
    final firstUnchecked = questions.indexWhere(
      (question) =>
          attempt.answer(question['id'] as String)?['checked'] != true,
    );
    final index = await showModalBottomSheet<int>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('Danh sách câu hỏi', style: designHeading(20)),
              for (final (i, question) in questions.indexed)
                ListTile(
                  title: Text('Câu ${i + 1}'),
                  selected: i == current,
                  subtitle: Text(
                    attempt.answer(question['id'] as String)?['checked'] == true
                        ? 'Đã kiểm tra'
                        : 'Chưa kiểm tra',
                  ),
                  enabled: firstUnchecked < 0 || i <= firstUnchecked,
                  onTap: () => Navigator.pop(sheetContext, i),
                ),
            ],
          ),
        ),
      ),
    );
    if (mounted && index != null && index != current) {
      await controller.move('QUIZ', index);
    }
  }
}

class LearningHistoryPage extends StatefulWidget {
  const LearningHistoryPage({super.key, required this.controller, this.kind});
  final LearningController controller;
  final String? kind;
  @override
  State<LearningHistoryPage> createState() => _LearningHistoryPageState();
}

class _LearningHistoryPageState extends State<LearningHistoryPage> {
  static const _maxSelection = 100;
  final items = <Json>[];
  final _selected = <String>{};
  String? cursor, error;
  bool loading = true, hasMore = true;
  bool _requesting = false;
  bool _hiding = false;
  bool _selecting = false;
  int _epoch = 0;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load({bool reset = false}) async {
    if (_requesting && !reset) return;
    final epoch = reset ? ++_epoch : _epoch;
    _requesting = true;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await widget.controller.repository.history(
        cursor: reset ? null : cursor,
        kind: widget.kind,
      );
      if (!mounted || !widget.controller.active || epoch != _epoch) return;
      setState(() {
        if (reset) items.clear();
        items.addAll(learningItems(result['items']));
        cursor = result['nextCursor'] as String?;
        hasMore = cursor != null;
      });
    } catch (e) {
      if (mounted && widget.controller.active && epoch == _epoch) {
        setState(
          () => error = e is ApiFailure ? e.message : 'Không tải được lịch sử.',
        );
      }
    } finally {
      if (mounted && epoch == _epoch) {
        _requesting = false;
        setState(() => loading = false);
      }
    }
  }

  void _endSelection() => setState(() {
    _selecting = false;
    _selected.clear();
  });

  void _toggleSelection(String id) {
    setState(() {
      if (!_selected.remove(id)) _selected.add(id);
    });
  }

  Future<void> _hideHistory(List<Json> targets, {bool batch = false}) async {
    final controller = widget.controller;
    if (_hiding || targets.isEmpty || !controller.active) return;
    final count = targets.length;
    final confirmed = await confirmHistoryHide(
      context,
      count: count,
      preview: [
        for (final item in targets.take(2))
          (title: _historyTitle(item), date: _historyDate(item, compact: true)),
      ],
    );
    if (confirmed != true || !mounted || !controller.active) return;

    final ids = targets.map((row) => row['id'] as String).toList();
    final removed = ids.toSet();
    setState(() => _hiding = true);
    try {
      if (batch) {
        await controller.repository.hideHistoryBatch(ids);
      } else {
        await controller.repository.hideHistory(ids.single);
      }
      if (!controller.active) return;
      controller.invalidateHome();
      unawaited(controller.loadCatalogue());
      if (!mounted) return;
      setState(() {
        items.removeWhere((row) => removed.contains(row['id']));
        _selected.clear();
        _selecting = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(historyHiddenMessage(count));
      await load(reset: true);
    } catch (e) {
      if (!mounted || !controller.active) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is ApiFailure
                ? e.message
                : 'Chưa xóa được lượt học. Hãy thử lại.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _hiding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final duration = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 180);
    final title = switch (widget.kind) {
      'LISTENING' => 'Lịch sử luyện nghe',
      'READING' => 'Lịch sử luyện đọc',
      _ => 'Lịch sử học tập',
    };
    return PopScope<void>(
      canPop: !_selecting && !_hiding,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _selecting && !_hiding) _endSelection();
      },
      child: FigmaPage(
        title: title,
        titleStyle: historyHeading(20),
        headerPadding: const EdgeInsets.symmetric(horizontal: 12),
        headerHeight:
            52 +
            (MediaQuery.textScalerOf(context).scale(20) - 20)
                    .clamp(0, double.infinity)
                    .toDouble() *
                2,
        leading: IconButton(
          tooltip: 'Quay lại',
          onPressed: _hiding ? null : () => Navigator.maybePop(context),
          icon: const HistoryIcon(HistoryIcon.back),
        ),
        trailing: HistorySelectionAction(
          selecting: _selecting,
          onPressed: _hiding
              ? null
              : _selecting
              ? _endSelection
              : !loading && items.any((item) => item['status'] == 'COMPLETED')
              ? () => setState(() => _selecting = true)
              : null,
        ),
        bottom: _selecting
            ? HistorySelectionBar(
                count: _selected.length,
                saving: _hiding,
                duration: duration,
                onDelete: () => _hideHistory(
                  items
                      .where((item) => _selected.contains(item['id']))
                      .toList(),
                  batch: true,
                ),
              )
            : null,
        child: RefreshIndicator(
          notificationPredicate: (notification) =>
              !_selecting && !_hiding && notification.depth == 0,
          onRefresh: () => load(reset: true),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              if (error != null) LearningError(error!, retry: load),
              for (final item in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _card(item, duration),
                ),
              if (loading) const Center(child: CircularProgressIndicator()),
              if (!loading && error == null && items.isEmpty)
                learningBody('Chưa có lượt học nào trong lịch sử.'),
              if (!loading && hasMore && items.isNotEmpty)
                TextButton(
                  onPressed: _hiding ? null : load,
                  child: const Text('Xem thêm'),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _card(Json item, Duration duration) {
    final id = item['id'] as String;
    final title = _historyTitle(item);
    final completed = item['status'] == 'COMPLETED';
    final selected = _selected.contains(id);
    final allowToggle =
        !_hiding && completed && (selected || _selected.length < _maxSelection);
    final result = item['result'] as Map?;
    final score = completed
        ? '${result?['correctCount']}/${result?['totalQuestions']} câu đúng'
        : 'Đang học · Tiếp tục';
    final borderRadius = BorderRadius.circular(16);
    return AnimatedContainer(
      key: ValueKey('learning-history-$id'),
      duration: duration,
      curve: Curves.easeOutCubic,
      constraints: const BoxConstraints(minHeight: 80),
      decoration: BoxDecoration(
        color: selected ? AppColors.primary25 : AppColors.grey5,
        borderRadius: borderRadius,
        border: Border.all(
          color: selected ? AppColors.primary200 : AppColors.grey100,
        ),
      ),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          borderRadius: borderRadius,
          excludeFromSemantics: _selecting,
          onLongPress: !_hiding && !_selecting && completed
              ? () => _hideHistory([item])
              : null,
          onTap: _hiding
              ? null
              : _selecting
              ? (allowToggle ? () => _toggleSelection(id) : null)
              : () async {
                  await openLearningLesson(
                    context,
                    widget.controller,
                    attemptId: id,
                  );
                  if (mounted) await load(reset: true);
                },
          child: Padding(
            padding: const EdgeInsets.all(15),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: historyHeading(18)),
                      const SizedBox(height: 6),
                      Text(
                        '$score  ·  ${_historyDate(item)}',
                        style: historyText(12, color: AppColors.grey800),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                SizedBox.square(
                  dimension: 24,
                  child: _selecting
                      ? (completed
                            ? HistorySelectionMark(
                                key: ValueKey('learning-history-select-$id'),
                                title: title,
                                selected: selected,
                                onTap: allowToggle
                                    ? () => _toggleSelection(id)
                                    : null,
                              )
                            : null)
                      : const HistoryIcon(
                          HistoryIcon.next,
                          color: AppColors.grey800,
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

String _historyTitle(Json item) => (item['lesson'] as Map)['title'] as String;

String _historyDate(Json item, {bool compact = false}) {
  final d = DateTime.parse(
    item['submittedAt'] as String? ?? item['updatedAt'] as String,
  ).toLocal();
  String two(int value) => value.toString().padLeft(2, '0');
  final day = '${two(d.day)}/${two(d.month)}';
  final time = '${two(d.hour)}:${two(d.minute)}';
  return compact ? '$day · $time' : '$day/${d.year}, $time';
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
