import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';

class SpeakingContentFeedback extends StatelessWidget {
  const SpeakingContentFeedback({
    super.key,
    required this.strengths,
    required this.improvements,
  });
  final List<String> strengths;
  final List<Json> improvements;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      if (strengths.isNotEmpty)
        _FeedbackSection(
          id: 'strengths',
          title: 'Điểm làm tốt',
          count: strengths.length,
          icon: Icons.check_circle_outline_rounded,
          color: AppColors.primary700,
          background: AppColors.primary25,
          children: [
            for (var index = 0; index < strengths.length; index++)
              Padding(
                padding: EdgeInsets.only(top: index == 0 ? 0 : 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 3),
                      child: Icon(
                        Icons.check_rounded,
                        size: 16,
                        color: AppColors.primary700,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        strengths[index],
                        style: designText(14, height: 1.5),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      if (strengths.isNotEmpty && improvements.isNotEmpty)
        const SizedBox(height: 12),
      if (improvements.isNotEmpty)
        _FeedbackSection(
          id: 'improvements',
          title: 'Gợi ý cải thiện',
          count: improvements.length,
          icon: Icons.lightbulb_outline_rounded,
          color: AppColors.warning300,
          background: AppColors.grey25,
          children: [
            for (var index = 0; index < improvements.length; index++) ...[
              if (index > 0)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Divider(height: 1, color: AppColors.grey100),
                ),
              Text(
                'Gợi ý ${(index + 1).toString().padLeft(2, '0')}',
                style: designText(
                  12,
                  color: AppColors.grey800,
                  weight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Bạn đã nói',
                style: designText(12, color: AppColors.grey800),
              ),
              const SizedBox(height: 4),
              Text(
                improvements[index]['quote']?.toString() ?? '',
                style: designText(15, weight: FontWeight.w600, height: 1.5),
              ),
              const SizedBox(height: 8),
              Text(
                improvements[index]['explanationVi']?.toString() ?? '',
                style: designText(14, color: AppColors.grey800, height: 1.5),
              ),
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.primary25,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Gợi ý diễn đạt',
                      style: designText(
                        12,
                        color: AppColors.primary700,
                        weight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      improvements[index]['suggestion']?.toString() ?? '',
                      style: designText(15, height: 1.5),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
    ],
  );
}

class _FeedbackSection extends StatelessWidget {
  const _FeedbackSection({
    required this.id,
    required this.title,
    required this.count,
    required this.icon,
    required this.color,
    required this.background,
    required this.children,
  });
  final String id;
  final String title;
  final int count;
  final IconData icon;
  final Color color;
  final Color background;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    const shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.all(Radius.circular(12)),
      side: BorderSide.none,
    );
    return Material(
      color: background,
      shape: shape,
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        key: ValueKey('content-feedback-$id'),
        shape: shape,
        collapsedShape: shape,
        backgroundColor: background,
        collapsedBackgroundColor: background,
        iconColor: color,
        collapsedIconColor: AppColors.grey800,
        tilePadding: const EdgeInsets.symmetric(horizontal: 12),
        childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
        minTileHeight: 56,
        leading: Icon(icon, color: color, size: 22),
        title: Row(
          children: [
            Expanded(
              child: Text(
                title,
                style: designText(15, weight: FontWeight.w600, height: 1.4),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                '$count',
                style: designText(11, weight: FontWeight.w600, color: color),
              ),
            ),
          ],
        ),
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children,
          ),
        ],
      ),
    );
  }
}
