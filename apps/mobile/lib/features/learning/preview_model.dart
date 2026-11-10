import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'writing_evaluation_service.dart';

/// Isolated, local preview data. Never writes assessment or account records.
class PreviewModel extends ChangeNotifier {
  static const prefix = 'lingoroad.uiPreview.';
  int dailyMinutes = 10;
  Set<String> focus = {'Đọc: Ngữ pháp', 'Nghe'};
  Set<String> completed = {};
  final drafts = ['', ''];
  final Map<String, String> itemDrafts = {};
  final Map<String, double> itemScores = {};
  final Map<String, WritingEvaluationResult> itemEvaluations = {};
  SharedPreferences? _prefs;
  bool _disposed = false;
  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  Future<void> restore() async {
    _prefs = await SharedPreferences.getInstance();
    dailyMinutes = _prefs!.getInt('${prefix}minutes') ?? 10;
    focus = (_prefs!.getStringList('${prefix}focus') ?? focus.toList()).toSet();
    completed = (_prefs!.getStringList('${prefix}completed') ?? []).toSet();
    for (var i = 0; i < 2; i++) {
      drafts[i] = _prefs!.getString('${prefix}draft$i') ?? '';
    }
    final allKeys = _prefs!.getKeys();
    for (final k in allKeys) {
      if (k.startsWith('${prefix}draft_')) {
        final itemId = k.replaceFirst('${prefix}draft_', '');
        itemDrafts[itemId] = _prefs!.getString(k) ?? '';
      } else if (k.startsWith('${prefix}score_')) {
        final itemId = k.replaceFirst('${prefix}score_', '');
        itemScores[itemId] = _prefs!.getDouble(k) ?? 0.0;
      } else if (k.startsWith('${prefix}eval_')) {
        final itemId = k.replaceFirst('${prefix}eval_', '');
        final jsonStr = _prefs!.getString(k);
        if (jsonStr != null && jsonStr.isNotEmpty) {
          try {
            itemEvaluations[itemId] = WritingEvaluationResult.fromJson(
              jsonDecode(jsonStr) as Map<String, dynamic>,
            );
          } catch (_) {}
        }
      }
    }
    notifyListeners();
  }

  WritingEvaluationResult? getEvaluation(String key) {
    if (itemEvaluations.containsKey(key)) {
      return itemEvaluations[key];
    }
    final score = itemScores[key];
    if (score != null && score > 0) {
      final safeScore = (score / 2.0).clamp(1.0, 5.0);
      final cefr = score >= 9.5
          ? 'C2'
          : score >= 8.5
              ? 'C1'
              : score > 6.5
                  ? 'B2'
                  : score >= 5.0
                      ? 'B1'
                      : score >= 3.0
                          ? 'A2'
                          : 'A1';
      final status = score >= 8.5
          ? LevelEvaluationStatus.exceedsExpectations
          : score >= 6.0
              ? LevelEvaluationStatus.meetsExpectations
              : LevelEvaluationStatus.needsImprovement;
      return WritingEvaluationResult(
        levelEvaluation: LevelEvaluation(
          status: status,
          summaryVi: 'Bài làm đạt trình độ $cefr.',
          encouragementVi: 'Tiếp tục luyện tập để cải thiện thêm!',
        ),
        scores: WritingScores(
          content: safeScore,
          communicativeAchievement: safeScore,
          organisation: safeScore,
          language: safeScore,
        ),
        scaledScore10: score,
        estimatedCefr: cefr,
        feedback: const [],
        overallCommentVi:
            'Bài viết đã được giám khảo AI đánh giá và ghi nhận kết quả.',
      );
    }
    return null;
  }

  Future<void> saveEvaluation(String key, WritingEvaluationResult result) async {
    itemEvaluations[key] = result;
    await _prefs?.setString('${prefix}eval_$key', jsonEncode(result.toJson()));
    notifyListeners();
  }

  Future<void> clearEvaluation(String key) async {
    itemEvaluations.remove(key);
    await _prefs?.remove('${prefix}eval_$key');
    notifyListeners();
  }

