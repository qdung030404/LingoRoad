import 'dart:async';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/learning/activity_clock.dart';
import 'package:mobile/features/learning/activity_collector.dart';
import 'package:mobile/features/learning/daily_learning.dart';
import 'package:mobile/features/learning/home_cache.dart';
import 'package:mobile/features/learning/learning_controller.dart';
import 'package:mobile/features/learning/learning_pages.dart';
import 'package:mobile/features/learning/learning_repository.dart';
import 'package:mobile/shared/app_button.dart';
import 'package:mobile/shared/figma_widgets.dart';
import 'daily_activity_test.dart' show TestClock, TestDailyRepository;
import 'learning_workflow_test.dart' show MemoryLearningRepository, copy;
import 'listening_practice_test.dart' show FakeListeningEngine;
import 'test_helpers.dart';

class _FakeStopwatch implements Stopwatch {
  int _elapsedUs = 0;
  bool _running = false;

  void advance(Duration delta) {
    if (_running) _elapsedUs += delta.inMicroseconds;
  }

  @override
  Duration get elapsed => Duration(microseconds: _elapsedUs);

  @override
  int get elapsedMilliseconds => _elapsedUs ~/ 1000;

  @override
  int get elapsedMicroseconds => _elapsedUs;

  @override
  int get elapsedTicks => _elapsedUs;

  @override
  int get frequency => 1000000;

  @override
  bool get isRunning => _running;

  @override
  void reset() {
    _elapsedUs = 0;
  }

  @override
  void start() {
    _running = true;
  }

  @override
  void stop() {
    _running = false;
  }
}

class _BlockingDailyRepository extends TestDailyRepository {
  Completer<Json>? nextSendGate;

  @override
  Future<Json> sendSegments(String id, List<Json> segments) async {
    final gate = nextSendGate;
    if (gate != null) {
      nextSendGate = null;
      return gate.future;
    }
    return super.sendSegments(id, segments);
  }
}

class _GoalDailyRepository extends TestDailyRepository {
  bool nextGoalJustMet = false;
  int sendCalls = 0;

  @override
  Future<Json> sendSegments(String id, List<Json> segments) async {
    sendCalls++;
    final res = await super.sendSegments(id, segments);
    return {...res, 'goalJustMet': nextGoalJustMet};
  }
}

class _CountingCatalogueRepository extends MemoryLearningRepository {
  int catalogueCalls = 0;

  @override
  Future<Json> catalogue() async {
    catalogueCalls++;
    return super.catalogue();
  }
}

class _QueuedProgressRepository extends MemoryLearningRepository {
  final List<Completer<void>> progressGates = [];
  bool failNextProgress = false;

  @override
  Future<LearningAttempt> progress(String id, Json body) async {
    final gate = Completer<void>();
    progressGates.add(gate);
    await gate.future;
    if (failNextProgress) {
      failNextProgress = false;
      throw const ApiFailure('Mạng chập chờn');
    }
    return super.progress(id, body);
  }
}

