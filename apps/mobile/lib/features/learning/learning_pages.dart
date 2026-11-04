import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'learning_controller.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';
import 'activity_collector.dart';

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
  bool opening = false;
  @override
  Widget build(BuildContext context) {
    LearningLesson? lesson;
    for (final candidate in widget.owner.lessons) {
      if (candidate.id == widget.lessonId) lesson = candidate;
    }
    return FigmaPage(
      title: lesson == null ? 'Bài học' : learningKindLabel(lesson.kind),
      bottom: CustomAppButton(
        key: const Key('learningStart'),
        text: lesson?.state == 'COMPLETED' ? 'Học lại' : 'Bắt đầu học',
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
              learningBody('${lesson?.minutes ?? '—'} phút · 5 câu luyện tập'),
              learningBody(
                'Chọn đáp án rồi bấm Kiểm tra để xem giải thích. Làm đủ câu và bấm Nộp bài để lưu kết quả.',
              ),
              if (lesson?.kind == 'LISTENING')
                learningBody(
                  'Bạn được nghe lại và tua không giới hạn. Audio bắt đầu ở trạng thái tạm dừng khi mở lại.',
                ),
              if (lesson?.kind == 'VOCABULARY')
                learningBody('Học 10 từ về gia đình trước phần luyện tập.'),
              learningBody('Bạn có thể thoát và tiếp tục từ tiến độ đã lưu.'),
            ],
          ),
        ],
      ),
    );
  }
}

class LearningCatalogue extends StatelessWidget {
  const LearningCatalogue({
    super.key,
    required this.controller,
    required this.kinds,
  });
  final LearningController controller;
  final List<String> kinds;
  @override
  Widget build(BuildContext context) {
    if (controller.loading && controller.lessons.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    final lessons = controller.lessons
        .where((l) => kinds.contains(l.kind))
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (controller.error != null)
          LearningError(controller.error!, retry: controller.refresh),
        for (final lesson in lessons) ...[
          LearningCard(
            key: ValueKey('learning-lesson-${lesson.id}'),
            onTap: () => openLearningLesson(
              context,
              controller,
              lessonId: lesson.id,
              attemptId: lesson.activeAttemptId,
            ),
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
                    switch (lesson.state) {
                      'COMPLETED' => 'Hoàn thành',
                      'IN_PROGRESS' => 'Đang học',
                      _ => 'Chưa học',
                    },
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
  });
  final LearningController owner;
  final String? lessonId, attemptId;
  @override
  State<LearningAttemptPage> createState() => _LearningAttemptPageState();
}

class _LearningAttemptPageState extends State<LearningAttemptPage>
    with WidgetsBindingObserver {
  late final controller = LearningAttemptController(owner: widget.owner);
  ActivityCollector? activity;
  bool _leaving = false;
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
    } else {
      activity?.resume();
    }
  }

