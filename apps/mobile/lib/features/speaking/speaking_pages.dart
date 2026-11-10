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

class SpeakingResult extends StatelessWidget {
  const SpeakingResult({
    super.key,
    required this.result,
    this.referenceText,
    this.audioPath,
    this.isCurrent,
  });
  final Json result;
  final String? referenceText;
  final String? audioPath;
  final bool Function()? isCurrent;
  @override
  Widget build(BuildContext context) => SpeakingAssessment(
    result: result,
    referenceText: referenceText,
    audioPath: audioPath,
    isCurrent: isCurrent,
  );
}

class SpeakingHistoryPage extends StatefulWidget {
  const SpeakingHistoryPage({super.key, required this.controller});
  final SpeakingController controller;
  @override
  State<SpeakingHistoryPage> createState() => _SpeakingHistoryPageState();
}

class _SpeakingHistoryPageState extends State<SpeakingHistoryPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(widget.controller.loadHistory());
    });
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    return AnimatedBuilder(
      animation: c,
      builder: (context, _) => SizedBox.expand(
        child: FigmaPage(
          title: 'Lịch sử Speaking',
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              DropdownButtonFormField<String>(
                initialValue: c.historyMode ?? 'ALL',
                decoration: const InputDecoration(labelText: 'Chế độ'),
                items: const [
                  DropdownMenuItem(value: 'ALL', child: Text('Tất cả')),
                  DropdownMenuItem(
                    value: 'READ_ALOUD',
                    child: Text('Luyện đọc'),
                  ),
                  DropdownMenuItem(
                    value: 'TOPIC',
                    child: Text('Nói theo chủ đề'),
                  ),
                  DropdownMenuItem(
                    value: 'TONGUE_TWISTER',
                    child: Text('Thử thách phát âm'),
                  ),
                ],
                onChanged: c.loadingHistory
                    ? null
                    : (value) {
                        c.historyMode = value == 'ALL' ? null : value;
                        unawaited(c.loadHistory());
                      },
              ),
              OutlinedButton(
                onPressed: c.loadingHistory ? null : c.loadHistory,
                child: const Text('Làm mới'),
              ),
              if (c.error != null) learningBody(c.error!),
              if (!c.loadingHistory && c.history.isEmpty)
                learningBody('Chưa có bài nộp. Hãy luyện câu đầu tiên.'),
              for (final row in c.history)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: LearningCard(
                    children: [
                      Text(speakingSentence(row), style: designHeading(18)),
                      if (row['result'] is Map)
                        learningBody(speakingHistoryScore(row)),
                      learningBody(
                        speakingStatus(row['status']?.toString() ?? ''),
                      ),
                      learningBody(
                        _date(row['createdAt']?.toString()),
                        size: 14,
                      ),
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
              if (c.loadingHistory)
                const Center(child: CircularProgressIndicator()),
              if (c.nextCursor != null)
                TextButton(
                  onPressed: c.loadingHistory
                      ? null
                      : () => c.loadHistory(more: true),
                  child: const Text('Xem thêm'),
                ),
            ],
          ),
        ),
      ),
    );
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
