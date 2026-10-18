import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_radius.dart';
import '../core/theme/app_typography.dart';

class CustomAppButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isSecondary;
  final Widget? icon;

  const CustomAppButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.isSecondary = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    final isDisabled = onPressed == null || isLoading;
    final textColor = isDisabled
        ? AppColors.grey500
        : (isSecondary ? AppColors.primary700 : Colors.white);
    final spinnerColor = isSecondary ? AppColors.primary700 : Colors.white;

    return SizedBox(
      height: 48,
      width: double.infinity,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: isSecondary ? AppColors.primary50 : AppColors.primary,
          foregroundColor: isSecondary ? AppColors.primary700 : Colors.white,
          disabledBackgroundColor: AppColors.grey200,
          disabledForegroundColor: AppColors.grey500,
          elevation: 0,
          shape: const RoundedRectangleBorder(borderRadius: AppRadius.buttonRadius),
        ),
        onPressed: isDisabled ? null : onPressed,
        child: isLoading
            ? SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: spinnerColor,
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null) ...[
                    icon!,
                    const SizedBox(width: 8),
                  ],
                  Text(
                    text,
                    style: AppTextStyles.button.copyWith(
                      color: textColor,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}