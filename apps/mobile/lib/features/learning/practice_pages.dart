import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'learning_widgets.dart';
import 'preview_model.dart';
import 'sample_audio.dart';
import 'preview_waveform.dart';
import '../speaking/speaking_controller.dart';
import '../speaking/speaking_repository.dart';
import '../speaking/speaking_pages.dart'
    show SpeakingHistoryPage, SpeakingResult;
import '../speaking/recording_waveform.dart';
import '../speaking/speaking_modes_page.dart';
import 'writing_practice_page.dart';

export 'writing_practice_page.dart';

Widget _speakingSurface(Widget child, SpeakingController? speaking) =>
    speaking == null ? PreviewSurface(child: child) : child;

Widget previewFlag(BuildContext context) => IconButton(
  tooltip: 'Báo vấn đề',
  onPressed: () => previewMessage(
    context,
    'Đây là bài mẫu. Báo cáo chưa được gửi lên máy chủ.',
  ),
  icon: const FigmaAsset('speaking/imgVuesaxLinearFlag'),
);

class PracticeIntroPage extends StatelessWidget {
  const PracticeIntroPage({
    super.key,
    required this.skill,
    required this.model,
    this.speaking,
  });
  final PracticeSkill skill;
  final PreviewModel model;
  final SpeakingController? speaking;
  @override
  Widget build(BuildContext context) => speaking == null
      ? _build(context)
      : AnimatedBuilder(
          animation: speaking!,
          builder: (context, _) => _build(context),
        );
  Widget _build(BuildContext context) => _speakingSurface(
    FigmaPage(
      titleStyle: designHeading(18),
      title: 'Bài tập',
      trailing: speaking == null
          ? null
          : IconButton(
              tooltip: 'Lịch sử Speaking',
              icon: const Icon(Icons.history),
              onPressed: speaking!.busy
                  ? null
                  : () => previewPush(
                      context,
                      SpeakingHistoryPage(controller: speaking!),
                    ),
            ),
      bottom: CustomAppButton(
        text: speaking?.busy == true ? 'Đang tải…' : 'Bắt đầu',
        onPressed: speaking?.busy == true
            ? null
            : () async {
                final controller = speaking;
                if (controller != null) {
                  await previewPush(
                    context,
                    SpeakingModesPage(
                      controller: controller,
                      practicePage: () => MicrophonePreviewPage(
                        model: model,
                        speaking: controller,
                      ),
                    ),
                  );
                  return;
                }
                if (!context.mounted) return;
                previewPush(context, switch (skill) {
                  PracticeSkill.speaking => MicrophonePreviewPage(
                    model: model,
                    speaking: speaking,
                  ),
                  PracticeSkill.writing => WritingPracticeListPage(
                    model: model,
                  ),
                  _ => PreviewQuizPage(
                    model: model,
                    kind: skill == PracticeSkill.listening
                        ? 'listening'
                        : 'reading',
                  ),
                });
              },
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          learningHeading(
            speaking != null ? 'Luyện nói mỗi ngày' : skill.title,
            size: 28,
          ),
          const SizedBox(height: 16),
          learningBody(
            speaking != null
                ? 'Luyện đọc, nói theo chủ đề và vượt thử thách phát âm cùng lingoRoad.'
                : skill.description,
          ),
          const SizedBox(height: 32),
          LearningCard(
            gap: 24,
            children: [
              _row(
                '${skill.source}/imgVuesaxBulkTimer',
                speaking != null
                    ? '30 giây–3 phút mỗi lượt'
                    : 'Khoảng 10-15 phút',
              ),
              _row(
                '${skill.source}/imgVuesaxBulkTask',
                skill == PracticeSkill.writing
                    ? 'Làm xong 2 bài viết'
                    : skill == PracticeSkill.speaking
                    ? (speaking == null
                          ? 'Làm xong 5 câu'
                          : 'Bốn chế độ luyện nói')
                    : 'Làm xong 5 câu',
              ),
              _row(
                '${skill.source}/${switch (skill) {
                  PracticeSkill.listening => 'imgVuesaxBulkRefresh',
                  PracticeSkill.reading => 'imgVuesaxBulkBookSquare',
                  PracticeSkill.writing => 'imgVuesaxBulkEdit',
                  PracticeSkill.speaking => 'imgVuesaxBulkMicrophone',
                }}',
                switch (skill) {
                  PracticeSkill.listening => 'Được nghe lại 2 lần mỗi câu',
                  PracticeSkill.reading => 'Đọc đoạn văn và trả lời câu hỏi',
                  PracticeSkill.writing => 'Viết câu và kiểm tra lỗi',
                  PracticeSkill.speaking =>
                    speaking == null
                        ? 'Bản thu mẫu và phản hồi minh họa'
                        : 'Ghi âm và nhận phản hồi phát âm',
                },
              ),
            ],
          ),
        ],
      ),
    ),
    speaking,
  );
  Widget _row(String icon, String text) => Row(
    children: [
      Container(
        padding: const EdgeInsets.all(12),
        decoration: const BoxDecoration(
          color: AppColors.primary25,
          shape: BoxShape.circle,
        ),
        child: FigmaAsset(icon, size: 20),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Text(text, style: designText(14, weight: FontWeight.w500)),
      ),
    ],
  );
}

