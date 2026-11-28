import 'package:flutter/material.dart';
import '../vocabulary/curated_topics_widgets.dart';
import '../vocabulary/vocabulary_controller.dart';
import 'learning_widgets.dart';
import 'lesson_pages.dart';
import 'practice_pages.dart';
import 'preview_model.dart';
import 'weekly_plan_pages.dart';

/// Builds the static preview roadmap sections when no live learner account is signed in.
List<Widget> buildSampleRoadSections({
  required BuildContext context,
  required bool vocabulary,
  required PreviewModel model,
  required VocabularyController? vocabularyController,
  required ValueChanged<bool> onSelectVocabulary,
  required ValueChanged<String> onOpenDeck,
}) {
  final List<String> names = vocabulary
      ? const [
          'Greetings and introductions',
          'Days, months and time',
          'Numbers',
          'Personal information',
          'Family and relationships',
        ]
      : const [
          "Subject pronouns and 'to be'",
          'Basic sentence structure',
          'Possessive adjectives',
        ];
  final List<String> subtitles = vocabulary
      ? const [
          'Chào hỏi và giới thiệu',
          'Thứ, tháng và giờ giấc',
          'Số đếm',
          'Thông tin cá nhân',
          'Gia đình và các mối quan hệ',
        ]
      : const [
          'Đại từ chủ ngữ và to be',
          'Cấu trúc câu cơ bản',
          'Cấu trúc câu cơ bản',
        ];
  return [
    learningSegments(
      ['Ngữ pháp', 'Từ vựng'],
      vocabulary ? 1 : 0,
      (i) => onSelectVocabulary(i == 1),
    ),
    const SizedBox(height: 24),
    if (vocabulary && vocabularyController != null)
      CuratedTopicsCatalogue(
        controller: vocabularyController,
        onOpenDeck: onOpenDeck,
      )
    else ...[
      Row(
        children: [
          Expanded(child: learningHeading('Chặng 1')),
          learningBody(vocabulary ? '1/4' : '1/3', size: 20),
        ],
      ),
      const SizedBox(height: 12),
      for (var i = 0; i < names.length; i++) ...[
        learningCatalogCard(
          names[i],
          subtitles[i],
          i,
          () => previewPush(
            context,
            vocabulary
                ? VocabularyLessonPage(model: model)
                : GrammarLessonPage(model: model),
          ),
          source: vocabulary ? 'vocabulary-road' : 'grammar-road',
        ),
        const SizedBox(height: 12),
      ],
    ],
  ];
}

/// Builds the static preview practice list when no live learner account is signed in.
List<Widget> buildSamplePracticeSections({
  required BuildContext context,
  required PracticeSkill skill,
  required PreviewModel model,
}) => [
  Row(
    children: [
      Expanded(child: learningHeading('Chặng 1')),
      learningBody('1/3', size: 20),
    ],
  ),
  const SizedBox(height: 12),
  for (var i = 0; i < 3; i++) ...[
    learningCatalogCard(
      i == 0
          ? skill.title
          : i == 1
          ? 'Personal Information'
          : 'Family and Relationships',
      i == 0
          ? skill.description
          : i == 1
          ? 'Luyện tập với thông tin về tên, tuổi, nơi sống và nghề nghiệp.'
          : 'Luyện tập từ vựng và cấu trúc về gia đình và các mối quan hệ.',
      i,
      () => previewPush(
        context,
        PracticeIntroPage(skill: skill, model: model),
      ),
    ),
    const SizedBox(height: 12),
  ],
];
