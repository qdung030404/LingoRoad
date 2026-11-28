import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/profile/reminder_coordinator.dart';
import 'package:mobile/main.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'test_helpers.dart';

class _RecordingReminderPlatform implements ReminderNotificationPlatform {
  _RecordingReminderPlatform({
    this.permission = NotificationPermissionState.granted,
  });

  NotificationPermissionState permission;
  String? launchTarget;
  final List<
    ({String accountId, bool enabled, String localTime, String? completedDate})
  >
  syncCalls = [];
  final List<String> cancelCalls = [];

  @override
  Future<NotificationPermissionState> checkPermission() async => permission;

  @override
  Future<NotificationPermissionState> requestPermission() async => permission;

  @override
  Future<void> syncSchedule({
    required String accountId,
    required bool enabled,
    required String localTime,
    String? completedDate,
  }) async {
    syncCalls.add((
      accountId: accountId,
      enabled: enabled,
      localTime: localTime,
      completedDate: completedDate,
    ));
  }

  @override
  Future<void> cancelForAccount(String accountId) async {
    cancelCalls.add(accountId);
  }

  @override
  Future<String?> consumeLaunchTarget() async {
    final target = launchTarget;
    launchTarget = null;
    return target;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('SessionController onAccountReady', () {
    test('fires onAccountReady on login when onboarding is completed', () async {
      final api = FakeApi(
        signedIn: true,
        onboarding: false,
        reminderEnabled: true,
        reminderTime: '20:15',
      );
      final session = SessionController(api);
      final readyEvents = <({String accountId, Json profile})>[];
      session.onAccountReady = (accountId, profile) async {
        readyEvents.add((accountId: accountId, profile: profile));
      };

      await session.initialize();

      expect(session.stage, SessionStage.ready);
      expect(readyEvents, hasLength(1));
      expect(readyEvents.single.accountId, 'user');
      expect(readyEvents.single.profile['reminderEnabled'], isTrue);
      expect(readyEvents.single.profile['reminderTime'], '20:15');
      session.dispose();
    });

    test(
      'skips onAccountReady during onboarding and fires after saveProfile completes onboarding',
      () async {
        final api = FakeApi(
          signedIn: true,
          onboarding: true,
          reminderEnabled: true,
          reminderTime: '21:00',
        );
        final session = SessionController(api);
        final readyEvents = <({String accountId, Json profile})>[];
        session.onAccountReady = (accountId, profile) async {
          readyEvents.add((accountId: accountId, profile: profile));
        };

        await session.initialize();
        expect(session.stage, SessionStage.onboarding);
        expect(readyEvents, isEmpty);

        await session.saveProfile({'learningPurpose': 'WORK'});
        expect(session.stage, SessionStage.ready);
        expect(readyEvents, hasLength(1));
        expect(readyEvents.single.accountId, 'user');
        expect(readyEvents.single.profile['learningPurpose'], 'WORK');
        expect(readyEvents.single.profile['reminderTime'], '21:00');
        session.dispose();
      },
    );

    test('swallows errors thrown by onAccountReady safely', () async {
      final api = FakeApi(signedIn: true, onboarding: false);
      final session = SessionController(api);
      session.onAccountReady = (_, _) => Future.error(StateError('boom'));

      await expectLater(session.initialize(), completes);
      expect(session.stage, SessionStage.ready);
      session.dispose();
    });

    testWidgets(
      'MyApp early-syncs reminder schedule on login and clears on logout without opening ProfilePage',
      (tester) async {
        const channel = MethodChannel('lingoroad/reminders');
        final calls = <MethodCall>[];
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (call) async {
              calls.add(call);
              if (call.method == 'checkPermission') return true;
              return null;
            });
        addTearDown(() {
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
              .setMockMethodCallHandler(channel, null);
        });

        final api = FakeApi(
          signedIn: true,
          completed: true,
          reminderEnabled: true,
          reminderTime: '20:45',
        );
        final session = SessionController(api);

        await tester.pumpWidget(MyApp(session: session));
        await tester.pumpAndSettle();

        final prefs = await SharedPreferences.getInstance();
        final rawSchedule = prefs.getString('reminder.local_schedule.v1.user');
        expect(rawSchedule, isNotNull);
        final decoded = jsonDecode(rawSchedule!) as Map<String, dynamic>;
        expect(decoded['enabled'], isTrue);
        expect(decoded['localTime'], '20:45');
        expect(
          calls.any(
            (c) =>
                c.method == 'syncSchedule' &&
                (c.arguments as Map)['accountId'] == 'user' &&
                (c.arguments as Map)['localTime'] == '20:45',
          ),
          isTrue,
        );

        await session.logout();
        await tester.pumpAndSettle();
        expect(prefs.getString('reminder.local_schedule.v1.user'), isNull);
        expect(
          calls.any(
            (c) =>
                c.method == 'cancelForAccount' &&
                (c.arguments as Map)['accountId'] == 'user',
          ),
          isTrue,
        );
      },
    );
  });

