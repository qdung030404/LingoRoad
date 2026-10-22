import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTextStyles {
  AppTextStyles._();

  static const String fontFamily = 'Inter';

  // Light Styles
  static const TextStyle heading1 = TextStyle(
    fontFamily: fontFamily,
    fontSize: 24,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimaryLight,
    height: 1.3,
  );

  static const TextStyle heading2 = TextStyle(
    fontFamily: fontFamily,
    fontSize: 18,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimaryLight,
    height: 1.35,
  );

  static const TextStyle body = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimaryLight,
    height: 1.5,
  );

  static const TextStyle bodyStrong = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimaryLight,
    height: 1.5,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: fontFamily,
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondaryLight,
    height: 1.4,
  );

  static const TextStyle button = TextStyle(
    fontFamily: fontFamily,
    fontSize: 15,
    fontWeight: FontWeight.w600,
    color: Colors.white,
  );

  // Dark Styles
  static const TextStyle heading1Dark = TextStyle(
    fontFamily: fontFamily,
    fontSize: 24,
    fontWeight: FontWeight.w700,
    color: AppColors.textPrimaryDark,
    height: 1.3,
  );

  static const TextStyle heading2Dark = TextStyle(
    fontFamily: fontFamily,
    fontSize: 18,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimaryDark,
    height: 1.35,
  );

  static const TextStyle bodyDark = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: AppColors.textPrimaryDark,
    height: 1.5,
  );

  static const TextStyle bodyStrongDark = TextStyle(
    fontFamily: fontFamily,
    fontSize: 14,
    fontWeight: FontWeight.w600,
    color: AppColors.textPrimaryDark,
    height: 1.5,
  );

  static const TextStyle captionDark = TextStyle(
    fontFamily: fontFamily,
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: AppColors.textSecondaryDark,
    height: 1.4,
  );

  // Dynamic context-aware helpers
  static TextStyle heading1Of(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? heading1Dark : heading1;

  static TextStyle heading2Of(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? heading2Dark : heading2;

  static TextStyle bodyOf(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? bodyDark : body;

  static TextStyle bodyStrongOf(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
      ? bodyStrongDark
      : bodyStrong;

  static TextStyle captionOf(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark ? captionDark : caption;
}
