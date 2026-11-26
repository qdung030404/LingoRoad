import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/learning_media_image.dart';

const speakingReviewSpeechDecoration = BoxDecoration(
  color: AppColors.grey25,
  borderRadius: AppRadius.cardSm,
);

class SpeakingReviewHeader extends StatelessWidget {
  const SpeakingReviewHeader({
    super.key,
    required this.title,
    required this.icon,
    required this.statusLabel,
    required this.dateLabel,
    this.completed = false,
    this.imageUrl,
  });

  final String title;
  final IconData icon;
  final String statusLabel;
  final String dateLabel;
  final bool completed;
  final String? imageUrl;

  @override
  Widget build(BuildContext context) {
    final hasImage = imageUrl != null && imageUrl!.trim().isNotEmpty;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primary25,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        spacing: 12,
        children: [
          if (hasImage)
            InkWell(
              borderRadius: AppRadius.cardSm,
              onTap: () => showZoomableIllustrationDialog(
                context,
                imageUrl: imageUrl!,
                title: title,
              ),
              child: LearningMediaImage(
                imageUrl: imageUrl,
                width: 52,
                height: 52,
                borderRadius: AppRadius.cardSm,
                semanticLabel: title,
              ),
            )
          else
            Container(
              width: 44,
              height: 44,
              decoration: const BoxDecoration(
                color: AppColors.grey0,
                borderRadius: AppRadius.cardSm,
              ),
              child: Icon(icon, color: AppColors.primary700, size: 22),
            ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 8,
              children: [
                Semantics(
                  header: true,
                  child: Text(title, style: designHeading(22, height: 1.2)),
                ),
                if (statusLabel.isNotEmpty || dateLabel.isNotEmpty)
                  Wrap(
                    spacing: 10,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      if (statusLabel.isNotEmpty)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: const BoxDecoration(
                            color: AppColors.grey0,
                            borderRadius: AppRadius.tagRadius,
                          ),
                          child: Text(
                            statusLabel,
                            style: designText(
                              12,
                              weight: FontWeight.w600,
                              color: completed
                                  ? AppColors.primary800
                                  : AppColors.grey800,
                            ),
                          ),
                        ),
                      if (dateLabel.isNotEmpty)
                        Text(
                          dateLabel,
                          style: designText(12, color: AppColors.grey800),
                        ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class SpeakingReviewCard extends StatelessWidget {
  const SpeakingReviewCard({
    super.key,
    required this.title,
    required this.annotation,
    required this.children,
  });

  final String title;
  final Widget annotation;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.grey0,
      borderRadius: AppRadius.cardRadius,
      border: Border.all(color: AppColors.grey100),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(title, style: designHeading(24)),
        const Divider(height: 24, color: AppColors.grey100),
        annotation,
        const Divider(height: 24, color: AppColors.grey100),
        ...children,
      ],
    ),
  );
}

class SpeakingReviewExpansionTile extends StatelessWidget {
  const SpeakingReviewExpansionTile({
    super.key,
    required this.title,
    required this.icon,
    required this.children,
    this.initiallyExpanded = false,
  });

  final String title;
  final IconData icon;
  final List<Widget> children;
  final bool initiallyExpanded;

  @override
  Widget build(BuildContext context) {
    const shape = RoundedRectangleBorder(
      borderRadius: AppRadius.cardRadius,
      side: BorderSide(color: AppColors.grey100),
    );
    return ExpansionTile(
      shape: shape,
      collapsedShape: shape,
      backgroundColor: AppColors.grey0,
      collapsedBackgroundColor: AppColors.grey0,
      iconColor: AppColors.primary700,
      collapsedIconColor: AppColors.grey800,
      clipBehavior: Clip.antiAlias,
      initiallyExpanded: initiallyExpanded,
      tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
      leading: Icon(icon, color: AppColors.primary700),
      title: Text(title, style: designHeading(16)),
      children: children,
    );
  }
}
