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

  static const Color heroBorder = AppColors.grey100;
  static final Color heroShadow = AppColors.grey900.withValues(alpha: 0.04);
  static const Color cefrChipBg = AppColors.grey50;
  static const Color cefrChipFg = AppColors.grey800;

  static const Color goalsBorder = AppColors.grey200;
  static const Color tagSurface = AppColors.grey50;
  static const Color tagText = AppColors.grey800;

  static const Color providerText = AppColors.grey800;
  static const Color avatarBg = AppColors.primary50;
  static const Color hoverTint = AppColors.primary25;
  static const Color danger = AppColors.error200;
  static const Color toggleOn = AppColors.primary;
  static const Color toggleOff = AppColors.grey300;

  static const Color cefrChartStart = AppColors.primary25;
  static const Color cefrChartMid = AppColors.primary25;
  static const Color cefrChartEnd = AppColors.grey5;
  static const Color cefrChartBorder = AppColors.grey100;
  static const Color routeGuide = AppColors.grey300;
  static const Color routeUnderlay = AppColors.primary50;
  static const Color routeLine = AppColors.primary;
  static const Color dotStroke = AppColors.grey700;
  static const Color dotFill = AppColors.grey0;
  static const Color dotHalo = AppColors.primary25;
  static const Color inputDotFill = AppColors.primary;
  static const Color inputDotBorder = AppColors.grey0;
  static const Color inputDotHalo = AppColors.primary200;
  static const Color goalDotStroke = AppColors.primaryDark;
  static const Color goalDotHalo = AppColors.primary50;
  static const Color activeCefrLabel = AppColors.primaryDark;
  static const Color inactiveCefrLabel = AppColors.grey800;
  static const Color roleText = AppColors.primaryDark;

  static const Color skillIconBg = AppColors.grey50;
  static const Color skillIconFg = AppColors.grey800;
  static const Color skillAdaptiveBg = AppColors.primary25;
  static const Color skillAdaptiveFg = AppColors.primaryDark;
  static const Color badgeBg = AppColors.grey5;
  static const Color badgeBorder = AppColors.grey200;
  static const Color badgeAdaptiveBg = AppColors.primary25;
  static const Color badgeAdaptiveBorder = AppColors.primary50;
  static const Color badgeAdaptiveFg = AppColors.primaryDark;

  static const Color permissionBg = AppColors.grey50;
  static const Color permissionIconBg = AppColors.grey0;
  static const Color permissionIconBorder = AppColors.grey200;
  static const Color permissionIconFg = AppColors.grey800;

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
