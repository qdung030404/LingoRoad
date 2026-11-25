import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/profile/profile_page.dart';
import 'package:mobile/features/profile/reminder_coordinator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'test_helpers.dart';

class _ScriptedPlatform implements ReminderNotificationPlatform {
  _ScriptedPlatform({
    this.permission = NotificationPermissionState.granted,
    this.afterRequest = NotificationPermissionState.granted,
  });

  NotificationPermissionState permission;
  NotificationPermissionState afterRequest;
  final List<({String accountId, bool enabled, String time})> synced = [];
  final List<String> cancelledAccounts = [];

  @override
  Future<NotificationPermissionState> checkPermission() async => permission;

  @override
  Future<NotificationPermissionState> requestPermission() async {
    permission = afterRequest;
    return permission;
  }

  @override
  Future<void> syncSchedule({
    required String accountId,
    required bool enabled,
    required String localTime,
  }) async {
    synced.add((accountId: accountId, enabled: enabled, time: localTime));
  }

  @override
  Future<void> cancelForAccount(String accountId) async {
    cancelledAccounts.add(accountId);
  }
}

class _InterceptingApi extends FakeApi {
  _InterceptingApi({
    super.completed = false,
    super.provider = 'GOOGLE',
    super.displayName = 'Anna Nguyễn',
    super.learningPurpose = 'WORK',
    super.targetCefr = 'B2',
    super.dailyGoalMinutes = 15,
    super.preferredKinds = const ['GRAMMAR', 'VOCABULARY', 'READING'],
    super.preferencesVersion = 2,
    super.reminderEnabled = true,
    super.reminderTime = '19:30',
    super.reminderVersion = 0,
    super.readingLevel,
    this.onRequest,
  }) : super(signedIn: true);

