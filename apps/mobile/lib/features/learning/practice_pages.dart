import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'learning_widgets.dart';
import 'preview_model.dart';
import 'sample_audio.dart';
import 'preview_waveform.dart';
import 'writing_practice_page.dart';

export 'writing_practice_page.dart';

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
      titleStyle: designHeading(18),
      title: 'Bài tập',
      bottom: CustomAppButton(
        text: 'Bắt đầu',
        onPressed: () => previewPush(context, switch (skill) {
          PracticeSkill.speaking => MicrophonePreviewPage(model: model),
          PracticeSkill.writing => WritingPracticeListPage(model: model),
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
  const MicrophonePreviewPage({super.key, required this.model});
  final PreviewModel model;
  @override
  Widget build(BuildContext context) => PreviewSurface(
    child: FigmaPage(
      titleStyle: designHeading(18),
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
            style: designHeading(24),
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
                                  borderRadius: AppRadius.buttonRadius,
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
