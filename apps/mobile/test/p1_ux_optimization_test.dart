import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/auth/firebase_identity.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/demo_shell.dart';
import 'package:mobile/features/grammar/grammar_catalogue_view.dart';
import 'package:mobile/features/grammar/grammar_controller.dart';
import 'package:mobile/features/grammar/grammar_repository.dart';
import 'package:mobile/features/learning/home_cache.dart';
import 'package:mobile/features/learning/learning_preview.dart';
import 'package:mobile/features/vocabulary/vocabulary_controller.dart';
import 'grammar_catalogue_test.dart' show FakeGrammarRepository;
import 'test_helpers.dart';

String _jwtWithExp(DateTime expiresAt) {
  final header = base64Url.encode(utf8.encode('{"alg":"RS256"}'));
  final payload = base64Url.encode(
    utf8.encode('{"exp":${expiresAt.toUtc().millisecondsSinceEpoch ~/ 1000}}'),
  );
  return '$header.$payload.sig';
}

Json _validHomeSnapshot() => {
  'date': homeLearningDate(),
  'totals': {
    'completedLessonCount': 2,
    'activeSeconds': 600,
    'dailyGoalMinutes': 10,
  },
  'today': {'date': homeLearningDate(), 'activeSeconds': 600, 'goalMet': true},
  'days': const <Json>[],
  'preferences': const {
    'dailyGoalMinutes': 10,
    'preferredKinds': ['GRAMMAR', 'VOCABULARY'],
  },
  'planStatus': 'ready',
  'plan': const {'items': <Json>[]},
  'unreadNotificationCount': 0,
};

