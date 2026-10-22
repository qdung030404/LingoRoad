import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'learning_widgets.dart';
import 'preview_model.dart';
import 'practice_pages.dart';
import 'sample_audio.dart';

class GrammarLessonPage extends StatelessWidget {
  const GrammarLessonPage({super.key, required this.model});
  final PreviewModel model;
  @override
  Widget build(BuildContext context) => PreviewSurface(
    child: FigmaPage(
      title: 'Bài học',
      bottom: CustomAppButton(
        text: 'Bắt đầu học',
        onPressed: () => previewPush(
          context,
          PreviewQuizPage(model: model, kind: 'grammar'),
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          learningHeading('Subject pronouns and\nverb to be', size: 28),
          const SizedBox(height: 8),
          learningBody('Đại từ chủ ngữ và động từ to be', size: 14),
          const SizedBox(height: 24),
          LearningCard(
            gap: 12,
            children: [
              learningHeading('Cấu trúc ngữ pháp'),
              for (final line in [
                'S + am/is/are + C',
                'S + am/is/are + not + C',
                'Am/Is/Are + S + C ?',
              ])
                Text(
                  '•  $line',
                  style: designText(18, weight: FontWeight.w500),
                ),
            ],
          ),
          const SizedBox(height: 24),
          LearningCard(
            gap: 8,
            children: [
              learningHeading('Ví dụ mở đầu'),
              const SizedBox(height: 4),
              for (final parts in [
                ['Hello! ', 'I am', ' Lan. ', 'I am', ' from Hanoi.'],
                ['Lan ', 'is', ' a student.'],
                ['Lan and Mai ', 'are', ' from Hanoi.'],
              ])
                Text.rich(
                  TextSpan(
                    style: designText(16, weight: FontWeight.w500),
                    children: [
                      const TextSpan(text: '•  '),
                      for (var i = 0; i < parts.length; i++)
                        TextSpan(
                          text: parts[i],
                          style: i.isOdd
                              ? const TextStyle(
                                  color: AppColors.primary500,
                                  decoration: TextDecoration.underline,
                                )
                              : null,
                        ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    ),
  );
}

class VocabularyLessonPage extends StatelessWidget {
  const VocabularyLessonPage({super.key, required this.model});
  final PreviewModel model;
  @override
  Widget build(BuildContext context) => PreviewSurface(
    child: FigmaPage(
      title: 'Bài học',
      bottom: CustomAppButton(
        text: 'Bắt đầu học',
        onPressed: () => previewPush(context, VocabularyWordPage(model: model)),
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          learningHeading('Family and relationships', size: 28),
          const SizedBox(height: 8),
          learningBody('Gia đình và các mối quan hệ', size: 14),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: const FigmaAsset(
              'vocabulary-lesson/imgImage59',
              width: double.infinity,
              height: 180,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(height: 24),
          LearningCard(
            children: [
              learningHeading('Sau bài này bạn có thể'),
              learningBody(
                'Gọi tên các thành viên trong gia đình bằng tiếng Anh và giới thiệu người thân bằng những câu đơn giản.',
                size: 14,
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  const LearningPill(
                    '10 từ',
                    small: true,
                    icon: FigmaAsset(
                      'vocabulary-lesson/imgVuesaxLinearTaskSquare',
                      size: 20,
                    ),
                  ),
                  const LearningPill(
                    '10 phút',
                    small: true,
                    icon: FigmaAsset(
                      'vocabulary-lesson/imgVuesaxLinearTimer',
                      size: 20,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ),
  );
}

const vocabularyWords = [
  ['mother', '/ˈmʌðə(r)/', 'My mother is a teacher.', 'Mẹ tôi là giáo viên.'],
  ['father', '/ˈfɑːðə(r)/', 'My father is a doctor.', 'Bố tôi là bác sĩ.'],
  ['sister', '/ˈsɪstə(r)/', 'My sister is a student.', 'Chị tôi là sinh viên.'],
  [
    'brother',
    '/ˈbrʌðə(r)/',
    'My brother likes football.',
    'Anh tôi thích bóng đá.',
  ],
  [
    'grandmother',
    '/ˈɡrænmʌðə(r)/',
    'My grandmother is kind.',
    'Bà tôi rất tốt bụng.',
  ],
  [
    'grandfather',
    '/ˈɡrænfɑːðə(r)/',
    'My grandfather likes reading.',
    'Ông tôi thích đọc sách.',
  ],
  [
    'parents',
    '/ˈpeərənts/',
    'My parents live in Hanoi.',
    'Bố mẹ tôi sống ở Hà Nội.',
  ],
  ['family', '/ˈfæməli/', 'I love my family.', 'Tôi yêu gia đình mình.'],
  [
    'daughter',
    '/ˈdɔːtə(r)/',
    'Their daughter is five.',
    'Con gái của họ năm tuổi.',
  ],
  ['son', '/sʌn/', 'Their son is a student.', 'Con trai của họ là sinh viên.'],
];

class VocabularyWordPage extends StatefulWidget {
  const VocabularyWordPage({super.key, required this.model});
  final PreviewModel model;
  @override
  State<VocabularyWordPage> createState() => _VocabularyWordPageState();
}

class _VocabularyWordPageState extends State<VocabularyWordPage> {
  int index = 0;
  void grid() => showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            for (var i = 0; i < 10; i++)
              LearningPill(
                '${i + 1}',
                selected: index == i,
                onTap: () {
                  setState(() => index = i);
                  Navigator.pop(context);
                },
              ),
          ],
        ),
      ),
    ),
  );
  @override
  Widget build(BuildContext context) {
    final word = vocabularyWords[index];
    return PreviewSurface(
      child: FigmaPage(
        title: 'Phần 1 · Học từ vựng',
        bottom: PreviewToolbar(
          index: index,
          total: 10,
          onBack: index == 0 ? null : () => setState(() => index--),
          onGrid: grid,
          onNext: () {
            if (index < 9) {
              setState(() => index++);
            } else {
              previewPush(
                context,
                PreviewQuizPage(model: widget.model, kind: 'vocabulary'),
              );
            }
          },
        ),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            PreviewProgress(
              index: index,
              total: 10,
              label: 'Từ ${index + 1}/10',
              sections: true,
            ),
            FigmaCard(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: SizedBox(
                      height: 180,
                      width: double.infinity,
                      child: LayoutBuilder(
                        builder: (context, bounds) => OverflowBox(
                          alignment: Alignment.topCenter,
                          maxHeight: 329,
                          child: FigmaAsset(
                            index == 0
                                ? 'vocabulary-word/imgImage59'
                                : 'vocabulary-lesson/imgImage59',
                            width: bounds.maxWidth,
                            height: index == 0 ? 329 : 180,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            learningHeading(word[0], size: 36),
                            const SizedBox(height: 8),
                            learningBody('${word[1]} · danh từ', size: 18),
                          ],
                        ),
                      ),
                      SampleAudio(
                        key: ValueKey(word[0]),
                        asset: word[0],
                        label: 'Nghe phát âm',
                        dark: true,
                      ),
                    ],
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Divider(height: 1, color: AppColors.grey100),
                  ),
                  Text.rich(
                    TextSpan(
                      style: designText(18, weight: FontWeight.w500),
                      children: [
                        TextSpan(
                          text: word[2].split(' ').take(2).join(' '),
                          style: const TextStyle(
                            color: AppColors.primary500,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                        TextSpan(
                          text: ' ${word[2].split(' ').skip(2).join(' ')}',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  learningBody(word[3], size: 18),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
