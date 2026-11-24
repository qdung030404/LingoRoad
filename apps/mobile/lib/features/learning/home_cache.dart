import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../core/api/api_client.dart';

String homeLearningDate([DateTime? now]) => (now ?? DateTime.now())
    .toUtc()
    .add(const Duration(hours: 7))
    .toIso8601String()
    .substring(0, 10);

bool validHomeSnapshot(Json value) =>
    value['date'] is String &&
    value['totals'] is Map &&
    value['today'] is Map &&
    value['days'] is List &&
    value['preferences'] is Map &&
    const ['ready', 'missing', 'stale'].contains(value['planStatus']);

class HomeCache {
  HomeCache({
    required String server,
    required String project,
    required String uid,
  }) : _key = 'learning.home.v1.${jsonEncode([server, project, uid])}';

  final String _key;
  static const lifetime = Duration(hours: 24);
  static const _maxLength = 32 * 1024;

  Future<Json?> read() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw == null || raw.length > _maxLength) return null;
      final envelope = jsonDecode(raw) as Map;
      final stored = DateTime.parse(envelope['storedAt'] as String);
      final age = DateTime.now().difference(stored);
      final value = Map<String, dynamic>.from(envelope['home'] as Map);
      if (age.isNegative || age > lifetime || !validHomeSnapshot(value)) {
        return null;
      }
      return value;
    } catch (_) {
      return null;
    }
  }

  Future<void> write(Json value) async {
    if (!validHomeSnapshot(value)) return;
    final raw = jsonEncode({
      'storedAt': DateTime.now().toUtc().toIso8601String(),
      'home': value,
    });
    if (raw.length > _maxLength) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, raw);
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
