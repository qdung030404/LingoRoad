import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/learning_media_image.dart';
import '../learning/learning_widgets.dart';
import 'speaking_controller.dart';
import 'speaking_history_list.dart';
import 'speaking_repository.dart';
import 'speaking_review_widgets.dart';
import 'speaking_assessment.dart';
import 'assessment_details.dart';

String speakingStatus(String status) => switch (status) {
  'CREATED' => 'Chưa nộp bản thu',
  'PROCESSING' => 'Đang chấm phát âm',
  'SUCCEEDED' => 'Đã chấm',
  'FAILED' => 'Chưa chấm được',
  'UNKNOWN' => 'Chưa xác định được kết quả',
  _ => status,
};

String? _submissionMode(Json submission) {
  final prompt = submission['promptSnapshot'];
  final result = submission['result'];
  return (prompt is Map ? prompt['mode']?.toString() : null) ??
      (result is Map ? result['mode']?.toString() : null);
}

class SpeakingSubmissionReviewHeader extends StatelessWidget {
  const SpeakingSubmissionReviewHeader({super.key, required this.submission});

  final Json submission;

  @override
  Widget build(BuildContext context) {
    final mode = _submissionMode(submission);
    final isTopic = mode == 'TOPIC';
    final isPicture = mode == 'PICTURE_DESCRIPTION';
    final prompt = submission['promptSnapshot'];
    final name = prompt is Map ? prompt['title'] : null;
    final imageUrl = prompt is Map ? prompt['imageUrl']?.toString() : null;
    final sentence = speakingSentence(submission).trim();
    final title = name is String && name.trim().isNotEmpty
        ? name.trim()
        : sentence.isNotEmpty
        ? sentence
        : isPicture
        ? 'Miêu tả bức tranh'
        : isTopic
        ? 'Tự nói'
        : 'Nghe và đọc';
    final status = submission['status']?.toString() ?? '';

    return SpeakingReviewHeader(
      title: title,
      icon: isPicture
          ? Icons.collections_outlined
          : isTopic
          ? Icons.mic_none_rounded
          : Icons.headphones_rounded,
      imageUrl: imageUrl,
      statusLabel: speakingStatus(status),
      dateLabel: formatSpeakingHistoryDate(submission['createdAt']?.toString()),
      completed: status == 'SUCCEEDED',
    );
  }
}

String speakingHistoryScore(Json submission) {
  final result = submission['result'];
  if (result is! Map) return '';
  final value = result.containsKey('overall')
      ? result['overall']
      : result['pronunciation'];
  return 'Điểm phát âm ${assessmentScoreText(value)} / 100';
}

class SpeakingCatalogue extends StatefulWidget {
  const SpeakingCatalogue({super.key, required this.controller});
  final SpeakingController controller;
  @override
  State<SpeakingCatalogue> createState() => _SpeakingCatalogueState();
}

class _SpeakingCatalogueState extends State<SpeakingCatalogue> {
  SpeakingController get controller => widget.controller;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(controller.initialize());
    });
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        learningHeading('Luyện đọc câu', size: 24),
        const SizedBox(height: 8),
        learningBody(
          'Thu giọng của bạn, nhận phản hồi phát âm và lưu kết quả. Mỗi bản thu tối đa 30 giây.',
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          onPressed: () =>
              previewPush(context, SpeakingHistoryPage(controller: controller)),
          icon: const Icon(Icons.history),
          label: const Text('Lịch sử Speaking'),
        ),
        if (controller.busy && controller.prompts.isEmpty)
          const Center(child: CircularProgressIndicator()),
        if (controller.error != null) ...[
          learningBody(controller.error!),
          TextButton(
            onPressed: controller.initialize,
            child: const Text('Thử tải lại'),
          ),
        ],
        if (!controller.enabled)
          learningBody('Luyện nói đang tạm dừng. Bạn vẫn xem được lịch sử.'),
        if (controller.submission != null)
          OutlinedButton(
            onPressed: () => previewPush(
              context,
              SpeakingRecordPage(controller: controller),
            ),
            child: Text('Tiếp tục · ${speakingStatus(controller.status)}'),
          ),
        for (final prompt in controller.prompts)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: LearningCard(
              children: [
                Text(
                  prompt['text']?.toString() ?? '',
                  style: designHeading(20),
                ),
                CustomAppButton(
                  text: 'Luyện câu này',
                  onPressed: !controller.enabled || controller.busy
                      ? null
                      : () async {
                          await controller.select(prompt);
                          if (context.mounted && controller.active) {
                            previewPush(
                              context,
                              SpeakingRecordPage(controller: controller),
                            );
                          }
                        },
                ),
              ],
            ),
          ),
      ],
    ),
  );
}

