import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/features/learning/activity_clock.dart';
import 'package:mobile/features/learning/activity_collector.dart';
import 'package:mobile/features/learning/daily_learning.dart';
import 'package:mobile/features/learning/daily_pages.dart';
import 'package:mobile/features/learning/learning_controller.dart';
import 'package:mobile/features/learning/learning_repository.dart';
import 'test_helpers.dart';

class TestClock implements ActivityClock {
  int value = 0;
  @override
  Future<int> milliseconds() async => value;
}

class TestDailyRepository implements DailyRepository {
  int? conflictSeq;
  int goal = 10, version = 0;
  List<String> savedKinds = ['READING'];
  bool offline = false, expired = false, partialAck = false;
  final received = <String, List<Json>>{};
  final runs = <String>[];
  @override
  Future<Json> openActivity(String id, String run) async {
    if (offline) throw const ApiFailure('Offline');
    runs.add(run);
    return {
      'sessionId': run,
      'anchorAt': '2026-11-02T00:00:00Z',
      'serverNow': '2026-11-02T00:00:00Z',
      'collectUntil': '2026-11-03T00:00:00Z',
      'uploadUntil': '2026-11-09T00:00:00Z',
    };
  }

  @override
  Future<Json> sendSegments(String id, List<Json> segments) async {
    if (segments.any((row) => row['seq'] == conflictSeq)) {
      throw const ApiFailure('Conflict', status: 409);
    }
    if (offline) throw const ApiFailure('Offline');
    if (expired) {
      throw const ApiFailure(
        'Expired',
        code: 'LEARNING_ACTIVITY_UPLOAD_EXPIRED',
        status: 410,
      );
    }
    received.putIfAbsent(id, () => []).addAll(segments);
    return {
      'acks': [
        for (final row in partialAck ? segments.take(1) : segments)
          {'seq': row['seq']},
      ],
    };
  }

