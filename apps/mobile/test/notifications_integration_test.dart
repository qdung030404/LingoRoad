import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/learning/activity_collector.dart';
import 'package:mobile/features/learning/daily_learning.dart';
import 'package:mobile/features/learning/daily_pages.dart';
import 'package:mobile/features/learning/home_cache.dart';
import 'package:mobile/features/learning/home_dashboard.dart';
import 'package:mobile/features/learning/learning_controller.dart';
import 'package:mobile/features/learning/learning_preview.dart';
import 'package:mobile/features/learning/learning_repository.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/learning/word_library.dart';
import 'package:mobile/features/notifications/notification_models.dart';
import 'package:mobile/features/notifications/notifications_page.dart';
import 'package:mobile/features/profile/reminder_coordinator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'test_helpers.dart';

class _RecordingReminderPlatform extends SharedPrefsReminderPlatform {
  _RecordingReminderPlatform({super.initialLaunchTarget});

  final List<
    ({String accountId, bool enabled, String localTime, String? completedDate})
  >
  syncedCalls = [];

  void setPendingTarget(String? target) {
    _customPending = target;
  }

  String? _customPending;

  @override
  Future<void> syncSchedule({
    required String accountId,
    required bool enabled,
    required String localTime,
    String? completedDate,
  }) async {
    syncedCalls.add((
      accountId: accountId,
      enabled: enabled,
      localTime: localTime,
      completedDate: completedDate,
    ));
    await super.syncSchedule(
      accountId: accountId,
      enabled: enabled,
      localTime: localTime,
      completedDate: completedDate,
    );
  }

  @override
  Future<String?> consumeLaunchTarget() async {
    if (_customPending != null) {
      final value = _customPending;
      _customPending = null;
      return value;
    }
    return super.consumeLaunchTarget();
  }
}

class _NotificationFakeApi extends FakeApi {
  _NotificationFakeApi({
    this.unreadCount = 3,
    this.goalMet = false,
    this.goalJustMet = false,
  }) : super(signedIn: true, completed: true);

