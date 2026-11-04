import 'package:flutter/services.dart';

abstract class ActivityClock {
  Future<int> milliseconds();
}

/// Boot-continuous native clock, including deep sleep. Never a wall clock.
class NativeActivityClock implements ActivityClock {
  static const channel = MethodChannel('lingoroad/activity_clock');
  @override
  Future<int> milliseconds() async =>
      (await channel.invokeMethod<num>('elapsedRealtimeMilliseconds'))!.toInt();
}