class PreviewQuizPage extends StatefulWidget {
  const PreviewQuizPage({super.key, required this.model, required this.kind});
  final PreviewModel model;
  final String kind;
  @override
  State<PreviewQuizPage> createState() => _PreviewQuizPageState();
}

class _PreviewQuizPageState extends State<PreviewQuizPage> {
  int index = 0;
  final answers = <int, int>{};
  bool reveal = false;
  int? selected;
  List<List<Object>> get questions => widget.kind == 'vocabulary'
      ? [
          [
            'My father and mother are my …',
            ['parents', 'sisters', 'brothers', 'sons'],
            0,
          ],
          [
            'My mother’s mother is my …',
            ['sister', 'grandmother', 'daughter', 'aunt'],
            1,
          ],
          [
            'A daughter is a …',
            ['boy', 'father', 'girl', 'grandfather'],
            2,
          ],
          [
            'My father’s son is my …',
            ['mother', 'sister', 'grandmother', 'brother'],
            3,
          ],
          [
            'My mother is a …',
            ['teacher', 'teach', 'teaching', 'teaches'],
            0,
          ],
        ]
      : widget.kind == 'grammar'
      ? [
          [
            'I … a student.',
            ['am', 'is', 'are', 'be'],
            0,
          ],
          [
            'Lan … from Hanoi.',
            ['am', 'is', 'are', 'be'],
            1,
          ],
          [
            'They … my friends.',
            ['am', 'is', 'are', 'be'],
            2,
          ],
          [
            '… she a teacher?',
            ['Am', 'Are', 'Be', 'Is'],
            3,
          ],
          [
            'We … not tired.',
            ['are', 'is', 'am', 'be'],
            0,
          ],
        ]
      : [
          [
            'What is the woman’s name?',
            ['Anna', 'Mai', 'Lan', 'Jane'],
            0,
          ],
          [
            'Where is Anna from?',
            ['London', 'Hanoi', 'Paris', 'Tokyo'],
            1,
          ],
          [
            'What does Anna do?',
            ['A doctor', 'A teacher', 'A student', 'A nurse'],
            2,
          ],
          [
            'What does Anna like?',
            ['Running', 'Cooking', 'Dancing', 'Reading'],
            3,
          ],
          [
            'How old is Anna?',
            ['Twenty', 'Twelve', 'Thirty', 'Eighteen'],
            0,
          ],
        ];
  String get title => switch (widget.kind) {
    'vocabulary' => 'Phần 2 · Luyện tập',
    'grammar' => 'Luyện ngữ pháp',
    'listening' => 'Luyện Nghe',
    _ => 'Luyện Đọc',
  };
  Future<void> next() async {
    if (selected == null) return;
    if (!reveal) {
      setState(() {
        answers[index] = selected!;
        reveal = true;
      });
      return;
    }
    if (index < questions.length - 1) {
      setState(() {
        index++;
        selected = answers[index];
        reveal = false;
      });
    } else {
      await widget.model.finish(widget.kind);
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute<void>(
            builder: (_) => QuizSummaryPage(
              correct: answers.entries
                  .where((e) => e.value == questions[e.key][2])
                  .length,
              total: questions.length,
              title: title,
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = questions[index];
    final options = q[1] as List<String>;
    return PreviewSurface(
      child: FigmaPage(
        titleStyle: designHeading(18),
        title: title,
        trailing: previewFlag(context),
        bottom: PreviewToolbar(
          index: index,
          total: questions.length,
          onBack: index == 0
              ? null
              : () => setState(() {
                  index--;
                  selected = answers[index];
                  reveal = selected != null;
                }),
          onNext: selected == null ? null : next,
          nextLabel: reveal
              ? (index == questions.length - 1 ? 'Kết quả' : 'Tiếp theo')
              : 'Kiểm tra',
        ),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            PreviewProgress(
              index: index,
              total: questions.length,
              label: 'Câu ${index + 1}/${questions.length}',
            ),
            if (widget.kind == 'listening') ...[
              LearningCard(
                children: [
                  SampleAudio(
                    key: ValueKey(index),
                    asset: 'listening',
                    label: 'Nghe đoạn hội thoại',
                    player: true,
                  ),
                ],
              ),
              const SizedBox(height: 24),
            ],
            if (widget.kind == 'reading') ...[
              LearningCard(
                gap: 12,
                children: [
                  learningHeading('Đoạn văn', size: 18),
                  learningBody(
                    'Hello! My name is Anna. I am twenty years old. I am from Hanoi. I am a student. I like reading books with my friends.',
                    size: 16,
                  ),
                ],
              ),
              const SizedBox(height: 24),
            ],
            learningHeading(q[0] as String, size: 24),
            const SizedBox(height: 24),
            for (var i = 0; i < options.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: AnswerOption(
                  key: ValueKey('previewOption$i'),
                  index: i,
                  text: options[i],
                  selected: selected == i,
                  correct: reveal ? i == q[2] : null,
                  chosen: selected == i,
                  onTap: reveal ? null : () => setState(() => selected = i),
                ),
              ),
            if (reveal)
              LearningCard(
                gap: 12,
                children: [
                  learningHeading(
                    selected == q[2] ? 'Chính xác!' : 'Cùng xem lại đáp án',
                  ),
                  learningBody(
                    'Đáp án: ${options[q[2] as int]}. Đây là câu hỏi mẫu để bạn thử giao diện.',
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}

class QuizSummaryPage extends StatelessWidget {
  const QuizSummaryPage({
    super.key,
    required this.correct,
    required this.total,
    required this.title,
  });
  final int correct, total;
  final String title;
  @override
  Widget build(BuildContext context) => PreviewSurface(
    child: FigmaPage(
      titleStyle: designHeading(18),
      title: 'Kết quả',
      bottom: CustomAppButton(
        text: 'Quay lại bài học',
        onPressed: () => Navigator.pop(context),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          LearningCard(
            children: [
              learningHeading('Đã hoàn thành bài tập', size: 28),
              learningBody(title),
              Text(
                '$correct/$total câu đúng',
                style: designHeading(36, color: AppColors.primary500),
              ),
              learningBody(
                'Điểm bài mẫu không cập nhật CEFR hoặc kết quả kiểm tra đầu vào.',
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

class MicrophonePreviewPage extends StatelessWidget {
  const MicrophonePreviewPage({super.key, required this.model, this.speaking});
  final PreviewModel model;
  final SpeakingController? speaking;
  @override
  Widget build(BuildContext context) => _speakingSurface(
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
                if (c.prompt == null) await c.select(c.prompts.first);
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
      ? _LiveSpeakingView(controller: widget.speaking!)
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

/// The original speaking layout, backed by real submissions for signed-in users.
class _LiveSpeakingView extends StatefulWidget {
  const _LiveSpeakingView({required this.controller});
  final SpeakingController controller;
  @override
  State<_LiveSpeakingView> createState() => _LiveSpeakingViewState();
}

class _LiveSpeakingViewState extends State<_LiveSpeakingView>
    with WidgetsBindingObserver {
  SpeakingController get c => widget.controller;
  final player = AudioPlayer();
  late final amplitudes = c.recorder.amplitudes;
  final subscriptions = <StreamSubscription<dynamic>>[];
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
                                            ? [
                                                const BoxShadow(
                                                  color: AppColors.primary100,
                                                  spreadRadius: 8,
                                                ),
                                              ]
                                            : [],
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
