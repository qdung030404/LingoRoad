import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Isolated, local preview data. Never writes assessment or account records.
class PreviewModel extends ChangeNotifier {
  static const prefix = 'lingoroad.uiPreview.';
  int dailyMinutes = 10;
  Set<String> focus = {'Đọc: Ngữ pháp', 'Nghe'};
  Set<String> completed = {};
  final drafts = ['', ''];
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
  'Describe what you did last weekend.',
  'Write about your best friend.',
];
const sampleWriting = [
  'Last weekend I went to the park with my friends. We played football and then we had lunch because we were hungry.',
  'My best friend is Minh. He is kind and funny. We have been friends for five years.',
];
int wordCount(String value) => RegExp(r"\S+").allMatches(value.trim()).length;
