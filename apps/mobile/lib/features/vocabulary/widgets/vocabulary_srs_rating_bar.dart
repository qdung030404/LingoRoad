import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/theme/app_radius.dart';
import 'package:mobile/core/theme/app_spacing.dart';
import 'package:mobile/shared/figma_widgets.dart';

class VocabularySrsRatingBar extends StatelessWidget {
  const VocabularySrsRatingBar({
    super.key,
    required this.enabled,
    required this.onRateEasy,
    required this.onRateMedium,
    required this.onRateHard,
    this.selectedRating,
  });

  final bool enabled;
  final VoidCallback onRateEasy;
  final VoidCallback onRateMedium;
  final VoidCallback onRateHard;
  final String? selectedRating;

  Widget _button({
    required String label,
    required String ratingKey,
    required Color activeColor,
    required Color bgColor,
    required VoidCallback onTap,
  }) {
    final selected = selectedRating == ratingKey;
    return Expanded(
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 200),
        opacity: enabled ? 1.0 : 0.45,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: OutlinedButton(
            key: Key('vocabularyRate$ratingKey'),
            onPressed: enabled ? onTap : null,
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.xs,
                vertical: AppSpacing.xs,
              ),
              backgroundColor: selected ? activeColor : bgColor,
              foregroundColor: selected ? AppColors.grey0 : activeColor,
              disabledForegroundColor: activeColor,
              side: BorderSide(
                color: activeColor,
                width: selected ? 2 : 1,
              ),
              shape: const RoundedRectangleBorder(
                borderRadius: AppRadius.buttonRadius,
              ),
            ),
            child: Text(
              label,
              maxLines: 2,
              textAlign: TextAlign.center,
              overflow: TextOverflow.visible,
              style: designText(
                15,
                weight: selected ? FontWeight.w700 : FontWeight.w600,
                color: selected ? AppColors.grey0 : activeColor,
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        _button(
          label: 'Dễ',
          ratingKey: 'EASY',
          activeColor: AppColors.success200,
          bgColor: AppColors.success0,
          onTap: onRateEasy,
        ),
        const SizedBox(width: AppSpacing.sm),
        _button(
          label: 'Trung bình',
          ratingKey: 'MEDIUM',
          activeColor: AppColors.warning300,
          bgColor: AppColors.warning0,
          onTap: onRateMedium,
        ),
        const SizedBox(width: AppSpacing.sm),
        _button(
          label: 'Khó',
          ratingKey: 'HARD',
          activeColor: AppColors.error200,
          bgColor: AppColors.error0,
          onTap: onRateHard,
        ),
      ],
    );
  }
}
