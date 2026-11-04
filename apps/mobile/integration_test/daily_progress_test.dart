import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/learning/activity_clock.dart';
import 'package:mobile/features/learning/learning_preview.dart';

// REST emulator identity only: never initializes or logs out the Firebase SDK.
// Optional host test: on DAILY_BACKGROUND_WINDOW, send HOME for 10 seconds,
// then start the existing MainActivity again during the 30-second window.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('daily plan, native clock, active time and immediate preferences', (
    tester,
  ) async {
    const emulator = String.fromEnvironment('LEARNING_TEST_EMULATOR');
    expect(
      RegExp(r'^(127\.0\.0\.1|localhost):\d+$').hasMatch(emulator),
      isTrue,
      reason: 'Requires an Auth Emulator forwarded to device loopback.',
    );
    const capture = bool.fromEnvironment('CAPTURE_EVIDENCE');
    const hostBackground = bool.fromEnvironment('VERIFY_HOST_BACKGROUND');
    final clock = NativeActivityClock();
    final firstTick = await clock.milliseconds();
    expect(firstTick, greaterThan(0));
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 250)),
    );
    expect(await clock.milliseconds(), greaterThan(firstTick));

    final api = ApiClient(config: AppConfig(), store: _MemoryTokens());
    late SessionController account;
    late Json reading;
    await tester.runAsync(() async {
      final identity = await Dio().post<Map<String, dynamic>>(
        'http://$emulator/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',
        data: {
          'email':
              'daily-mumu-${DateTime.now().millisecondsSinceEpoch}@example.com',
          'password': 'DailyDevice123!',
          'returnSecureToken': true,
        },
      );
      api.accessToken = identity.data!['idToken'] as String;
      account = SessionController(api)
        ..user = await api.request('GET', '/auth/me')
        ..stage = SessionStage.ready;
      final prefs = await api.request('GET', '/learning/preferences');
      await api.request(
        'PATCH',
        '/learning/preferences',
        data: {
          'dailyGoalMinutes': 20,
          'preferredKinds': ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'],
          'expectedVersion': prefs['version'],
        },
      );
      final catalogue = await api.request('GET', '/learning/lessons');
      reading = Map<String, dynamic>.from(
        (catalogue['items'] as List).firstWhere(
              (row) => row['kind'] == 'READING',
            )
            as Map,
      );
    });

    Future<void> waitFor(Finder finder) async {
      for (var i = 0; i < 150 && finder.evaluate().isEmpty; i++) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 100)),
        );
        await tester.pump();
      }
      expect(finder, findsWidgets);
      await tester.pumpAndSettle();
    }

    Future<void> tap(Finder finder) async {
      await waitFor(finder);
      await tester.ensureVisible(finder.first);
      await tester.pumpAndSettle();
      await tester.tap(finder.first);
      await tester.pumpAndSettle();
    }

    Future<void> elapse(int seconds) async {
      final until = DateTime.now().add(Duration(seconds: seconds));
      while (DateTime.now().isBefore(until)) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 200)),
        );
        await tester.pump();
      }
    }

    Future<Json> stats() async {
      late Json result;
      await tester.runAsync(() async {
        result = await api.request('GET', '/learning/progress');
      });
      return result;
    }

    Future<void> screenshot(String name) async {
      if (capture) {
        await tester.pumpAndSettle();
        await binding.takeScreenshot(name);
      }
    }

    Future<void> mount() async {
      await tester.pumpWidget(
        MaterialApp(
          key: UniqueKey(),
          theme: AppTheme.lightTheme,
          home: LearningPreview(account: account),
        ),
      );
      await tester.pumpAndSettle();
      await waitFor(find.byKey(const Key('dailyTaskProgress')));
    }

    await mount();
    if (capture) {
      await binding.convertFlutterSurfaceToImage();
      await tester.pumpAndSettle();
    }
    expect(
      tester.widget<Text>(find.byKey(const Key('dailyActiveMinutes'))).data,
      '0 phút 0 giây / 20 phút hoạt động đã ghi nhận',
    );
    await screenshot('daily-01-plan');
    await tap(find.byKey(ValueKey('learning-lesson-${reading['id']}')));
    await tap(find.byKey(const Key('learningStart')));
    await waitFor(find.text('Câu 1/5'));
    await elapse(8);
    await tap(find.byTooltip('Lưu và thoát'));
    final recorded = (await stats())['today']['activeSeconds'] as int;
    expect(recorded, greaterThanOrEqualTo(5));
    await tap(find.byKey(ValueKey('learning-lesson-${reading['id']}')));
    await waitFor(find.text('Câu 1/5'));
    await elapse(1);

    if (hostBackground) {
      debugPrint(
        'DAILY_BACKGROUND_WINDOW: HOME 10s then MainActivity; wait30s',
      );
      await elapse(30);
    } else {
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
      await elapse(8);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await elapse(6);
    }
    await tap(find.byTooltip('Lưu và thoát'));
    final afterGap = (await stats())['today']['activeSeconds'] as int;
    expect(afterGap, greaterThan(recorded));
    expect(
      afterGap - recorded,
      lessThan(hostBackground ? 27 : 12),
      reason: 'Background gap must not become observed learning time.',
    );
    debugPrint(
      'DAILY_BACKGROUND_VERIFIED: recordedDelta=${afterGap - recorded}s',
    );

    await tap(find.byKey(ValueKey('learning-lesson-${reading['id']}')));
    await waitFor(find.text('Câu 1/5'));
    for (var i = 0; i < 5; i++) {
      await tap(find.byKey(const ValueKey('learning-option-A')));
      await tap(find.byKey(const Key('learningPrimaryAction')));
      await waitFor(find.text(i == 4 ? 'Nộp bài' : 'Tiếp theo'));
      await tap(find.byKey(const Key('learningPrimaryAction')));
      if (i < 4) await waitFor(find.text('Câu ${i + 2}/5'));
    }
    await waitFor(find.text('Kết quả bài học'));
    await tap(find.byIcon(Icons.arrow_back));
    await waitFor(find.byKey(const Key('dailyPreferences')));
    await tap(find.byKey(const Key('dailyPreferences')));
    await tap(find.text('5 phút'));
    await tap(find.byKey(const Key('dailySavePreferences')));
    await waitFor(find.byKey(const Key('dailyTaskProgress')));
    final state = await stats();
    expect(state['today']['dailyGoalMinutes'], 5);
    expect(state['today']['completedLessonCount'], 1);
    expect(state['today']['goalMet'], false);
    final activeSeconds = (state['today']['activeSeconds'] as num).toInt();
    final recordedLabel =
        '${activeSeconds ~/ 60} phút ${activeSeconds % 60} giây / 5 phút hoạt động đã ghi nhận';
    expect(
      tester.widget<Text>(find.byKey(const Key('dailyActiveMinutes'))).data,
      recordedLabel,
    );
    expect(find.byKey(const Key('dailyGoalMet')), findsNothing);
    expect(find.text('Đã hoàn thành kế hoạch hôm nay'), findsOneWidget);
    expect(find.text('Bạn đã hoàn thành các bài hiện có'), findsNothing);
    await screenshot('daily-02-complete-and-new-target');

    await tap(find.byKey(const Key('previewTab4')));
    await waitFor(find.text('Hoạt động 7 ngày'));
    expect(find.textContaining('Đọc: 2/5'), findsOneWidget);
    await screenshot('daily-03-progress');
    await tester.runAsync(() async {
      final summary = await api.request('GET', '/learning/summary');
      final current = await api.request('GET', '/learning/progress');
      expect(
        summary['completedLessonCount'],
        current['totals']['completedLessonCount'],
      );
      expect(summary['activeSeconds'], current['totals']['activeSeconds']);
      expect(current['days'].length, 7);
    });

    // New widget/controller tree reads server plans, goals, results and time.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    await mount();
    expect(
      tester.widget<Text>(find.byKey(const Key('dailyActiveMinutes'))).data,
      recordedLabel,
    );
    await screenshot('daily-04-restored');
    await tester.pumpWidget(const SizedBox.shrink());
    account.dispose();
    api.dio.close();
  });
}

class _MemoryTokens implements TokenStore {
  @override
  Future<void> clear() async {}
  @override
  Future<String?> read() async => null;
  @override
  Future<void> write(String token) async {}
}
