import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api/api_client.dart';
import 'vocabulary_models.dart';

/// Serialized account-scoped writes. A failed write must prevent a mutation.
class VocabularyPendingStore {
  VocabularyPendingStore(this.accountId);
  final String accountId;
  Future<void> _writes = Future.value();
  String key(String target) => 'vocabulary.v1.$accountId.$target';
  Future<Json?> read(String target) async {
    await _writes.catchError((_) {});
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(key(target));
    return raw == null ? null : vocabularyJson(jsonDecode(raw));
  }

  Future<void> write(String target, Json? value) {
    final raw = value == null ? null : jsonEncode(value);
    final next = _writes.catchError((_) {}).then((_) async {
      final prefs = await SharedPreferences.getInstance();
      final ok = raw == null
          ? await prefs.remove(key(target))
          : await prefs.setString(key(target), raw);
      if (!ok) {
        throw StateError('Không lưu được dữ liệu từ vựng trên thiết bị.');
      }
    });
    _writes = next;
    return next;
  }
}
