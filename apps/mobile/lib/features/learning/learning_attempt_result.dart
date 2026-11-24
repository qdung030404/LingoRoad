import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'learning_controller.dart';
import 'learning_pages.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';
import 'listening_audio.dart';
import 'practice_widgets.dart';

class LearningAttemptResultView extends StatelessWidget {
  const LearningAttemptResultView({
    super.key,
    required this.owner,
    required this.controller,
    required this.attempt,
    required this.audio,
    required this.onLeave,
    required this.onRetryStandard,
  });

  final LearningController owner;
  final LearningAttemptController controller;
  final LearningAttempt attempt;
  final ListeningAudioController? audio;
  final Future<void> Function() onLeave;
  final Future<void> Function() onRetryStandard;

  @override
  Widget build(BuildContext context) {
    if (attempt.lesson.kind == 'LISTENING' ||
        attempt.lesson.kind == 'READING') {
      return _practiceResult(context);
    }
    final result = attempt.json['result'] as Map;
    final levelChange = attempt.levelChange;
    return FigmaPage(
      title: 'Kết quả bài học',
      leading: IconButton(onPressed: onLeave, icon: const Icon(Icons.arrow_back)),
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CustomAppButton(
            text: 'Làm lại',
            isLoading: controller.loading,
            onPressed: controller.loading ? null : onRetryStandard,
          ),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (controller.error != null)
            LearningError(
              controller.error!,
              retry: () => controller.load(lessonId: attempt.lesson.id),
            ),
          if (levelChange != null) ...[
            _levelChangeBanner(levelChange),
            const SizedBox(height: 16),
          ],
          learningHeading(attempt.lesson.title, size: 28),
          const SizedBox(height: 16),
          if (attempt.content['passage'] case final String passage) ...[
            PassageCard(passage: passage, practice: true),
            const SizedBox(height: 16),
          ],
          LearningCard(
            children: [
              learningHeading('Đã hoàn thành', size: 24),
              learningHeading(
                '${result['correctCount']}/${result['totalQuestions']} câu đúng',
                size: 28,
              ),
              learningBody(
                'Kết quả đã lưu vào lịch sử học tập. Bài luyện tập không thay đổi mức CEFR đầu vào.',
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (attempt.content['transcript'] case final String transcript) ...[
            LearningCard(
              children: [
                learningHeading('Bản chép lời'),
                learningBody(transcript),
              ],
            ),
            const SizedBox(height: 16),
          ],
          for (final (qIndex, q) in attempt.questions.indexed) ...[
            LearningResultQuestionCard(
              index: qIndex,
              prompt: q['prompt'] as String,
              options: learningItems(q['options']),
              answer: attempt.answer(q['id'] as String),
            ),
            const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }

  Widget _practiceResult(BuildContext context) {
    final result = attempt.json['result'] as Map;
    final isListening = attempt.lesson.kind == 'LISTENING';
    final nextLessons = owner.lessons.where(
      (lesson) =>
          lesson.kind == attempt.lesson.kind &&
          lesson.id != attempt.lesson.id &&
          lesson.cefrLevel == attempt.lesson.cefrLevel &&
          lesson.state != 'COMPLETED',
    );
    final next = nextLessons.isNotEmpty ? nextLessons.first : null;
    final levelChange = attempt.levelChange;
    return FigmaPage(
      title: 'Kết quả bài học',
      titleStyle: designHeading(18),
      leading: IconButton(
        tooltip: 'Quay lại',
        onPressed: onLeave,
        icon: isListening
            ? const FigmaAsset('intro/imgVuesaxLinearArrowLeft', size: 24)
            : const Icon(Icons.arrow_back),
      ),
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CustomAppButton(
            text: 'Xem lại đáp án',
            onPressed: controller.loading
                ? null
                : () => previewPush<void>(
                    context,
                    PracticeReviewPage(
                      attempt: attempt,
                      audio: audio,
                      controller: controller,
                    ),
                  ),
          ),
          const SizedBox(height: 8),
          LayoutBuilder(
            builder: (context, constraints) {
              final retry = CustomAppButton(
                text: 'Làm lại',
                fontSize: 14,
                isSecondary: true,
                onPressed: controller.loading
                    ? null
                    : () => controller.load(lessonId: attempt.lesson.id),
              );
              final nextAction = CustomAppButton(
                text: next == null ? 'Về danh sách' : 'Bài tiếp theo',
                fontSize: 14,
                isSecondary: true,
                onPressed: controller.loading
                    ? null
                    : () async {
                        if (next == null) {
                          await onLeave();
                          return;
                        }
                        await openLearningLesson(
                          context,
                          owner,
                          lessonId: next.id,
                        );
                      },
              );
              if (constraints.maxWidth < 328 ||
                  MediaQuery.textScalerOf(context).scale(14) > 20) {
                return Column(spacing: 8, children: [retry, nextAction]);
              }
              return Row(
                spacing: 8,
                children: [
                  Expanded(child: retry),
                  Expanded(child: nextAction),
                ],
              );
            },
          ),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (controller.error != null)
            LearningError(
              controller.error!,
              retry: () => controller.load(lessonId: attempt.lesson.id),
            ),
          if (levelChange != null) ...[
            _levelChangeBanner(levelChange),
            const SizedBox(height: 16),
          ],
          learningHeading(attempt.lesson.title, size: 28),
          const SizedBox(height: 6),
          learningBody(
            isListening
                ? 'Kết quả lượt luyện tập đã được lưu. Bạn có thể xem lại đáp án và nghe lại từng đoạn hội thoại.'
                : 'Kết quả lượt luyện tập đã được lưu. Bạn có thể xem lại đáp án và dẫn chứng trong bài.',
            size: 14,
          ),
          const SizedBox(height: 16),
          FigmaCard(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 56,
                      height: 56,
                      alignment: Alignment.center,
                      decoration: const BoxDecoration(
                        color: AppColors.primary25,
                        shape: BoxShape.circle,
                      ),
                      child: const FigmaAsset('practice/imgFrame74', size: 40),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Đã hoàn thành',
                            style: designText(
                              14,
                              weight: FontWeight.w500,
                              color: AppColors.primary700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          learningHeading(
                            '${result['correctCount']}/${result['totalQuestions']} câu đúng',
                            size: 26,
                          ),
                        ],
                      ),
                    ),
                    if (attempt.lesson.cefrLevel case final String level) ...[
                      const SizedBox(width: 12),
                      PreviewLevelBadge(label: level),
                    ],
                  ],
                ),
                if (attempt.questions.isNotEmpty) ...[
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Divider(height: 1, color: AppColors.grey100),
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final (qIdx, q) in attempt.questions.indexed)
                        _resultQuestionChip(
                          qIdx + 1,
                          attempt.answer(q['id'] as String)?['isCorrect'] ==
                              true,
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          FigmaCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 12,
              children: isListening
                  ? [
                      _resultGuideRow(
                        'listen-intro/imgVuesaxBulkRefresh',
                        22,
                        'Nghe lại từng đoạn dẫn chứng theo câu hỏi',
                      ),
                      _resultGuideRow(
                        'practice/imgVuesaxLinearHeadphone',
                        20,
                        'Đối chiếu bản chép lời và bản dịch tiếng Việt',
                      ),
                      _resultGuideRow(
                        'reading/imgVuesaxLinearMessageQuestion',
                        20,
                        'Hỏi AI vì sao đáp án đúng và đối chiếu với lựa chọn của bạn',
                      ),
                    ]
                  : [
                      _resultGuideRow(
                        'home-v2/imgVuesaxBulkBook',
                        22,
                        'Xem lại đoạn dẫn chứng được đánh dấu trong bài đọc',
                      ),
                      _resultGuideRow(
                        'reading/imgVuesaxLinearMessageQuestion',
                        20,
                        'Đọc lời giải chi tiết và sử dụng Giải thích AI từng câu',
                      ),
                    ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _resultQuestionChip(int number, bool isRight) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
    decoration: BoxDecoration(
      color: isRight ? AppColors.primary25 : AppColors.warning0,
      borderRadius: AppRadius.tagRadius,
      border: Border.all(
        color: isRight ? AppColors.primary200 : const Color(0xFFFFCC01),
      ),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        FigmaAsset(
          isRight
              ? 'review/imgVuesaxLinearTickCircle'
              : 'review/imgVuesaxLinearInfoCircle',
          size: 16,
        ),
        const SizedBox(width: 6),
        Text(
          'Câu $number',
          style: designText(
            13,
            weight: FontWeight.w500,
            color: isRight ? const Color(0xFF0A5D21) : const Color(0xFFCA8A04),
          ),
        ),
      ],
    ),
  );

  Widget _resultGuideRow(String asset, double iconSize, String text) => Row(
    children: [
      Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: AppColors.primary25,
          shape: BoxShape.circle,
        ),
        child: FigmaAsset(asset, size: iconSize),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Text(
          text,
          style: designText(
            14,
            weight: FontWeight.w500,
            color: AppColors.grey900,
            height: 1.4,
          ),
        ),
      ),
    ],
  );

  Widget _levelChangeBanner(Json change) {
    final isUp = change['direction'] == 'UP';
    final kindLabel = learningKindLabel(change['kind'] as String? ?? 'READING');
    final toCefr = change['to'] as String? ?? '';
    return Container(
      key: const Key('learningLevelChangeBanner'),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isUp ? AppColors.primary25 : const Color(0xFFFFF8E6),
        borderRadius: AppRadius.cardRadius,
        border: Border.all(
          color: isUp ? AppColors.primary300 : const Color(0xFFF3C669),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isUp ? Icons.trending_up_rounded : Icons.trending_down_rounded,
            color: isUp ? AppColors.primary700 : const Color(0xFF9A6700),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isUp
                      ? 'Mức luyện tập đề xuất: $kindLabel $toCefr ↑'
                      : 'Điều chỉnh mức luyện tập đề xuất: $kindLabel $toCefr ↓',
                  style: designText(
                    16,
                    weight: FontWeight.w700,
                    color: AppColors.grey900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isUp
                      ? '2 bài Đọc khác nhau đạt từ 80%. Kế hoạch tiếp theo sẽ ưu tiên mức $toCefr.'
                      : '2 bài Đọc khác nhau đạt dưới 50%. Hệ thống ưu tiên củng cố mức $toCefr.',
                  style: designText(14, color: AppColors.grey800, height: 1.4),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
