import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../speaking/recording_waveform.dart';
import '../speaking/speaking_controller.dart';
import '../speaking/speaking_pages.dart'
    show SpeakingHistoryPage, SpeakingResult;
import '../speaking/speaking_repository.dart';
import 'learning_widgets.dart';
import 'sample_audio.dart';

/// The speaking practice layout backed by real submissions for signed-in users.
class LiveSpeakingView extends StatefulWidget {
  const LiveSpeakingView({super.key, required this.controller});
  final SpeakingController controller;
  @override
  State<LiveSpeakingView> createState() => _LiveSpeakingViewState();
}

class _LiveSpeakingViewState extends State<LiveSpeakingView>
    with WidgetsBindingObserver {
  SpeakingController get c => widget.controller;
  final player = AudioPlayer();
  late final amplitudes = c.recorder.amplitudes;
  final subscriptions = <StreamSubscription<Object?>>[];
  bool playing = false;
  Duration position = Duration.zero, duration = Duration.zero;
  int get index {
    final found = c.prompts.indexWhere((p) => p['id'] == c.prompt?['id']);
    return found < 0 ? 0 : found;
  }

  int get total => c.prompts.length;
  bool get feedback => c.status == 'SUCCEEDED' && c.result != null;
  int? get gameStars {
    final score = c.result?['overall'];
    if (score is! num || !score.isFinite) return null;
    if (score >= 90) return 3;
    if (score >= 80) return 2;
    if (score >= 60) return 1;
    return 0;
  }

  bool get locked => c.busy || c.recording || c.processing || !c.active;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    subscriptions.add(
      player.onPlayerStateChanged.listen((state) {
        if (mounted) setState(() => playing = state == PlayerState.playing);
      }),
    );
    subscriptions.add(
      player.onPositionChanged.listen((value) {
        if (mounted) setState(() => position = value);
      }),
    );
    subscriptions.add(
      player.onDurationChanged.listen((value) {
        if (mounted) setState(() => duration = value);
      }),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await c.initialize();
      if (!mounted || !c.active || c.prompts.isEmpty) return;
      if (c.prompt == null) await c.select(c.prompts.first);
      if (c.submission != null) await c.check();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) {
      unawaited(player.stop());
      unawaited(c.stop());
    } else if (c.submission != null) {
      unawaited(c.check());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    for (final subscription in subscriptions) {
      unawaited(subscription.cancel());
    }
    unawaited(player.dispose());
    unawaited(c.endSession());
    super.dispose();
  }

  Future<void> record() async {
    await player.stop();
    position = duration = Duration.zero;
    await c.start();
  }

  Future<void> play() async {
    final path = c.audioPath;
    if (path == null) return;
    try {
      if (playing) {
        await player.pause();
      } else {
        await player.play(DeviceFileSource(path));
      }
    } catch (_) {
      if (mounted) {
        previewMessage(context, 'Không phát được bản thu. Vui lòng ghi lại.');
      }
    }
  }

  Future<void> submit() async {
    await player.stop();
    await c.send(newAttempt: c.terminal);
  }

  Future<void> move(int offset) async {
    if (locked) return;
    await player.stop();
    final target = index + offset;
    if (target >= total) {
      await c.finishPractice();
      if (mounted) Navigator.pop(context);
      return;
    }
    if (target >= 0) {
      if (c.mode == 'TONGUE_TWISTER') {
        try {
          await c.refreshGameProgress();
        } catch (_) {
          if (mounted) {
            previewMessage(context, 'Chưa tải được thành tích. Hãy thử lại.');
          }
          return;
        }
        if (!c.gameProgress.any(
          (item) =>
              item['id'] == c.prompts[target]['id'] && item['unlocked'] == true,
        )) {
          if (mounted) {
            previewMessage(
              context,
              'Đạt 60 điểm và đọc đủ 80% để mở màn tiếp.',
            );
          }
          return;
        }
      }
      await c.select(c.prompts[target]);
    }
  }

  String? get sample {
    if (c.prompt?['sampleAsset'] is String) {
      return c.prompt!['sampleAsset'] as String;
    }
    const sentences = [
      'I have lived here for five years',
      'My name is Anna',
      'I am a student from Hanoi',
    ];
    final found = sentences.indexOf(c.sentence);
    return found < 0 ? null : 'speak${found + 1}';
  }

  String time(Duration value) =>
      '${value.inMinutes.toString().padLeft(2, '0')}:${(value.inSeconds % 60).toString().padLeft(2, '0')}';
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: c,
    builder: (context, _) => PopScope(
      canPop: !c.busy,
      child: FigmaPage(
        titleStyle: designHeading(18),
        title: 'Luyện Nói',
        leading: IconButton(
          tooltip: 'Quay lại',
          onPressed: c.busy ? null : () => Navigator.pop(context),
          icon: const Icon(Icons.chevron_left),
        ),
        trailing: IconButton(
          tooltip: 'Lịch sử Speaking',
          icon: const Icon(Icons.history),
          onPressed: locked
              ? null
              : () => previewPush(
                  context,
                  SpeakingHistoryPage(controller: c, mode: c.mode),
                ),
        ),
        bottom: total == 0
            ? null
            : feedback
            ? CustomAppButton(
                text: index == total - 1 ? 'Hoàn thành' : 'Câu tiếp',
                onPressed: locked ? null : () => move(1),
                borderRadius: AppRadius.tagRadius,
              )
            : PreviewToolbar(
                index: index,
                total: total,
                onBack: locked || index == 0 ? null : () => move(-1),
                onNext: locked || !c.enabled || c.serviceUnavailable
                    ? null
                    : c.audioPath == null
                    ? record
                    : submit,
                nextLabel: c.busy || c.processing
                    ? 'Đang chấm…'
                    : c.audioPath == null
                    ? 'Bắt đầu'
                    : c.terminal
                    ? 'Nộp lần mới'
                    : 'Nộp bản thu',
              ),
        child: total == 0
            ? Center(
                child: c.busy
                    ? const CircularProgressIndicator()
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(c.error ?? 'Chưa có câu luyện được mở.'),
                          TextButton(
                            onPressed: c.initialized
                                ? c.loadPrompts
                                : c.initialize,
                            child: const Text('Thử lại'),
                          ),
                        ],
                      ),
              )
            : feedback
            ? result()
            : LayoutBuilder(
                builder: (context, bounds) => SingleChildScrollView(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: bounds.maxHeight),
                    child: IntrinsicHeight(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            PreviewProgress(
                              index: index,
                              total: total,
                              label:
                                  '${c.isTopic ? 'Chủ đề' : 'Câu'} ${index + 1}/$total',
                            ),
                            FigmaCard(
                              child: Text(
                                c.sentence,
                                textAlign: TextAlign.center,
                                style: designHeading(
                                  c.isTopic ? 28 : 32,
                                  height: 1.2,
                                ),
                              ),
                            ),
                            if (c.isTopic && c.prompt?['hints'] is List) ...[
                              const SizedBox(height: 12),
                              FigmaCard(
                                padding: const EdgeInsets.all(16),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    learningHeading('Câu hỏi gợi ý', size: 18),
                                    for (final hint
                                        in c.prompt!['hints'] as List)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 8),
                                        child: learningBody(
                                          '• $hint',
                                          size: 15,
                                        ),
                                      ),
                                    const Divider(
                                      height: 24,
                                      color: AppColors.grey100,
                                    ),
                                    learningBody(
                                      'Tối đa 60 giây. Nói ít nhất 10 giây và khoảng 20 từ để nhận phản hồi nội dung.',
                                      size: 13,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            const SizedBox(height: 12),
                            if (!c.recording &&
                                c.audioPath == null &&
                                sample != null)
                              Center(
                                child: SampleAudio(
                                  key: ValueKey('sample-$index'),
                                  asset: sample!,
                                ),
                              ),
                            if (c.audioPath != null) ...[
                              LearningCard(
                                children: [
                                  learningHeading('Bản ghi của bạn', size: 18),
                                  Row(
                                    children: [
                                      IconButton(
                                        key: const Key('speakingPlayback'),
                                        tooltip: 'Nghe bản thu của bạn',
                                        onPressed: c.busy ? null : play,
                                        icon: playing
                                            ? const Icon(Icons.pause)
                                            : const FigmaAsset(
                                                'speaking-recorded/imgVuesaxLinearPlay',
                                                size: 20,
                                              ),
                                      ),
                                      const SizedBox(width: 12),
                                      Expanded(
                                        child: Column(
                                          children: [
                                            LinearProgressIndicator(
                                              value:
                                                  duration.inMilliseconds == 0
                                                  ? 0
                                                  : (position.inMilliseconds /
                                                            duration
                                                                .inMilliseconds)
                                                        .clamp(0, 1),
                                              minHeight: 4,
                                              color: AppColors.primary500,
                                              backgroundColor:
                                                  AppColors.grey200,
                                            ),
                                            const SizedBox(height: 8),
                                            Row(
                                              mainAxisAlignment:
                                                  MainAxisAlignment
                                                      .spaceBetween,
                                              children: [
                                                Text(
                                                  time(position),
                                                  style: designText(
                                                    12,
                                                    color: AppColors.grey600,
                                                  ),
                                                ),
                                                Text(
                                                  time(duration),
                                                  style: designText(
                                                    12,
                                                    color: AppColors.grey600,
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                  OutlinedButton.icon(
                                    style: OutlinedButton.styleFrom(
                                      minimumSize: const Size.fromHeight(48),
                                    ),
                                    onPressed: locked ? null : record,
                                    icon: const Icon(Icons.mic_none, size: 20),
                                    label: const Text('Ghi lại'),
                                  ),
                                ],
                              ),
                            ],
                            if (c.busy || c.processing) ...[
                              const SizedBox(height: 24),
                              LearningCard(
                                children: [
                                  Row(
                                    children: [
                                      const SizedBox(
                                        width: 24,
                                        height: 24,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 3,
                                        ),
                                      ),
                                      const SizedBox(width: 16),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              'Đang chấm phát âm',
                                              style: designHeading(18),
                                            ),
                                            const SizedBox(height: 8),
                                            Text(
                                              'Đang phân tích bản thu của bạn. Kết quả sẽ hiện tại đây.',
                                              style: designText(
                                                14,
                                                height: 1.5,
                                                color: AppColors.grey800,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ],
                            if (c.error != null) learningBody(c.error!),
                            if (c.status == 'FAILED' ||
                                c.status == 'UNKNOWN') ...[
                              const SizedBox(height: 16),
                              learningBody(
                                speakingErrorMessage(
                                  c.submission?['errorCode']?.toString(),
                                ),
                              ),
                              TextButton(
                                onPressed: c.checking ? null : c.check,
                                child: const Text('Kiểm tra trạng thái'),
                              ),
                            ],
                            const Spacer(flex: 2),
                            const SizedBox(height: 32),
                            if (c.audioPath == null &&
                                !c.busy &&
                                !c.processing) ...[
                              if (c.recording) ...[
                                RecordingWaveform(amplitudes: amplitudes),
                                const SizedBox(height: 24),
                                Center(
                                  child: Text(
                                    'Đang thu âm · ${c.seconds.toString().padLeft(2, '0')} / ${c.maxSeconds} giây',
                                    style: designText(
                                      14,
                                      color: AppColors.primary700,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 16),
                              ],
                              Center(
                                child: Tooltip(
                                  message: c.recording
                                      ? 'Dừng ghi âm'
                                      : 'Bắt đầu ghi âm',
                                  child: InkWell(
                                    key: const Key('previewRecord'),
                                    onTap: !c.active || !c.enabled
                                        ? null
                                        : c.recording
                                        ? c.stop
                                        : record,
                                    borderRadius: AppRadius.buttonRadius,
                                    child: AnimatedContainer(
                                      duration:
                                          MediaQuery.disableAnimationsOf(
                                            context,
                                          )
                                          ? Duration.zero
                                          : const Duration(milliseconds: 180),
                                      width: 96,
                                      height: 96,
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        shape: BoxShape.circle,
                                        color: c.recording
                                            ? AppColors.primary700
                                            : Colors.white,
                                        boxShadow: c.recording
                                            ? AppShadows.recordingRing
                                            : const [],
                                        border: Border.all(
                                          color: c.recording
                                              ? AppColors.primary700
                                              : AppColors.grey900,
                                          width: 2,
                                        ),
                                      ),
                                      child: c.recording
                                          ? const Icon(
                                              Icons.stop_rounded,
                                              size: 40,
                                              color: Colors.white,
                                            )
                                          : const FigmaAsset(
                                              'speaking/imgVuesaxOutlineMicrophone2',
                                              size: 32,
                                            ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 24),
                              Text(
                                c.recording
                                    ? 'Chạm để dừng'
                                    : 'Chạm để bắt đầu ghi âm',
                                textAlign: TextAlign.center,
                                style: designText(
                                  c.recording ? 20 : 24,
                                  weight: FontWeight.w600,
                                ),
                              ),
                            ],
                            const Spacer(),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
      ),
    ),
  );
  Widget result() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      PreviewProgress(
        index: index,
        total: total,
        label: 'Xem lại câu ${index + 1}/$total',
      ),
      const SizedBox(height: 16),
      if (c.mode == 'TONGUE_TWISTER') ...[
        LearningCard(
          children: [
            learningHeading(
              gameStars == null ? 'Chưa đủ dữ liệu xếp sao' : '$gameStars sao',
            ),
            learningBody(
              c.result?['overall'] is num &&
                      (c.result!['overall'] as num) >= 60 &&
                      (c.result?['completeness'] as num? ?? 0) >= 80
                  ? 'Đã vượt màn. Bạn có thể luyện lại để cải thiện thành tích.'
                  : 'Đạt 60 điểm và đọc đủ ít nhất 80% để mở màn tiếp.',
            ),
          ],
        ),
        const SizedBox(height: 12),
      ],
      SpeakingResult(
        result: c.result!,
        repository: c.repository,
        submissionId: c.submission?['id'] as String?,
        referenceText: c.sentence,
        audioPath: c.resultAudioPath(c.submission?['id'] as String?),
        isCurrent: () => c.active,
      ),
      const SizedBox(height: 16),
      OutlinedButton.icon(
        style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        onPressed: locked ? null : () => c.select(c.prompt!),
        icon: const Icon(Icons.replay),
        label: const Text('Luyện lại'),
      ),
    ],
  );
}

