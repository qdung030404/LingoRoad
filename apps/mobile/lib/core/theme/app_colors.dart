import 'package:flutter/material.dart';

/// Hệ thống màu chuẩn (Design Tokens) cho Đồ án tốt nghiệp
class AppColors {
  AppColors._();

  // ==========================================
  // 1. PRIMARY PALETTE
  // ==========================================
  static const Color primary25 = Color(0xFFE7F4EB);
  static const Color primary50 = Color(0xFFDCF1E0);
  static const Color primary100 = Color(0xFFCCECDC);
  static const Color primary200 = Color(0xFF9DDEB1);
  static const Color primary300 = Color(0xFF72D391);
  static const Color primary400 = Color(0xFF52C87A);
  static const Color primary500 = Color(0xFF35AC5F); // Main Brand Primary
  static const Color primary600 = Color(0xFF278A4A);
  static const Color primary700 = Color(0xFF1E713B);
  static const Color primary800 = Color(0xFF20623F);
  static const Color primary900 = Color(0xFF1F4524);

  // ==========================================
  // 2. GREYSCALE PALETTE
  // ==========================================
  static const Color grey0 = Color(0xFFFFFFFF);
  static const Color grey5 = Color(0xFFF9FCFE);
  static const Color grey25 = Color(0xFFF1F7FC);
  static const Color grey50 = Color(0xFFE4ECF4);
  static const Color grey100 = Color(0xFFDEE7F0);
  static const Color grey200 = Color(0xFFD8E2EB);
  static const Color grey300 = Color(0xFFCCD6E0);
  static const Color grey400 = Color(0xFFBDCBD6);
  static const Color grey500 = Color(0xFFA3B1BE);
  static const Color grey600 = Color(0xFF8392A0);
  static const Color grey700 = Color(0xFF657482);
  static const Color grey800 = Color(0xFF45515D);
  static const Color grey900 = Color(0xFF14191F);

  // ==========================================
  // 3. ALERT / SUCCESS
  // ==========================================
  static const Color success0 = Color(0xFFEDFAF0);
  static const Color success25 = Color(0xFFA2F3AA);
  static const Color success50 = Color(0xFF35E757);
  static const Color success100 = Color(0xFF04B129);
  static const Color success200 = Color(0xFF09721A);
  static const Color success300 = Color(0xFF0A5E21);

  // ==========================================
  // 4. ALERT / ERROR
  // ==========================================
  static const Color error0 = Color(0xFFFDF2F3);
  static const Color error25 = Color(0xFFFCD0D2);
  static const Color error50 = Color(0xFFFF807B);
  static const Color error100 = Color(0xFFEF3D37);
  static const Color error200 = Color(0xFFB22B23);
  static const Color error300 = Color(0xFF8E1E1D);

  // ==========================================
  // 5. ALERT / WARNING
  // ==========================================
  static const Color warning0 = Color(0xFFFFF7EA);
  static const Color warning25 = Color(0xFFFFE6B2);
  static const Color warning50 = Color(0xFFFCE247);
  static const Color warning100 = Color(0xFFF2BD00);
  static const Color warning200 = Color(0xFFE28F01);
  static const Color warning300 = Color(0xFFC16A01);

  // ==========================================
  // 6. ADDITIONAL / OVERLAY
  // ==========================================
  static const Color overlayPopup = Color(0xCC14191F); // 80% opacity Greyscale 900
  static const Color strokeButtonGlass = Color(0x1AFFFFFF); // 10% white stroke

  // ==========================================
  // 7. SEMANTIC ALIASES (Ánh xạ theo vai trò)
  // ==========================================
  static const Color primary = primary500;
  static const Color primaryDark = primary700;
  static const Color primaryLight = primary50;

  // Background & Surface
  static const Color backgroundLight = grey5;
  static const Color surfaceLight = grey0;
  static const Color backgroundDark = grey900;
  static const Color surfaceDark = Color(0xFF1E242B);

  // Text
  static const Color textPrimaryLight = grey900;
  static const Color textSecondaryLight = grey700;
  static const Color textMutedLight = grey500;

  static const Color textPrimaryDark = grey0;
  static const Color textSecondaryDark = grey300;
  static const Color textMutedDark = grey500;

  // Borders
  static const Color borderLight = grey200;
  static const Color borderDark = grey800;
}