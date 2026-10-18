import 'package:flutter/material.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_radius.dart';
import '../core/theme/app_shadows.dart';
import '../core/theme/app_spacing.dart';
import '../core/theme/app_typography.dart';

enum DialogType { info, success, warning, error }

class CustomAppDialog extends StatelessWidget {
  final String title;
  final String message;
  final DialogType type;
  final String confirmText;
  final String? cancelText;
  final VoidCallback onConfirm;
  final VoidCallback? onCancel;

  const CustomAppDialog({
    super.key,
    required this.title,
    required this.message,
    this.type = DialogType.info,
    this.confirmText = 'Xác nhận',
    this.cancelText,
    required this.onConfirm,
    this.onCancel,
  });

  Color _getHeaderColor() {
    switch (type) {
      case DialogType.success:
        return AppColors.success100;
      case DialogType.warning:
        return AppColors.warning100;
      case DialogType.error:
        return AppColors.error100;
      case DialogType.info:
        return AppColors.primary;
    }
  }

  IconData _getHeaderIcon() {
    switch (type) {
      case DialogType.success:
        return Icons.check_circle_outline_rounded;
      case DialogType.warning:
        return Icons.warning_amber_rounded;
      case DialogType.error:
        return Icons.error_outline_rounded;
      case DialogType.info:
        return Icons.info_outline_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final color = _getHeaderColor();

    return Dialog(
      shape: const RoundedRectangleBorder(borderRadius: AppRadius.dialogRadius),
      elevation: 0,
      backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
      child: Container(
        padding: AppSpacing.dialogPadding,
        decoration: BoxDecoration(
          borderRadius: AppRadius.dialogRadius,
          boxShadow: AppShadows.level3,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Icon Header
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(_getHeaderIcon(), color: color, size: 28),
            ),
            const SizedBox(height: AppSpacing.md),

            // Tiêu đề
            Text(
              title,
              style: AppTextStyles.heading2.copyWith(
                color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),

            // Nội dung mô tả
            Text(
              message,
              style: AppTextStyles.body.copyWith(
                color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.lg),

            // Nút bấm tương tác
            Row(
              children: [
                if (cancelText != null) ...[
                  Expanded(
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(
                          color: isDark ? AppColors.borderDark : AppColors.borderLight,
                        ),
                        shape: const RoundedRectangleBorder(borderRadius: AppRadius.buttonRadius),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: () {
                        Navigator.of(context).pop();
                        onCancel?.call();
                      },
                      child: Text(
                        cancelText!,
                        style: AppTextStyles.bodyStrong.copyWith(
                          color: isDark ? AppColors.textSecondaryDark : AppColors.textSecondaryLight,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                ],
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: type == DialogType.error ? AppColors.error100 : AppColors.primary,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: const RoundedRectangleBorder(borderRadius: AppRadius.buttonRadius),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: () {
                      Navigator.of(context).pop();
                      onConfirm();
                    },
                    child: Text(confirmText, style: AppTextStyles.button),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Hàm tiện ích static để gọi nhanh Dialog ở bất kỳ đâu
  static Future<void> show(
    BuildContext context, {
    required String title,
    required String message,
    DialogType type = DialogType.info,
    String confirmText = 'Xác nhận',
    String? cancelText,
    required VoidCallback onConfirm,
    VoidCallback? onCancel,
  }) {
    return showDialog(
      context: context,
      barrierDismissible: cancelText != null,
      builder: (ctx) => CustomAppDialog(
        title: title,
        message: message,
        type: type,
        confirmText: confirmText,
        cancelText: cancelText,
        onConfirm: onConfirm,
        onCancel: onCancel,
      ),
    );
  }
}