  Future<Json> Function(
    String method,
    String path,
    Json? data,
    Future<Json> Function() fallback,
  )?
  onRequest;

  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Duration? receiveTimeout,
  }) async {
    Future<Json> fallback() => super.request(
      method,
      path,
      data: data,
      auth: auth,
      receiveTimeout: receiveTimeout,
    );
    if (onRequest != null) {
      return onRequest!(method, path, data, fallback);
    }
    return fallback();
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Future<SessionController> bootSession(_InterceptingApi api) async {
    final session = SessionController(api);
    await session.initialize();
    return session;
  }

  testWidgets(
    'Unassessed profile shows Chưa đánh giá, primary assessment CTA, Mức khởi đầu badges, and hides password reset for Google accounts',
    (tester) async {
      final api = _InterceptingApi(
        completed: false,
        provider: 'GOOGLE',
        reminderEnabled: false,
      );
      final session = await bootSession(api);
      final platform = _ScriptedPlatform(
        permission: NotificationPermissionState.denied,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ProfilePage(session: session, reminderPlatform: platform),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Chưa đánh giá'), findsOneWidget);
      expect(find.text('Làm bài kiểm tra đầu vào'), findsOneWidget);
      expect(find.text('Mức khởi đầu'), findsNWidgets(4));
      expect(find.text('Đăng nhập qua Google'), findsOneWidget);
      expect(find.text('Đổi mật khẩu'), findsNothing);
      expect(find.text('Đặt lại mật khẩu qua email'), findsNothing);

      // Intentional Reminder OFF must NOT show OS permission prompt
      expect(find.byKey(const Key('notificationPermissionBox')), findsNothing);
      expect(find.byKey(const Key('reminderTimeRow')), findsNothing);
      expect(
        find.text('Đang tắt · Bật để nhận nhắc học mỗi tối'),
        findsOneWidget,
      );

      // Enabling reminder while OS permission is denied shows explicit permission box and allows granting
      final grantedPlatform = _ScriptedPlatform(
        permission: NotificationPermissionState.denied,
        afterRequest: NotificationPermissionState.granted,
      );
      await tester.pumpWidget(
        MaterialApp(
          home: ProfilePage(
            session: session,
            reminderPlatform: grantedPlatform,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.byKey(const Key('reminderToggleSwitch')),
        160,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.byKey(const Key('reminderToggleSwitch')));
      await tester.pumpAndSettle();
      expect(
        find.text('Chưa thể nhắc học — cần cấp quyền thông báo'),
        findsOneWidget,
      );
      await tester.scrollUntilVisible(
        find.byKey(const Key('openNotificationSettingsButton')),
        120,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(find.byKey(const Key('openNotificationSettingsButton')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('notificationPermissionBox')), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Narrow 320px viewport keeps adaptive reading tile heights balanced and all interactive controls >= 48px',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final api = _InterceptingApi(
        completed: true,
        provider: 'GOOGLE',
        readingLevel: {'cefrLevel': 'B1', 'source': 'ADAPTIVE'},
      );
      final session = await bootSession(api);

      await tester.pumpWidget(MaterialApp(home: ProfilePage(session: session)));
      await tester.pumpAndSettle();

      expect(find.text('Cập nhật từ bài học'), findsOneWidget);
      final readH = tester
          .getSize(find.byKey(const ValueKey('skillTile-READING')))
          .height;
      final listenH = tester
          .getSize(find.byKey(const ValueKey('skillTile-LISTENING')))
          .height;
      final gramH = tester
          .getSize(find.byKey(const ValueKey('skillTile-GRAMMAR')))
          .height;
      final vocabH = tester
          .getSize(find.byKey(const ValueKey('skillTile-VOCABULARY')))
          .height;
      expect(readH, equals(listenH));
      expect(gramH, equals(vocabH));

      for (final key in [
        const Key('editIdentityButton'),
        const Key('viewPlacementResultButton'),
        const Key('editLearningGoalsButton'),
        const Key('reminderToggleSwitch'),
        const Key('reminderTimeRow'),
        const Key('logoutButton'),
      ]) {
        await tester.scrollUntilVisible(
          find.byKey(key),
          160,
          scrollable: find.byType(Scrollable).first,
        );
        expect(tester.getSize(find.byKey(key)).height, greaterThanOrEqualTo(48));
      }
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Inline display name edit supports cancel preserving old name and save updating overview with keyboard inset',
    (tester) async {
      tester.view.viewInsets = const FakeViewPadding(bottom: 290);
      addTearDown(tester.view.resetViewInsets);

      final api = _InterceptingApi(displayName: 'Anna Nguyễn');
      final session = await bootSession(api);

      await tester.pumpWidget(MaterialApp(home: ProfilePage(session: session)));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.byKey(const Key('editIdentityButton')));
      await tester.tap(find.byKey(const Key('editIdentityButton')));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('inlineNameInput')).descendant(find.byType(TextFormField)),
        'Anna Nguyễn Minh',
      );
      await tester.ensureVisible(find.byKey(const Key('cancelEditNameButton')));
      await tester.tap(find.byKey(const Key('cancelEditNameButton')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('profileDisplayName')), findsOneWidget);
      expect(find.text('Anna Nguyễn'), findsOneWidget);

      await tester.ensureVisible(find.byKey(const Key('editIdentityButton')));
      await tester.tap(find.byKey(const Key('editIdentityButton')));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('inlineNameInput')).descendant(find.byType(TextFormField)),
        'Anna Nguyễn Minh',
      );
      await tester.ensureVisible(find.byKey(const Key('saveEditNameButton')));
      await tester.tap(find.byKey(const Key('saveEditNameButton')));
      await tester.pumpAndSettle();
      expect(find.text('Đã lưu họ và tên'), findsOneWidget);
      expect(find.text('Anna Nguyễn Minh'), findsOneWidget);
    },
  );

  testWidgets(
    'Goals edit page enforces 3-option leave popup, updates overview with Đã lưu mục tiêu học tập, and dismisses stale errors while saving',
    (tester) async {
      var failSave = true;
      final api = _InterceptingApi(
        dailyGoalMinutes: 15,
        onRequest: (method, path, data, fallback) async {
          if (method == 'PATCH' && path == '/learning/preferences' && failSave) {
            throw const ApiFailure(
              'Không lưu được thay đổi do kết nối gián đoạn.',
              status: 503,
            );
          }
          return fallback();
        },
      );
      final session = await bootSession(api);

      await tester.pumpWidget(MaterialApp(home: ProfilePage(session: session)));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.byKey(const Key('editLearningGoalsButton')));
      await tester.tap(find.byKey(const Key('editLearningGoalsButton')));
      await tester.pumpAndSettle();

      // Initially clean: Chưa có thay đổi
      expect(find.text('Chưa có thay đổi'), findsOneWidget);

      await tester.scrollUntilVisible(
        find.byKey(const ValueKey('minutes-pill-20')),
        120,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.byKey(const ValueKey('minutes-pill-20')));
      await tester.pumpAndSettle();

      // Back triggers 3-option popup; choose Continue Editing
      await tester.tap(find.byKey(const Key('goalsBackButton')));
      await tester.pumpAndSettle();
      expect(find.text('Tiếp tục chỉnh sửa'), findsOneWidget);
      expect(find.text('Lưu và rời trang'), findsOneWidget);
      expect(find.text('Bỏ thay đổi'), findsOneWidget);
      await tester.tap(find.byKey(const Key('leaveDialogContinueButton')));
      await tester.pumpAndSettle();

      // First save fails -> banner visible & draft preserved
      await tester.tap(find.byKey(const Key('goalsSaveButton')));
      await tester.pumpAndSettle();
      expect(
        find.text('Không lưu được thay đổi do kết nối gián đoạn.'),
        findsOneWidget,
      );
      expect(find.text('Lưu lại thay đổi'), findsOneWidget);

      // Retry succeeds -> overview updated cleanly
      failSave = false;
      await tester.tap(find.byKey(const Key('goalsSaveButton')));
      await tester.pumpAndSettle();

      expect(find.text('Đã lưu mục tiêu học tập'), findsOneWidget);
      expect(find.text('20 phút / ngày'), findsOneWidget);
    },
  );

  testWidgets(
    '409 conflict auto-confirms when server snapshot matches draft, and displays all differing fields before manual overwrite',
    (tester) async {
      // Scenario A: timeout/409 where server already holds exact draft changes -> confirms smoothly
      final apiMatch = _InterceptingApi(
        learningPurpose: 'WORK',
        targetCefr: 'B2',
        dailyGoalMinutes: 20,
        preferredKinds: const ['GRAMMAR', 'VOCABULARY'],
        preferencesVersion: 4,
        onRequest: (method, path, data, fallback) async {
          if (method == 'PATCH' && path == '/learning/preferences') {
            throw const ApiFailure(
              'Thiết lập đã thay đổi.',
              code: 'LEARNING_PREFERENCES_CONFLICT',
              status: 409,
            );
          }
          return fallback();
        },
      );
      // Client starts stale with 15 min / STUDY / B1 while server already updated to draft values
      final sessionA = await bootSession(apiMatch);
      sessionA.user = {
        ...sessionA.user!,
        'profile': {
          ...sessionA.profile,
          'learningPurpose': 'STUDY',
          'targetCefr': 'B1',
          'dailyGoalMinutes': 15,
          'preferredKinds': ['GRAMMAR'],
          'preferencesVersion': 3,
        },
      };

      // Open Overview with stale cached profile (override GET on initial fetch once)
      var initialFetched = false;
      apiMatch.onRequest = (method, path, data, fallback) async {
        if (method == 'GET' && path == '/learning/preferences' && !initialFetched) {
          initialFetched = true;
          return {
            'learningPurpose': 'STUDY',
            'targetCefr': 'B1',
            'dailyGoalMinutes': 15,
            'preferredKinds': ['GRAMMAR'],
            'version': 3,
            'readingLevel': {'cefrLevel': 'B1', 'source': 'PLACEMENT'},
          };
        }
        if (method == 'PATCH' && path == '/learning/preferences') {
          throw const ApiFailure(
            'Thiết lập đã thay đổi.',
            code: 'LEARNING_PREFERENCES_CONFLICT',
            status: 409,
          );
        }
        return fallback();
      };

      await tester.pumpWidget(MaterialApp(home: ProfilePage(session: sessionA)));
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.byKey(const Key('editLearningGoalsButton')));
      await tester.tap(find.byKey(const Key('editLearningGoalsButton')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('goalsPurposeDropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Công việc').last);
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('cefr-pill-B2')));
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey('minutes-pill-20')),
        120,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.byKey(const ValueKey('minutes-pill-20')));
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey('kind-chip-VOCABULARY')),
        120,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.byKey(const ValueKey('kind-chip-VOCABULARY')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('goalsSaveButton')));
      await tester.pumpAndSettle();
      expect(find.text('Đã lưu mục tiêu học tập'), findsOneWidget);
      expect(find.text('20 phút / ngày'), findsOneWidget);

      // Scenario B: true 409 conflict across ALL 4 fields displays every difference before user overwrites
      final apiDiff = _InterceptingApi(
        learningPurpose: 'DAILY_COMMUNICATION',
        targetCefr: 'C1',
        dailyGoalMinutes: 30,
        preferredKinds: const ['LISTENING'],
        preferencesVersion: 9,
      );
      var firstLoadDiff = true;
      apiDiff.onRequest = (method, path, data, fallback) async {
        if (method == 'GET' && path == '/learning/preferences' && firstLoadDiff) {
          firstLoadDiff = false;
          return {
            'learningPurpose': 'WORK',
            'targetCefr': 'B1',
            'dailyGoalMinutes': 15,
            'preferredKinds': ['GRAMMAR'],
            'version': 8,
            'readingLevel': {'cefrLevel': 'B1', 'source': 'PLACEMENT'},
          };
        }
        return fallback();
      };
      final sessionB = await bootSession(apiDiff);
      sessionB.user = {
        ...sessionB.user!,
        'profile': {
          ...sessionB.profile,
          'learningPurpose': 'WORK',
          'targetCefr': 'B1',
          'dailyGoalMinutes': 15,
          'preferredKinds': ['GRAMMAR'],
          'preferencesVersion': 8,
        },
      };

      await tester.pumpWidget(
        MaterialApp(
          key: const ValueKey('app-session-b'),
          home: ProfilePage(
            key: const ValueKey('profile-session-b'),
            session: sessionB,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('editLearningGoalsButton')));
      await tester.tap(find.byKey(const Key('editLearningGoalsButton')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey('cefr-pill-B2')));
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey('minutes-pill-20')),
        120,
        scrollable: find.byType(Scrollable).last,
      );
      await tester.tap(find.byKey(const ValueKey('minutes-pill-20')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('goalsSaveButton')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('goalsConflictBox')), findsOneWidget);
      expect(find.textContaining('Mục đích học:'), findsOneWidget);
      expect(find.textContaining('Mục tiêu CEFR:'), findsOneWidget);
      expect(find.textContaining('Thời lượng mỗi ngày:'), findsOneWidget);
      expect(find.textContaining('Nhóm bài ưu tiên:'), findsOneWidget);
      expect(find.text('Lưu lựa chọn đang sửa'), findsOneWidget);

      // Now explicitly confirm overwriting server with draft
      await tester.tap(find.byKey(const Key('goalsSaveButton')));
      await tester.pumpAndSettle();
      expect(find.text('Đã lưu mục tiêu học tập'), findsOneWidget);
      expect(apiDiff.profile['dailyGoalMinutes'], 20);
      expect(apiDiff.profile['targetCefr'], 'B2');
    },
  );

  test(
    'ReminderCoordinator coalesces rapid updates, rejects stale server overwrites on 409, and clears local schedule on logout',
    () async {
      final firstPatch = Completer<Json>();
      var patchCount = 0;
      late final Future<Json> Function() firstPatchCommit;
      final api = _InterceptingApi(
        reminderEnabled: true,
        reminderTime: '19:30',
        reminderVersion: 0,
        onRequest: (method, path, data, fallback) async {
          if (method == 'PATCH' && path == '/auth/me') {
            patchCount++;
            if (patchCount == 1) {
              firstPatchCommit = fallback;
              return firstPatch.future;
            }
          }
          return fallback();
        },
      );
      final session = await bootSession(api);
      final platform = _ScriptedPlatform();
      final coordinator = ReminderCoordinator(
        session: session,
        platform: platform,
      );
      await coordinator.initialize();

      // Fire 3 rapid mutations while request #1 is in flight -> coalesces to single final sync ('21:00')
      final f1 = coordinator.setTime('20:00');
      final f2 = coordinator.setTime('20:30');
      final f3 = coordinator.setTime('21:00');
      await Future<void>.value();

      firstPatch.complete(await firstPatchCommit());
      await Future.wait([f1, f2, f3]);

      expect(patchCount, 2); // Only 20:00 (first) + 21:00 (coalesced latest)!
      expect(coordinator.state.serverTime, '21:00');
      expect(coordinator.state.version, 2);
      expect(platform.synced.last.time, '21:00');

      // Simulate external 409 change from another device -> does NOT silently overwrite
      api.profile['reminderTime'] = '22:00';
      api.profile['reminderVersion'] = 3;
      await coordinator.setTime('18:00');
      expect(coordinator.state.serverTime, '22:00');
      expect(coordinator.state.errorMessage, contains('22:00'));

      // Logout clears local account notification schedule
      await session.logout();
      expect(platform.cancelledAccounts, contains('user'));
      coordinator.dispose();
    },
  );
}

extension on Finder {
  Finder descendant(Finder matching) =>
      find.descendant(of: this, matching: matching);
}
