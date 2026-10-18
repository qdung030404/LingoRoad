import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppShadows {
  AppShadows._();

  /// Level 1: Card thường
  static List<BoxShadow> get level1 => [
        BoxShadow(
          color: AppColors.grey900.withValues(alpha: 0.04),
          offset: const Offset(0, 2),
          blurRadius: 8,
        ),
      ];

  /// Level 2: Nút trôi (Floating bar) / Bottom sheet
  static List<BoxShadow> get level2 => [
        BoxShadow(
          color: AppColors.grey900.withValues(alpha: 0.08),
          offset: const Offset(0, 6),
          blurRadius: 16,
        ),
      ];

  /// Level 3: Hộp thoại (Dialog) / Popover
  static List<BoxShadow> get level3 => [
        BoxShadow(
          color: AppColors.grey900.withValues(alpha: 0.14),
          offset: const Offset(0, 10),
          blurRadius: 24,
        ),
      ];
}
