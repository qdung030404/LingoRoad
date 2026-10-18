import 'package:flutter/material.dart';
import '../core/theme/app_borders.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_radius.dart';
import '../core/theme/app_typography.dart';

class CustomAppInputContainer extends StatelessWidget {
  final String? label;
  final String? value;
  final String? placeholder;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final VoidCallback? onTap;
  final bool hasError;
  final String? errorText;

  const CustomAppInputContainer({
    super.key,
    this.label,
    this.value,
    this.placeholder,
    this.prefixIcon,
    this.suffixIcon = const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.grey500),
    this.onTap,
    this.hasError = false,
    this.errorText,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasValue = value != null && value!.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (label != null) ...[
          Text(
            label!,
            style: AppTextStyles.bodyStrong.copyWith(
              fontSize: 13,
              color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
            ),
          ),
          const SizedBox(height: 6),
        ],
        InkWell(
          borderRadius: AppRadius.inputRadius,
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: isDark ? AppColors.surfaceDark : AppColors.grey0,
              borderRadius: AppRadius.inputRadius,
              border: hasError
                  ? Border.all(color: AppColors.error100, width: 1.0)
                  : AppBorders.hairline(isDark),
            ),
            child: Row(
              children: [
                if (prefixIcon != null) ...[
                  prefixIcon!,
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: Text(
                    hasValue ? value! : (placeholder ?? ''),
                    style: AppTextStyles.body.copyWith(
                      color: hasValue
                          ? (isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight)
                          : AppColors.grey500,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                if (suffixIcon != null) ...[
                  const SizedBox(width: 8),
                  suffixIcon!,
                ],
              ],
            ),
          ),
        ),
        if (hasError && errorText != null) ...[
          const SizedBox(height: 4),
          Text(
            errorText!,
            style: AppTextStyles.caption.copyWith(color: AppColors.error100),
          ),
        ],
      ],
    );
  }
}