class _TrackingPreviewApi extends FakeApi {
  _TrackingPreviewApi() : super(signedIn: true, completed: true);

  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Duration? receiveTimeout,
  }) async {
    requestedPaths.add(path);
    if (path == '/learning/home') return _validHomeSnapshot();
    if (path == '/learning/lessons') return {'items': const <Json>[]};
    if (path == '/learning/summary') return {'lessons': const <Json>[]};
    if (path == '/learning/history') return {'items': const <Json>[]};
    if (path == '/learning/daily/today' || path.startsWith('/learning/daily')) {
      return {
        'today': {
          'date': homeLearningDate(),
          'activeSeconds': 600,
          'goalMet': true,
        },
        'days': const <Json>[],
        'totals': {'completedLessonCount': 2, 'activeSeconds': 600},
      };
    }
    if (path == '/vocabulary/summary') {
      return {
        'totals': {'totalWords': 0, 'rememberedWords': 0},
        'decks': const <Json>[],
      };
    }
    if (path == '/vocabulary/topics') return {'topics': const <Json>[]};
    if (path == '/vocabulary/decks') return {'decks': const <Json>[]};
    if (path.startsWith('/grammar')) {
      if (path.contains('levels')) return {'levels': const <Json>[]};
      return {'tree': const <Json>[]};
    }
    if (path.startsWith('/notifications')) {
      return {'items': const <Json>[], 'unreadCount': 0};
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

class _LargeGrammarRepository extends FakeGrammarRepository {
  @override
  Future<List<GrammarTreeNode>> fetchTree() async => <GrammarTreeNode>[
    GrammarTreeNode(
      id: 'root-id',
      code: 'grammar',
      parentCode: null,
      cefrLevel: 'A1',
      isLeaf: false,
      titleEn: 'English Grammar',
      titleVi: 'Hệ thống Ngữ pháp',
      summaryVi: '',
      orderIndex: 0,
      prerequisiteCodes: const <String>[],
      lessonCount: 40,
      learnerStatus: null,
      children: <GrammarTreeNode>[
        GrammarTreeNode(
          id: 'group-large',
          code: 'grammar.tenses',
          parentCode: 'grammar',
          cefrLevel: 'A1',
          isLeaf: false,
          titleEn: 'Verb Tenses',
          titleVi: 'Hệ thống Thì',
          summaryVi: 'Danh sách bài ngữ pháp dài',
          orderIndex: 1,
          prerequisiteCodes: const <String>[],
          lessonCount: 40,
          learnerStatus: null,
          children: List<GrammarTreeNode>.generate(
            40,
            (i) => GrammarTreeNode(
              id: 'leaf-$i',
              code: 'grammar.tenses.item_$i',
              parentCode: 'grammar.tenses',
              cefrLevel: 'A1',
              isLeaf: true,
              titleEn: 'Grammar Rule $i',
              titleVi: 'Chuyên đề Ngữ pháp $i',
              summaryVi: 'Mô tả chuyên đề $i',
              orderIndex: i,
              prerequisiteCodes: const <String>[],
              lessonCount: 1,
              learnerStatus: 'NOT_STARTED',
              children: const <GrammarTreeNode>[],
            ),
          ),
        ),
      ],
    ),
  ];
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(
      const MethodChannel('lingoroad/reminders'),
      (_) async => null,
    );
  });

  group('FirebaseIdentity JWT cache & single-flight coalescing', () {
    test(
      'caches valid JWT in RAM, coalesces concurrent reads, and expires within safety margin',
      () async {
        var now = DateTime.utc(2026, 11, 28, 12, 0, 0);
        var uid = 'uid-1';
        var fetchCount = 0;
        Completer<String?>? gate;

        final identity = FirebaseIdentity(
          now: () => now,
          uidReader: () => uid,
          tokenFetcher: (forceRefresh) async {
            fetchCount++;
            final pending = gate;
            if (pending != null) return pending.future;
            final seq = fetchCount;
            return '${_jwtWithExp(now.add(const Duration(minutes: 10)))}-$seq';
          },
        );

        gate = Completer<String?>();
        final first = identity.idToken();
        final second = identity.idToken();
        expect(fetchCount, 1);
        final token1 = _jwtWithExp(now.add(const Duration(minutes: 10)));
        gate.complete(token1);
        gate = null;
        expect(await Future.wait([first, second]), [token1, token1]);
        expect(fetchCount, 1);

        // Cache hit inside validity window (> 60s before exp).
        now = now.add(const Duration(minutes: 8, seconds: 59));
        expect(await identity.idToken(), token1);
        expect(fetchCount, 1);

        // Entering 60s safety margin refreshes token.
        now = now.add(const Duration(seconds: 2));
        final refreshed = await identity.idToken();
        expect(refreshed, isNot(token1));
        expect(fetchCount, 2);

        // UID change resets cached token immediately.
        uid = 'uid-2';
        await identity.idToken();
        expect(fetchCount, 3);
      },
    );

    test(
      'forceRefresh bypasses cache and coalesces concurrent non-force reads',
      () async {
        final now = DateTime.utc(2026, 11, 28, 12, 0, 0);
        var fetchCount = 0;
        final gates = <Completer<String?>>[];
        final forceFlags = <bool>[];

        final identity = FirebaseIdentity(
          now: () => now,
          uidReader: () => 'uid-1',
          tokenFetcher: (forceRefresh) {
            fetchCount++;
            forceFlags.add(forceRefresh);
            final completer = Completer<String?>();
            gates.add(completer);
            return completer.future;
          },
        );

        final initial = identity.idToken();
        final t1 = _jwtWithExp(now.add(const Duration(minutes: 30)));
        gates.removeAt(0).complete(t1);
        expect(await initial, t1);

        final forced = identity.idToken(forceRefresh: true);
        final joined = identity.idToken();
        expect(fetchCount, 2);
        expect(forceFlags, [false, true]);
        final t2 = _jwtWithExp(now.add(const Duration(minutes: 60)));
        gates.removeAt(0).complete(t2);
        expect(await Future.wait([forced, joined]), [t2, t2]);
      },
    );
  });

  group('DemoShell SWR startup & LearningPreview direct tab jump', () {
    testWidgets(
      'DemoShell renders cached LearningPreview immediately with startupSwrProgress while loading',
      (tester) async {
        tester.view.physicalSize = const Size(430, 932);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        final api = _TrackingPreviewApi();
        final session = SessionController(api);
        addTearDown(session.dispose);
        session.stage = SessionStage.loading;
        session.cachedHome = _validHomeSnapshot();
        session.cachedAccount = {
          'id': 'user-swr',
          'name': 'Minh SWR',
          'placementCefr': 'B1',
        };

        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.lightTheme,
            home: DemoShell(session: session),
          ),
        );
        await tester.pump();

        expect(find.byKey(const Key('startupSwrProgress')), findsOneWidget);
        expect(find.byType(LearningPreview), findsOneWidget);
        expect(find.textContaining('Minh SWR'), findsOneWidget);
      },
    );

    testWidgets(
      'jumping from tab 0 to tab 4 skips intermediate _loadTab requests for tabs 1..3',
      (tester) async {
        tester.view.physicalSize = const Size(430, 932);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        final api = _TrackingPreviewApi();
        final session = SessionController(api);
        addTearDown(session.dispose);
        session.user = {
          'id': 'user-1',
          'name': 'Anna',
          'profile': {'dailyGoalMinutes': 10},
        };
        session.placement = {'hasCompleted': true, 'estimatedCefr': 'B1'};
        session.stage = SessionStage.ready;

        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.lightTheme,
            home: LearningPreview(account: session),
          ),
        );
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 50));

        api.requestedPaths.clear();
        await tester.tap(find.byKey(const Key('previewTab4')));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 50));

        expect(
          api.requestedPaths.any(
            (p) =>
                p == '/learning/lessons' ||
                p == '/vocabulary/summary' ||
                p == '/vocabulary/topics',
          ),
          isFalse,
        );
      },
    );
  });

  group('GrammarController debounce/memoization & WordPlaybackTracker', () {
    test('GrammarController debounces search and memoizes visibleGroups', () async {
      final controller = GrammarController(repository: FakeGrammarRepository());
      addTearDown(controller.dispose);
      await controller.load();

      final initialVisible = controller.visibleGroups;
      expect(identical(controller.visibleGroups, initialVisible), isTrue);

      var notifyCount = 0;
      controller.addListener(() => notifyCount++);

      controller.setSearchQuery(
        'present',
        debounce: true,
        delay: const Duration(milliseconds: 40),
      );
      controller.setSearchQuery(
        'simple',
        debounce: true,
        delay: const Duration(milliseconds: 40),
      );
      expect(controller.searchQuery, isEmpty);
      expect(notifyCount, 0);

      await Future<void>.delayed(const Duration(milliseconds: 80));
      expect(controller.searchQuery, 'simple');
      expect(notifyCount, 1);
      final filtered = controller.visibleGroups;
      expect(identical(controller.visibleGroups, filtered), isTrue);
      expect(identical(filtered, initialVisible), isFalse);
    });

    testWidgets(
      'GrammarCatalogueView virtualizes large topic lists in SliverList',
      (tester) async {
        tester.view.physicalSize = const Size(430, 800);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);

        final controller = GrammarController(
          repository: _LargeGrammarRepository(),
        );
        addTearDown(controller.dispose);
        await controller.load();
        if (!controller.isGroupExpanded('grammar.tenses')) {
          controller.toggleGroup('grammar.tenses');
        }

        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.lightTheme,
            home: Scaffold(
              body: CustomScrollView(
                slivers: [
                  GrammarCatalogueView(controller: controller, asSliver: true),
                ],
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.byType(SliverList), findsOneWidget);
        expect(find.text('Chuyên đề Ngữ pháp 0'), findsOneWidget);
        expect(find.text('Chuyên đề Ngữ pháp 39'), findsNothing);
      },
    );

    test(
      'WordPlaybackTracker notifies only affected word listenables',
      () {
        final tracker = WordPlaybackTracker();
        addTearDown(tracker.dispose);

        var aCalls = 0;
        var bCalls = 0;
        var cCalls = 0;
        tracker.listen('w-a').addListener(() => aCalls++);
        tracker.listen('w-b').addListener(() => bCalls++);
        tracker.listen('w-c').addListener(() => cCalls++);

        tracker.setPlaying('w-a');
        expect([aCalls, bCalls, cCalls], [1, 0, 0]);
        expect(tracker.listen('w-a').value, isTrue);

        tracker.setPlaying('w-b');
        expect([aCalls, bCalls, cCalls], [2, 1, 0]);
        expect(tracker.listen('w-a').value, isFalse);
        expect(tracker.listen('w-b').value, isTrue);

        tracker.setPlaying('w-b');
        expect([aCalls, bCalls, cCalls], [2, 1, 0]);

        tracker.setPlaying(null);
        expect([aCalls, bCalls, cCalls], [2, 2, 0]);
      },
    );
  });
}
