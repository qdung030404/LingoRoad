import 'package:flutter/widgets.dart';

class AppStartupTiming {
  static const _enabled = bool.fromEnvironment('LINGOROAD_STARTUP_TIMING');
  static final _clock = Stopwatch();
  static final _stages = <String>{};

  static void start() {
    if (_enabled) _clock.start();
  }

  static void afterNextFrame(String stage) {
    if (!_enabled || !_clock.isRunning || !_stages.add(stage)) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      debugPrint(
        'LingoRoadStartup stage=$stage elapsedMs=${_clock.elapsedMilliseconds}',
      );
    });
  }
}
