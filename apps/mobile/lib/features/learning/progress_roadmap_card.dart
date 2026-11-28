import 'package:flutter/material.dart';
import '../../core/theme/app_borders.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../grammar/grammar_topic_detail_page.dart' show GrammarCefrBadge;
import 'learning_widgets.dart';

class CefrMilestoneEntry {
  const CefrMilestoneEntry({
    required this.cefrLevel,
    required this.totalLessons,
    required this.completedLessonCount,
    required this.status,
  });

  final String cefrLevel;
  final int totalLessons;
  final int completedLessonCount;
  final String status;
}

class ProgressSectionCardHeader extends StatelessWidget {
  const ProgressSectionCardHeader({super.key, required this.title});
  final String title;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
    decoration: const BoxDecoration(
      color: Colors.white,
      border: Border(bottom: BorderSide(color: AppColors.grey100)),
    ),
    child: Text(title, style: designHeading(24)),
  );
}

class ProgressRoadmapCard extends StatelessWidget {
  const ProgressRoadmapCard({
    super.key,
    required this.cefrLabel,
    required this.completedCount,
    required this.totalCount,
    required this.milestones,
    required this.activeCefr,
    required this.onSelectMilestone,
    this.canTogglePreviousLevels = false,
    this.showPreviousLevels = false,
    this.onTogglePreviousLevels,
    this.loading = false,
  });

  final String cefrLabel;
  final int completedCount;
  final int totalCount;
  final List<CefrMilestoneEntry> milestones;
  final String activeCefr;
  final ValueChanged<CefrMilestoneEntry> onSelectMilestone;
  final bool canTogglePreviousLevels;
  final bool showPreviousLevels;
  final VoidCallback? onTogglePreviousLevels;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final List<CefrMilestoneEntry> populated =
        milestones.where((m) => m.totalLessons > 0).toList();
    final bool allDone = populated.isNotEmpty &&
        populated.every((m) => m.completedLessonCount >= m.totalLessons) &&
        completedCount > 0;

    return DashboardCard(
      key: const Key('progressRoadmapCard'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ProgressSectionCardHeader(title: 'Lộ trình $cefrLabel'),
          Padding(
            padding: AppSpacing.allMd,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (loading)
                  const Padding(
                    padding: AppSpacing.allLg,
                    child: Center(child: CircularProgressIndicator()),
                  )
                else ...[
                  Text(
                    'Đã hoàn thành $completedCount trên $totalCount bài',
                    key: const Key('progressCompletedSummary'),
                    style: designHeading(20),
                  ),
                  AppSpacing.gapSm,
                  Text(
                    allDone
                        ? 'Đã hoàn thành các bài học hiện có trong lộ trình'
                        : 'Mốc hiện tại: $activeCefr · Chạm để xem Ngữ pháp, Nghe, Đọc',
                    style: designText(16, color: AppColors.grey800, height: 1.35),
                  ),
                  AppSpacing.gapMd,
                  for (int i = 0; i < milestones.length; i++) ...[
                    if (i > 0) AppSpacing.gapSm,
                    _MilestoneRow(
                      milestone: milestones[i],
                      isActive: milestones[i].cefrLevel == activeCefr,
                      onTap: () => onSelectMilestone(milestones[i]),
                    ),
                  ],
                  if (canTogglePreviousLevels) ...[
                    AppSpacing.gapMd,
                    CustomAppButton(
                      key: const Key('progressTogglePreviousLevels'),
                      text: showPreviousLevels
                          ? 'Ẩn các bậc trước đó'
                          : 'Xem các bậc trước đó',
                      isSecondary: true,
                      onPressed: onTogglePreviousLevels,
                    ),
                  ],
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MilestoneRow extends StatelessWidget {
  const _MilestoneRow({
    required this.milestone,
    required this.isActive,
    required this.onTap,
  });

  final CefrMilestoneEntry milestone;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bool isCompleted = milestone.status == 'COMPLETED' ||
        (milestone.totalLessons > 0 &&
            milestone.completedLessonCount >= milestone.totalLessons);
    final String? statusLabel = isCompleted
        ? 'Hoàn thành'
        : (isActive || milestone.status == 'IN_PROGRESS')
        ? 'Mốc hiện tại'
        : null;
    final double ratio = milestone.totalLessons > 0
        ? (milestone.completedLessonCount / milestone.totalLessons).clamp(0.0, 1.0)
        : 0.0;

    return Material(
      color: isActive ? AppColors.primary25 : AppColors.grey5,
      borderRadius: AppRadius.cardSm,
      child: InkWell(
        key: Key('progressMilestone_${milestone.cefrLevel}'),
        borderRadius: AppRadius.cardSm,
        onTap: onTap,
        child: Container(
          padding: AppSpacing.allMd,
          decoration: BoxDecoration(
            borderRadius: AppRadius.cardSm,
            border: isActive
                ? Border.all(color: AppColors.primary200)
                : AppBorders.hairline(),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  GrammarCefrBadge(level: milestone.cefrLevel),
                  AppSpacing.gapSm,
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: AppSpacing.sm,
                          runSpacing: AppSpacing.xs,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              'Mốc ${milestone.cefrLevel}',
                              style: AppTextStyles.bodyStrong,
                            ),
                            if (statusLabel != null)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.sm,
                                  vertical: AppSpacing.xs,
                                ),
                                decoration: BoxDecoration(
                                  color: isCompleted
                                      ? AppColors.success0
                                      : AppColors.surfaceLight,
                                  borderRadius: AppRadius.tagRadius,
                                  border: Border.all(
                                    color: isCompleted
                                        ? AppColors.success25
                                        : AppColors.primary200,
                                  ),
                                ),
                                child: Text(
                                  statusLabel,
                                  style: AppTextStyles.caption.copyWith(
                                    color: isCompleted
                                        ? AppColors.success200
                                        : AppColors.primary700,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                          ],
                        ),
                        AppSpacing.gapXs,
                        Text(
                          '${milestone.completedLessonCount}/${milestone.totalLessons} bài',
                          style: AppTextStyles.caption.copyWith(
                            color: AppColors.grey700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  AppSpacing.gapSm,
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.grey600,
                  ),
                ],
              ),
              AppSpacing.gapSm,
              ClipRRect(
                borderRadius: AppRadius.pill,
                child: LinearProgressIndicator(
                  value: ratio,
                  minHeight: 6,
                  backgroundColor: AppColors.grey100,
                  color: AppColors.primary500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
