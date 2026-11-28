import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/learning_media_image.dart';
import 'learning_controller.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';
import 'listening_audio.dart';

class PracticeLessonFacts extends StatelessWidget {
  const PracticeLessonFacts({super.key, required this.lesson});

  final LearningLesson lesson;

  @override
  Widget build(BuildContext context) {
    final isReading = lesson.kind == 'READING';
    final intro = isReading ? 'read-intro' : 'listen-intro';
    final duration = lesson.json['audioDurationMs'] as num?;
    final replay = duration == null
        ? 'Nghe lại và tua không giới hạn'
        : 'Audio ${(duration / 1000).ceil()} giây · Nghe lại không giới hạn';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.grey0,
        borderRadius: AppRadius.cardRadius,
        border: Border.all(color: AppColors.grey100),
        boxShadow: [
          BoxShadow(
            color: AppColors.grey900.withValues(alpha: 0.06),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 12,
        children: [
          _fact(intro, 'Timer', 'Khoảng ${lesson.minutes} phút'),
          const Divider(height: 1, thickness: 1, color: AppColors.grey100),
          _fact(intro, 'Task', '${lesson.questionCount} câu luyện tập'),
          const Divider(height: 1, thickness: 1, color: AppColors.grey100),
          _fact(
            intro,
            isReading ? 'BookSquare' : 'Refresh',
            isReading ? 'Đọc đoạn văn và trả lời câu hỏi' : replay,
          ),
        ],
      ),
    );
  }

  Widget _fact(String intro, String icon, String text) => Row(
    children: [
      Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: AppColors.primary25,
          shape: BoxShape.circle,
        ),
        child: FigmaAsset('$intro/imgVuesaxBulk$icon', size: 20),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Text(
          text,
          style: designText(
            15,
            weight: FontWeight.w500,
            color: AppColors.grey900,
            height: 1.4,
          ),
        ),
      ),
    ],
  );
}

class PracticeReviewPage extends StatefulWidget {
  const PracticeReviewPage({
    super.key,
    required this.attempt,
    this.audio,
    this.controller,
  });

  final LearningAttempt attempt;
  final ListeningAudioController? audio;
  final LearningAttemptController? controller;

  @override
  State<PracticeReviewPage> createState() => _PracticeReviewPageState();
}

class _PracticeReviewPageState extends State<PracticeReviewPage> {
  final _scroll = ScrollController();
  bool _wrongOnly = false;
  int _position = 0;

