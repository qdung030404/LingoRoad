import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum AppLanguage { vi, en }

class AppLanguageProvider extends ChangeNotifier {
  static const _key = 'app_language';
  final SharedPreferences? _prefs;
  final Map<AppLanguage, Map<String, dynamic>> _translations;
  AppLanguage _currentLanguage = AppLanguage.vi;

  AppLanguageProvider({
    required SharedPreferences sharedPreferences,
    required this._translations,
  }) : _prefs = sharedPreferences {
    // Đọc ngôn ngữ đã lưu, mặc định là tiếng Việt
    final String? langCode = _prefs?.getString(_key);
    if (langCode == 'en') {
      _currentLanguage = AppLanguage.en;
    } else {
      _currentLanguage = AppLanguage.vi;
    }
  }

  AppLanguageProvider.empty()
      : _prefs = null,
        _translations = const {};

  AppLanguageProvider.test({
    required this._translations,
    AppLanguage currentLanguage = AppLanguage.vi,
  }) : _prefs = null {
    _currentLanguage = currentLanguage;
  }

  AppLanguage get currentLanguage => _currentLanguage;

  void setLanguage(AppLanguage language) {
    if (_currentLanguage != language) {
      _currentLanguage = language;
      _prefs?.setString(_key, language.name);
      notifyListeners();
    }
  }

  /// Dịch chuỗi theo dạng nested key (ví dụ: 'auth.login.title')
  String translate(String key, [List<dynamic>? args]) {
    final data = _translations[_currentLanguage] ?? {};
    final keys = key.split('.');
    dynamic current = data;

    for (final k in keys) {
      if (current is Map && current.containsKey(k)) {
        current = current[k];
      } else {
        return key;
      }
    }

    if (current == null) return key;
    String result = current.toString();

    if (args != null && args.isNotEmpty) {
      for (final arg in args) {
        result = result.replaceFirst('{}', arg.toString());
      }
    }

    return result;
  }
}