  @override
  Future<Json> ensurePlan() async => {'plan': null};
  @override
  Future<Json> preferences() async => {
    'version': version,
    'dailyGoalMinutes': goal,
    'preferredKinds': ['READING'],
  };
  @override
  Future<Json> progress() async => {
    'today': {'activeSeconds': 0, 'goalMet': false},
    'days': [],
    'totals': {},
  };
  @override
  Future<Json> savePreferences(Json body) async {
    goal = body['dailyGoalMinutes'] as int;
    savedKinds = (body['preferredKinds'] as List).cast<String>();
    version++;
    return body;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  test(
    'one conflicted receipt cannot quarantine valid receipts in its batch',
    () async {
      final repo = TestDailyRepository()..conflictSeq = 1;
      final owner = DailyLearningController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final box = ActivityOutbox(owner: owner);
      await box.add({
        'sessionId': 's',
        'seq': 1,
        'startOffsetMs': 0,
        'endOffsetMs': 1000,
      });
      await box.add({
        'sessionId': 's',
        'seq': 2,
        'startOffsetMs': 1000,
        'endOffsetMs': 2000,
      });
      await box.flush();
      expect(box.entries.single['seq'], 1);
      expect(box.entries.single['rejected'], true);
      expect(repo.received['s']!.single['seq'], 2);
      owner.dispose();
    },
  );
  test(
    'saved goal refreshes shared profile cache and stale account never sends receipts',
    () async {
      final repo = TestDailyRepository();
      bool current = true;
      int? cached;
      final daily = DailyLearningController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => current,
        onPreferences: (p) => cached = p['dailyGoalMinutes'] as int,
      );
      await daily.refresh();
      await daily.save(20, ['READING']);
      expect(cached, 20);
      final box = ActivityOutbox(owner: daily);
      await box.add({
        'sessionId': 's',
        'seq': 0,
        'startOffsetMs': 0,
        'endOffsetMs': 5000,
      });
      current = false;
      await box.flush();
      expect(repo.received, isEmpty);
      expect(box.pendingSeconds, 5);
      daily.dispose();
    },
  );
  testWidgets(
    'confirmed seconds and task completion stay separate from minute goal',
    (tester) async {
      final repo = TestDailyRepository();
      final daily =
          DailyLearningController(
              repository: repo,
              accountId: 'a',
              isCurrent: () => true,
            )
            ..progress = {
              'today': {
                'activeSeconds': 15,
                'dailyGoalMinutes': 5,
                'goalMet': false,
              },
            }
            ..plan = {
              'completedCount': 1,
              'totalCount': 1,
              'estimatedMinutes': 5,
              'items': [],
            };
      final learning = LearningController(
        repository: ApiLearningRepository(FakeApi()),
        accountId: 'a',
        daily: daily,
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: SingleChildScrollView(
              child: DailyPlanCard(learning: learning),
            ),
          ),
        ),
      );
      expect(find.textContaining('0 phút 15 giây / 5 phút'), findsOneWidget);
      expect(find.textContaining('1/1 bài kế hoạch'), findsOneWidget);
      expect(find.byKey(const Key('dailyGoalMet')), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      learning.dispose();
      daily.dispose();
    },
  );
  testWidgets(
    'Home timeline DailyPlanCard renders completed, active and SRS due steps cleanly on narrow screen',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final repo = TestDailyRepository();
      final daily =
          DailyLearningController(
              repository: repo,
              accountId: 'a',
              isCurrent: () => true,
            )
            ..preferences = {
              'version': 1,
              'dailyGoalMinutes': 15,
              'preferredKinds': ['GRAMMAR', 'LISTENING'],
            }
            ..progress = {
              'today': {
                'activeSeconds': 300,
                'dailyGoalMinutes': 15,
                'goalMet': false,
              },
            }
            ..plan = {
              'completedCount': 1,
              'totalCount': 2,
              'estimatedMinutes': 15,
              'items': [
                {
                  'id': 'p1',
                  'lessonId': 'lesson-grammar-1',
                  'title': 'Subject pronouns & to be',
                  'kind': 'GRAMMAR',
                  'estimatedMinutes': 10,
                  'reasonCode': 'COMPLETED_TODAY',
                  'reason': 'Đã hoàn thành hôm nay',
                  'completed': true,
                  'completedAttemptId': 'att-1',
                },
                {
                  'id': 'p2',
                  'lessonId': 'lesson-listening-1',
                  'title': 'Greetings and Introductions',
                  'kind': 'LISTENING',
                  'estimatedMinutes': 5,
                  'reasonCode': 'NEW',
                  'reason': 'Bài mới',
                  'completed': false,
                },
              ],
            };
      final learning = LearningController(
        repository: ApiLearningRepository(FakeApi()),
        accountId: 'a',
        daily: daily,
      );
      var tappedReview = false;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: SingleChildScrollView(
              child: DailyPlanCard(
                learning: learning,
                showActivitySummary: false,
                defaultCefrLevel: 'A1',
                onReviewVocabulary: () => tappedReview = true,
              ),
            ),
          ),
        ),
      );
      expect(find.text('Lộ trình trong ngày'), findsOneWidget);
      expect(find.text('Điều chỉnh'), findsOneWidget);
      expect(find.byKey(const Key('dailyHomeMinutesStrip')), findsNothing);
      expect(find.text('Subject pronouns & to be'), findsOneWidget);
      expect(find.text('Ngữ pháp · Đã hoàn thành'), findsOneWidget);
      expect(find.text('TIẾP THEO · 5 PHÚT'), findsOneWidget);
      expect(find.text('Nghe A1'), findsOneWidget);
      expect(find.text('Greetings and Introductions'), findsOneWidget);
      expect(find.text('Bắt đầu bài này'), findsOneWidget);
      expect(find.byKey(const Key('dailyActiveMinutes')), findsNothing);
      expect(tappedReview, isFalse);
      expect(tester.takeException(), isNull);

      // Tap 'Điều chỉnh' opens ranked 1->6 priority Bottom Sheet (clean, no preview box or duration picker)
      await tester.tap(find.byKey(const Key('dailyPreferences')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('dailyPreferencesSheet')), findsOneWidget);
      expect(find.text('Điều chỉnh lộ trình ngày'), findsOneWidget);
      expect(find.text('Thời lượng mỗi ngày'), findsNothing);
      expect(find.byKey(const Key('dailyKindOrderPreview')), findsNothing);
      expect(find.text('Đã chọn 2/6'), findsOneWidget);
      expect(find.text('Viết'), findsOneWidget);
      expect(tester.takeException(), isNull);

      // Reset order and tap Đọc (#1) -> Nghe (#2) -> Nói (#3) -> Viết (#4)
      Future<void> tapSheetItem(Key key) async {
        final target = find.byKey(key);
        await tester.ensureVisible(target);
        await tester.pumpAndSettle();
        await tester.tap(target);
        await tester.pumpAndSettle();
      }

      await tapSheetItem(const Key('dailyResetKindOrder'));
      await tapSheetItem(const ValueKey('daily-kind-READING'));
      await tapSheetItem(const ValueKey('daily-kind-LISTENING'));
      await tapSheetItem(const ValueKey('daily-kind-SPEAKING'));
      await tapSheetItem(const ValueKey('daily-kind-WRITING'));
      expect(find.text('Đã chọn 4/6'), findsOneWidget);

      await tester.tap(find.byKey(const Key('dailySavePreferences')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('dailyPreferencesSheet')), findsNothing);
      expect(repo.savedKinds, ['READING', 'LISTENING', 'SPEAKING', 'WRITING']);
      expect(tester.takeException(), isNull);

      // Verify > 3 timeline steps collapse from 4th onward into faux-skeleton stack and expand/collapse on tap
      daily.plan = {
        'completedCount': 1,
        'totalCount': 5,
        'estimatedMinutes': 35,
        'items': [
          {
            'id': 'p1',
            'lessonId': 'spk-1',
            'title': 'My day',
            'kind': 'SPEAKING',
            'estimatedMinutes': 5,
            'reasonCode': 'COMPLETED_TODAY',
            'reason': 'Đã hoàn thành hôm nay',
            'completed': true,
          },
          {
            'id': 'p2',
            'lessonId': 'gram-1',
            'title': 'Subject pronouns and to be',
            'kind': 'GRAMMAR',
            'estimatedMinutes': 10,
            'reasonCode': 'NEW',
            'reason': 'Bài mới',
            'completed': false,
          },
          {
            'id': 'p3',
            'lessonId': 'vocab-1',
            'title': 'Family and relationships',
            'kind': 'VOCABULARY',
            'estimatedMinutes': 10,
            'reasonCode': 'NEW',
            'reason': 'Bài mới',
            'completed': false,
          },
          {
            'id': 'p4',
            'lessonId': 'read-1',
            'title': 'Ordering Breakfast at Sunny Bakery',
            'kind': 'READING',
            'estimatedMinutes': 5,
            'reasonCode': 'NEW',
            'reason': 'Bài mới',
            'completed': false,
          },
          {
            'id': 'p5',
            'lessonId': 'listen-1',
            'title': 'Checking Tomorrow Timetable',
            'kind': 'LISTENING',
            'estimatedMinutes': 5,
            'reasonCode': 'NEW',
            'reason': 'Bài mới',
            'completed': false,
          },
          {
            'id': 'p6',
            'lessonId': 'wrt-1',
            'title': 'Forgotten Jacket at a Hotel',
            'kind': 'WRITING',
            'cefrLevel': 'A2',
            'estimatedMinutes': 8,
            'reasonCode': 'NEW',
            'reason': 'Thư / Email',
            'completed': false,
          },
        ],
      };
      String? openedWritingId;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: SingleChildScrollView(
              child: DailyPlanCard(
                learning: learning,
                showActivitySummary: false,
                defaultCefrLevel: 'A1',
                onOpenWritingItem: (id) async => openedWritingId = id,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('My day'), findsOneWidget);
      expect(find.text('Subject pronouns and to be'), findsOneWidget);
      expect(find.text('Family and relationships'), findsOneWidget);
      expect(find.text('Ordering Breakfast at Sunny Bakery'), findsNothing);
      expect(find.text('Checking Tomorrow Timetable'), findsNothing);
      expect(find.text('Forgotten Jacket at a Hotel'), findsNothing);
      expect(find.byKey(const Key('dailyExpandSkeleton')), findsOneWidget);
      expect(find.text('Xem thêm 3'), findsOneWidget);
      expect(find.text('+3'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.ensureVisible(find.byKey(const Key('dailyExpandSkeleton')));
      await tester.tap(find.byKey(const Key('dailyExpandSkeleton')));
      await tester.pumpAndSettle();
      expect(find.text('Ordering Breakfast at Sunny Bakery'), findsOneWidget);
      expect(find.text('Checking Tomorrow Timetable'), findsOneWidget);
      expect(find.text('Forgotten Jacket at a Hotel'), findsOneWidget);
      expect(find.textContaining('Luyện viết A2 · Thư / Email'), findsOneWidget);
      await tester.ensureVisible(find.byKey(const ValueKey('daily-plan-wrt-1')));
      await tester.tap(find.byKey(const ValueKey('daily-plan-wrt-1')));
      await tester.pumpAndSettle();
      expect(openedWritingId, 'wrt-1');
      expect(find.byKey(const Key('dailyCollapseSteps')), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.ensureVisible(find.byKey(const Key('dailyCollapseSteps')));
      await tester.tap(find.byKey(const Key('dailyCollapseSteps')));
      await tester.pumpAndSettle();
      expect(find.text('Ordering Breakfast at Sunny Bakery'), findsNothing);
      expect(find.byKey(const Key('dailyExpandSkeleton')), findsOneWidget);
      expect(tester.takeException(), isNull);

      // Verify DailyStudyMinutesStrip (used in Tiến độ học tập card on Home)
      daily.preferences = {
        'version': 2,
        'dailyGoalMinutes': 15,
        'preferredKinds': ['GRAMMAR', 'LISTENING'],
      };
      daily.progress = {
        'today': {
          'activeSeconds': 300,
          'dailyGoalMinutes': 15,
          'goalMet': false,
        },
      };
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: DailyStudyMinutesStrip(daily: daily),
          ),
        ),
      );
      expect(find.byKey(const Key('dailyHomeMinutesStrip')), findsOneWidget);
      expect(find.text('Thời gian học hôm nay'), findsOneWidget);
      expect(find.text('5 / 15 phút'), findsOneWidget);
      expect(find.byKey(const Key('dailyGoalMet')), findsNothing);

      // Sub-minute formatting + goalMet celebration state on 320px width
      daily.progress = {
        'today': {
          'activeSeconds': 45,
          'dailyGoalMinutes': 15,
          'goalMet': false,
        },
      };
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(320, 640),
              textScaler: TextScaler.linear(1.6),
            ),
            child: Scaffold(
              body: DailyStudyMinutesStrip(daily: daily),
            ),
          ),
        ),
      );
      expect(find.text('45 giây / 15 phút'), findsOneWidget);
      expect(tester.takeException(), isNull);

      daily.progress = {
        'today': {
          'activeSeconds': 960,
          'dailyGoalMinutes': 15,
          'goalMet': true,
        },
      };
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: DailyStudyMinutesStrip(daily: daily),
          ),
        ),
      );
      expect(find.byKey(const Key('dailyGoalMet')), findsOneWidget);
      expect(find.text('Đã đạt mục tiêu ngày'), findsOneWidget);
      expect(find.text('16 / 15 phút'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(const SizedBox.shrink());
      learning.dispose();
      daily.dispose();
    },
  );
  test(
    'offline foreground intervals survive recreation and account isolation; background gap is not counted',
    () async {
      final repo = TestDailyRepository();
      final clock = TestClock();
      final owner = DailyLearningController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final box = ActivityOutbox(owner: owner, clock: clock);
      final collector = ActivityCollector(
        outbox: box,
        attemptId: 'attempt',
        isEligible: () => true,
      );
      await collector.start();
      collector.timer?.cancel();
      repo.offline = true;
      for (var i = 1; i <= 10; i++) {
        clock.value = i * 1000;
        await collector.sample();
      }
      await collector.pause();
      expect(box.pendingSeconds, 10);
      clock.value += 120000;
      await collector.resume();
      collector.timer?.cancel();
      for (var i = 0; i < 5; i++) {
        clock.value += 1000;
        await collector.sample();
      }
      await collector.checkpoint();
      expect(box.pendingSeconds, 15);
      final other = ActivityOutbox(
        owner: DailyLearningController(
          repository: repo,
          accountId: 'b',
          isCurrent: () => true,
        ),
      );
      await other.restore();
      expect(other.pendingSeconds, 0);
      final reopened = ActivityOutbox(owner: owner);
      await reopened.restore();
      expect(reopened.pendingSeconds, 15);
      repo.offline = false;
      repo.partialAck = true;
      await reopened.flush();
      expect(reopened.entries, isEmpty);
      expect(
        owner.today['activeSeconds'],
        0,
      ); // Pending telemetry never invents confirmed progress.
      collector.dispose();
      owner.dispose();
    },
  );
  test(
    'idle stops credit; audio progress allows learning; frozen sample gap is discarded',
    () async {
      final repo = TestDailyRepository();
      final clock = TestClock();
      final owner = DailyLearningController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final box = ActivityOutbox(owner: owner, clock: clock);
      final collector = ActivityCollector(
        outbox: box,
        attemptId: 'attempt',
        isEligible: () => true,
      );
      await collector.start();
      collector.timer?.cancel();
      repo.offline = true;
      clock.value = 61000;
      await collector.sample();
      expect(box.pendingSeconds, 0);
      for (var i = 0; i < 5; i++) {
        clock.value += 1000;
        await collector.audioAdvanced();
        await collector.sample();
      }
      expect(box.pendingSeconds, 5);
      collector.audioStopped();
      clock.value += 10000;
      await collector.sample();
      expect(box.pendingSeconds, 5);
      collector.dispose();
      owner.dispose();
    },
  );
  test(
    'large outbox drains every batch and expired records remain explicitly unconfirmed',
    () async {
      final repo = TestDailyRepository();
      final owner = DailyLearningController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final box = ActivityOutbox(owner: owner);
      await box.restore();
      for (var i = 0; i < 205; i++) {
        await box.add({
          'sessionId': 's',
          'seq': i,
          'startOffsetMs': i * 1000,
          'endOffsetMs': (i + 1) * 1000,
        });
      }
      await box.flush();
      expect(box.entries, isEmpty);
      expect(repo.received['s']!.length, 205);
      await box.add({
        'sessionId': 'expired',
        'seq': 0,
        'startOffsetMs': 0,
        'endOffsetMs': 1000,
      });
      repo.expired = true;
      await box.flush();
      expect(box.entries.single['expired'], true);
      expect(box.error, contains('quá hạn'));
      owner.dispose();
    },
  );
  test(
    '24 hour collection expiry requests a new idempotency run and resets its sequence',
    () async {
      final repo = TestDailyRepository();
      final clock = TestClock();
      final owner = DailyLearningController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      final c = ActivityCollector(
        outbox: ActivityOutbox(owner: owner, clock: clock),
        attemptId: 'a',
        isEligible: () => true,
      );
      await c.start();
      c.timer?.cancel();
      clock.value = const Duration(hours: 24).inMilliseconds;
      await c.sample();
      c.timer?.cancel();
      expect(repo.runs.length, 2);
      expect(repo.runs[0], isNot(repo.runs[1]));
      c.dispose();
      owner.dispose();
    },
  );
}