Json _homeSnapshot(String date) => {
  'date': date,
  'planStatus': 'ready',
  'plan': {
    'completedCount': 0,
    'totalCount': 1,
    'estimatedMinutes': 10,
    'items': const <Json>[],
  },
  'continueLesson': null,
  'totals': {'completedLessonCount': 1, 'activeSeconds': 60, 'streakDays': 1},
  'today': {
    'date': date,
    'activeSeconds': 60,
    'dailyGoalMinutes': 10,
    'goalMet': false,
    'completedCount': 0,
  },
  'days': const <Json>[],
  'preferences': {
    'version': 1,
    'dailyGoalMinutes': 10,
    'preferredKinds': const ['READING'],
  },
  'unreadNotificationCount': 0,
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  tearDown(() {
    debugOnRebuildDirtyWidget = null;
  });

  testWidgets(
    'throttles onPointerMove IPC to 500ms, keeps onPointerDown immediate, and skips 1Hz full-page rebuilds',
    (tester) async {
      var clockMs = 10000;
      var clockCalls = 0;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(NativeActivityClock.channel, (call) async {
            if (call.method == 'elapsedRealtimeMilliseconds') {
              clockCalls++;
              return clockMs;
            }
            return null;
          });
      addTearDown(() {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(NativeActivityClock.channel, null);
      });

      final dailyRepo = TestDailyRepository();
      final daily = DailyLearningController(
        repository: dailyRepo,
        accountId: 'alice',
        isCurrent: () => true,
      );
      final learningRepo = MemoryLearningRepository()
        ..state['lesson'] = {
          'id': 'lesson',
          'title': 'Throttled Lesson',
          'kind': 'READING',
        }
        ..state['content'] = {
          'steps': <Json>[],
          'passage': 'Short passage for rebuild test.',
        };
      final owner = LearningController(
        repository: learningRepo,
        accountId: 'alice',
        daily: daily,
      );

      final createdWatches = <_FakeStopwatch>[];
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(
            owner: owner,
            lessonId: 'lesson',
            stopwatchFactory: () {
              final watch = _FakeStopwatch();
              createdWatches.add(watch);
              return watch;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      final moveWatch = createdWatches.first;
      var listViewRebuilds = 0;
      var optionRebuilds = 0;
      debugOnRebuildDirtyWidget = (Element element, bool builtOnce) {
        if (element.widget is ListView) listViewRebuilds++;
        if (element.widget is AnswerOption) optionRebuilds++;
      };

      // 14 seconds of 1Hz ActivityCollector ticks must cause 0 full-page rebuilds.
      for (var i = 0; i < 14; i++) {
        clockMs += 1000;
        await tester.pump(const Duration(seconds: 1));
      }
      expect(listViewRebuilds, 0);
      expect(optionRebuilds, 0);

      // Verify pointer down is immediate and pointer move is throttled at 500ms.
      clockCalls = 0;
      final center = tester.getCenter(find.byType(ListView));
      final gesture = await tester.startGesture(center, kind: PointerDeviceKind.touch);
      await tester.pump();
      expect(clockCalls, 1);

      for (var i = 0; i < 30; i++) {
        moveWatch.advance(const Duration(milliseconds: 15));
        await gesture.moveBy(const Offset(0, -1));
      }
      await tester.pump();
      expect(moveWatch.elapsedMilliseconds, 450);
      expect(clockCalls, 1);

      moveWatch.advance(const Duration(milliseconds: 50));
      await gesture.moveBy(const Offset(0, -1));
      await tester.pump();
      expect(clockCalls, 2);

      await gesture.up();
      await tester.pump();

      // Another pointerDown immediately afterwards still forwards immediately.
      final second = await tester.startGesture(center, kind: PointerDeviceKind.touch);
      await tester.pump();
      expect(clockCalls, 3);
      await second.up();

      expect(listViewRebuilds, 0);
      expect(optionRebuilds, 0);

      await tester.pumpWidget(const SizedBox.shrink());
      owner.dispose();
      daily.dispose();
    },
  );

  testWidgets(
    'audio position ticks update ListeningAudioControls without rebuilding LearningAttemptPage or primary action',
    (tester) async {
      final repo = MemoryLearningRepository();
      (repo.state['lesson'] as Map)['kind'] = 'LISTENING';
      repo.state['content'] = <String, dynamic>{
        'steps': <Json>[],
        'audioUrl': 'test.wav',
      };
      final owner = LearningController(repository: repo, accountId: 'alice');
      final engine = FakeListeningEngine();

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(
            owner: owner,
            lessonId: 'lesson',
            audioEngineFactory: () => engine,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Gate: option selected before audio load keeps primary button disabled.
      await tester.tap(find.byKey(const ValueKey('learning-option-a')));
      await tester.pump();
      expect(
        tester
            .widget<CustomAppButton>(
              find.byKey(const Key('learningPrimaryAction')),
            )
            .onPressed,
        isNull,
      );

      // Load/play audio unlocks primary button.
      await tester.tap(find.byTooltip('Phát audio'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<CustomAppButton>(
              find.byKey(const Key('learningPrimaryAction')),
            )
            .onPressed,
        isNotNull,
      );

      var listViewRebuilds = 0;
      var primaryButtonRebuilds = 0;
      debugOnRebuildDirtyWidget = (Element element, bool builtOnce) {
        if (element.widget is ListView) listViewRebuilds++;
        if (element.widget.key == const Key('learningPrimaryAction')) {
          primaryButtonRebuilds++;
        }
      };

      // Simulate 20 high-frequency audio position events (10Hz over 2 seconds).
      for (var ms = 100; ms <= 2000; ms += 100) {
        engine.positionEvents.add(Duration(milliseconds: ms));
        await tester.pump();
      }

      expect(find.text('0:02'), findsOneWidget);
      expect(listViewRebuilds, 0);
      expect(primaryButtonRebuilds, 0);

      // Primary action still checks answer cleanly.
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();
      expect(find.text('Đúng'), findsOneWidget);
      expect(repo.checks, 1);

      await tester.pumpWidget(const SizedBox.shrink());
      owner.dispose();
    },
  );

  test(
    '15s mid-lesson ActivityOutbox flush keeps HomeCache intact when goalJustMet=false and refreshes when goalJustMet=true',
    () async {
      final api = FakeApi(signedIn: true, completed: true);
      final session = SessionController(api);
      await session.initialize();

      final dailyRepo = _GoalDailyRepository();
      final clock = TestClock();
      var homeCalls = 0;
      var goalJustMetCalls = 0;

      late final LearningController learning;
      final daily = DailyLearningController(
        repository: dailyRepo,
        accountId: 'alice',
        isCurrent: () => true,
        onHomeChanged: () async {
          learning.invalidateHome();
          await learning.refresh();
          await learning.loadCatalogue();
        },
      );

      final learningRepo = _CountingCatalogueRepository();
      learning = LearningController(
        repository: learningRepo,
        accountId: 'alice',
        daily: daily,
        fetchHome: () async {
          homeCalls++;
          return _homeSnapshot(homeLearningDate());
        },
        onHome: session.rememberHome,
        onHomeInvalidated: session.clearHome,
        onGoalJustMet: () => goalJustMetCalls++,
      );

      final homeCache = HomeCache(
        server: api.config.apiBaseUrl,
        project: 'proj',
        uid: 'uid',
      );
      await learning.refresh();
      await learning.loadCatalogue();
      await homeCache.write(_homeSnapshot(homeLearningDate()));
      expect(homeCalls, 1);
      expect(learningRepo.catalogueCalls, 1);
      expect(session.cachedHome, isNotNull);
      expect(await homeCache.read(), isNotNull);

      final outbox = ActivityOutbox(
        owner: daily,
        clock: clock,
        onGoalJustMet: learning.onGoalJustMet,
      );
      final collector = ActivityCollector(
        outbox: outbox,
        attemptId: 'att-1',
        isEligible: () => true,
      );
      await collector.start();
      collector.timer?.cancel();

      // Capture exact tick notifications: ticks 1..4 should emit 0 notifications.
      var collectorNotifications = 0;
      collector.addListener(() => collectorNotifications++);
      for (var i = 1; i <= 4; i++) {
        clock.value = i * 1000;
        await collector.sample();
      }
      expect(collectorNotifications, 0);

      // Advance through tick 15 to trigger periodic 15s flush with goalJustMet=false.
      for (var i = 5; i <= 15; i++) {
        clock.value = i * 1000;
        await collector.sample();
      }
      await Future<void>.delayed(Duration.zero);

      expect(dailyRepo.sendCalls, greaterThan(0));
      expect(homeCalls, 1);
      expect(learningRepo.catalogueCalls, 1);
      expect(goalJustMetCalls, 0);
      expect(session.cachedHome, isNotNull);
      expect(await homeCache.read(), isNotNull);

      // Next 15s flush with goalJustMet=true triggers onGoalJustMet and refreshes Home.
      dailyRepo.nextGoalJustMet = true;
      for (var i = 16; i <= 30; i++) {
        clock.value = i * 1000;
        await collector.sample();
      }
      await Future<void>.delayed(Duration.zero);

      expect(goalJustMetCalls, 1);
      expect(homeCalls, 2);
      expect(learningRepo.catalogueCalls, 2);

      collector.dispose();
      learning.dispose();
      daily.dispose();
      session.dispose();
    },
  );

  test(
    'LearningAttemptController.move() updates in 0ms, serializes expectedVersion for check/submit, and rolls back on failure',
    () async {
      final repo = _QueuedProgressRepository();
      final owner = LearningController(repository: repo, accountId: 'alice');
      final controller = LearningAttemptController(owner: owner);
      await controller.load(attemptId: 'attempt');

      // Check q0 first (version 0 -> 1).
      await controller.select('q0', 'a');
      await controller.check('q0');
      expect(controller.attempt!.version, 1);

      // Optimistic 0ms move while PATCH /progress is still in-flight.
      final moveFuture = controller.move('QUIZ', 1);
      expect(controller.index, 1);
      expect(controller.phase, 'QUIZ');
      expect(controller.busy, isFalse);

      // Select & check q1 before PATCH /progress resolves -> must serialize expectedVersion!
      await controller.select('q1', 'a');
      final checkFuture = controller.check('q1');
      await Future<void>.delayed(Duration.zero);
      expect(repo.checks, 1);
      expect(repo.progressGates, hasLength(1));

      repo.progressGates.removeAt(0).complete();
      await Future.wait([moveFuture, checkFuture]);

      expect(controller.error, isNull);
      expect(controller.notice, isNull);
      expect(controller.attempt!.answer('q1')?['checked'], isTrue);
      expect(controller.attempt!.version, 3);
      expect(repo.checks, 2);

      // Check remaining questions q2..q4 so attempt is ready to submit.
      for (var i = 2; i < 5; i++) {
        final m = controller.move('QUIZ', i);
        await Future<void>.delayed(Duration.zero);
        repo.progressGates.removeAt(0).complete();
        await m;
        await controller.select('q$i', 'a');
        await controller.check('q$i');
      }

      // Move back (in-flight) then move forward, then immediately call submit().
      final moveBack = controller.move('QUIZ', 3);
      await Future<void>.delayed(Duration.zero);
      final moveForward = controller.move('QUIZ', 4);
      expect(controller.index, 4);
      final submitFuture = controller.submit();
      await Future<void>.delayed(Duration.zero);
      // Release Move 1 (index 3) and then Move 2 (index 4).
      while (repo.progressGates.isNotEmpty) {
        repo.progressGates.removeAt(0).complete();
        await Future<void>.delayed(Duration.zero);
      }
      await Future.wait([moveBack, moveForward, submitFuture]);
      expect(controller.attempt!.completed, isTrue);
      expect(controller.error, isNull);

      // Separate attempt: PATCH /progress failure rolls back optimistic index & preserves pending draft.
      final failRepo = _QueuedProgressRepository()..state = copy(
        MemoryLearningRepository().state,
      );
      final failOwner = LearningController(
        repository: failRepo,
        accountId: 'alice',
      );
      final failController = LearningAttemptController(owner: failOwner);
      await failController.load(attemptId: 'attempt');

      failRepo.failNextProgress = true;
      final failedMove = failController.move('QUIZ', 1);
      expect(failController.index, 1);
      await Future<void>.delayed(Duration.zero);
      failRepo.progressGates.removeAt(0).complete();
      await failedMove;

      expect(failController.index, 0);
      expect(failController.error, 'Mạng chập chờn');
      expect(failController.unsynced, isTrue);

      // Retry via flush recovers position 1 cleanly.
      final retryFuture = failController.flush();
      await Future<void>.delayed(Duration.zero);
      failRepo.progressGates.removeAt(0).complete();
      expect(await retryFuture, isTrue);
      expect(failController.index, 1);
      expect(failController.error, isNull);

      failController.dispose();
      failOwner.dispose();
      controller.dispose();
      owner.dispose();
    },
  );

  testWidgets(
    'LearningAttemptPage.leave() pops COMPLETED attempt immediately without waiting on WAN activity flush',
    (tester) async {
      final repo = MemoryLearningRepository()
        ..state['status'] = 'COMPLETED'
        ..state['result'] = {
          'correctCount': 5,
          'totalQuestions': 5,
          'scoreRatio': 1,
        };
      final dailyRepo = _BlockingDailyRepository();
      final daily = DailyLearningController(
        repository: dailyRepo,
        accountId: 'alice',
        isCurrent: () => true,
      );
      final owner = LearningController(
        repository: repo,
        accountId: 'alice',
        daily: daily,
      );

      await owner.activity!.add({
        'sessionId': 'sess-completed',
        'seq': 0,
        'startOffsetMs': 0,
        'endOffsetMs': 5000,
      });

      final hangFlush = Completer<Json>();
      dailyRepo.nextSendGate = hangFlush;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Builder(
            builder: (context) => Scaffold(
              body: ElevatedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) =>
                        LearningAttemptPage(owner: owner, attemptId: 'attempt'),
                  ),
                ),
                child: const Text('Open lesson'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Open lesson'));
      await tester.pumpAndSettle();
      expect(find.text('Kết quả bài học'), findsOneWidget);

      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();

      // Route popped immediately even while activity outbox flush is still blocked on WAN.
      expect(hangFlush.isCompleted, isFalse);
      expect(find.byType(LearningAttemptPage), findsNothing);
      expect(find.text('Open lesson'), findsOneWidget);

      hangFlush.complete({
        'acks': [
          {'seq': 0},
        ],
      });
      await tester.pump();
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
      daily.dispose();
    },
  );
}
