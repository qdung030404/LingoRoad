import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'writing_evaluation_service.dart';

class WritingEvaluationResultPage extends StatelessWidget {
  const WritingEvaluationResultPage({
    super.key,
    required this.result,
    required this.prompt,
    required this.essay,
  });

  final WritingEvaluationResult result;
  final String prompt;
  final String essay;

  Color _getStatusBgColor(LevelEvaluationStatus status) {
    switch (status) {
      case LevelEvaluationStatus.exceedsExpectations:
        return AppColors.success0;
      case LevelEvaluationStatus.meetsExpectations:
        return AppColors.primary25;
      case LevelEvaluationStatus.needsImprovement:
        return AppColors.warning0;
    }
  }

  Color _getStatusTextColor(LevelEvaluationStatus status) {
    switch (status) {
      case LevelEvaluationStatus.exceedsExpectations:
        return AppColors.success200;
      case LevelEvaluationStatus.meetsExpectations:
        return AppColors.primary700;
      case LevelEvaluationStatus.needsImprovement:
        return AppColors.warning300;
    }
  }

  IconData _getStatusIcon(LevelEvaluationStatus status) {
    switch (status) {
      case LevelEvaluationStatus.exceedsExpectations:
        return Icons.stars_rounded;
      case LevelEvaluationStatus.meetsExpectations:
        return Icons.verified_rounded;
      case LevelEvaluationStatus.needsImprovement:
        return Icons.trending_up_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final levelStatus = result.levelEvaluation.status;
    final levelBg = _getStatusBgColor(levelStatus);
    final levelColor = _getStatusTextColor(levelStatus);
    final levelIcon = _getStatusIcon(levelStatus);

    return Scaffold(
      backgroundColor: AppColors.grey5,
      appBar: AppBar(
        title: Text(
          'Đánh giá Bài viết AI',
          style: designHeading(18),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 20),
          onPressed: () => Navigator.of(context).pop(false),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacing.horizontal(context),
            vertical: AppSpacing.md,
          ),
          children: [
            // 1. Thẻ Đánh giá Sư phạm theo Trình độ
            Container(
              padding: AppSpacing.cardPadding,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: AppRadius.cardRadius,
                border: Border.all(color: AppColors.grey100),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.xs),
                        decoration: BoxDecoration(
                          color: levelBg,
                          borderRadius: AppRadius.tagRadius,
                        ),
                        child: Icon(levelIcon, color: levelColor, size: 24),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Đánh giá theo Trình độ',
                              style: designText(13, color: AppColors.grey600),
                            ),
                            const SizedBox(height: 2),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.sm,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: levelBg,
                                borderRadius: AppRadius.tagRadius,
                                border: Border.all(color: levelColor),
                              ),
                              child: Text(
                                result.levelEvaluation.labelVi,
                                style: designText(
                                  13,
                                  color: levelColor,
                                  weight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (result.levelEvaluation.summaryVi.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      result.levelEvaluation.summaryVi,
                      style: designText(
                        14,
                        color: AppColors.grey900,
                        weight: FontWeight.w500,
                        height: 1.45,
                      ),
                    ),
                  ],
                  if (result.levelEvaluation.encouragementVi.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.sm),
                      decoration: BoxDecoration(
                        color: AppColors.primary25,
                        borderRadius: AppRadius.tagRadius,
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.emoji_objects_outlined,
                            size: 16,
                            color: AppColors.primary700,
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Expanded(
                            child: Text(
                              result.levelEvaluation.encouragementVi,
                              style: designText(
                                13,
                                color: AppColors.primary800,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            // 2. Thử thách / Checklist Ngữ pháp Mục tiêu
            if (result.grammarChecklist.isNotEmpty) ...[
              Container(
                padding: AppSpacing.cardPadding,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: AppRadius.cardRadius,
                  border: Border.all(color: AppColors.grey100),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.checklist_rtl_rounded,
                          color: AppColors.primary700,
                          size: 20,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Text(
                          'Thử thách Ngữ pháp Mục tiêu',
                          style: designHeading(16),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Đánh giá mức độ áp dụng tự nhiên và chính xác vào bài viết:',
                      style: designText(12, color: AppColors.grey600),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    for (final item in result.grammarChecklist)
                      _buildGrammarChecklistTile(item),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],

            // 3. Lộ trình Cải thiện Bước tiếp theo (Improvement Steps)
            if (result.improvementSteps.isNotEmpty) ...[
              Container(
                padding: AppSpacing.cardPadding,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: AppRadius.cardRadius,
                  border: Border.all(color: AppColors.grey100),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.tips_and_updates_outlined,
                          color: AppColors.warning300,
                          size: 20,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Text(
                          'Cần làm gì để cải thiện bài viết?',
                          style: designHeading(16),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    for (int i = 0; i < result.improvementSteps.length; i++)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              width: 20,
                              height: 20,
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: AppColors.primary50,
                                shape: BoxShape.circle,
                              ),
                              child: Text(
                                '${i + 1}',
                                style: designText(
                                  11,
                                  color: AppColors.primary700,
                                  weight: FontWeight.w700,
                                ),
                              ),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            Expanded(
                              child: Text(
                                result.improvementSteps[i],
                                style: designText(
                                  13,
                                  color: AppColors.grey800,
                                  height: 1.45,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],

            // 4. Nhận xét tổng quan của AI Examiner
            if (result.overallCommentVi.isNotEmpty) ...[
              Container(
                padding: AppSpacing.cardPadding,
                decoration: BoxDecoration(
                  color: AppColors.primary25,
                  borderRadius: AppRadius.cardRadius,
                  border: Border.all(color: AppColors.primary200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.rate_review_outlined,
                          color: AppColors.primary700,
                          size: 20,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Text(
                          'Nhận xét từ Giám khảo AI',
                          style: designHeading(
                            16,
                            color: AppColors.primary800,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      result.overallCommentVi,
                      style: designText(
                        14,
                        color: AppColors.grey800,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],

            // 5. Danh sách sửa lỗi từng câu (Feedback)
            Text(
              result.feedback.isNotEmpty
                  ? 'Phân tích & Đề xuất sửa câu (${result.feedback.length})'
                  : 'Phân tích & Đề xuất sửa câu',
              style: designHeading(18),
            ),
            const SizedBox(height: AppSpacing.sm),
            if (result.feedback.isNotEmpty) ...[
              ...result.feedback.map(_buildFeedbackCard),
            ] else ...[
              Container(
                padding: AppSpacing.cardPadding,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: AppRadius.cardRadius,
                  border: Border.all(color: AppColors.grey100),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.xs),
                      decoration: BoxDecoration(
                        color: AppColors.success0,
                        borderRadius: AppRadius.tagRadius,
                      ),
                      child: const Icon(
                        Icons.check_circle_outline,
                        color: AppColors.success200,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Không phát hiện lỗi câu cần sửa',
                            style: designText(
                              14,
                              weight: FontWeight.w600,
                              color: AppColors.grey900,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            'Các câu văn trong bài viết của bạn được diễn đạt rất tự nhiên và chính xác theo chuẩn trình độ.',
                            style: designText(
                              13,
                              color: AppColors.grey700,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.md),

            // 6. Các nút hành động
            CustomAppButton(
              text: 'Hoàn tất bài viết',
              onPressed: () => Navigator.of(context).pop(false),
            ),
            const SizedBox(height: AppSpacing.sm),
            CustomAppButton(
              key: const Key('rewriteButton'),
              text: 'Viết lại để áp dụng góp ý',
              isSecondary: true,
              onPressed: () => Navigator.of(context).pop(true),
            ),
            const SizedBox(height: AppSpacing.lg),
          ],
        ),
      ),
    );
  }

  Widget _buildGrammarChecklistTile(GrammarChecklistItem item) {
    Color bg;
    Color border;
    Color textCol;
    IconData icon;

    switch (item.status) {
      case GrammarStatus.mastered:
        bg = AppColors.success0;
        border = AppColors.success100;
        textCol = AppColors.success200;
        icon = Icons.check_circle_rounded;
        break;
      case GrammarStatus.attemptedWithErrors:
        bg = AppColors.warning0;
        border = AppColors.warning100;
        textCol = AppColors.warning300;
        icon = Icons.error_rounded;
        break;
      case GrammarStatus.notUsed:
        bg = AppColors.grey50;
        border = AppColors.grey200;
        textCol = AppColors.grey600;
        icon = Icons.remove_circle_outline_rounded;
        break;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.tagRadius,
        border: Border.all(color: AppColors.grey100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  item.grammarPoint,
                  style: designText(
                    14,
                    weight: FontWeight.w600,
                    color: AppColors.grey900,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: AppRadius.tagRadius,
                  border: Border.all(color: border),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 13, color: textCol),
                    const SizedBox(width: 4),
                    Text(
                      item.statusLabelVi,
                      style: designText(
                        11,
                        color: textCol,
                        weight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (item.evidenceSentence.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm,
                vertical: 4,
              ),
              decoration: BoxDecoration(
                color: AppColors.grey25,
                borderRadius: AppRadius.tagRadius,
                border: Border.all(color: AppColors.grey100),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.format_quote_rounded,
                    size: 14,
                    color: AppColors.grey500,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      item.evidenceSentence,
                      style: designText(
                        12,
                        color: AppColors.grey700,
                      ).copyWith(fontStyle: FontStyle.italic),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (item.feedbackVi.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              item.feedbackVi,
              style: designText(
                12,
                color: AppColors.grey800,
                height: 1.4,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFeedbackCard(WritingFeedbackItem item) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: AppSpacing.cardPadding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardRadius,
        border: Border.all(color: AppColors.grey100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.error_outline,
                size: 18,
                color: AppColors.error100,
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  item.originalSentence,
                  style: designText(
                    14,
                    color: AppColors.grey900,
                    weight: FontWeight.w600,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Padding(
            padding: const EdgeInsets.only(left: AppSpacing.lg),
            child: Text(
              item.issueVi,
              style: designText(13, color: AppColors.error100),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: AppColors.primary25,
              borderRadius: AppRadius.tagRadius,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.check_circle_outline,
                  size: 16,
                  color: AppColors.primary700,
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    item.suggestion,
                    style: designText(
                      13,
                      color: AppColors.primary800,
                      weight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (item.explanationVi.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Padding(
              padding: const EdgeInsets.only(left: AppSpacing.sm),
              child: Text(
                item.explanationVi,
                style: designText(
                  12,
                  color: AppColors.grey600,
                  height: 1.4,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
