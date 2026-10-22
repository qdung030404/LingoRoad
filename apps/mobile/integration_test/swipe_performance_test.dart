import 'dart:io';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/main.dart';

import '../test/test_helpers.dart';

// FrameTiming is reported by the engine, independently of gesture/pump time.
// Both baseline and optimized runs must use the same device, mode and harness.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  binding.framePolicy = LiveTestWidgetsFlutterBindingFramePolicy.fullyLive;

  testWidgets('engine frame timings for welcome and main pages', (
    tester,
  ) async {
    final report = <String, dynamic>{
      'mode': kProfileMode ? 'profile' : (kReleaseMode ? 'release' : 'debug'),
      'operatingSystem': Platform.operatingSystemVersion,
      'thresholdMs': 16.67,
      'measurement': 'SchedulerBinding.addTimingsCallback FrameTiming',
      'windowFilter':
          'buildStart inside currentSystemFrameTimeStamp action window',
      'framePolicy': 'fullyLive',
      'scenarios': <String, dynamic>{},
    };

    Map<String, dynamic> summarize(List<double> values) {
      values.sort();
      double percentile(double p) => values[((values.length - 1) * p).round()];
      return {
        'p50Ms': percentile(.50),
        'p90Ms': percentile(.90),
        'p99Ms': percentile(.99),
        'maxMs': values.last,
        'over16_67Ms': values.where((value) => value > 16.67).length,
      };
    }

    Future<void> measure(String name, Future<void> Function() action) async {
      // Flutter's own watchPerformance uses a two-second delay to flush batches.
      await Future<void>.delayed(const Duration(seconds: 2));
      final frames = <FrameTiming>[];
      void capture(List<FrameTiming> batch) => frames.addAll(batch);
      SchedulerBinding.instance.addTimingsCallback(capture);
      final start =
          SchedulerBinding.instance.currentSystemFrameTimeStamp.inMicroseconds;
      var end = start;
      try {
        await action();
        await tester.pumpAndSettle();
        end = SchedulerBinding
            .instance
            .currentSystemFrameTimeStamp
            .inMicroseconds;
        await Future<void>.delayed(const Duration(seconds: 2));
      } finally {
        SchedulerBinding.instance.removeTimingsCallback(capture);
      }
      frames.removeWhere((frame) {
        final timestamp = frame.timestampInMicroseconds(FramePhase.buildStart);
        return timestamp <= start || timestamp > end;
      });
      expect(frames, isNotEmpty, reason: 'Engine must return real FrameTiming');
      (report['scenarios'] as Map<String, dynamic>)[name] = {
        'frameCount': frames.length,
        'build': summarize([
          for (final frame in frames) frame.buildDuration.inMicroseconds / 1000,
        ]),
        'raster': summarize([
          for (final frame in frames)
            frame.rasterDuration.inMicroseconds / 1000,
        ]),
        'total': summarize([
          for (final frame in frames) frame.totalSpan.inMicroseconds / 1000,
        ]),
      };
      debugPrint('FRAME_REPORT $name ${(report['scenarios'] as Map)[name]}');
    }

    double page(String key) =>
        tester.widget<PageView>(find.byKey(Key(key))).controller!.page!;

    Future<void> swipe(String key, int target) async {
      final finder = find.byKey(Key(key));
      final box = tester.getRect(finder);
      final direction = target > page(key) ? -1.0 : 1.0;
      // Welcome artwork lives above its original fixed card. Main pages use
      // the same upper content band to avoid the bottom navigation overlay.
      final start = Offset(
        direction < 0 ? box.right - 40 : box.left + 40,
        box.top + 180,
      );
      await tester.timedDragFrom(
        start,
        Offset(direction * (box.width - 80), 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(page(key), closeTo(target, .01));
    }

    Future<void> tapTab(int target) async {
      await tester.tap(find.byKey(Key('previewTab$target')));
      await tester.pumpAndSettle();
      expect(page('learningPages'), closeTo(target, .01));
    }

    await tester.pumpWidget(MyApp(session: SessionController(FakeApi())));
    await tester.pumpAndSettle();
    await measure('welcome_first', () async {
      await swipe('welcomePages', 1);
      await swipe('welcomePages', 2);
      await swipe('welcomePages', 1);
      await swipe('welcomePages', 0);
    });
    await measure('welcome_warm', () async {
      for (var repeat = 0; repeat < 2; repeat++) {
        for (final target in [1, 2, 1, 0]) {
          await swipe('welcomePages', target);
        }
      }
    });

    await tester.tap(find.byKey(const Key('openLearningPreview')));
    await tester.pumpAndSettle();
    await measure('main_horizontal_first', () async {
      for (final target in [1, 2, 3, 2, 1, 0]) {
        await swipe('learningPages', target);
      }
    });
    await measure('main_horizontal_warm', () async {
      for (var repeat = 0; repeat < 2; repeat++) {
        for (final target in [1, 2, 3, 2, 1, 0]) {
          await swipe('learningPages', target);
        }
      }
    });
    await measure('main_buttons', () async {
      for (final target in [3, 0, 2, 1, 3, 0]) {
        await tapTab(target);
      }
    });
    await measure('main_vertical_first', () async {
      for (var tab = 0; tab < 4; tab++) {
        await tapTab(tab);
        final finder = find.byKey(PageStorageKey('preview-content-$tab'));
        for (final dy in [-350.0, 350.0]) {
          await tester.timedDrag(
            finder,
            Offset(0, dy),
            const Duration(milliseconds: 400),
          );
          await tester.pumpAndSettle();
        }
      }
    });
    await measure('main_vertical_warm', () async {
      for (var tab = 0; tab < 4; tab++) {
        await tapTab(tab);
        final finder = find.byKey(PageStorageKey('preview-content-$tab'));
        for (final dy in [-350.0, 350.0]) {
          await tester.timedDrag(
            finder,
            Offset(0, dy),
            const Duration(milliseconds: 400),
          );
          await tester.pumpAndSettle();
        }
      }
    });
    expect(tester.takeException(), isNull);
    binding.reportData = report;
  });
}
