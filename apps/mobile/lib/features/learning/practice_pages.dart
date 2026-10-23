import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'learning_widgets.dart';
import 'preview_model.dart';
import 'sample_audio.dart';
import 'preview_waveform.dart';

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
  });
  final PracticeSkill skill;
  final PreviewModel model;
  @override
  Widget build(BuildContext context) => PreviewSurface(
    child: FigmaPage(
      title: 'Bài tập',
      bottom: CustomAppButton(
        text: 'Bắt đầu',
        onPressed: () => previewPush(context, switch (skill) {
          PracticeSkill.speaking => MicrophonePreviewPage(model: model),
          PracticeSkill.writing => WritingPreviewPage(model: model),
          _ => PreviewQuizPage(
            model: model,
            kind: skill == PracticeSkill.listening ? 'listening' : 'reading',
          ),
        }),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          learningHeading(skill.title, size: 28),
          const SizedBox(height: 16),
          learningBody(skill.description),
          const SizedBox(height: 32),
          LearningCard(
            gap: 24,
            children: [
              _row('${skill.source}/imgVuesaxBulkTimer', 'Khoảng 10-15 phút'),
              _row(
                '${skill.source}/imgVuesaxBulkTask',
                skill == PracticeSkill.writing
                    ? 'Làm xong 2 bài viết'
                    : skill == PracticeSkill.speaking
                    ? 'Làm xong 5 câu'
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
                  PracticeSkill.speaking => 'Bản thu mẫu và phản hồi minh họa',
                },
              ),
            ],
          ),
        ],
      ),
    ),
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
                style: designText(
                  36,
                  weight: FontWeight.w600,
                  color: AppColors.primary500,
                ),
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
  const MicrophonePreviewPage({super.key, required this.model});
  final PreviewModel model;
  @override
  Widget build(BuildContext context) => PreviewSurface(
    child: FigmaPage(
      title: 'Luyện Nói',
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CustomAppButton(
            text: 'Tiếp tục với bản mẫu',
            onPressed: () => Navigator.pushReplacement(
              context,
              MaterialPageRoute<void>(
                builder: (_) => SpeakingPreviewPage(model: model),
              ),
            ),
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
            style: designText(24, weight: FontWeight.w600),
          ),
          const SizedBox(height: 28),
          Text(
            'Bản xem trước dùng bản thu mẫu. Micro của thiết bị không được sử dụng.',
            textAlign: TextAlign.center,
            style: designText(18, color: AppColors.grey800, height: 1.5),
          ),
          const SizedBox(height: 24),
          for (final s in [
            'Chỉ ghi âm khi bạn chạm nút trong bản chính thức',
            'Phản hồi bên dưới là dữ liệu minh họa',
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
  );
}

enum _SpeakingStage { ready, recording, recorded, feedback }

class SpeakingPreviewPage extends StatefulWidget {
  const SpeakingPreviewPage({super.key, required this.model});
  final PreviewModel model;
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
  Widget build(BuildContext context) => PreviewSurface(
    child: FigmaPage(
      title: 'Luyện Nói',
      trailing: previewFlag(context),
      bottom: stage == _SpeakingStage.feedback
          ? CustomAppButton(
              text: index == 4 ? 'Hoàn thành' : 'Câu tiếp',
              onPressed: next,
              borderRadius: BorderRadius.circular(8),
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
                  constraints: BoxConstraints(minHeight: bounds.maxHeight),
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
                              style: designText(
                                32,
                                weight: FontWeight.w600,
                                height: 1,
                              ),
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
                                recording: stage == _SpeakingStage.recording,
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
                              learningBody('Cấu trúc: First...Then..Finally'),
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
                                  borderRadius: BorderRadius.circular(99),
                                  child: Container(
                                    width: 96,
                                    height: 96,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: stage == _SpeakingStage.recording
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
                                      size: stage == _SpeakingStage.recording
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
                                stage == _SpeakingStage.recording ? 20 : 24,
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
                style: designText(32, weight: FontWeight.w600, height: 1),
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

class WritingPreviewPage extends StatefulWidget {
  const WritingPreviewPage({super.key, required this.model});
  final PreviewModel model;
  @override
  State<WritingPreviewPage> createState() => _WritingPreviewPageState();
}

class _WritingPreviewPageState extends State<WritingPreviewPage> {
  int index = 0;
  bool hints = false, saving = false;
  late final controller = TextEditingController(
    text: widget.model.drafts[index],
  );
  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> save({bool announce = false}) async {
    if (saving) return;
    saving = true;
    try {
      await widget.model.saveDraft(index, controller.text);
      if (announce && mounted) {
        previewMessage(context, 'Đã lưu bản nháp trên thiết bị.');
      }
    } catch (_) {
      if (mounted) {
        previewMessage(context, 'Không lưu được bản nháp. Vui lòng thử lại.');
      }
    } finally {
      saving = false;
    }
  }

  Future<void> move(int next) async {
    FocusScope.of(context).unfocus();
    await save();
    if (!mounted) return;
    setState(() {
      index = next;
      controller.text = widget.model.drafts[index];
      hints = false;
    });
  }

  Future<void> next() async {
    if (controller.text.trim().isEmpty) {
      previewMessage(context, 'Hãy viết câu trả lời trước khi tiếp tục.');
      return;
    }
    await save();
    if (!mounted) return;
    if (index == 0) {
      await move(1);
      return;
    }
    if (widget.model.drafts.any((d) => d.trim().isEmpty)) {
      previewMessage(context, 'Cần hoàn thành cả hai bài viết.');
      return;
    }
    await widget.model.finish('writing');
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute<void>(
          builder: (_) => WritingResultPage(model: widget.model),
        ),
      );
    }
  }

  Future<void> grid() async {
    await save();
    if (!mounted) return;
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Wrap(
            spacing: 12,
            children: [
              for (var i = 0; i < 2; i++)
                LearningPill(
                  'Bài ${i + 1}',
                  selected: i == index,
                  onTap: () {
                    Navigator.pop(context);
                    move(i);
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => PopScope(
    onPopInvokedWithResult: (didPop, _) {
      if (didPop) save();
    },
    child: PreviewSurface(
      child: FigmaPage(
        title: 'Luyện Viết',
        trailing: previewFlag(context),
        bottom: PreviewToolbar(
          index: index,
          total: 2,
          onBack: index == 0 ? null : () => move(0),
          onGrid: grid,
          onNext: controller.text.trim().isEmpty ? null : next,
          nextLabel: index == 1 ? 'Nộp bài' : 'Tiếp theo',
        ),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            PreviewProgress(
              index: index,
              total: 2,
              label: 'Câu ${index + 1}/2',
            ),
            FigmaCard(
              padding: const EdgeInsets.fromLTRB(14, 24, 14, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  learningBody('Đề bài', size: 18),
                  const SizedBox(height: 16),
                  learningHeading(writingPrompts[index], size: 24),
                ],
              ),
            ),
            const SizedBox(height: 12),
            LearningCard(
              children: [
                InkWell(
                  key: const Key('writingHints'),
                  onTap: () => setState(() => hints = !hints),
                  child: Row(
                    children: [
                      Expanded(
                        child: learningHeading(
                          'Gợi ý từ và cấu trúc',
                          size: 18,
                        ),
                      ),
                      const FigmaAsset(
                        'writing/imgVuesaxLinearArrowDown',
                        size: 20,
                      ),
                    ],
                  ),
                ),
                if (hints) ...[
                  learningHeading('Từ và cụm từ', size: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final word
                          in index == 0
                              ? [
                                  'went to',
                                  'played',
                                  'had lunch',
                                  'because',
                                  'then',
                                ]
                              : [
                                  'kind',
                                  'funny',
                                  'best friend',
                                  'for five years',
                                ])
                        LearningPill(
                          word,
                          onTap: () {
                            final current = controller.text;
                            controller.text =
                                '$current${current.isEmpty ? '' : ' '}$word';
                            controller.selection = TextSelection.collapsed(
                              offset: controller.text.length,
                            );
                            setState(() {});
                          },
                        ),
                    ],
                  ),
                  learningHeading('Cấu trúc', size: 16),
                  learningBody(
                    index == 0
                        ? '1. Bạn đã đi đâu hoặc làm gì?\n2. Bạn đi với ai?\n3. Bạn cảm thấy thế nào?'
                        : '1. Giới thiệu bạn thân của bạn.\n2. Mô tả tính cách và sở thích.',
                    size: 14,
                  ),
                ],
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 160,
              child: TextField(
                key: const Key('writingInput'),
                controller: controller,
                expands: true,
                maxLines: null,
                textAlignVertical: TextAlignVertical.top,
                onChanged: (_) => setState(() {}),
                style: designText(16, height: 1.5),
                textCapitalization: TextCapitalization.sentences,
                decoration: InputDecoration(
                  hintText: 'Bắt đầu viết ở đây....',
                  hintStyle: designText(16, color: AppColors.grey600),
                  filled: true,
                  fillColor: AppColors.grey50,
                  contentPadding: const EdgeInsets.all(16),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: AppColors.grey100),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: const BorderSide(color: AppColors.grey100),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: learningBody(
                    '${wordCount(controller.text)} từ · mục tiêu 40–60',
                    size: 18,
                  ),
                ),
                TextButton.icon(
                  onPressed: () => save(announce: true),
                  icon: const FigmaAsset(
                    'writing/imgVuesaxLinearBookSaved',
                    size: 20,
                  ),
                  label: Text(
                    'Lưu',
                    style: designText(18, color: AppColors.grey800),
                  ),
                ),
              ],
            ),
            TextButton(
              onPressed: () {
                setState(() => controller.text = sampleWriting[index]);
              },
              child: const Text('Điền bài mẫu'),
            ),
          ],
        ),
      ),
    ),
  );
}

class WritingResultPage extends StatelessWidget {
  const WritingResultPage({super.key, required this.model});
  final PreviewModel model;
  @override
  Widget build(BuildContext context) => PreviewSurface(
    child: FigmaPage(
      title: 'Kết quả',
      headerHeight: 42,
      bottom: CustomAppButton(
        text: 'Xem chi tiết từng bài',
        onPressed: () => previewPush(context, WritingReviewPage(model: model)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          FigmaCard(
            child: Column(
              children: [
                Text(
                  'Đã nộp 2 bài viết',
                  textAlign: TextAlign.center,
                  style: designText(28, weight: FontWeight.w600),
                ),
                const SizedBox(height: 12),
                Text(
                  'Bài viết không chấm điểm số. Bài của bạn được nhận xét theo từng tiêu chí',
                  textAlign: TextAlign.center,
                  style: designText(18, color: AppColors.grey800),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          const FeedbackRow(
            title: 'Đủ ý',
            detail: 'Tốt ở cả 2 bài',
            colored: true,
          ),
          const FeedbackRow(
            title: 'Từ vựng',
            detail: 'Tốt ở cả 2 bài',
            colored: true,
          ),
          const FeedbackRow(
            title: 'Ngữ pháp',
            detail: 'Cần xem ở bài 1',
            warning: true,
            colored: true,
          ),
          const FeedbackRow(
            title: 'Từ nối',
            detail: 'Cần xem ở bài 1',
            warning: true,
            colored: true,
          ),
          const SizedBox(height: 16),
          learningBody(
            'Nhận xét minh họa để xem giao diện. Bài viết chưa được AI hoặc giáo viên chấm.',
            size: 12,
          ),
        ],
      ),
    ),
  );
}

class WritingReviewPage extends StatefulWidget {
  const WritingReviewPage({super.key, required this.model});
  final PreviewModel model;
  @override
  State<WritingReviewPage> createState() => _WritingReviewPageState();
}

class _WritingReviewPageState extends State<WritingReviewPage> {
  int index = 0;
  @override
  Widget build(BuildContext context) => PreviewSurface(
    child: FigmaPage(
      title: 'Bài viết ${index + 1}/2',
      headerHeight: 42,
      bottom: PreviewToolbar(
        index: index,
        total: 2,
        onBack: index == 0 ? null : () => setState(() => index--),
        onNext: () {
          if (index == 0) {
            setState(() => index++);
          } else {
            Navigator.pop(context);
          }
        },
        nextLabel: index == 1 ? 'Hoàn tất' : 'Tiếp theo',
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          learningBody('Đề bài', size: 18),
          const SizedBox(height: 16),
          learningHeading(writingPrompts[index], size: 24),
          const SizedBox(height: 24),
          learningBody('Bài viết của bạn', size: 18),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.grey50,
              border: Border.all(color: AppColors.grey100),
              borderRadius: BorderRadius.circular(8),
            ),
            child: SelectableText(
              widget.model.drafts[index],
              style: designText(16, height: 1.5),
            ),
          ),
          const SizedBox(height: 24),
          const FeedbackRow(title: 'Đủ ý', colored: true),
          const FeedbackRow(title: 'Từ vựng', colored: true),
          const FeedbackRow(
            title: 'Ngữ pháp',
            detail: 'Ví dụ: kiểm tra thì quá khứ và cấu trúc câu.',
          ),
          const FeedbackRow(
            title: 'Từ nối',
            detail: 'Ví dụ: dùng then, because để liên kết ý.',
          ),
          const SizedBox(height: 12),
          learningBody(
            'Góp ý mẫu, chưa dựa trên phân tích bài viết.',
            size: 12,
          ),
        ],
      ),
    ),
  );
}
