import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:mobile/core/theme/app_typography.dart';

Future<void> loadUiFonts() async {
  final manifest =
      jsonDecode(await rootBundle.loadString('FontManifest.json'))
          as List<dynamic>;
  final families = {AppTextStyles.fontFamily, ...AppTextStyles.fontFallback};
  for (final font in manifest.cast<Map<String, dynamic>>()) {
    final family = font['family'] as String;
    if (!families.contains(family)) continue;
    final loader = FontLoader(family);
    for (final face in font['fonts'] as List<dynamic>) {
      loader.addFont(rootBundle.load(face['asset'] as String));
    }
    await loader.load();
  }
}
