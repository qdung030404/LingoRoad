import 'package:flutter/material.dart';

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
