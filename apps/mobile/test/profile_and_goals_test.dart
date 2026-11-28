import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/profile/cefr_road_chart.dart';
import 'package:mobile/features/profile/profile_constants.dart';
import 'package:mobile/features/profile/profile_page.dart';
import 'package:mobile/features/profile/reminder_coordinator.dart';
import 'package:mobile/main.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'test_helpers.dart';

part 'profile_and_goals_extra_cases.dart';

class _ScriptedPlatform implements ReminderNotificationPlatform {
  _ScriptedPlatform({
    this.permission = NotificationPermissionState.granted,
    this.afterRequest = NotificationPermissionState.granted,
  });

  NotificationPermissionState permission;
  NotificationPermissionState afterRequest;
  String? launchTarget;
  final List<
    ({String accountId, bool enabled, String time, String? completedDate})
  >
  synced = [];
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
    String? completedDate,
  }) async {
    synced.add((
      accountId: accountId,
      enabled: enabled,
      time: localTime,
      completedDate: completedDate,
    ));
  }

  @override
  Future<void> cancelForAccount(String accountId) async {
    cancelledAccounts.add(accountId);
  }

  @override
  Future<String?> consumeLaunchTarget() async {
    final target = launchTarget;
    launchTarget = null;
    return target;
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

Future<SessionController> _bootSession(_InterceptingApi api) async {
  final session = SessionController(api);
  await session.initialize();
  return session;
}

Future<void> tapGoalChip(WidgetTester tester, Key key) async {
  final chip = find.byKey(key);
  await tester.scrollUntilVisible(
    chip,
    120,
    scrollable: find.byType(Scrollable).last,
  );
  await tester.tap(chip);
  await tester.pumpAndSettle();
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));


  testWidgets(
    'Unassessed profile hides empty KPI strip, shows dark assessment CTA, allows avatar updates, and renders inline Settings & Account card without extra page',
    (tester) async {
      final api = _InterceptingApi(
        completed: false,
        provider: 'GOOGLE',
        reminderEnabled: false,
      );
      final session = await _bootSession(api);
      final platform = _ScriptedPlatform(
        permission: NotificationPermissionState.denied,
      );

      await tester.pumpWidget(
        MaterialApp(
          home: ProfilePage(
            session: session,
            reminderPlatform: platform,
            onPickAvatarImage: () async => 'https://cdn.example.com/anna.jpg',
          ),
        ),
      );
      await tester.pumpAndSettle();

      // KPI strip hidden when stats are null, and no separate settings icon/page
      expect(find.byKey(const Key('profileStatsStrip')), findsNothing);
      expect(find.byKey(const Key('openProfileSettingsButton')), findsNothing);
      expect(find.byKey(const Key('openProfileSettingsCard')), findsNothing);

      expect(find.text('Chưa có kết quả đầu vào'), findsOneWidget);
      expect(find.text('Kiểm tra đầu vào'), findsOneWidget);
      expect(find.byType(CefrRoadChart), findsOneWidget);
      for (final lvl in allCefrLevels) {
        expect(
          find.descendant(
            of: find.byType(CefrRoadChart),
            matching: find.text(lvl),
          ),
          findsOneWidget,
        );
      }
      expect(find.text('Mục tiêu'), findsOneWidget);
      expect(find.text('Đầu vào'), findsNothing);
      final ctaBtn = tester.widget<ElevatedButton>(
        find.byKey(const Key('startPlacementButton')),
      );
      expect(
        ctaBtn.style?.backgroundColor?.resolve({}),
        const Color(0xFF1A2029),
      );
      expect(find.text('Theo kỹ năng'), findsOneWidget);
      expect(find.text('Chưa đánh giá'), findsNWidgets(4));
      expect(find.byKey(const Key('retakePlacementButton')), findsNothing);
      for (final kind in ['READING', 'LISTENING', 'GRAMMAR', 'VOCABULARY']) {
        final iconBox = tester.widget<Container>(
          find.byKey(ValueKey('skillIconBox-$kind')),
        );
        expect(
          (iconBox.decoration as BoxDecoration).color,
          ProfilePalette.skillRowInactiveIconBg,
        );
      }
      expect(find.text('anna@example.com'), findsOneWidget);
      expect(find.byKey(const Key('profileProviderIcon')), findsOneWidget);
      expect(find.text('Google'), findsNothing);
      expect(find.text('Đăng nhập qua Google'), findsNothing);
      expect(find.text('Đổi mật khẩu'), findsNothing);
      expect(find.text('Đặt lại mật khẩu'), findsNothing);
      expect(find.text('Đặt lại mật khẩu qua email'), findsNothing);

      // Intentional Reminder OFF inline on Profile must NOT show OS permission prompt
      expect(find.byKey(const Key('notificationPermissionBox')), findsNothing);
      expect(find.byKey(const Key('reminderTimeRow')), findsNothing);
      expect(find.text('Đang tắt'), findsOneWidget);

      // Tapping avatar badge updates user avatarUrl quietly without top toast box
      await tester.ensureVisible(find.byKey(const Key('changeAvatarButton')));
      await tester.tap(find.byKey(const Key('changeAvatarButton')));
      await tester.pumpAndSettle();
      expect(api.avatarUrl, 'https://cdn.example.com/anna.jpg');
      expect(session.user?['avatarUrl'], 'https://cdn.example.com/anna.jpg');
      expect(find.byKey(const Key('profileSuccessToast')), findsNothing);
      expect(find.text('Đã cập nhật ảnh đại diện'), findsNothing);

      // Enabling reminder while OS permission is denied shows explicit permission box inline and allows granting
      final grantedPlatform = _ScriptedPlatform(
        permission: NotificationPermissionState.denied,
        afterRequest: NotificationPermissionState.granted,
      );
      await tester.pumpWidget(
        MaterialApp(
          key: const ValueKey('granted-profile-app'),
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
      expect(find.text('Chưa có quyền thông báo'), findsOneWidget);
      expect(find.text('Bật quyền thông báo'), findsOneWidget);
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
    'Failed avatar update shows floating SnackBar instead of top toast box',
    (tester) async {
      final api = _InterceptingApi(completed: true, provider: 'GOOGLE');
      final session = await _bootSession(api);

      await tester.pumpWidget(
        MaterialApp(
          home: ProfilePage(
            session: session,
            onPickAvatarImage: () async =>
                throw const ApiFailure('Không thể tải ảnh đại diện.'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.ensureVisible(find.byKey(const Key('changeAvatarButton')));
      await tester.tap(find.byKey(const Key('changeAvatarButton')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('profileSuccessToast')), findsNothing);
      expect(find.byType(SnackBar), findsOneWidget);
      expect(find.text('Không thể tải ảnh đại diện.'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Narrow 320px viewport keeps inline Google icon beside email, renders KPI strip when provided, stacks skills cleanly, and keeps >= 48px touch targets including inline settings',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final api = _InterceptingApi(
        completed: true,
        provider: 'GOOGLE',
        displayName: 'Anna Nguyễn Minh',
        readingLevel: {'cefrLevel': 'B1', 'source': 'ADAPTIVE'},
      );
      final session = await _bootSession(api);

      await tester.pumpWidget(
        MaterialApp(
          home: ProfilePage(
            session: session,
            rememberedWords: 42,
            completedLessonCount: 9,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('profileStatsStrip')), findsOneWidget);
      expect(find.text('42'), findsOneWidget);
      expect(find.text('9'), findsOneWidget);
      expect(find.text('15p'), findsOneWidget);
      expect(find.text('Anna Nguyễn Minh'), findsOneWidget);
      expect(find.byType(Dialog), findsNothing);
      expect(find.text('anna@example.com'), findsOneWidget);
      expect(find.byKey(const Key('profileProviderIcon')), findsOneWidget);
      final iconRect = tester.getRect(
        find.byKey(const Key('profileProviderIcon')),
      );
      final emailRect = tester.getRect(find.text('anna@example.com'));
      expect(iconRect.right, lessThanOrEqualTo(emailRect.left));
      expect(find.text('Đầu vào'), findsOneWidget);
      expect(find.text('Mục tiêu'), findsOneWidget);
      expect(find.text('Xem kết quả'), findsOneWidget);
      expect(find.text('Theo kỹ năng'), findsOneWidget);
      expect(find.text('Cập nhật từ bài học'), findsOneWidget);
      expect(find.text('Từ kết quả đầu vào'), findsNWidgets(3));
      expect(find.text('Đánh giá lại'), findsOneWidget);
      expect(find.text('Chỉnh sửa'), findsOneWidget);
      expect(find.text('Công việc'), findsOneWidget);
      expect(find.text('15 phút/ngày'), findsOneWidget);
      expect(find.text('Đọc hiểu'), findsNWidgets(2));
      expect(find.text('Ngữ pháp'), findsNWidgets(2));
      expect(find.text('Từ vựng'), findsNWidgets(2));

      final readRect = tester.getRect(
        find.byKey(const ValueKey('skillTile-READING')),
      );
      final listenRect = tester.getRect(
        find.byKey(const ValueKey('skillTile-LISTENING')),
      );
      final gramRect = tester.getRect(
        find.byKey(const ValueKey('skillTile-GRAMMAR')),
      );
      final vocabRect = tester.getRect(
        find.byKey(const ValueKey('skillTile-VOCABULARY')),
      );
      expect(readRect.width, equals(listenRect.width));
      expect(gramRect.width, equals(vocabRect.width));
      expect(readRect.height, greaterThanOrEqualTo(49));
      expect(readRect.top, lessThan(listenRect.top));
      expect(listenRect.top, lessThan(gramRect.top));
      expect(gramRect.top, lessThan(vocabRect.top));

      for (final key in [
        const Key('changeAvatarButton'),
        const Key('editIdentityButton'),
        const Key('viewPlacementResultButton'),
        const Key('retakePlacementButton'),
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
        expect(
          tester.getSize(find.byKey(key)).height,
          greaterThanOrEqualTo(48),
        );
      }
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'Standard width (>= 340px) renders Figma Theo kỹ năng vertical list with retake button and pill logout button',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final api = _InterceptingApi(
        completed: true,
        readingLevel: {'cefrLevel': 'B1', 'source': 'ADAPTIVE'},
      );
      final session = await _bootSession(api);

      await tester.pumpWidget(MaterialApp(home: ProfilePage(session: session)));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('cefrOverviewCard')), findsOneWidget);
      expect(
        find.descendant(
          of: find.byKey(const Key('cefrOverviewCard')),
          matching: find.byKey(const Key('profileSkillsCard')),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byKey(const Key('cefrOverviewCard')),
          matching: find.byType(Divider),
        ),
        findsNothing,
      );
      expect(find.text('Theo kỹ năng'), findsOneWidget);
      expect(find.text('Cập nhật từ bài học'), findsOneWidget);
      expect(find.text('Từ kết quả đầu vào'), findsNWidgets(3));
      expect(find.byKey(const Key('retakePlacementButton')), findsOneWidget);
      for (final kind in ['READING', 'LISTENING', 'GRAMMAR', 'VOCABULARY']) {
        final iconBox = tester.widget<Container>(
          find.byKey(ValueKey('skillIconBox-$kind')),
        );
        expect(
          (iconBox.decoration as BoxDecoration).color,
          ProfilePalette.skillRowAdaptiveBg,
        );
      }

      final readRect = tester.getRect(
        find.byKey(const ValueKey('skillTile-READING')),
      );
      final listenRect = tester.getRect(
        find.byKey(const ValueKey('skillTile-LISTENING')),
      );
      final gramRect = tester.getRect(
        find.byKey(const ValueKey('skillTile-GRAMMAR')),
      );
      final vocabRect = tester.getRect(
        find.byKey(const ValueKey('skillTile-VOCABULARY')),
      );
      expect(readRect.width, equals(listenRect.width));
      expect(readRect.top, lessThan(listenRect.top));
      expect(listenRect.top, lessThan(gramRect.top));
      expect(gramRect.top, lessThan(vocabRect.top));

      // Verify Figma pill shape on logoutButton
      final logoutMaterial = tester.widget<Material>(
        find.ancestor(
          of: find.byKey(const Key('logoutButton')),
          matching: find.byType(Material),
        ).first,
      );
      expect(logoutMaterial.shape, isA<StadiumBorder>());

      // Verify distinct CEFR pillar palettes and balanced 2x2 priority skills grid in Goals Summary
      final palettes = allPreferredLearningKinds
          .map((k) => skillPillarPalette(k).accent)
          .toSet();
      expect(palettes.length, 6);
      expect(find.text('Kỹ năng ưu tiên'), findsOneWidget);
      expect(find.text('3/6 đã chọn'), findsOneWidget);
      final goalGramRect = tester.getRect(
        find.byKey(const ValueKey('goalSkillBadge-GRAMMAR')),
      );
      final goalVocabRect = tester.getRect(
        find.byKey(const ValueKey('goalSkillBadge-VOCABULARY')),
      );
      expect(goalGramRect.top, equals(goalVocabRect.top));

      // Verify retaking placement from Profile opens QuestionPage and backing out mid-retake keeps user on Profile
      await tester.ensureVisible(find.byKey(const Key('retakePlacementButton')));
      await tester.tap(find.byKey(const Key('retakePlacementButton')));
      await tester.pumpAndSettle();
      expect(find.text('Phần 1 · Đọc'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Hồ sơ của tôi'), findsOneWidget);
      expect(session.hasCompletedPlacement, isTrue);
      expect(session.placementCefr, 'B1');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'CEFR road chart supports identical input and target levels cleanly at 320px width',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Padding(
              padding: EdgeInsets.all(16),
              child: CefrRoadChart(
                hasPlacement: true,
                inputLevel: 'B1',
                targetLevel: 'B1',
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('cefrPlacementSummary')), findsOneWidget);
      expect(find.byKey(const Key('cefrTargetSummary')), findsOneWidget);
      expect(find.text('Đầu vào'), findsOneWidget);
      expect(find.text('Mục tiêu'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  _registerProfileAndGoalsExtraTests();

  testWidgets(
    'FontManifest registers Be Vietnam Pro ExtraBold (800) without legacy fonts, and both themes apply Be Vietnam Pro to textTheme',
    (_) async {
      final rawManifest = await rootBundle.loadString('FontManifest.json');
      expect(rawManifest, isNot(contains('Hanken')));
      expect(rawManifest, isNot(contains('Madimi')));
      expect(rawManifest.toLowerCase(), isNot(contains('hanken')));
      expect(rawManifest.toLowerCase(), isNot(contains('madimi')));

      final manifest = (jsonDecode(rawManifest) as List<dynamic>)
          .cast<Map<String, dynamic>>();
      final beVietnamFamily = manifest.firstWhere(
        (entry) => entry['family'] == 'Be Vietnam Pro',
      );
      final fonts = (beVietnamFamily['fonts'] as List<dynamic>)
          .cast<Map<String, dynamic>>();
      expect(
        fonts.any(
          (font) =>
              font['asset'] == 'assets/fonts/BeVietnamPro-ExtraBold.ttf' &&
              font['weight'] == 800,
        ),
        isTrue,
      );

      expect(
        AppTheme.lightTheme.textTheme.bodyMedium?.fontFamily,
        'Be Vietnam Pro',
      );
      expect(
        AppTheme.darkTheme.textTheme.bodyMedium?.fontFamily,
        'Be Vietnam Pro',
      );
    },
  );
}
