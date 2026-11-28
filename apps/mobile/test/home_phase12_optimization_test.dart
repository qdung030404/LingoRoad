import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/app_startup_timing.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/learning/daily_learning.dart';
import 'package:mobile/features/learning/home_cache.dart';
import 'package:mobile/features/learning/learning_controller.dart';
import 'package:mobile/features/learning/learning_preview.dart';
import 'package:mobile/features/learning/learning_repository.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/learning/writing_evaluation_service.dart';
import 'package:mobile/features/learning/writing_practice_page.dart';
import 'package:mobile/features/vocabulary/vocabulary_controller.dart';
import 'package:mobile/features/vocabulary/vocabulary_models.dart'
    show vocabularyCopy;
import 'package:mobile/features/vocabulary/vocabulary_pages.dart';
import 'package:mobile/features/vocabulary/vocabulary_review_page.dart';
import 'test_helpers.dart';
import 'vocabulary_controller_test.dart' show FakeVocabularyRepository;

Json _buildHomeSnapshot({
  required String date,
  required String planStatus,
  Json? plan,
}) {
  return <String, dynamic>{
    'date': date,
    'planStatus': planStatus,
    'plan': plan,
    'continueLesson': <String, dynamic>{
      'id': 'lesson-home-1',
      'code': 'grammar-present-simple',
      'kind': 'GRAMMAR',
      'title': 'Present Simple Quick Start',
      'description': 'Cấu trúc hiện tại đơn cơ bản',
      'estimatedMinutes': 10,
      'contentVersion': 1,
      'questionCount': 5,
    },
    'totals': <String, dynamic>{
      'completedLessonCount': 4,
      'activeSeconds': 900,
      'streakDays': 3,
    },
    'today': <String, dynamic>{
      'date': date,
      'activeSeconds': 300,
      'dailyGoalMinutes': 15,
      'goalMet': false,
      'completedCount': 0,
    },
    'days': const <Map<String, dynamic>>[],
    'preferences': <String, dynamic>{
      'version': 1,
      'dailyGoalMinutes': 15,
      'preferredKinds': <String>['GRAMMAR', 'READING'],
    },
    'unreadNotificationCount': 2,
  };
}

class _HomeStartupApi extends FakeApi {
  _HomeStartupApi({
    this.homeGate,
    this.planGate,
    this.initialPlanStatus = 'missing',
  }) : super(signedIn: true, completed: true);

  final Completer<void>? homeGate;
  final Completer<void>? planGate;
  final String initialPlanStatus;

  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Duration? receiveTimeout,
  }) async {
    requestedPaths.add('$method $path');
    if (path == '/learning/home') {
      if (homeGate != null) await homeGate!.future;
      final today = homeLearningDate();
      return _buildHomeSnapshot(
        date: today,
        planStatus: initialPlanStatus,
        plan: initialPlanStatus == 'ready' ? _samplePlan() : null,
      );
    }
    if (path == '/learning/plan/today' && method == 'POST') {
      if (planGate != null) await planGate!.future;
      return <String, dynamic>{
        'date': homeLearningDate(),
        'plan': _samplePlan(),
        'continueLesson': <String, dynamic>{
          'id': 'lesson-plan-1',
          'code': 'grammar-plan-1',
          'kind': 'GRAMMAR',
          'title': 'Planned Grammar Lesson',
          'description': 'Bài học trong lộ trình hôm nay',
          'estimatedMinutes': 10,
          'contentVersion': 1,
          'questionCount': 5,
        },
      };
    }
    if (path == '/vocabulary/summary') {
      return <String, dynamic>{
        'totals': <String, dynamic>{
          'totalWords': 3,
          'rememberedWords': 1,
          'needsReviewWords': 2,
          'reviewedWords': 1,
          'completedReviewCount': 0,
        },
        'decks': const <Map<String, dynamic>>[],
        'hasMoreDecks': false,
        'activeAttemptId': null,
      };
    }
    if (path.startsWith('/notifications')) {
      return <String, dynamic>{'items': const <Object>[], 'unreadCount': 2};
    }
    return super.request(
      method,
      path,
      data: data,
      auth: auth,
      receiveTimeout: receiveTimeout,
    );
  }

  Json _samplePlan() => <String, dynamic>{
    'completedCount': 0,
    'totalCount': 1,
    'estimatedMinutes': 10,
    'items': <Map<String, dynamic>>[
      <String, dynamic>{
        'id': 'plan-item-1',
        'lessonId': 'lesson-plan-1',
        'title': 'Planned Grammar Lesson',
        'kind': 'GRAMMAR',
        'estimatedMinutes': 10,
        'reasonCode': 'NEW',
        'reason': 'Bài mới',
        'completed': false,
      },
    ],
  };
}

