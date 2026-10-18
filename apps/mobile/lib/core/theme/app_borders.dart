import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppBorders {
  AppBorders._();

  static Border hairline([bool isDark = false]) {
    return Border.all(
      color: isDark ? AppColors.borderDark : AppColors.borderLight,
      width: 1.0,
    );
  }

  static BorderSide hairlineSide([bool isDark = false]) {
    return BorderSide(
      color: isDark ? AppColors.borderDark : AppColors.borderLight,
      width: 1.0,
    );
  }
}
