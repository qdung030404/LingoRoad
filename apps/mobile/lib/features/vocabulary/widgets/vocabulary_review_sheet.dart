import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/theme/app_radius.dart';
import 'package:mobile/core/theme/app_spacing.dart';
import 'package:mobile/shared/figma_widgets.dart';
import 'package:mobile/features/learning/learning_widgets.dart';
import 'package:mobile/features/vocabulary/vocabulary_models.dart';

String _ratingLabel(String rating) {
  switch (rating) {
    case 'EASY':
      return 'Dễ';
    case 'MEDIUM':
      return 'Trung bình';
    case 'HARD':
      return 'Khó';
    default:
      return rating;
  }
}

Future<void> showVocabularyReviewDetailsSheet(
  BuildContext context,
  VocabularyReviewAttempt attempt,
) async {
  final items = attempt.items.where((i) => i.state != 'PENDING').toList();
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: AppColors.grey0,
    shape: const RoundedRectangleBorder(
      borderRadius: AppRadius.bottomSheetRadius,
    ),
    builder: (context) => SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.72,
        child: Column(
          children: [
            Padding(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacing.horizontal(context),
                vertical: AppSpacing.sm,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        learningHeading('Chi tiết lượt ôn', size: 22),
                        AppSpacing.gapXs,
                        Text(
                          'Đã xử lý ${items.length}/${attempt.items.length} từ trong bộ',
                          style: designText(14, color: AppColors.grey600),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppColors.borderLight),
            Expanded(
              child: items.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(AppSpacing.xl),
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.history_outlined,
                              size: 48,
                              color: AppColors.grey400,
                            ),
                            AppSpacing.gapMd,
                            Text(
                              'Chưa có từ nào được hoàn thành trong lượt này.',
                              textAlign: TextAlign.center,
                              style: designText(14, color: AppColors.grey600),
                            ),
                          ],
                        ),
                      ),
                    )
                  : ListView.builder(
                      padding: EdgeInsets.symmetric(
                        horizontal: AppSpacing.horizontal(context),
                        vertical: AppSpacing.md,
                      ),
                      itemCount: items.length,
                      itemBuilder: (context, index) {
                        final item = items[index];
                        return Container(
                          margin: const EdgeInsets.only(bottom: AppSpacing.md),
                          padding: AppSpacing.allMd,
                          decoration: BoxDecoration(
                            color: AppColors.grey0,
                            borderRadius: AppRadius.cardRadius,
                            border: Border.all(color: AppColors.borderLight),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      item.word.english,
                                      style: designHeading(18),
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: AppSpacing.sm,
                                      vertical: AppSpacing.xs,
                                    ),
                                    decoration: BoxDecoration(
                                      color: item.state == 'REVIEWED'
                                          ? AppColors.success0
                                          : AppColors.grey50,
                                      borderRadius: AppRadius.cardSm,
                                    ),
                                    child: Text(
                                      item.state == 'REVIEWED'
                                          ? 'Đã ôn'
                                          : 'Bỏ qua',
                                      style: designText(
                                        12,
                                        weight: FontWeight.w600,
                                        color: item.state == 'REVIEWED'
                                            ? AppColors.success200
                                            : AppColors.grey700,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              AppSpacing.gapXs,
                              Text(
                                item.word.meaning,
                                style: designText(14, color: AppColors.grey800),
                              ),
                              if (item.rating != null) ...[
                                const SizedBox(height: AppSpacing.sm),
                                Row(
                                  children: [
                                    const Icon(
                                      Icons.speed_rounded,
                                      size: 14,
                                      color: AppColors.grey500,
                                    ),
                                    const SizedBox(width: AppSpacing.xs),
                                    Text(
                                      'Đánh giá: ${_ratingLabel(item.rating!)}',
                                      style: designText(
                                        12,
                                        color: AppColors.grey600,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    ),
  );
}
