import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../speaking/speaking_controller.dart';
import 'learning_widgets.dart';
import 'live_speaking_view.dart';
import 'preview_model.dart';
import 'preview_waveform.dart';
import 'sample_audio.dart';

Widget speakingSurface(Widget child, SpeakingController? speaking) =>
    speaking == null ? PreviewSurface(child: child) : child;

Widget previewFlag(BuildContext context) => IconButton(
  tooltip: 'Báo vấn đề',
  onPressed: () => previewMessage(
    context,
    'Đây là bài mẫu. Báo cáo chưa được gửi lên máy chủ.',
  ),
  icon: const FigmaAsset('speaking/imgVuesaxLinearFlag'),
);

class MicrophonePreviewPage extends StatelessWidget {
  const MicrophonePreviewPage({super.key, required this.model, this.speaking});
  final PreviewModel model;
  final SpeakingController? speaking;
  @override
  Widget build(BuildContext context) => speakingSurface(
    FigmaPage(
      titleStyle: designHeading(18),
      title: 'Luyện Nói',
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CustomAppButton(
            text: speaking == null
                ? 'Tiếp tục với bản mẫu'
                : 'Cho phép dùng micro',
            onPressed: () async {
              final c = speaking;
              if (c != null) {
                if (!await c.recorder.hasPermission()) {
                  if (context.mounted) {
                    previewMessage(
                      context,
                      'Chưa có quyền micro. Cho phép micro trong cài đặt rồi thử lại.',
                    );
                  }
                  return;
                }
                if (!c.active || !context.mounted) return;
                if (c.prompt == null && c.prompts.isNotEmpty) {
                  await c.select(c.prompts.first);
                }
              }
              if (!context.mounted) return;
              Navigator.pushReplacement(
                context,
                MaterialPageRoute<void>(
                  builder: (_) =>
                      SpeakingPreviewPage(model: model, speaking: speaking),
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          CustomAppButton(
            text: 'Không tiện nói lúc này',
            isSecondary: true,
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 80),
        children: [
          Center(
            child: Container(
              width: 96,
              height: 96,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.grey200, width: 2),
              ),
              child: const FigmaAsset(
                'microphone/imgVuesaxOutlineMicrophone2',
                size: 32,
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Cho phép dùng micro\nđể luyện nói',
            textAlign: TextAlign.center,
            style: designHeading(24),
          ),
          const SizedBox(height: 28),
          Text(
            speaking == null
                ? 'Bản xem trước dùng bản thu mẫu. Micro của thiết bị không được sử dụng.'
                : 'Micro chỉ được sử dụng khi bạn chạm nút ghi âm. Bạn có thể nghe lại trước khi nộp.',
            textAlign: TextAlign.center,
            style: designText(18, color: AppColors.grey800, height: 1.5),
          ),
          const SizedBox(height: 24),
          for (final s in [
            speaking == null
                ? 'Chỉ ghi âm khi bạn chạm nút trong bản chính thức'
                : 'Chỉ ghi âm khi bạn chạm nút micro',
            speaking == null
                ? 'Phản hồi bên dưới là dữ liệu minh họa'
                : 'Chấm phát âm và lưu kết quả theo tài khoản',
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const FigmaAsset('microphone/imgCheck', size: 20),
                  const SizedBox(width: 12),
                  Expanded(child: learningBody(s, size: 18)),
                ],
              ),
            ),
        ],
      ),
    ),
    speaking,
  );
}

enum _SpeakingStage { ready, recording, recorded, feedback }

class SpeakingPreviewPage extends StatefulWidget {
  const SpeakingPreviewPage({super.key, required this.model, this.speaking});
  final PreviewModel model;
  final SpeakingController? speaking;
  @override
  State<SpeakingPreviewPage> createState() => _SpeakingPreviewPageState();
}

class _SpeakingPreviewPageState extends State<SpeakingPreviewPage>
    with WidgetsBindingObserver {
  int index = 0, seconds = 0;
  _SpeakingStage stage = _SpeakingStage.ready;
  Timer? timer;
  static const prompts = [
    'I have lived here for five years',
    'My name is Anna',
    'I am a student from Hanoi',
    'Describe your daily routine',
    'Talk about your hobbies',
  ];
  String get transcript => index == 3
      ? 'I wake up at seven. Then I go to work by bus'
      : index == 4
      ? 'I like reading books and listening to music.'
      : prompts[index];
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState s) {
    if (s != AppLifecycleState.resumed && stage == _SpeakingStage.recording) {
      stop();
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void record() {
    timer?.cancel();
    setState(() {
      stage = _SpeakingStage.recording;
      seconds = 0;
    });
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => seconds++);
      if (seconds >= 30) stop();
    });
  }

