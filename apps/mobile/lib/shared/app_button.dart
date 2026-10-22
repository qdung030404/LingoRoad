import 'package:flutter/material.dart';
import 'dart:ui' as ui;
import '../core/theme/app_colors.dart';
import '../core/theme/app_radius.dart';
import '../core/theme/app_typography.dart';

class CustomAppButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isSecondary;
  final Widget? icon;
  final BorderRadius? borderRadius;
  final double fontSize;

  const CustomAppButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
    this.isSecondary = false,
    this.icon,
    this.borderRadius,
    this.fontSize = 16,
  });

  @override
  Widget build(BuildContext context) {
    final isDisabled = onPressed == null || isLoading;
    final textColor = isDisabled
        ? AppColors.grey500
        : (isSecondary ? AppColors.grey900 : Colors.white);
    final spinnerColor = isSecondary ? AppColors.primary700 : Colors.white;

    return SizedBox(
      height: 48,
      width: double.infinity,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: isSecondary ? Colors.white : AppColors.grey900,
          foregroundColor: isSecondary ? AppColors.grey900 : Colors.white,
          disabledBackgroundColor: AppColors.grey200,
          disabledForegroundColor: AppColors.grey500,
          elevation: 0,
          padding: EdgeInsets.symmetric(horizontal: text.isEmpty ? 0 : 12),
          side: isSecondary
              ? const BorderSide(color: AppColors.grey200)
              : BorderSide.none,
          shape: RoundedRectangleBorder(
            borderRadius: borderRadius ?? AppRadius.buttonRadius,
          ),
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
                    if (text.isNotEmpty) const SizedBox(width: 8),
                  ],
                  if (text.isNotEmpty)
                    Flexible(
                      child: Text(
                        text,
                        style: AppTextStyles.button.copyWith(
                          color: textColor,
                          fontSize: fontSize,
                          fontWeight: FontWeight.w500,
                          letterSpacing: -fontSize * .03,
                          fontVariations: const [ui.FontVariation('wght', 500)],
                        ),
                      ),
                    ),
                ],
              ),
      ),
    );
  }
}