class SpeakingRecordPage extends StatefulWidget {
  const SpeakingRecordPage({super.key, required this.controller});
  final SpeakingController controller;
  @override
  State<SpeakingRecordPage> createState() => _SpeakingRecordPageState();
}

class _SpeakingRecordPageState extends State<SpeakingRecordPage>
    with WidgetsBindingObserver {
  final AudioPlayer _player = AudioPlayer();
  SpeakingController get c => widget.controller;
  bool get showReviewHeader =>
      c.mode != 'TONGUE_TWISTER' && c.status == 'SUCCEEDED' && c.result != null;
  bool _playing = false;
  StreamSubscription<void>? _completion;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _completion = _player.onPlayerComplete.listen((_) {
      if (mounted) setState(() => _playing = false);
    });
    if (c.submission != null) unawaited(c.check());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) {
      unawaited(_player.stop());
      _playing = false;
      unawaited(c.stop());
    } else if (c.submission != null) {
      unawaited(c.check());
    }
  }

  Future<void> _record() async {
    await _player.stop();
    if (mounted) setState(() => _playing = false);
    await c.start();
  }

  Future<void> _play() async {
    final path = c.audioPath;
    if (path == null) return;
    try {
      if (_playing) {
        await _player.stop();
      } else {
        await _player.play(DeviceFileSource(path));
      }
      if (mounted) setState(() => _playing = !_playing);
    } catch (_) {
      if (mounted) {
        previewMessage(context, 'Không nghe được bản thu. Vui lòng ghi lại.');
      }
    }
  }

  Future<void> _send({bool newAttempt = false}) async {
    await _player.stop();
    if (mounted) setState(() => _playing = false);
    await c.send(newAttempt: newAttempt);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_completion?.cancel());
    unawaited(_player.dispose());
    unawaited(c.endSession());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: c,
    builder: (context, _) => PopScope(
      canPop: !c.busy,
      child: SizedBox.expand(
        child: FigmaPage(
          title: 'Luyện Nói',
          leading: IconButton(
            tooltip: 'Quay lại',
            onPressed: c.busy ? null : () => Navigator.pop(context),
            icon: const Icon(Icons.chevron_left),
          ),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (showReviewHeader)
                SpeakingSubmissionReviewHeader(submission: c.submission!)
              else ...[
                if (c.promptImageUrl case final String pictureUrl) ...[
                  LearningCard(
                    children: [
                      InkWell(
                        key: const ValueKey('speaking-record-picture-preview'),
                        borderRadius: BorderRadius.circular(12),
                        onTap: () => showZoomableIllustrationDialog(
                          context,
                          imageUrl: pictureUrl,
                          title:
                              c.prompt?['title']?.toString() ??
                              'Quan sát tranh',
                          caption: c.sentence,
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: AspectRatio(
                            aspectRatio: 4 / 3,
                            child: LearningMediaImage(
                              imageUrl: pictureUrl,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              semanticLabel:
                                  c.prompt?['title']?.toString() ??
                                  'Bức tranh luyện nói',
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],
                LearningCard(
                  children: [Text(c.sentence, style: designHeading(26))],
                ),
                const SizedBox(height: 16),
              ],
              if (!c.active)
                learningBody('Phiên đăng nhập đã thay đổi. Vui lòng quay lại.'),
              if (c.recording) ...[
                Text(
                  'Đang ghi âm · ${c.seconds}/${c.maxSeconds} giây',
                  style: designHeading(20),
                ),
                const SizedBox(height: 16),
                CustomAppButton(text: 'Dừng ghi âm', onPressed: c.stop),
              ] else if (c.busy)
                const Center(
                  child: Column(
                    children: [
                      CircularProgressIndicator(),
                      SizedBox(height: 12),
                      Text('Đang xử lý bản thu…'),
                    ],
                  ),
                )
              else ...[
                if (c.submission != null) ...[
                  if (!showReviewHeader) ...[
                    Text(speakingStatus(c.status), style: designHeading(20)),
                    const SizedBox(height: 12),
                  ],
                  if (c.status == 'SUCCEEDED' && c.result != null)
                    SpeakingResult(
                      result: c.result!,
                      repository: c.repository,
                      submissionId: c.submission?['id'] as String?,
                      referenceText: c.sentence,
                      audioPath: c.resultAudioPath(
                        c.submission?['id'] as String?,
                      ),
                      isCurrent: () => c.active,
                    ),
                  if (c.status == 'FAILED')
                    learningBody(
                      speakingErrorMessage(
                        c.submission?['errorCode']?.toString(),
                      ),
                    ),
                  if (c.status == 'UNKNOWN')
                    learningBody(
                      'Máy chủ chưa xác định được kết quả lần chấm này. Kiểm tra trạng thái trước khi chủ động nộp lần mới.',
                    ),
                  if (c.status != 'SUCCEEDED')
                    OutlinedButton.icon(
                      onPressed: c.checking ? null : c.check,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Kiểm tra trạng thái'),
                    ),
                ],
                if (c.audioPath != null) ...[
                  OutlinedButton.icon(
                    onPressed: _play,
                    icon: Icon(_playing ? Icons.stop : Icons.play_arrow),
                    label: Text(
                      _playing ? 'Dừng nghe' : 'Nghe bản thu của bạn',
                    ),
                  ),
                  if (!c.processing &&
                      c.status != 'SUCCEEDED' &&
                      !c.serviceUnavailable)
                    CustomAppButton(
                      text: c.terminal ? 'Nộp lần mới' : 'Nộp bản thu',
                      onPressed: !c.enabled || !c.active
                          ? null
                          : () => _send(newAttempt: c.terminal),
                    ),
                  const SizedBox(height: 12),
                ],
                if (!c.processing)
                  CustomAppButton(
                    text: c.audioPath == null ? 'Ghi âm' : 'Ghi lại',
                    onPressed: c.enabled && c.active ? _record : null,
                  ),
              ],
              if (c.error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 16),
                  child: Text(
                    c.error!,
                    style: designText(14, color: const Color(0xFFB42318)),
                  ),
                ),
              const SizedBox(height: 20),
              learningBody(
                'Bản thu chỉ được dùng tạm để nghe lại và chấm phát âm. Lịch sử lưu điểm và transcript, không lưu audio.',
                size: 14,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class SpeakingResult extends StatefulWidget {
  const SpeakingResult({
    super.key,
    required this.result,
    this.referenceText,
    this.audioPath,
    this.isCurrent,
    this.repository,
    this.submissionId,
  });
  final SpeakingRepository? repository;
  final String? submissionId;
  final Json result;
  final String? referenceText;
  final String? audioPath;
  final bool Function()? isCurrent;
  @override
  State<SpeakingResult> createState() => _SpeakingResultState();
}

class _SpeakingResultState extends State<SpeakingResult> {
  Json? updatedResult;
  String? error;
  bool retrying = false;

  @override
  void didUpdateWidget(covariant SpeakingResult oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.submissionId != widget.submissionId) {
      updatedResult = null;
      error = null;
      retrying = false;
    }
  }

  Future<void> retryContent() async {
    final id = widget.submissionId;
    final repository = widget.repository;
    if (retrying ||
        id == null ||
        repository == null ||
        widget.isCurrent?.call() == false) {
      return;
    }
    bool current() =>
        mounted &&
        widget.submissionId == id &&
        widget.isCurrent?.call() != false;
    setState(() {
      retrying = true;
      error = null;
    });
    try {
      var row = await repository.retrySubmissionContent(id);
      while (row['status'] == 'PROCESSING' && current()) {
        await Future<void>.delayed(const Duration(seconds: 2));
        if (!current()) return;
        row = await repository.submission(id);
      }
      if (current() && row['result'] is Map) {
        setState(
          () => updatedResult = Map<String, dynamic>.from(row['result'] as Map),
        );
      }
    } catch (_) {
      if (current()) {
        setState(() => error = 'Chưa chấm lại được nội dung. Hãy thử lại.');
      }
    } finally {
      if (current()) setState(() => retrying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = updatedResult ?? widget.result;
    final content = result['content'] as Map?;
    final canRetry =
        (result['mode'] == 'TOPIC' ||
            result['mode'] == 'PICTURE_DESCRIPTION') &&
        result['transcript'] is String &&
        (result['transcript'] as String).trim().isNotEmpty &&
        widget.submissionId != null &&
        widget.repository != null &&
        (content?['status'] == 'unavailable' ||
            content?['status'] == 'processing' ||
            content == null);
    return SpeakingAssessment(
      result: result,
      useSharedScoreLayout: result['mode'] != 'TONGUE_TWISTER',
      referenceText: widget.referenceText,
      audioPath: widget.audioPath,
      isCurrent: widget.isCurrent,
      contentAction: canRetry
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 8),
                if (error != null) learningBody(error!),
                OutlinedButton.icon(
                  onPressed: retrying ? null : retryContent,
                  icon: const Icon(Icons.refresh_rounded),
                  label: Text(
                    retrying ? 'Đang chấm nội dung…' : 'Chấm lại nội dung',
                  ),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(48),
                  ),
                ),
              ],
            )
          : null,
    );
  }
}

class SpeakingHistoryPage extends StatefulWidget {
  const SpeakingHistoryPage({super.key, required this.controller, this.mode});
  final String? mode;
  final SpeakingController controller;
  @override
  State<SpeakingHistoryPage> createState() => _SpeakingHistoryPageState();
}

class _SpeakingHistoryPageState extends State<SpeakingHistoryPage> {
  late String? _mode = widget.mode;

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final repository = controller.repository;
    final mode = _mode;
    final title = switch (widget.mode) {
      'READ_ALOUD' => 'Lịch sử nghe và đọc',
      'TOPIC' => 'Lịch sử tự nói',
      'PICTURE_DESCRIPTION' => 'Lịch sử miêu tả bức tranh',
      'TONGUE_TWISTER' => 'Lịch sử thử thách phát âm',
      _ => 'Lịch sử Speaking',
    };
    return SpeakingHistoryList(
      key: ValueKey(mode),
      title: title,
      emptyMessage: 'Chưa có bài nộp. Hãy luyện câu đầu tiên.',
      active: () => controller.active,
      loadPage: (cursor) =>
          repository.historyForMode(cursor: cursor, mode: mode),
      hide: repository.hideSpeakingHistory,
      describe: (row) {
        final status = row['status']?.toString() ?? '';
        final content = (row['result'] as Map?)?['content'];
        final contentStatus = content is Map ? content['status'] : null;
        return SpeakingHistoryEntry(
          id: row['id'] as String,
          title: speakingSentence(row),
          date: row['createdAt']?.toString(),
          canHide: const {'SUCCEEDED', 'FAILED', 'UNKNOWN'}.contains(status),
          details: [
            if (row['result'] is Map) speakingHistoryScore(row),
            speakingStatus(status),
            if (contentStatus == 'unavailable') 'Nội dung chưa chấm được',
            if (contentStatus == 'insufficient_data')
              'Chưa đủ dữ liệu chấm nội dung',
          ],
        );
      },
      open: (id) async {
        await previewPush<void>(
          context,
          SpeakingHistoryDetail(controller: controller, id: id),
        );
      },
      filter: widget.mode != null
          ? null
          : (enabled) => DropdownButtonFormField<String>(
              initialValue: mode ?? 'ALL',
              decoration: const InputDecoration(labelText: 'Chế độ'),
              items: const [
                DropdownMenuItem(value: 'ALL', child: Text('Tất cả')),
                DropdownMenuItem(value: 'READ_ALOUD', child: Text('Luyện đọc')),
                DropdownMenuItem(
                  value: 'TOPIC',
                  child: Text('Nói theo chủ đề'),
                ),
                DropdownMenuItem(
                  value: 'PICTURE_DESCRIPTION',
                  child: Text('Miêu tả bức tranh'),
                ),
                DropdownMenuItem(
                  value: 'TONGUE_TWISTER',
                  child: Text('Thử thách phát âm'),
                ),
              ],
              onChanged: enabled
                  ? (value) =>
                        setState(() => _mode = value == 'ALL' ? null : value)
                  : null,
            ),
    );
  }
}

class SpeakingHistoryDetail extends StatefulWidget {
  const SpeakingHistoryDetail({
    super.key,
    required this.controller,
    required this.id,
  });
  final SpeakingController controller;
  final String id;
  @override
  State<SpeakingHistoryDetail> createState() => _SpeakingHistoryDetailState();
}

class _SpeakingHistoryDetailState extends State<SpeakingHistoryDetail> {
  Json? submission;
  String? error;
  @override
  void initState() {
    super.initState();
    unawaited(load());
  }

  Future<void> load() async {
    try {
      final value = await widget.controller.repository.submission(widget.id);
      if (mounted && widget.controller.active) {
        setState(() {
          submission = value;
          error = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => error = 'Không tải được kết quả. Vui lòng thử lại.');
      }
    }
  }

  @override
  Widget build(BuildContext context) => SizedBox.expand(
    child: FigmaPage(
      title: 'Kết quả Speaking',
      leading: IconButton(
        tooltip: 'Quay lại',
        onPressed: () => Navigator.pop(context),
        icon: const Icon(Icons.chevron_left),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (error != null) ...[
            learningBody(error!),
            TextButton(onPressed: load, child: const Text('Thử lại')),
          ] else if (submission == null)
            const Center(child: CircularProgressIndicator())
          else ...[
            if (_submissionMode(submission!) == 'TONGUE_TWISTER') ...[
              Text(speakingSentence(submission!), style: designHeading(24)),
              const SizedBox(height: 16),
              learningBody(
                speakingStatus(submission!['status']?.toString() ?? ''),
              ),
            ] else
              SpeakingSubmissionReviewHeader(submission: submission!),
            if (submission!['status'] == 'FAILED')
              learningBody(
                speakingErrorMessage(submission!['errorCode']?.toString()),
              ),
            if (submission!['result'] is Map)
              SpeakingResult(
                result: Map<String, dynamic>.from(submission!['result'] as Map),
                repository: widget.controller.repository,
                submissionId: widget.id,
                referenceText: speakingSentence(submission!),
                audioPath: widget.controller.resultAudioPath(widget.id),
                isCurrent: () => widget.controller.active,
              ),
          ],
        ],
      ),
    ),
  );
}