  double getScore(String key, [int? fallbackIndex]) {
    if (itemScores.containsKey(key)) {
      return itemScores[key]!;
    }
    if (fallbackIndex != null &&
        fallbackIndex >= 0 &&
        fallbackIndex < drafts.length) {
      final fallbackKey = '${prefix}score$fallbackIndex';
      if (_prefs?.containsKey(fallbackKey) ?? false) {
        return _prefs!.getDouble(fallbackKey) ?? 0.0;
      }
    }
    return 0.0;
  }

  Future<void> saveScore(String key, double score, [int? fallbackIndex]) async {
    itemScores[key] = score;
    await _prefs?.setDouble('${prefix}score_$key', score);
    if (fallbackIndex != null && fallbackIndex >= 0) {
      await _prefs?.setDouble('${prefix}score$fallbackIndex', score);
    }
    notifyListeners();
  }

  String getDraft(String key, [int? fallbackIndex]) {
    if (itemDrafts.containsKey(key) && itemDrafts[key]!.isNotEmpty) {
      return itemDrafts[key]!;
    }
    if (fallbackIndex != null &&
        fallbackIndex >= 0 &&
        fallbackIndex < drafts.length) {
      return drafts[fallbackIndex];
    }
    return '';
  }

  Future<void> saveItemDraft(String key, String text, [int? fallbackIndex]) async {
    itemDrafts[key] = text;
    await _prefs?.setString('${prefix}draft_$key', text);
    if (fallbackIndex != null &&
        fallbackIndex >= 0 &&
        fallbackIndex < drafts.length) {
      drafts[fallbackIndex] = text;
      await _prefs?.setString('${prefix}draft$fallbackIndex', text);
    }
    notifyListeners();
  }

  Future<void> savePlan(int minutes, Set<String> skills) async {
    if (![5, 10, 20].contains(minutes) || skills.isEmpty) return;
    dailyMinutes = minutes;
    focus = Set.of(skills);
    await _prefs?.setInt('${prefix}minutes', minutes);
    await _prefs?.setStringList('${prefix}focus', skills.toList());
    notifyListeners();
  }

  Future<void> saveDraft(int index, String text) async {
    drafts[index] = text;
    await _prefs?.setString('${prefix}draft$index', text);
    notifyListeners();
  }

  Future<void> finish(String lesson) async {
    completed.add(lesson);
    await _prefs?.setStringList('${prefix}completed', completed.toList());
    notifyListeners();
  }
}

enum PracticeSkill { listening, reading, writing, speaking }

extension PracticeDetails on PracticeSkill {
  String get label => ['Nghe', 'Đọc', 'Viết', 'Nói'][index];
  String get source =>
      ['listen-intro', 'read-intro', 'write-intro', 'speak-intro'][index];
  String get title => [
    'Greetings and Introductions',
    'Everyday Introductions',
    'Write About Yourself',
    'Introduce Yourself',
  ][index];
  String get description => [
    'Nghe các đoạn hội thoại ngắn về chào hỏi, giới thiệu tên và làm quen.',
    'Đọc các đoạn văn ngắn về bản thân và xác định thông tin quan trọng như tên, tuổi, quê quán.',
    'Luyện viết câu đơn giản giới thiệu bản thân, dùng đúng từ vựng và cấu trúc cơ bản.',
    'Luyện giới thiệu bản thân bằng tiếng Anh qua các câu hỏi gợi ý về tên, tuổi, quê quán và sở thích.',
  ][index];
}

const writingPrompts = [
  'You recently stayed at a hotel in Hanoi and left your jacket in the room. Write an email to the receptionist: say who you are, describe your jacket, and ask how to get it back.',
  'Some people argue that working from home brings more benefits, while others believe working in an office fosters better collaboration. Discuss both views and give your opinion.',
];
const sampleWriting = [
  'Dear Hotel Receptionist, My name is Nam and I stayed in room 302 last weekend. Unfortunately, I forgot my dark blue jacket in the closet. Could you please check with housekeeping and inform me how I can arrange to get it back? Thank you very much for your assistance.',
  'Nowadays, the debate between working remotely and working in an office has gained widespread attention. On the one hand, remote work offers flexibility and saves commuting time. On the other hand, office environments promote direct communication and team bonding. In my opinion, a hybrid model combining both approaches provides the optimal balance for modern workers.',
];
int wordCount(String value) => RegExp(r"\S+").allMatches(value.trim()).length;