  void _attemptChanged() {
    final attempt = controller.attempt;
    if (attempt == null || controller.loading) return;
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
          ModalRoute.of(context)?.isCurrent == true &&
          !controller.loading &&
          controller.attempt?.completed == false,
    );
    activity!.addListener(_activityChanged);
    activity!.start();
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
    activity?.dispose();
    controller.dispose();
    super.dispose();
  }

  Future<void> leave() async {
    if (_leaving) return;
    _leaving = true;
    await _checkpointActivity();
    await controller.flush();
    if (mounted) Navigator.pop(context);
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
                : LearningError(
                    controller.error ?? 'Không tải được bài học.',
                    retry: () => controller.load(
                      lessonId: widget.lessonId,
                      attemptId: widget.attemptId,
                    ),
                  ),
          ),
        );
      }
      if (attempt.completed) return _result(attempt);
      final study = controller.phase == 'STUDY' && attempt.steps.isNotEmpty;
      final items = study ? attempt.steps : attempt.questions;
      final index = controller.index.clamp(0, items.length - 1);
      final item = items[index];
      final questionId = study ? null : item['id'] as String;
      final answer = questionId == null ? null : attempt.answer(questionId);
      final checked = answer?['checked'] == true;
      final blocked = controller.busy || controller.syncing;
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
            title: attempt.lesson.title,
            titleStyle: designHeading(18),
            leading: IconButton(
              tooltip: 'Lưu và thoát',
              onPressed: leave,
              icon: const Icon(Icons.arrow_back),
            ),
            bottom: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (controller.unsynced)
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
                if (activity?.error != null)
                  LearningError(activity!.error!, retry: activity!.start),
                if (widget.owner.activity?.error != null)
                  LearningError(
                    widget.owner.activity!.error!,
                    retry: () => widget.owner.activity!.flush(),
                  ),
                if (controller.error != null)
                  LearningError(controller.error!, retry: controller.retry),
                if (controller.notice != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(controller.notice!, style: designText(12)),
                  ),
                Row(
                  children: [
                    SizedBox(
                      width: 48,
                      child: CustomAppButton(
                        text: '',
                        isSecondary: true,
                        icon: const Icon(Icons.chevron_left),
                        onPressed: blocked || index == 0
                            ? null
                            : () => controller.move(
                                study ? 'STUDY' : 'QUIZ',
                                index - 1,
                              ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: CustomAppButton(
                        key: const Key('learningPrimaryAction'),
                        isLoading: controller.busy,
                        text: study
                            ? (last ? 'Bắt đầu luyện tập' : 'Tiếp theo')
                            : (!checked
                                  ? 'Kiểm tra'
                                  : (last ? 'Nộp bài' : 'Tiếp theo')),
                        onPressed:
                            blocked ||
                                (!study &&
                                    !checked &&
                                    controller.selected(questionId!) == null)
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
              padding: const EdgeInsets.all(16),
              children: [
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
                  if (attempt.content['passage'] case final String passage) ...[
                    LearningCard(children: [learningBody(passage, size: 18)]),
                    const SizedBox(height: 16),
                  ],
                  if (attempt.content['audioUrl'] case final String url) ...[
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
                  learningHeading(item['prompt'] as String, size: 24),
                  const SizedBox(height: 16),
                  for (final option in learningItems(item['options'])) ...[
                    _answerOption(option, questionId!, answer, blocked),
                    const SizedBox(height: 12),
                  ],
                  if (checked)
                    LearningCard(
                      children: [
                        learningHeading(
                          answer!['isCorrect'] == true
                              ? 'Chính xác!'
                              : 'Chưa chính xác',
                        ),
                        learningBody(answer['explanation'] as String? ?? ''),
                      ],
                    ),
                ],
              ],
            ),
          ),
        ),
      );
    },
  );
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
    return FigmaPage(
      title: 'Kết quả bài học',
      leading: IconButton(onPressed: leave, icon: const Icon(Icons.arrow_back)),
      bottom: CustomAppButton(
        text: 'Làm lại',
        isLoading: controller.loading,
        onPressed: controller.loading
            ? null
            : () async {
                final lessonId = attempt.lesson.id;
                await controller.load(lessonId: lessonId);
              },
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (controller.error != null)
            LearningError(
              controller.error!,
              retry: () => controller.load(lessonId: attempt.lesson.id),
            ),
          learningHeading(attempt.lesson.title, size: 28),
          const SizedBox(height: 16),
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
          for (final q in attempt.questions) ...[
            LearningCard(
              children: [
                learningHeading(q['prompt'] as String),
                for (final o in learningItems(q['options']))
                  Text(
                    '${o['id'] == attempt.answer(q['id'] as String)?['optionId'] ? 'Đã chọn: ' : ''}${o['text']}${o['id'] == attempt.answer(q['id'] as String)?['correctOptionId'] ? ' ✓' : ''}',
                    style: designText(16),
                  ),
                learningBody(
                  attempt.answer(q['id'] as String)?['explanation']
                          as String? ??
                      '',
                ),
              ],
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
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
