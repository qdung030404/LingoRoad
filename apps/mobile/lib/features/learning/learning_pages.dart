import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/learning_media_image.dart';
import 'activity_collector.dart';
import 'learning_attempt_result.dart';
import 'learning_catalogue.dart';
import 'learning_controller.dart';
import 'learning_lesson_intro_page.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';
import 'listening_audio.dart';

export 'grammar_lesson_launcher.dart';
export 'learning_catalogue.dart';
export 'learning_history_page.dart';
export 'learning_lesson_intro_page.dart';

part 'learning_pages_helpers.dart';

Future<void> openLearningLesson(
  BuildContext context,
  LearningController controller, {
  String? lessonId,
  String? attemptId,
  bool skipStudy = false,
  bool skipIntro = false,
}) async {
  await previewPush<void>(
    context,
    attemptId == null && lessonId != null && !skipIntro
        ? LearningLessonIntroPage(
            owner: controller,
            lessonId: lessonId,
            skipStudy: skipStudy,
          )
        : LearningAttemptPage(
            owner: controller,
            lessonId: lessonId,
            attemptId: attemptId,
            skipStudy: skipStudy,
          ),
  );
  if (controller.active) await controller.refresh();
}

class LearningAttemptPage extends StatefulWidget {
  const LearningAttemptPage({
    super.key,
    required this.owner,
    this.lessonId,
    this.attemptId,
    this.audioEngineFactory,
    this.skipStudy = false,
  });
  final LearningController owner;
  final String? lessonId, attemptId;
  final ListeningAudioEngine Function()? audioEngineFactory;
  final bool skipStudy;
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
      final study =
          !widget.skipStudy &&
          controller.phase == 'STUDY' &&
          attempt.steps.isNotEmpty;
      final items = study ? attempt.steps : attempt.questions;
      final index = controller.index.clamp(0, items.length - 1);
      final item = items[index];
      final passage = study ? null : attempt.content['passage'] as String?;
      final isReadingLesson = attempt.lesson.kind == 'READING';
      final isGrammarQuiz = !study && attempt.lesson.kind == 'GRAMMAR';
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
                : isGrammarQuiz
                ? 'Luyện ngữ pháp'
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
                if (listening || reading || isGrammarQuiz) ...[
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
                    if ((attempt.content['coverImageUrl'] as String? ??
                            attempt.lesson.coverImageUrl)
                        case final String cover when cover.trim().isNotEmpty) ...[
                      ClipRRect(
                        borderRadius: AppRadius.cardSm,
                        child: LearningMediaImage(
                          key: const ValueKey('reading-attempt-scene-strip'),
                          imageUrl: cover,
                          width: double.infinity,
                          height: 112,
                          fit: BoxFit.cover,
                          semanticLabel: attempt.lesson.title,
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    _passageCard(
                      passage,
                      highlightText: checked
                          ? (answer!['evidence'] as String?)
                          : null,
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (listening)
                    if ((attempt.content['coverImageUrl'] as String? ??
                            attempt.lesson.coverImageUrl)
                        case final String cover when cover.trim().isNotEmpty) ...[
                      ClipRRect(
                        borderRadius: AppRadius.cardSm,
                        child: LearningMediaImage(
                          key: const ValueKey('listening-attempt-scene-strip'),
                          imageUrl: cover,
                          width: double.infinity,
                          height: 112,
                          fit: BoxFit.cover,
                          semanticLabel: attempt.lesson.title,
                        ),
                      ),
                      const SizedBox(height: 12),
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
                  if (reading || listening || isGrammarQuiz)
                    Text(
                      item['prompt'] as String,
                      style: designHeading(18, height: 1.4),
                    )
                  else
                    learningHeading(item['prompt'] as String, size: 22),
                  const SizedBox(height: 16),
                  if ((reading || listening) &&
                      hasVisualImageOptions(options)) ...[
                    PracticeImageAnswerGrid(
                      options: options,
                      checked: checked,
                      selectedOptionId: checked
                          ? answer!['optionId'] as String?
                          : controller.selected(questionId!),
                      correctOptionId: answer?['correctOptionId'] as String?,
                      onSelect: checked || blocked
                          ? null
                          : (optionId) => controller.select(
                                questionId!,
                                optionId,
                              ),
                    ),
                    const SizedBox(height: 8),
                  ] else
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

}