class _RolloverDailyRepo implements DailyRepository {
  _RolloverDailyRepo(this.onEnsurePlan);
  final Future<Json> Function() onEnsurePlan;

  @override
  Future<Json> ensurePlan() => onEnsurePlan();

  @override
  Future<Json> openActivity(String id, String run) async => <String, dynamic>{};

  @override
  Future<Json> preferences() async => <String, dynamic>{};

  @override
  Future<Json> progress() async => <String, dynamic>{};

  @override
  Future<Json> savePreferences(Json body) async => body;

  @override
  Future<Json> sendSegments(String id, List<Json> segments) async =>
      <String, dynamic>{'acks': const <Object>[]};
}

void _mockAudioPlayers() {
  final messenger =
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
  for (final name in <String>[
    'xyz.luan/audioplayers.global',
    'xyz.luan/audioplayers.global/events',
  ]) {
    messenger.setMockMethodCallHandler(MethodChannel(name), (_) async => null);
  }
  messenger.setMockMethodCallHandler(
    const MethodChannel('xyz.luan/audioplayers'),
    (MethodCall call) async {
      if (call.method == 'create') {
        final id = (call.arguments as Map)['playerId'];
        messenger.setMockMethodCallHandler(
          MethodChannel('xyz.luan/audioplayers/events/$id'),
          (_) async => null,
        );
      }
      return null;
    },
  );
}

