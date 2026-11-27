import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// Màu theo vai trò trong Hồ sơ, lấy từ bảng màu chung của LingoRoad.
class ProfilePalette {
  ProfilePalette._();

  static const Color background = AppColors.backgroundLight;
  static const Color paper = AppColors.surfaceLight;
  static const Color ink = AppColors.textPrimaryLight;
  static const Color muted = AppColors.textSecondaryLight;
  static const Color accent = AppColors.primaryDark;
  static const Color routeGreen = AppColors.primaryDark;
  static const Color line = AppColors.grey100;

  // Emerald Hero đồng bộ LearningGradientBackdrop (Home & Tiến độ)
  static const Color heroGradientStart = Color(0xFF1F452A);
  static const Color heroGradientMid = Color(0xFF2B6A3F);
  static const Color heroGradientEnd = Color(0xFF4FA767);
  static const Color heroGlow = Color(0x479DE8B8);
  static const Color heroTextPrimary = AppColors.grey0;
  static const Color heroTextMuted = Color(0xD9FFFFFF);
  static const Color heroGlassBg = Color(0x2EFFFFFF);
  static const Color heroGlassBorder = Color(0x3DFFFFFF);
  static const Color heroWarningDot = AppColors.warning50;

  static const Color heroBorder = AppColors.grey100;
  static final Color heroShadow = AppColors.grey900.withValues(alpha: 0.06);
  static final Color cardShadow = AppColors.grey900.withValues(alpha: 0.04);
  static const Color cefrChipBg = AppColors.grey50;
  static const Color cefrChipFg = AppColors.grey800;
  static const Color cefrGapBg = AppColors.primary25;
  static const Color cefrGapBorder = AppColors.primary100;

  static const Color goalsBorder = AppColors.grey200;
  static const Color bentoSurface = AppColors.grey25;
  static const Color tagSurface = AppColors.grey50;
  static const Color tagText = AppColors.grey800;

  static const Color providerText = AppColors.grey800;
  static const Color avatarBg = AppColors.primary50;
  static const Color hoverTint = AppColors.primary25;
  static const Color danger = AppColors.error200;
  static const Color dangerBg = AppColors.error0;
  static const Color dangerBorder = AppColors.error25;
  static const Color toggleOn = AppColors.primary;
  static const Color toggleOff = AppColors.grey300;

  // CEFR Road Chart 3 chặng
  static const Color cefrChartStart = Color(0xFFECF8F0);
  static const Color cefrChartMid = Color(0xFFF7FCF9);
  static const Color cefrChartEnd = AppColors.grey5;
  static const Color cefrChartBorder = AppColors.primary50;
  static const Color routeGuide = AppColors.grey200;
  static const Color routeGuideActive = AppColors.primary200;
  static const Color routeUnderlay = AppColors.primary100;
  static const Color routeLine = AppColors.primary;
  static const Color routeJourneyStart = AppColors.primaryDark;
  static const Color routeJourneyEnd = AppColors.primary;
  static const Color routePassed = AppColors.primary200;
  static const Color routeFuture = AppColors.grey300;
  static const Color routeAreaTop = Color(0x3859B070);
  static const Color routeAreaBottom = Color(0x0359B070);
  static const Color dotStroke = AppColors.grey500;
  static const Color dotFill = AppColors.grey0;
  static const Color dotHalo = Color(0xB3FFFFFF);
  static const Color inputDotFill = AppColors.primaryDark;
  static const Color inputDotBorder = AppColors.grey0;
  static const Color inputDotHalo = Color(0x8C9DE8B8);
  static const Color goalDotStroke = AppColors.primaryDark;
  static const Color goalDotCore = AppColors.primary;
  static const Color goalDotHalo = AppColors.primary50;
  static const Color activeCefrLabel = AppColors.primaryDark;
  static const Color inactiveCefrLabel = AppColors.grey700;
  static const Color roleText = AppColors.primaryDark;

  // Skill cards
  static const Color skillIconBg = AppColors.grey50;
  static const Color skillIconFg = AppColors.grey800;
  static const Color skillAdaptiveBg = AppColors.primary50;
  static const Color skillAdaptiveFg = AppColors.primaryDark;
  static const Color skillAdaptiveSurface = Color(0xFFF2FBF5);
  static const Color skillAdaptiveCardBorder = Color(0xFFB9E8C8);
  static const Color badgeBg = AppColors.grey5;
  static const Color badgeBorder = AppColors.grey200;
  static const Color badgeAdaptiveBg = AppColors.primary25;
  static const Color badgeAdaptiveBorder = AppColors.primary200;
  static const Color badgeAdaptiveFg = AppColors.primaryDark;

  // Warning / permission banner
  static const Color permissionBg = AppColors.warning0;
  static const Color permissionBorder = AppColors.warning25;
  static const Color permissionIconBg = AppColors.grey0;
  static const Color permissionIconBorder = AppColors.warning25;
  static const Color permissionIconFg = AppColors.warning300;

  static const Color unassessedCta = AppColors.grey900;
  static const Color inputBorder = AppColors.borderLight;
}

const List<String> allCefrLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const Map<String, String> learningPurposes = {
  'EXAM': 'Thi chứng chỉ',
  'WORK': 'Công việc',
  'DAILY_COMMUNICATION': 'Giao tiếp hằng ngày',
  'STUDY': 'Học tập ở trường',
};

const Map<String, String> cefrLevelNames = {
  'A1': 'A1 · Khởi đầu',
  'A2': 'A2 · Sơ cấp',
  'B1': 'B1 · Trung cấp',
  'B2': 'B2 · Trung cao',
  'C1': 'C1 · Cao cấp',
};

const List<String> selectableTargetCefrLevels = ['A2', 'B1', 'B2', 'C1'];

const List<int> dailyGoalMinuteOptions = [5, 10, 15, 20, 30];

const List<String> allPreferredLearningKinds = [
  'GRAMMAR',
  'VOCABULARY',
  'READING',
  'LISTENING',
];

String learningKindLabelVi(String kind) => switch (kind) {
  'GRAMMAR' => 'Ngữ pháp',
  'VOCABULARY' => 'Từ vựng',
  'READING' => 'Đọc hiểu',
  'LISTENING' => 'Nghe hiểu',
  _ => kind,
};

IconData learningKindIcon(String kind) => switch (kind) {
  'READING' => Icons.menu_book_rounded,
  'LISTENING' => Icons.headphones_rounded,
  'GRAMMAR' => Icons.description_outlined,
  'VOCABULARY' => Icons.bookmark_border_rounded,
  _ => Icons.school_outlined,
};

String learningPurposeLabelVi(String? purpose) =>
    purpose == null ? 'Chưa chọn' : (learningPurposes[purpose] ?? purpose);

String cefrLabelWithDescriptor(String cefr) => cefrLevelNames[cefr] ?? cefr;

String formatKindsSummary(Iterable<String> kinds) {
  final ordered = [
    for (final k in allPreferredLearningKinds)
      if (kinds.contains(k)) learningKindLabelVi(k),
  ];
  return ordered.isEmpty ? 'Chưa chọn' : ordered.join(', ');
}