  int unreadCount;
  bool goalMet;
  bool goalJustMet;

  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Duration? receiveTimeout,
  }) async {
    final today = homeLearningDate();
    if (method == 'GET' && path == '/learning/home') {
      return {
        'date': today,
        'planStatus': 'ready',
        'unreadNotificationCount': unreadCount,
        'preferences': {
          'learningPurpose': 'WORK',
          'targetCefr': 'B1',
          'dailyGoalMinutes': 10,
          'preferredKinds': ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'],
          'version': 1,
        },
        'plan': {
          'id': 'plan-1',
          'date': today,
          'timeZone': 'Asia/Ho_Chi_Minh',
          'version': 1,
          'policyVersion': 'baseline-v1',
          'dailyGoalMinutes': 10,
          'estimatedMinutes': 10,
          'completedCount': 0,
          'totalCount': 1,
          'items': [
            {
              'lessonId': 'lesson-1',
              'kind': 'READING',
              'title': 'Daily Reading',
              'estimatedMinutes': 10,
              'completed': false,
              'reasonCode': 'NEW',
              'reason': 'Bài mới',
            },
          ],
          'continueLessonId': 'lesson-1',
          'continueAttemptId': null,
        },
        'today': {
          'date': today,
          'dailyGoalMinutes': 10,
          'activeSeconds': goalMet ? 600 : 120,
          'goalMet': goalMet,
          'completedLessonCount': 0,
          'completedAttemptCount': 0,
          'hasActivity': true,
          'timeMeasured': true,
        },
        'days': [
          for (var i = 0; i < 7; i++)
            {
              'date': today,
              'dailyGoalMinutes': 10,
              'activeSeconds': i == 6 && goalMet ? 600 : 0,
              'goalMet': i == 6 && goalMet,
              'completedLessonCount': 0,
              'completedAttemptCount': 0,
              'hasActivity': i == 6,
              'timeMeasured': true,
            },
        ],
        'totals': {'completedLessonCount': 1, 'activeSeconds': 600},
        'continueLesson': null,
      };
    }
    if (method == 'GET' && path.startsWith('/notifications')) {
      return {
        'items': [
          {
            'id': 'n-1',
            'type': 'DAILY_PLAN_READY',
            'title': 'Lộ trình hôm nay đã sẵn sàng',
            'body': 'Bạn có 1 bài học đang chờ.',
            'targetType': 'DAILY_PLAN',
            'targetPayload': {'date': today},
            'readAt': null,
            'createdAt': DateTime.now().toUtc().toIso8601String(),
          },
        ],
        'nextCursor': null,
        'unreadCount': unreadCount,
      };
    }
    if (method == 'PATCH' && path == '/notifications/n-1/read') {
      unreadCount = unreadCount > 0 ? unreadCount - 1 : 0;
      return {
        'item': {
          'id': 'n-1',
          'type': 'DAILY_PLAN_READY',
          'title': 'Lộ trình hôm nay đã sẵn sàng',
          'body': 'Bạn có 1 bài học đang chờ.',
          'targetType': 'DAILY_PLAN',
          'targetPayload': {'date': today},
          'readAt': DateTime.now().toUtc().toIso8601String(),
          'createdAt': DateTime.now().toUtc().toIso8601String(),
        },
        'unreadCount': unreadCount,
      };
    }
    if (method == 'GET' && path.startsWith('/vocabulary/summary')) {
      return {
        'totals': {'totalWords': 0, 'rememberedWords': 0, 'needsReviewWords': 0},
        'decks': <Json>[],
      };
    }
    if (method == 'POST' && path.contains('/segments')) {
      final segs = (data?['segments'] as List? ?? const []);
      return {
        'acks': [
          for (final s in segs)
            {'seq': (s as Map)['seq'], 'startAt': null, 'endAt': null},
        ],
        'serverNow': DateTime.now().toUtc().toIso8601String(),
        'goalJustMet': goalJustMet,
      };
    }
    return super.request(
      method,
      path,
      data: data,
      auth: auth,
      receiveTimeout: receiveTimeout,
    );
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets(
    'HomeDashboard bell button invokes onNotifications instead of onReview and renders unread badge including 9+ cap',
    (tester) async {
      var reviewCalls = 0;
      var notifCalls = 0;
      final model = PreviewModel();
      final library = WordLibrary();

      Widget buildHome(int unread) => MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: HomeDashboard(
            model: model,
            library: library,
            onProfile: () {},
            onLesson: () {},
            onGrammar: () {},
            onWords: () {},
            onReview: () => reviewCalls++,
            onNotifications: () => notifCalls++,
            unreadNotificationCount: unread,
            onDeck: (_) {},
          ),
        ),
      );

      await tester.pumpWidget(buildHome(0));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('homeNotificationButton')), findsOneWidget);
      expect(find.byKey(const Key('homeNotificationBadge')), findsNothing);

      await tester.tap(find.byKey(const Key('homeNotificationButton')));
      await tester.pumpAndSettle();
      expect(notifCalls, 1);
      expect(reviewCalls, 0);

      await tester.pumpWidget(buildHome(3));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('homeNotificationBadge')), findsOneWidget);
      expect(find.text('3'), findsOneWidget);

      await tester.pumpWidget(buildHome(12));
      await tester.pumpAndSettle();
      expect(find.text('9+'), findsOneWidget);

      model.dispose();
      library.dispose();
    },
  );

  testWidgets(
    'LearningPreview preview mode opens NotificationsPage from Home bell and navigates on tap',
    (tester) async {
      final model = PreviewModel();
      final platform = _RecordingReminderPlatform();

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningPreview(model: model, reminderPlatform: platform),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('homeNotificationBadge')), findsOneWidget);
      await tester.tap(find.byKey(const Key('homeNotificationButton')));
      await tester.pumpAndSettle();

      expect(find.byType(NotificationsPage), findsOneWidget);
      expect(
        find.byKey(const Key('notificationItem_preview-daily-plan')),
        findsOneWidget,
      );

      await tester.tap(
        find.byKey(const Key('notificationItem_preview-daily-plan')),
      );
      await tester.pumpAndSettle();

      expect(find.byType(WeeklyPlanPage), findsOneWidget);
      model.dispose();
    },
  );

  testWidgets(
    'LearningPreview syncs unreadNotificationCount, Tier 3 Smart Suppression completedDate, and OS launch deep-link',
    (tester) async {
      final api = _NotificationFakeApi(unreadCount: 4, goalMet: true);
      final session = SessionController(api);
      await session.initialize();
      final platform = _RecordingReminderPlatform(
        initialLaunchTarget: 'DAILY_PLAN',
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningPreview(account: session, reminderPlatform: platform),
        ),
      );
      await tester.pumpAndSettle();

      // OS launch target DAILY_PLAN auto-opens DailyPlanPage.
      expect(find.byType(DailyPlanPage), findsOneWidget);

      // Smart Suppression synced completedDate for today.
      expect(
        platform.syncedCalls.any((c) => c.completedDate == homeLearningDate()),
        isTrue,
      );

      // Navigate back to HomeDashboard and confirm unread badge = 4.
      Navigator.of(tester.element(find.byType(DailyPlanPage))).pop();
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('homeNotificationBadge')), findsOneWidget);
      expect(find.text('4'), findsOneWidget);

      // Tapping bell opens authenticated NotificationsPage and decrements badge when read.
      await tester.tap(find.byKey(const Key('homeNotificationButton')));
      await tester.pumpAndSettle();
      expect(find.byType(NotificationsPage), findsOneWidget);
      await tester.tap(find.byKey(const Key('notificationItem_n-1')));
      await tester.pumpAndSettle();
      expect(find.byType(DailyPlanPage), findsOneWidget);

      session.dispose();
    },
  );

  test('ActivityOutbox fires onGoalJustMet when segments returns goalJustMet=true', () async {
    final api = _NotificationFakeApi(goalJustMet: true);
    final daily = DailyLearningController(
      repository: ApiDailyRepository(api),
      accountId: 'user-1',
      isCurrent: () => true,
    );
    var goalMetFired = 0;
    final outbox = ActivityOutbox(
      owner: daily,
      onGoalJustMet: () => goalMetFired++,
    );
    await outbox.add({
      'sessionId': 'sess-1',
      'seq': 0,
      'startOffsetMs': 0,
      'endOffsetMs': 5000,
    });
    await outbox.flush();
    expect(goalMetFired, 1);
    daily.dispose();
  });

  test('LearningAttemptController triggers owner.onLevelChanged on submit with levelChange', () async {
    final repo = _LevelChangeLearningRepo();
    Json? receivedChange;
    final owner = LearningController(
      repository: repo,
      accountId: 'user-1',
      onLevelChanged: (_, change) => receivedChange = change,
    );
    final attemptController = LearningAttemptController(owner: owner);
    await attemptController.load(lessonId: 'l-1');
    await attemptController.submit();
    expect(receivedChange, isNotNull);
    expect(receivedChange!['to'], 'B1');
    expect(
      AppNotificationType.fromApi('SKILL_LEVEL_CHANGED'),
      AppNotificationType.skillLevelChanged,
    );
    attemptController.dispose();
    owner.dispose();
  });
}