Json _deck3ReviewAttempt() {
  final item = <String, dynamic>{
    'id': 'item-d3',
    'wordId': 'word-d3',
    'state': 'PENDING',
    'draft': '',
    'word': <String, dynamic>{
      'id': 'word-d3',
      'english': 'resilient',
      'meaning': 'kiên cường',
      'contentVersion': 1,
    },
  };
  return <String, dynamic>{
    'id': 'attempt-deck-3',
    'deckId': 'deck-3',
    'deckSnapshot': <String, dynamic>{'name': 'Bộ từ số 3'},
    'version': 0,
    'status': 'IN_PROGRESS',
    'phase': 'FRONT',
    'queue': <String>['item-d3'],
    'currentItem': item,
    'items': <Map<String, dynamic>>[item],
    'counts': <String, dynamic>{'totalCount': 1, 'reviewedCount': 0},
  };
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    _mockAudioPlayers();
    AppStartupTiming.resetForTesting();
  });

  tearDown(() {
    AppStartupTiming.resetForTesting();
  });

  testWidgets(
    'GET /learning/home renders content immediately while POST /learning/plan/today runs in background and records startup stages',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(430, 1000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final List<(String, Map<String, Object?>)> stages =
          <(String, Map<String, Object?>)>[];
      AppStartupTiming.resetForTesting(
        onStage: (String stage, int _, Map<String, Object?> meta) {
          stages.add((stage, meta));
        },
      );

      final Completer<void> planGate = Completer<void>();
      final _HomeStartupApi api = _HomeStartupApi(
        planGate: planGate,
        initialPlanStatus: 'missing',
      );
      final SessionController session = SessionController(api);
      await session.initialize();
      addTearDown(session.dispose);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningPreview(account: session),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      // Home content is visible BEFORE POST /learning/plan/today resolves!
      expect(api.requestedPaths, contains('GET /learning/home'));
      expect(api.requestedPaths, contains('POST /learning/plan/today'));
      expect(find.text('Present Simple Quick Start'), findsWidgets);
      expect(find.textContaining('5 / 15 phút'), findsOneWidget);
      expect(
        stages.map(((String, Map<String, Object?>) e) => e.$1).toList(),
        <String>['home-first-content', 'home-live'],
      );
      expect(stages.first.$2, <String, Object?>{
        'source': 'network',
        'cache': 'miss',
        'planStatus': 'missing',
      });

      // Now complete POST /learning/plan/today -> plan card updates & home-plan-ready fires
      planGate.complete();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(find.text('Planned Grammar Lesson'), findsWidgets);
      expect(
        stages.map(((String, Map<String, Object?>) e) => e.$1).toList(),
        <String>['home-first-content', 'home-live', 'home-plan-ready'],
      );
      expect(stages.last.$2, <String, Object?>{
        'cache': 'miss',
        'planStatus': 'missing',
      });

      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets(
    'cached Home records home-first-content from cache before network home-live resolves',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(430, 1000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final List<(String, Map<String, Object?>)> stages =
          <(String, Map<String, Object?>)>[];
      AppStartupTiming.resetForTesting(
        onStage: (String stage, int _, Map<String, Object?> meta) {
          stages.add((stage, meta));
        },
      );

      final Completer<void> homeGate = Completer<void>();
      final _HomeStartupApi api = _HomeStartupApi(
        homeGate: homeGate,
        initialPlanStatus: 'ready',
      );
      final SessionController session = SessionController(api);
      await session.initialize();
      session.cachedHome = _buildHomeSnapshot(
        date: homeLearningDate(),
        planStatus: 'ready',
        plan: api._samplePlan(),
      );
      addTearDown(session.dispose);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningPreview(account: session),
        ),
      );
      await tester.pump();

      expect(
        stages.map(((String, Map<String, Object?>) e) => e.$1).toList(),
        <String>['home-first-content'],
      );
      expect(stages.single.$2['source'], 'cache');
      expect(stages.single.$2['cache'], 'hit');

      homeGate.complete();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 50));

      expect(
        stages.map(((String, Map<String, Object?>) e) => e.$1).toList(),
        <String>['home-first-content', 'home-live', 'home-plan-ready'],
      );

      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  test(
    'LearningController preserves Vietnam midnight day-rollover retry when ensurePlan returns a new date',
    () async {
      int homeCalls = 0;
      final DailyLearningController daily = DailyLearningController(
        repository: _RolloverDailyRepo(
          () async => <String, dynamic>{
            'date': '2026-11-29',
            'plan': <String, dynamic>{
              'completedCount': 0,
              'totalCount': 0,
              'estimatedMinutes': 0,
              'items': const <Object>[],
            },
            'continueLesson': null,
          },
        ),
        accountId: 'user',
        isCurrent: () => true,
      );
      final List<String> seenDates = <String>[];
      final LearningController learning = LearningController(
        repository: ApiLearningRepository(FakeApi(signedIn: true)),
        accountId: 'user',
        daily: daily,
        fetchHome: () async {
          homeCalls++;
          return homeCalls == 1
              ? _buildHomeSnapshot(date: '2026-11-28', planStatus: 'missing')
              : _buildHomeSnapshot(
                  date: '2026-11-29',
                  planStatus: 'ready',
                  plan: <String, dynamic>{
                    'completedCount': 0,
                    'totalCount': 0,
                    'estimatedMinutes': 0,
                    'items': const <Object>[],
                  },
                );
        },
        onPlanReady: (Json value) => seenDates.add(value['date'] as String),
      );

      await learning.refresh();
      await Future<void>.delayed(const Duration(milliseconds: 20));

      expect(homeCalls, 2);
      expect(seenDates, <String>['2026-11-29']);

      learning.dispose();
      daily.dispose();
    },
  );

  testWidgets(
    'PreviewModel defers restoration on signed-in startup and restores saved drafts before Writing read or write',
    (WidgetTester tester) async {
      final WritingPracticeItem item = WritingPracticeItem.defaultItems.first;
      SharedPreferences.setMockInitialValues(<String, Object>{
        'lingoroad.uiPreview.user.user.draft_${item.id}':
            'Bản nháp cũ đã lưu từ phiên trước',
        'lingoroad.uiPreview.user.user.score_${item.id}': 7.5,
      });

      final PreviewModel model = PreviewModel(accountId: 'user');
      addTearDown(model.dispose);

      // Before opening Writing, signed-in startup has NOT restored PreviewModel
      expect(model.isRestored, isFalse);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: WritingTaskPage(model: model, item: item),
        ),
      );
      await tester.pumpAndSettle();

      // WritingTaskPage triggers lazy restore so saved draft & score are preserved
      expect(model.isRestored, isTrue);
      expect(model.getEvaluation(item.id)?.scaledScore10, 7.5);
      await tester.scrollUntilVisible(
        find.byKey(const Key('writingInput')),
        200,
      );
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('writingInput')))
            .controller!
            .text,
        'Bản nháp cũ đã lưu từ phiên trước',
      );

      // Saving a new draft persists to SharedPreferences for future app launches
      await model.saveItemDraft(
        item.id,
        'Bản nháp mới cập nhật trong phiên hiện tại',
        0,
      );
      final PreviewModel nextLaunchModel = PreviewModel(accountId: 'user');
      addTearDown(nextLaunchModel.dispose);
      await nextLaunchModel.ensureRestored();
      expect(
        nextLaunchModel.getDraft(item.id, 0),
        'Bản nháp mới cập nhật trong phiên hiện tại',
      );
      expect(nextLaunchModel.getEvaluation(item.id)?.scaledScore10, 7.5);

      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  test(
    'PreviewModel waits for in-flight restoration before mutating state so concurrent finish() and saveItemDraft() are never overwritten',
    () async {
      SharedPreferences.setMockInitialValues(<String, Object>{
        'lingoroad.uiPreview.user.user.completed': <String>['grammar-old'],
        'lingoroad.uiPreview.user.user.draft_wrt-race': 'Bản nháp cũ trên đĩa',
      });

      final Completer<SharedPreferences> restoreGate =
          Completer<SharedPreferences>();
      final PreviewModel model = PreviewModel(
        accountId: 'user',
        preferencesLoader: () => restoreGate.future,
      );
      addTearDown(model.dispose);

      // Start restoration and hold it pending
      final Future<void> pendingRestore = model.ensureRestored();
      expect(model.isRestored, isFalse);

      // Trigger mutations while restoration is still waiting on SharedPreferences
      final Future<void> pendingFinish = model.finish('writing');
      final Future<void> pendingDraft = model.saveItemDraft(
        'wrt-race',
        'Bản nháp mới ghi khi đang khôi phục',
        0,
      );

      // Release SharedPreferences so restoration completes first, followed by queued writes
      restoreGate.complete(await SharedPreferences.getInstance());
      await Future.wait<void>(<Future<void>>[
        pendingRestore,
        pendingFinish,
        pendingDraft,
      ]);

      // Verify current in-memory state preserves BOTH restored items and concurrent writes
      expect(model.isRestored, isTrue);
      expect(model.completed, <String>{'grammar-old', 'writing'});
      expect(
        model.getDraft('wrt-race', 0),
        'Bản nháp mới ghi khi đang khôi phục',
      );

      // Verify persisted state on reopen
      final PreviewModel reopened = PreviewModel(accountId: 'user');
      addTearDown(reopened.dispose);
      await reopened.ensureRestored();
      expect(reopened.completed, <String>{'grammar-old', 'writing'});
      expect(
        reopened.getDraft('wrt-race', 0),
        'Bản nháp mới ghi khi đang khôi phục',
      );
    },
  );

  testWidgets(
    'Vocabulary Ôn tập always queries /vocabulary/reviews/active (<= 1 request) and stays accurate when Device B starts or finishes a review after Device A loaded Home',
    (WidgetTester tester) async {
      tester.view.physicalSize = const Size(430, 1000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      Json? serverActiveAttempt;
      final FakeVocabularyRepository repo = FakeVocabularyRepository((
        String method,
        String path,
        Json? body,
      ) async {
        if (path == '/vocabulary/summary') {
          return <String, dynamic>{
            'totals': <String, dynamic>{
              'totalWords': 3,
              'rememberedWords': 0,
              'needsReviewWords': 3,
              'reviewedWords': 0,
              'completedReviewCount': 0,
            },
            'decks': <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'deck-1',
                'name': 'Bộ từ số 1',
                'version': 0,
                'totalWords': 1,
                'rememberedWords': 0,
                'needsReviewWords': 1,
                'reviewedWords': 0,
                'activeAttemptId': null,
              },
              <String, dynamic>{
                'id': 'deck-2',
                'name': 'Bộ từ số 2',
                'version': 0,
                'totalWords': 1,
                'rememberedWords': 0,
                'needsReviewWords': 1,
                'reviewedWords': 0,
                'activeAttemptId': 'stale-attempt-deck-2',
              },
            ],
            'hasMoreDecks': true,
          };
        }
        if (path == '/vocabulary/reviews/active') {
          final Json? active = serverActiveAttempt;
          return <String, dynamic>{
            'attempt': active == null ? null : vocabularyCopy(active),
          };
        }
        throw ApiFailure('Unexpected request: $method $path');
      });

      final VocabularyController controller = VocabularyController(
        repository: repo,
        accountId: 'user',
        isCurrent: () => true,
      );
      // Device A loads Home when no review is active (summary.activeAttemptId == null, stale == false)
      await controller.refresh();
      expect(controller.stale, isFalse);

      int fallbackCount = 0;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: SingleChildScrollView(
              child: VocabularyHomeSection(
                controller: controller,
                onWords: () {},
                onDeck: (_) {},
                onReview: () => fallbackCount++,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Case A: Device B starts an IN_PROGRESS review on 3rd deck AFTER Device A loaded summary!
      serverActiveAttempt = _deck3ReviewAttempt();
      repo.calls.clear();

      await tester.tap(find.byKey(const Key('homeReviewWords')));
      await tester.pumpAndSettle();

      expect(fallbackCount, 0);
      expect(find.byType(VocabularyReviewPage), findsOneWidget);
      expect(find.text('resilient'), findsWidgets);
      // Strictly 1 HTTP request on tap (/vocabulary/reviews/active), zero /reviews/:id or /history calls!
      expect(repo.calls, hasLength(1));
      expect(repo.calls.single['path'], '/vocabulary/reviews/active');

      // Pop back (refresh updates Device A summary while stale == false)
      Navigator.of(tester.element(find.byType(VocabularyReviewPage))).pop();
      await tester.pumpAndSettle();
      expect(controller.stale, isFalse);

      // Case B: Device B finishes the session AFTER Device A refreshed summary!
      serverActiveAttempt = null;
      repo.calls.clear();

      await tester.tap(find.byKey(const Key('homeReviewWords')));
      await tester.pumpAndSettle();

      // Device A does NOT reopen the finished session; falls back cleanly in 1 request!
      expect(find.byType(VocabularyReviewPage), findsNothing);
      expect(fallbackCount, 1);
      expect(repo.calls, hasLength(1));
      expect(repo.calls.single['path'], '/vocabulary/reviews/active');

      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );
}