  void _showQuestion(int position, {required bool wrongOnly}) {
    unawaited(widget.audio?.stopEvidence());
    setState(() {
      _position = position;
      _wrongOnly = wrongOnly;
    });
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final attempt = widget.attempt;
    final questions = attempt.questions;
    if (questions.isEmpty) {
      return const FigmaPage(
        title: 'Xem lại đáp án',
        child: Center(child: Text('Lượt học này chưa có câu hỏi để xem lại.')),
      );
    }
    final incorrect = [
      for (final (index, question) in questions.indexed)
        if (attempt.answer(question['id'] as String)?['isCorrect'] == false)
          index,
    ];
    final index = _wrongOnly ? incorrect[_position] : _position;
    final question = questions[index];
    final questionId = question['id'] as String;
    final answer = attempt.answer(questionId);
    final last =
        _position == (_wrongOnly ? incorrect.length : questions.length) - 1;
    final evidenceIds = (answer?['evidenceSegmentIds'] as List? ?? []).toSet();
    final evidence = learningItems(
      attempt.content['transcriptSegments'],
    ).where((segment) => evidenceIds.contains(segment['id'])).toList();
    final passage = attempt.content['passage'] as String?;
    final hasPassage = passage != null && passage.trim().isNotEmpty;
    final explanation = (answer?['explanation'] as String? ?? '').trim();
    final audio = widget.audio;
    final controller = widget.controller;
    return PopScope(
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) unawaited(audio?.pause());
      },
      child: FigmaPage(
        title: 'Xem lại câu ${index + 1}/${questions.length}',
        titleStyle: designHeading(18),
        bottom: Row(
          children: [
            SizedBox(
              width: 48,
              height: 48,
              child: IconButton.outlined(
                tooltip: 'Câu trước',
                onPressed: _position == 0
                    ? null
                    : () => _showQuestion(_position - 1, wrongOnly: _wrongOnly),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.grey0,
                  disabledBackgroundColor: AppColors.grey25,
                  side: BorderSide(
                    color: _position == 0
                        ? AppColors.grey100
                        : AppColors.grey200,
                  ),
                  shape: const RoundedRectangleBorder(
                    borderRadius: AppRadius.tagRadius,
                  ),
                ),
                icon: Opacity(
                  opacity: _position == 0 ? 0.35 : 1,
                  child: const FigmaAsset(
                    'listening/imgVuesaxLinearArrowLeft1',
                    size: 20,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: CustomAppButton(
                text: last
                    ? 'Về kết quả'
                    : _wrongOnly
                    ? 'Câu sai tiếp theo'
                    : 'Câu tiếp theo',
                borderRadius: AppRadius.tagRadius,
                onPressed: last
                    ? () => Navigator.pop(context)
                    : () => _showQuestion(_position + 1, wrongOnly: _wrongOnly),
              ),
            ),
          ],
        ),
        child: ListView(
          controller: _scroll,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          children: [
            Wrap(
              spacing: 8,
              children: [
                ChoiceChip(
                  label: const Text('Tất cả'),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  shape: const StadiumBorder(),
                  showCheckmark: false,
                  backgroundColor: AppColors.grey0,
                  selectedColor: AppColors.primary25,
                  side: BorderSide(
                    color: !_wrongOnly
                        ? AppColors.primary500
                        : AppColors.grey200,
                  ),
                  labelStyle: designText(
                    14,
                    weight: FontWeight.w500,
                    color: !_wrongOnly
                        ? AppColors.primary500
                        : AppColors.grey900,
                  ),
                  selected: !_wrongOnly,
                  onSelected: (selected) {
                    if (selected) _showQuestion(index, wrongOnly: false);
                  },
                ),
                ChoiceChip(
                  label: Text('Câu sai (${incorrect.length})'),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  shape: const StadiumBorder(),
                  showCheckmark: false,
                  backgroundColor: AppColors.grey0,
                  selectedColor: AppColors.primary25,
                  side: BorderSide(
                    color: _wrongOnly
                        ? AppColors.primary500
                        : AppColors.grey200,
                  ),
                  labelStyle: designText(
                    14,
                    weight: FontWeight.w500,
                    color: _wrongOnly
                        ? AppColors.primary500
                        : (incorrect.isEmpty
                              ? AppColors.grey700
                              : AppColors.grey900),
                  ),
                  selected: _wrongOnly,
                  onSelected: incorrect.isEmpty
                      ? null
                      : (selected) {
                          if (selected) _showQuestion(0, wrongOnly: true);
                        },
                ),
              ],
            ),
            if (hasPassage) ...[
              const SizedBox(height: 8),
              PassageCard(
                passage: passage,
                highlightText: answer?['evidence'] as String?,
                practice: true,
                evidencePreview: true,
              ),
            ],
            if (evidence.isNotEmpty && audio != null) ...[
              const SizedBox(height: 8),
              FigmaCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 10,
                  children: [
                    Row(
                      children: [
                        const FigmaAsset(
                          'practice/imgVuesaxLinearHeadphone',
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: learningHeading('Đoạn dẫn chứng', size: 16),
                        ),
                      ],
                    ),
                    for (final segment in evidence)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primary25,
                          borderRadius: AppRadius.cardSm,
                          border: Border.all(color: AppColors.primary100),
                        ),
                        child: IntrinsicHeight(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Container(
                                width: 3,
                                decoration: const BoxDecoration(
                                  color: AppColors.primary500,
                                  borderRadius: BorderRadius.all(
                                    Radius.circular(AppRadius.xxs / 2),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Align(
                                alignment: Alignment.topCenter,
                                child: LearningMediaImage(
                                  imageUrl: speakerAvatarAsset(
                                    segment['speaker']?.toString() ?? '',
                                    avatarUrl:
                                        segment['speakerAvatar'] as String?,
                                  ),
                                  width: 24,
                                  height: 24,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  '${segment['speaker']} · ${segment['text']}',
                                  style: designText(
                                    14,
                                    weight: FontWeight.w500,
                                    color: AppColors.grey900,
                                    height: 1.45,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ListenableBuilder(
                      listenable: audio,
                      builder: (context, _) {
                        final playing =
                            audio.playing &&
                            audio.evidenceIds.length == evidenceIds.length &&
                            audio.evidenceIds.containsAll(evidenceIds);
                        return OutlinedButton.icon(
                          onPressed: audio.busy
                              ? null
                              : playing
                              ? audio.pause
                              : () => audio.playSegments(evidence),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.primary800,
                            side: BorderSide(
                              color: playing
                                  ? AppColors.primary500
                                  : AppColors.grey200,
                            ),
                            backgroundColor: playing
                                ? AppColors.primary25
                                : AppColors.grey0,
                            minimumSize: const Size(0, 48),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 10,
                            ),
                            shape: const StadiumBorder(),
                          ),
                          icon: Icon(
                            playing
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                          ),
                          label: Text(
                            playing
                                ? 'Tạm dừng đoạn nghe'
                                : 'Nghe đoạn trả lời câu ${index + 1}',
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ],
            if (audio != null)
              ListenableBuilder(
                listenable: audio,
                builder: (context, _) => audio.error == null
                    ? const SizedBox.shrink()
                    : Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          audio.error!,
                          style: designText(13, color: AppColors.error200),
                        ),
                      ),
              ),
            const SizedBox(height: 20),
            learningHeading(question['prompt'] as String, size: 18),
            const SizedBox(height: 12),
            if (hasVisualImageOptions(learningItems(question['options']))) ...[
              PracticeImageAnswerGrid(
                options: learningItems(question['options']),
                checked: true,
                selectedOptionId: answer?['optionId'] as String?,
                correctOptionId: answer?['correctOptionId'] as String?,
                keyPrefix: 'review-option-',
                showReviewLabels: true,
              ),
              const SizedBox(height: 8),
            ] else
              for (final (optionIndex, option) in learningItems(
                question['options'],
              ).indexed) ...[
                PracticeAnswerTile(
                  index: optionIndex,
                  text: option['text'] as String,
                  correct: option['id'] == answer?['correctOptionId'],
                  selected: option['id'] == answer?['optionId'],
                  wrong:
                      option['id'] == answer?['optionId'] &&
                      answer?['isCorrect'] == false,
                  label: switch ((
                    option['id'] == answer?['correctOptionId'],
                    option['id'] == answer?['optionId'],
                  )) {
                    (true, true) => 'Đáp án đúng · Bạn chọn',
                    (true, false) => 'Đáp án đúng',
                    (false, true) => 'Bạn chọn',
                    _ => null,
                  },
                ),
                const SizedBox(height: 8),
              ],
            if (explanation.isNotEmpty)
              FigmaCard(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 6,
                  children: [
                    learningHeading('Lời giải', size: 16),
                    learningBody(explanation, size: 14),
                  ],
                ),
              ),
            if (attempt.lesson.kind == 'LISTENING' &&
                attempt.completed &&
                answer?['checked'] == true &&
                controller != null) ...[
              const SizedBox(height: 12),
              ListenableBuilder(
                listenable: controller,
                builder: (context, _) => PracticeAiExplainCard(
                  questionId: questionId,
                  originalExplanation: explanation,
                  ai: controller.aiExplanation(questionId),
                  explaining: controller.isExplaining(questionId),
                  errorText: controller.explainError(questionId),
                  onExplain: () => controller.explainQuestion(questionId),
                  listening: true,
                ),
              ),
            ],
            if ((attempt.content['transcript'] as String? ?? '').isNotEmpty ||
                learningItems(
                  attempt.content['transcriptSegments'],
                ).isNotEmpty) ...[
              const SizedBox(height: 12),
              CustomAppButton(
                text: 'Bản chép lời',
                isSecondary: true,
                icon: const Icon(Icons.receipt_long_outlined, size: 20),
                borderRadius: AppRadius.cardSm,
                onPressed: () => previewPush<void>(
                  context,
                  ListeningTranscript(
                    controller: audio,
                    content: attempt.content,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