class _LevelChangeLearningRepo implements LearningRepository {
  @override
  Future<LearningAttempt> start(String lessonId) async => LearningAttempt({
    'id': 'att-1',
    'version': 1,
    'status': 'IN_PROGRESS',
    'lesson': {
      'id': lessonId,
      'kind': 'READING',
      'title': 'Reading 1',
      'description': '',
      'estimatedMinutes': 5,
    },
    'position': {'phase': 'QUIZ', 'index': 0},
    'content': {'steps': <Json>[]},
    'questions': [
      {
        'id': 'q1',
        'prompt': 'P?',
        'options': [
          {'id': 'a', 'text': 'A'},
        ],
      },
    ],
    'answers': [
      {'questionId': 'q1', 'optionId': 'a', 'checked': true, 'isCorrect': true},
    ],
  });

  @override
  Future<LearningAttempt> submit(String id, int version) async =>
      LearningAttempt({
        'id': id,
        'version': version + 1,
        'status': 'COMPLETED',
        'lesson': {
          'id': 'l-1',
          'kind': 'READING',
          'title': 'Reading 1',
          'description': '',
          'estimatedMinutes': 5,
        },
        'position': {'phase': 'QUIZ', 'index': 0},
        'content': {'steps': <Json>[]},
        'questions': <Json>[],
        'answers': <Json>[],
        'levelChange': {
          'kind': 'READING',
          'from': 'A2',
          'to': 'B1',
          'direction': 'UP',
        },
      });

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
