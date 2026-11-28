import 'package:flutter/widgets.dart';

typedef StartupStageObserver =
    void Function(String stage, int elapsedMs, Map<String, Object?> metadata);

class AppStartupTiming {
  static const _enabled = bool.fromEnvironment('LINGOROAD_STARTUP_TIMING');
  static final _clock = Stopwatch();
  static final _stages = <String>{};
  static StartupStageObserver? observer;

  static bool get _active => _enabled || observer != null;

  static void start({bool force = false}) {
    if ((_active || force) && !_clock.isRunning) {
      _clock.start();
    }
  }

  static void resetForTesting({StartupStageObserver? onStage}) {
    _clock
      ..stop()
      ..reset();
    _stages.clear();
    observer = onStage;
    if (onStage != null) {
      _clock.start();
    }
  }

  static void afterNextFrame(
    String stage, {
    Map<String, Object?> metadata = const {},
  }) {
    if (!_active || !_clock.isRunning || !_stages.add(stage)) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final elapsedMs = _clock.elapsedMilliseconds;
      observer?.call(stage, elapsedMs, metadata);
      if (_enabled) {
        final suffix = metadata.entries
            .where((entry) => entry.value != null)
            .map((entry) => ' ${entry.key}=${entry.value}')
            .join();
        debugPrint('LingoRoadStartup stage=$stage elapsedMs=$elapsedMs$suffix');
      }
    });
  }
}
