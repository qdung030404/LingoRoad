import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../speaking/speaking_controller.dart';
import '../speaking/speaking_modes_page.dart';
import '../speaking/speaking_pages.dart' show SpeakingHistoryPage;
import 'learning_widgets.dart';
import 'preview_model.dart';
import 'sample_audio.dart';
import 'speaking_practice_pages.dart';
import 'writing_practice_page.dart';

export 'speaking_practice_pages.dart';
export 'writing_practice_page.dart';

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
  Widget _build(BuildContext context) => speakingSurface(
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
  const PreviewQuizPage({
    super.key,
    required this.model,
    required this.kind,
  });

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
  bool _submitting = false;

  List<List<Object>> get questions =>
      widget.kind == 'vocabulary'
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
    if (selected == null || _submitting) return;
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
      setState(() => _submitting = true);
      try {
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
      } finally {
        if (mounted) setState(() => _submitting = false);
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
          onBack: _submitting || index == 0
              ? null
              : () => setState(() {
                  index--;
                  selected = answers[index];
                  reveal = selected != null;
                }),
          onNext: _submitting || selected == null ? null : next,
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
        text: 'Về trang chủ',
        onPressed: () => Navigator.of(context).popUntil(
          (route) =>
              route.settings.name == learningHomeRouteName || route.isFirst,
        ),
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