  group('SharedPrefsReminderPlatform', () {
    test(
      'persists completedDate, preserves it when null, clears it when empty, and clears on cancel',
      () async {
        final platform = SharedPrefsReminderPlatform();
        final prefs = await SharedPreferences.getInstance();

        await platform.syncSchedule(
          accountId: 'acc-1',
          enabled: true,
          localTime: '19:30',
          completedDate: '2026-11-28',
        );
        var saved =
            jsonDecode(prefs.getString('reminder.local_schedule.v1.acc-1')!)
                as Map<String, dynamic>;
        expect(saved['localTime'], '19:30');
        expect(saved['completedDate'], '2026-11-28');

        // Updating time with completedDate == null keeps prior completedDate.
        await platform.syncSchedule(
          accountId: 'acc-1',
          enabled: true,
          localTime: '20:00',
        );
        saved =
            jsonDecode(prefs.getString('reminder.local_schedule.v1.acc-1')!)
                as Map<String, dynamic>;
        expect(saved['localTime'], '20:00');
        expect(saved['completedDate'], '2026-11-28');

        // Passing empty string explicitly clears completedDate.
        await platform.syncSchedule(
          accountId: 'acc-1',
          enabled: true,
          localTime: '20:00',
          completedDate: '',
        );
        saved =
            jsonDecode(prefs.getString('reminder.local_schedule.v1.acc-1')!)
                as Map<String, dynamic>;
        expect(saved.containsKey('completedDate'), isFalse);

        // Save completedDate again, then cancelForAccount removes everything.
        await platform.syncSchedule(
          accountId: 'acc-1',
          enabled: true,
          localTime: '20:00',
          completedDate: '2026-11-28',
        );
        await platform.cancelForAccount('acc-1');
        expect(prefs.getString('reminder.local_schedule.v1.acc-1'), isNull);
        expect(prefs.getString('reminder.completed_date.v1.acc-1'), isNull);
      },
    );

    test('consumeLaunchTarget returns initial value once then clears', () async {
      final withTarget = SharedPrefsReminderPlatform(
        initialLaunchTarget: 'DAILY_PLAN',
      );
      expect(await withTarget.consumeLaunchTarget(), 'DAILY_PLAN');
      expect(await withTarget.consumeLaunchTarget(), isNull);

      final defaultPlatform = SharedPrefsReminderPlatform();
      expect(await defaultPlatform.consumeLaunchTarget(), isNull);
    });
  });

  group('MethodChannelReminderPlatform', () {
    const channel = MethodChannel('lingoroad/reminders');

    tearDown(() {
      debugDefaultTargetPlatformOverride = null;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null);
    });

    test(
      'forwards completedDate on syncSchedule and consumes launch target once on Android',
      () async {
        debugDefaultTargetPlatformOverride = TargetPlatform.android;
        final recordedCalls = <MethodCall>[];
        String? nativeLaunchTarget = 'DAILY_PLAN';

        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(channel, (call) async {
              recordedCalls.add(call);
              if (call.method == 'consumeLaunchTarget') {
                final target = nativeLaunchTarget;
                nativeLaunchTarget = null;
                return target;
              }
              return null;
            });

        final platform = MethodChannelReminderPlatform();

        await platform.syncSchedule(
          accountId: 'user-42',
          enabled: true,
          localTime: '19:30',
          completedDate: '2026-11-28',
        );
        await platform.syncSchedule(
          accountId: 'user-42',
          enabled: true,
          localTime: '20:00',
        );
        await platform.syncSchedule(
          accountId: 'user-42',
          enabled: true,
          localTime: '20:00',
          completedDate: '',
        );

        expect(recordedCalls, hasLength(3));
        expect(recordedCalls[0].method, 'syncSchedule');
        expect(recordedCalls[0].arguments, {
          'accountId': 'user-42',
          'enabled': true,
          'localTime': '19:30',
          'completedDate': '2026-11-28',
        });
        expect(recordedCalls[1].arguments, {
          'accountId': 'user-42',
          'enabled': true,
          'localTime': '20:00',
        });
        expect(recordedCalls[2].arguments, {
          'accountId': 'user-42',
          'enabled': true,
          'localTime': '20:00',
          'completedDate': '',
        });

        expect(await platform.consumeLaunchTarget(), 'DAILY_PLAN');
        expect(await platform.consumeLaunchTarget(), isNull);
        expect(
          recordedCalls.where((c) => c.method == 'consumeLaunchTarget').length,
          2,
        );
      },
    );

    test(
      'consumeLaunchTarget falls back to null when plugin is missing or non-Android',
      () async {
        debugDefaultTargetPlatformOverride = TargetPlatform.android;
        final platform = MethodChannelReminderPlatform();
        expect(await platform.consumeLaunchTarget(), isNull);

        debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
        expect(await platform.consumeLaunchTarget(), isNull);
      },
    );
  });

  group('syncAccountReminderSchedule', () {
    test('syncs schedule with completedDate only when permission is granted', () async {
      final platform = _RecordingReminderPlatform(
        permission: NotificationPermissionState.granted,
      );

      await syncAccountReminderSchedule(
        platform: platform,
        accountId: 'acc-9',
        enabled: true,
        localTime: '19:30',
        completedDate: '2026-11-28',
      );

      expect(platform.syncCalls, hasLength(1));
      expect(platform.syncCalls.single.accountId, 'acc-9');
      expect(platform.syncCalls.single.enabled, isTrue);
      expect(platform.syncCalls.single.localTime, '19:30');
      expect(platform.syncCalls.single.completedDate, '2026-11-28');
      expect(platform.cancelCalls, isEmpty);
    });

    test(
      'does not sync when permission is denied and enabled is true, but cancels when disabled',
      () async {
        final platform = _RecordingReminderPlatform(
          permission: NotificationPermissionState.denied,
        );

        await syncAccountReminderSchedule(
          platform: platform,
          accountId: 'acc-9',
          enabled: true,
          localTime: '19:30',
          completedDate: '2026-11-28',
        );
        expect(platform.syncCalls, isEmpty);
        expect(platform.cancelCalls, isEmpty);

        await syncAccountReminderSchedule(
          platform: platform,
          accountId: 'acc-9',
          enabled: false,
          localTime: '19:30',
        );
        expect(platform.syncCalls, isEmpty);
        expect(platform.cancelCalls, ['acc-9']);
      },
    );
  });
}