  void stop() {
    timer?.cancel();
    if (mounted) setState(() => stage = _SpeakingStage.recorded);
  }

  Future<void> next() async {
    if (stage == _SpeakingStage.recording) stop();
    if (stage == _SpeakingStage.recorded) {
      setState(() => stage = _SpeakingStage.feedback);
      return;
    }
    if (index < 4) {
      setState(() {
        index++;
        seconds = 0;
        stage = _SpeakingStage.ready;
      });
    } else {
      await widget.model.finish('speaking');
      if (mounted) Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) => widget.speaking != null
      ? LiveSpeakingView(controller: widget.speaking!)
      : PreviewSurface(
          child: FigmaPage(
            titleStyle: designHeading(18),
            title: 'Luyện Nói',
            trailing: previewFlag(context),
            bottom: stage == _SpeakingStage.feedback
                ? CustomAppButton(
                    text: index == 4 ? 'Hoàn thành' : 'Câu tiếp',
                    onPressed: next,
                    borderRadius: AppRadius.tagRadius,
                  )
                : PreviewToolbar(
                    index: index,
                    total: 5,
                    onBack: index == 0 || stage == _SpeakingStage.recording
                        ? null
                        : () => setState(() {
                            index--;
                            stage = _SpeakingStage.ready;
                          }),
                    onNext: stage == _SpeakingStage.recording
                        ? null
                        : (index >= 3 && stage == _SpeakingStage.ready
                              ? record
                              : next),
                    nextLabel: index >= 3 && stage == _SpeakingStage.ready
                        ? 'Bắt đầu'
                        : 'Tiếp theo',
                  ),
            child: stage == _SpeakingStage.feedback
                ? feedback()
                : LayoutBuilder(
                    builder: (context, bounds) => SingleChildScrollView(
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          minHeight: bounds.maxHeight,
                        ),
                        child: IntrinsicHeight(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                PreviewProgress(
                                  index: index,
                                  total: 5,
                                  label: 'Câu ${index + 1}/5',
                                ),
                                FigmaCard(
                                  child: Text(
                                    prompts[index],
                                    textAlign: TextAlign.center,
                                    style: designHeading(32, height: 1),
                                  ),
                                ),
                                const SizedBox(height: 12),
                                if (index < 3 && stage == _SpeakingStage.ready)
                                  Center(
                                    child: SampleAudio(
                                      key: ValueKey('sample-$index'),
                                      asset: 'speak${index + 1}',
                                    ),
                                  ),
                                if (index >= 3 &&
                                    stage != _SpeakingStage.recorded) ...[
                                  const SizedBox(height: 24),
                                  Center(
                                    child: _PreparationClock(
                                      recording:
                                          stage == _SpeakingStage.recording,
                                      seconds: seconds,
                                    ),
                                  ),
                                  if (stage == _SpeakingStage.ready) ...[
                                    const SizedBox(height: 24),
                                    learningHeading('Gợi ý từ', size: 18),
                                    const SizedBox(height: 12),
                                    Wrap(
                                      spacing: 8,
                                      runSpacing: 8,
                                      children: [
                                        for (final t in [
                                          'wake up',
                                          'go to work',
                                          'in the evening',
                                        ])
                                          LearningPill(t),
                                      ],
                                    ),
                                    const SizedBox(height: 12),
                                    learningBody(
                                      'Cấu trúc: First...Then..Finally',
                                    ),
                                  ],
                                ],
                                if (stage == _SpeakingStage.recorded) ...[
                                  const SizedBox(height: 12),
                                  LearningCard(
                                    children: [
                                      learningHeading('Bản ghi mẫu', size: 18),
                                      SampleAudio(
                                        key: ValueKey('record-$index'),
                                        asset: 'speak${index + 1}',
                                        player: true,
                                      ),
                                      TextButton(
                                        onPressed: record,
                                        child: const Text('Ghi lại'),
                                      ),
                                    ],
                                  ),
                                  learningBody(
                                    'Đang dùng bản thu mẫu; chưa thu âm giọng của bạn.',
                                    size: 12,
                                  ),
                                ],
                                const Spacer(),
                                const SizedBox(height: 32),
                                if (stage != _SpeakingStage.recorded &&
                                    !(index >= 3 &&
                                        stage == _SpeakingStage.ready)) ...[
                                  if (stage == _SpeakingStage.recording) ...[
                                    const PreviewWaveform(),
                                    const SizedBox(height: 24),
                                  ],
                                  Center(
                                    child: Tooltip(
                                      message: stage == _SpeakingStage.recording
                                          ? 'Dừng mô phỏng'
                                          : 'Bắt đầu mô phỏng ghi âm',
                                      child: InkWell(
                                        key: const Key('previewRecord'),
                                        onTap: stage == _SpeakingStage.recording
                                            ? stop
                                            : record,
                                        borderRadius: AppRadius.buttonRadius,
                                        child: Container(
                                          width: 96,
                                          height: 96,
                                          alignment: Alignment.center,
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            color:
                                                stage ==
                                                    _SpeakingStage.recording
                                                ? AppColors.grey900
                                                : Colors.white,
                                            border: Border.all(
                                              color: AppColors.grey900,
                                              width: 2,
                                            ),
                                          ),
                                          child: FigmaAsset(
                                            stage == _SpeakingStage.recording
                                                ? 'speaking-recording/imgVuesaxOutlinePause'
                                                : 'speaking/imgVuesaxOutlineMicrophone2',
                                            size:
                                                stage ==
                                                    _SpeakingStage.recording
                                                ? 40
                                                : 32,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 24),
                                  Text(
                                    stage == _SpeakingStage.recording
                                        ? 'Chạm để dừng'
                                        : 'Chạm để bắt đầu ghi âm',
                                    textAlign: TextAlign.center,
                                    style: designText(
                                      stage == _SpeakingStage.recording
                                          ? 20
                                          : 24,
                                      weight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  if (stage == _SpeakingStage.ready)
                                    TextButton(
                                      onPressed: next,
                                      child: Text(
                                        'Không tiện nói lúc này',
                                        style: designText(
                                          18,
                                          color: const Color(0xFFDE1B0C),
                                        ),
                                      ),
                                    ),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
          ),
        );
  Widget feedback() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      PreviewProgress(
        index: index,
        total: 5,
        label: 'Xem lại câu ${index + 1}/5',
      ),
      LearningCard(
        children: [
          learningHeading('Chúng tôi nghe được', size: 24),
          Text(
            transcript,
            style: designText(18, color: AppColors.grey800, height: 1.5),
          ),
          SampleAudio(
            key: ValueKey('feedback-$index'),
            asset: 'speak${index + 1}',
            player: true,
          ),
        ],
      ),
      const SizedBox(height: 24),
      const FeedbackRow(title: 'Đúng chủ đề'),
      const FeedbackRow(title: 'Có 2 ý', detail: 'Thử thêm một ý về buổi tối'),
      const FeedbackRow(
        title: 'Từ nối',
        detail: 'Thêm từ nối để nói tự nhiên hơn',
        warning: true,
      ),
      const SizedBox(height: 12),
      learningBody(
        'Phản hồi mẫu, không phân tích giọng nói của bạn. Nếu hệ thống nghe sai, đánh giá có thể lệch.',
        size: 16,
      ),
    ],
  );
}

class _PreparationClock extends StatelessWidget {
  const _PreparationClock({this.recording = false, this.seconds = 0});
  final bool recording;
  final int seconds;
  @override
  Widget build(BuildContext context) => SizedBox(
    width: 140,
    height: 140,
    child: Stack(
      clipBehavior: Clip.none,
      children: [
        const Positioned(
          left: -3,
          top: -3,
          child: FigmaAsset(
            'speaking-prompt/imgEllipse',
            width: 146,
            height: 146,
          ),
        ),
        Positioned(
          left: -3,
          top: -3,
          child: Transform.flip(
            flipX: true,
            child: const FigmaAsset(
              'speaking-prompt/imgEllipse1',
              width: 73,
              height: 146,
            ),
          ),
        ),
        Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                recording ? '0:${seconds.toString().padLeft(2, '0')}' : '0:12',
                style: designHeading(32, height: 1),
              ),
              const SizedBox(height: 4),
              Text(
                recording ? 'Còn ${30 - seconds} giây' : 'Chuẩn bị',
                style: designText(16, color: AppColors.grey800, height: 1.5),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class FeedbackRow extends StatelessWidget {
  const FeedbackRow({
    super.key,
    required this.title,
    this.detail,
    this.warning = false,
    this.colored = false,
  });
  final String title;
  final String? detail;
  final bool warning, colored;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.fromLTRB(8, 16, 16, 16),
    decoration: const BoxDecoration(
      border: Border(bottom: BorderSide(color: AppColors.grey500)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FigmaAsset(
          '${colored ? 'writing-result' : 'speaking-feedback'}/${warning ? 'imgVuesaxOutlineInfoCircle' : 'imgVuesaxOutlineTickCircle'}',
          size: 28,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: designText(16, weight: FontWeight.w500)),
              if (detail != null) ...[
                const SizedBox(height: 4),
                learningBody(detail!, size: 14),
              ],
            ],
          ),
        ),
      ],
    ),
  );
}
