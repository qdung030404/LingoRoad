import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'learning_controller.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';
import 'activity_collector.dart';
import 'listening_audio.dart';

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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(text)),
      );
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
    return FigmaPage(
      title: lesson == null ? 'Bài học' : learningKindLabel(lesson.kind),
      bottom: CustomAppButton(
        key: const Key('learningStart'),
        text: lesson?.state == 'COMPLETED'
            ? 'Học lại'
            : lesson?.kind == 'LISTENING'
            ? 'Bắt đầu luyện nghe'
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
          const SizedBox(height: 16),
          LearningCard(
            children: [
              learningBody(lesson?.description ?? ''),
              if (lesson?.cefrLevel case final String level
                  when lesson?.kind == 'READING' || lesson?.kind == 'LISTENING')
                LearningPill(level, small: true),
              learningBody(
                '${lesson?.minutes ?? '—'} phút · ${lesson?.questionCount ?? 5} câu luyện tập',
              ),
              if (lesson?.json['audioDurationMs'] case final num ms)
                learningBody('Audio ${(ms / 1000).ceil()} giây'),
              learningBody(
                'Chọn đáp án rồi bấm Kiểm tra để xem giải thích. Làm đủ câu và bấm Nộp bài để lưu kết quả.',
              ),
              if (lesson?.kind == 'LISTENING')
                learningBody(
                  'Bạn được nghe lại và tua không giới hạn. Audio bắt đầu ở trạng thái tạm dừng khi mở lại.',
                ),
              if (lesson?.kind == 'VOCABULARY')
                learningBody('Học 10 từ về gia đình trước phần luyện tập.'),
              learningBody(
                'Nếu thoát trước khi nộp bài, tiến độ và thời gian lượt này sẽ bị hủy để lần sau làm lại từ đầu.',
              ),
            ],
          ),
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
                final preparation = _introContent['preparation'] as Map?;
                if (items.isEmpty && preparation == null) {
                  return const SizedBox.shrink();
                }
                return Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (preparation != null) ...[
                        learningHeading('Chuẩn bị nghe', size: 20),
                        learningBody(preparation['situation'] as String? ?? ''),
                        learningBody(preparation['objective'] as String? ?? ''),
                        const SizedBox(height: 16),
                      ],
                      Text('Từ vựng trọng tâm', style: designHeading(18)),
                      const SizedBox(height: 12),
                      KeyVocabularySection(
                        items: items,
                        savedWordKeysListenable: canSaveWords
                            ? _savedWordKeys
                            : null,
                        savingWordKeysListenable: canSaveWords
                            ? _savingWordKeys
                            : null,
                        onSaveWord: canSaveWords && lesson?.kind != 'LISTENING'
                            ? _saveReadingWord
                            : null,
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

class LearningCatalogue extends StatefulWidget {
  const LearningCatalogue({
    super.key,
    required this.controller,
    required this.kinds,
  });
  final LearningController controller;
  final List<String> kinds;

  @override
  State<LearningCatalogue> createState() => _LearningCatalogueState();
}

class _LearningCatalogueState extends State<LearningCatalogue> {
  String? selectedLevel;

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    if (controller.loading && controller.lessons.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
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
        if (controller.error != null)
          LearningError(controller.error!, retry: controller.refresh),
        if (levels.length > 1 || (isListening && levels.isNotEmpty)) ...[
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final filter in <String?>[null, ...levels])
                ChoiceChip(
                  label: Text(filter ?? 'Tất cả'),
                  selected: filter == level,
                  onSelected: (selected) =>
                      setState(() => selectedLevel = selected ? filter : null),
                ),
            ],
          ),
          const SizedBox(height: 12),
        ],
        for (final lesson in visible) ...[
          LearningCard(
            key: ValueKey('learning-lesson-${lesson.id}'),
            onTap: () => openLearningLesson(
              context,
              controller,
              lessonId: lesson.id,
            ),
            children: [
              learningHeading(lesson.title),
              learningBody(lesson.description),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  LearningPill(
                    isReading || isListening
                        ? lesson.cefrLevel ??
                              (isListening ? 'Chưa phân loại' : 'Đọc')
                        : learningKindLabel(lesson.kind),
                    small: true,
                  ),
                  LearningPill('${lesson.minutes} phút', small: true),
                  if (isListening)
                    LearningPill('${lesson.questionCount} câu', small: true),
                  if (lesson.json['audioDurationMs'] case final num ms
                      when isListening)
                    LearningPill(
                      '${(ms / 1000).ceil()} giây audio',
                      small: true,
                    ),
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
        if (lessons.isEmpty && !controller.loading && controller.error == null)
          learningBody('Chưa có bài học được xuất bản.'),
        if (isListening && lessons.isNotEmpty && visible.isEmpty)
          learningBody('Chưa có bài nghe ở cấp độ này.'),
      ],
    );
  }
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
            titleStyle: reading ? null : designHeading(18),
            leading: IconButton(
              tooltip: 'Thoát',
              onPressed: leave,
              icon: reading
                  ? const FigmaAsset(
                      'reading/imgVuesaxLinearArrowLeft',
                      size: 20,
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
                        borderRadius: reading ? AppRadius.tagRadius : null,
                        icon: reading
                            ? const FigmaAsset(
                                'reading/imgVuesaxLinearArrowLeft1',
                                size: 20,
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
                        borderRadius: reading ? AppRadius.tagRadius : null,
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
              key: reading ? ValueKey(questionId) : null,
              padding: reading
                  ? const EdgeInsets.fromLTRB(16, 16, 16, 8)
                  : const EdgeInsets.all(16),
              children: [
                if (listening) ...[
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
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: AppRadius.pill,
                    child: LinearProgressIndicator(
                      value: (index + 1) / items.length,
                      minHeight: 3,
                      backgroundColor: AppColors.grey200,
                      color: AppColors.primary500,
                      semanticsLabel:
                          'Tiến độ bài nghe, câu ${index + 1} trên ${items.length}',
                    ),
                  ),
                  const SizedBox(height: 20),
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
                      style: listening
                          ? designHeading(20, height: 1.35)
                          : designText(18, weight: FontWeight.w600),
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
                    SizedBox(height: listening ? 8 : 12),
                  ],
                  if (checked) ...[
                    ReadingAnswerFeedbackCard(
                      isCorrect: answer!['isCorrect'] == true,
                      explanation: answer['explanation'] as String? ?? '',
                      evidence: answer['evidence'] as String?,
                    ),
                    if (reading) ...[
                      const SizedBox(height: 12),
                      ReadingAiExplainCard(
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
    final accented = selected || correct;
    final tone = wrong
        ? AppColors.error200
        : accented
        ? AppColors.primary700
        : AppColors.grey900;
    final letter = String.fromCharCode(65 + optionIndex);
    return Semantics(
      button: true,
      selected: selected,
      enabled: !checked && !blocked,
      label: 'Đáp án $letter',
      child: Material(
        color: wrong
            ? AppColors.error0
            : accented
            ? AppColors.primary25
            : AppColors.grey0,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.cardSm,
          side: BorderSide(
            color: wrong
                ? AppColors.error25
                : accented
                ? AppColors.primary500
                : AppColors.grey100,
          ),
        ),
        child: InkWell(
          key: ValueKey('learning-option-${option['id']}'),
          borderRadius: AppRadius.cardSm,
          onTap: checked || blocked
              ? null
              : () => controller.select(questionId, option['id'] as String),
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 56),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: accented || wrong
                          ? AppColors.grey0
                          : AppColors.grey50,
                      borderRadius: AppRadius.tagRadius,
                    ),
                    child: Text(
                      letter,
                      style: designText(
                        13,
                        weight: FontWeight.w600,
                        color: tone,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      option['text'] as String,
                      style: designText(
                        16,
                        weight: FontWeight.w500,
                        color: tone,
                        height: 1.4,
                      ),
                    ),
                  ),
                  if (accented || wrong) ...[
                    const SizedBox(width: 8),
                    Icon(
                      wrong ? Icons.cancel_outlined : Icons.check_circle,
                      color: tone,
                      size: 20,
                      semanticLabel: checked
                          ? (correct ? 'Đúng' : 'Sai')
                          : 'Đã chọn',
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
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
        borderRadius: BorderRadius.circular(12),
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
        borderRadius: BorderRadius.circular(12),
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

  Widget _result(LearningAttempt attempt) {
    final result = attempt.json['result'] as Map;
    final levelChange = attempt.levelChange;
    final listening = attempt.lesson.kind == 'LISTENING';
    final nextLessons = widget.owner.lessons.where(
      (lesson) =>
          lesson.kind == 'LISTENING' &&
          lesson.id != attempt.lesson.id &&
          lesson.cefrLevel == attempt.lesson.cefrLevel &&
          lesson.state != 'COMPLETED',
    );
    final next = nextLessons.isEmpty ? null : nextLessons.first;
    final segments = learningItems(attempt.content['transcriptSegments']);
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
          if (listening)
            TextButton(
              onPressed: controller.loading
                  ? null
                  : () async {
                      await _audio?.pause();
                      if (!mounted) return;
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
              child: Text(next == null ? 'Về danh sách' : 'Bài tiếp theo'),
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
          if (controller.error != null && listening)
            const Text(
              'Thử lại sẽ tạo lượt học mới và có thể thay thế lượt chưa nộp của bài này.',
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
          if (listening && _audio != null) ...[
            FigmaCard(
              padding: const EdgeInsets.all(16),
              child: ListeningAudioControls(controller: _audio!),
            ),
            const SizedBox(height: 16),
          ],
          if (attempt.content['transcript'] case final String transcript) ...[
            LearningCard(
              children: [
                if (listening && _audio != null)
                  ListeningTranscript(
                    key: ValueKey('transcript-${attempt.id}'),
                    controller: _audio!,
                    content: attempt.content,
                  )
                else ...[
                  learningHeading('Bản chép lời'),
                  learningBody(transcript),
                ],
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
            if (listening &&
                _audio != null &&
                (attempt.answer(q['id'] as String)?['evidenceSegmentIds']
                            as List? ??
                        [])
                    .isNotEmpty)
              OutlinedButton.icon(
                onPressed: _audio!.busy
                    ? null
                    : () {
                        final ids =
                            (attempt.answer(
                                      q['id'] as String,
                                    )!['evidenceSegmentIds']
                                    as List)
                                .cast<String>()
                                .toSet();
                        _audio!.playSegments(
                          segments.where((s) => ids.contains(s['id'])).toList(),
                        );
                      },
                icon: const Icon(Icons.hearing),
                label: Text('Nghe đoạn trả lời câu ${qIndex + 1}'),
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
                  style: designText(
                    14,
                    color: AppColors.grey800,
                    height: 1.4,
                  ),
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
  const LearningHistoryPage({super.key, required this.controller});
  final LearningController controller;
  @override
  State<LearningHistoryPage> createState() => _LearningHistoryPageState();
}

class _LearningHistoryPageState extends State<LearningHistoryPage> {
  final items = <Json>[];
  String? cursor, error;
  bool loading = true, hasMore = true;
  bool _requesting = false;
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
    if (reset) {
      items.clear();
      cursor = null;
      hasMore = true;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await widget.controller.repository.history(cursor: cursor);
      if (!mounted || !widget.controller.active || epoch != _epoch) return;
      setState(() {
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

  @override
  Widget build(BuildContext context) => FigmaPage(
    title: 'Lịch sử học tập',
    child: RefreshIndicator(
      onRefresh: () => load(reset: true),
      child: ListView(
        padding: const EdgeInsets.all(16),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          if (error != null) LearningError(error!, retry: load),
          for (final item in items) ...[
            LearningCard(
              key: ValueKey('learning-history-${item['id']}'),
              onTap: () async {
                await openLearningLesson(
                  context,
                  widget.controller,
                  attemptId: item['id'] as String,
                );
                if (mounted) await load(reset: true);
              },
              children: [
                learningHeading((item['lesson'] as Map)['title'] as String),
                learningBody(
                  item['status'] == 'COMPLETED'
                      ? 'Hoàn thành · ${(item['result'] as Map)['correctCount']}/${(item['result'] as Map)['totalQuestions']} câu đúng'
                      : 'Đang học · Tiếp tục',
                ),
                learningBody(
                  _date(
                    item['submittedAt'] as String? ??
                        item['updatedAt'] as String,
                  ),
                  size: 12,
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
          if (loading) const Center(child: CircularProgressIndicator()),
          if (!loading && error == null && items.isEmpty)
            learningBody(
              'Chưa có lượt học. Bắt đầu một bài để lưu tiến độ tại đây.',
            ),
          if (!loading && hasMore && items.isNotEmpty)
            TextButton(onPressed: load, child: const Text('Xem thêm')),
        ],
      ),
    ),
  );
  String _date(String value) {
    final d = DateTime.parse(value).toLocal();
    return '${d.day}/${d.month}/${d.year} ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
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
