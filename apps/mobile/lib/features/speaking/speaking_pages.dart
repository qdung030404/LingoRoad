import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../learning/learning_widgets.dart';
import 'speaking_controller.dart';
import 'speaking_repository.dart';
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
              LearningCard(
                children: [Text(c.sentence, style: designHeading(26))],
              ),
              const SizedBox(height: 16),
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
                  Text(speakingStatus(c.status), style: designHeading(20)),
                  const SizedBox(height: 12),
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
        result['mode'] == 'TOPIC' &&
        result['transcript'] is String &&
        (result['transcript'] as String).trim().isNotEmpty &&
        widget.submissionId != null &&
        widget.repository != null &&
        (content?['status'] == 'unavailable' ||
            content?['status'] == 'processing' ||
            content == null);
    return SpeakingAssessment(
      result: result,
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
  late String? mode = widget.mode;
  List<Json> rows = [];
  String? cursor, error;
  bool loading = false;

  @override
  void initState() {
    super.initState();
    unawaited(load());
  }

  Future<void> load({bool more = false}) async {
    final c = widget.controller;
    if (!c.active || loading || (more && cursor == null)) return;
    setState(() {
      loading = true;
      error = null;
      if (!more) {
        rows = [];
        cursor = null;
      }
    });
    try {
      final page = await c.repository.historyForMode(
        cursor: more ? cursor : null,
        mode: mode,
      );
      if (!mounted || !c.active) return;
      final items = speakingItems(page['items']);
      setState(() {
        rows = more ? [...rows, ...items] : items;
        cursor = page['nextCursor'] as String?;
      });
    } catch (_) {
      if (mounted && c.active) {
        setState(() => error = 'Chưa tải được lịch sử. Hãy thử lại.');
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final title = switch (widget.mode) {
      'READ_ALOUD' => 'Lịch sử nghe và đọc',
      'TOPIC' => 'Lịch sử tự nói',
      'TONGUE_TWISTER' => 'Lịch sử thử thách phát âm',
      _ => 'Lịch sử Speaking',
    };
    if (!c.active) {
      return FigmaPage(
        title: title,
        child: const Center(child: Text('Phiên đăng nhập đã thay đổi.')),
      );
    }
    final list = ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (widget.mode == null)
          DropdownButtonFormField<String>(
            initialValue: mode ?? 'ALL',
            decoration: const InputDecoration(labelText: 'Chế độ'),
            items: const [
              DropdownMenuItem(value: 'ALL', child: Text('Tất cả')),
              DropdownMenuItem(value: 'READ_ALOUD', child: Text('Luyện đọc')),
              DropdownMenuItem(value: 'TOPIC', child: Text('Nói theo chủ đề')),
              DropdownMenuItem(
                value: 'TONGUE_TWISTER',
                child: Text('Thử thách phát âm'),
              ),
            ],
            onChanged: loading
                ? null
                : (value) {
                    mode = value == 'ALL' ? null : value;
                    unawaited(load());
                  },
          ),
        OutlinedButton(
          onPressed: loading ? null : load,
          child: const Text('Làm mới'),
        ),
        if (error != null) learningBody(error!),
        if (!loading && error == null && rows.isEmpty)
          learningBody('Chưa có bài nộp. Hãy luyện câu đầu tiên.'),
        for (final row in rows)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: LearningCard(
              children: [
                Text(speakingSentence(row), style: designHeading(18)),
                if (row['result'] is Map)
                  learningBody(speakingHistoryScore(row)),
                learningBody(speakingStatus(row['status']?.toString() ?? '')),
                if (row['result'] case {'content': final Map content})
                  if (content['status'] == 'unavailable')
                    learningBody('Nội dung chưa chấm được', size: 14)
                  else if (content['status'] == 'insufficient_data')
                    learningBody('Chưa đủ dữ liệu chấm nội dung', size: 14),
                learningBody(_date(row['createdAt']?.toString()), size: 14),
                OutlinedButton(
                  onPressed: () => previewPush(
                    context,
                    SpeakingHistoryDetail(
                      controller: c,
                      id: row['id'] as String,
                    ),
                  ),
                  child: const Text('Xem kết quả'),
                ),
              ],
            ),
          ),
        if (loading) const Center(child: CircularProgressIndicator()),
        if (cursor != null)
          TextButton(
            onPressed: loading ? null : () => load(more: true),
            child: const Text('Xem thêm'),
          ),
      ],
    );
    return FigmaPage(title: title, child: list);
  }

  String _date(String? value) {
    final date = value == null ? null : DateTime.tryParse(value)?.toLocal();
    return date == null
        ? ''
        : '${date.day}/${date.month}/${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
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
            Text(speakingSentence(submission!), style: designHeading(24)),
            const SizedBox(height: 16),
            learningBody(
              speakingStatus(submission!['status']?.toString() ?? ''),
            ),
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
