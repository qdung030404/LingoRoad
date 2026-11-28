import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/grammar/grammar_controller.dart';
import 'package:mobile/features/grammar/grammar_repository.dart';
import 'package:mobile/features/grammar/grammar_topic_detail_page.dart';
import 'package:mobile/features/learning/cefr_milestone_detail_page.dart';
import 'package:mobile/features/learning/daily_learning.dart';
import 'package:mobile/features/learning/home_cache.dart';
import 'package:mobile/features/learning/learning_catalogue.dart';
import 'package:mobile/features/learning/learning_controller.dart';
import 'package:mobile/features/learning/learning_repository.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/learning/progress_dashboard.dart';
import 'support/ui_fonts.dart';
import 'test_helpers.dart';

class _StubLearningRepository implements LearningRepository {
  @override
  Future<Json> catalogue() async => {'items': []};
  @override
  Future<Json> lesson(String lessonId) => throw UnimplementedError();
  @override
  Future<Json> summary() async => {};
  @override
  Future<LearningAttempt> start(String lessonId) => throw UnimplementedError();
  @override
  Future<LearningAttempt> attempt(String id) => throw UnimplementedError();
  @override
  Future<LearningAttempt> progress(String id, Json body) => throw UnimplementedError();
  @override
  Future<LearningAttempt> check(String id, String questionId, Json body) => throw UnimplementedError();
  @override
  Future<LearningAttempt> submit(String id, int version) => throw UnimplementedError();
  @override
  Future<void> cancel(String id) async {}
  @override
  Future<void> hideHistory(String id) async {}
  @override
  Future<void> hideHistoryBatch(List<String> ids) async {}
  @override
  Future<Json> explainAnswer(String id, String questionId) => throw UnimplementedError();
  @override
  Future<Json> history({String? cursor, String? kind}) async => {'items': []};
  @override
  String audioUrl(String path) => path;
}

class _StubDailyRepository implements DailyRepository {
  @override
  Future<Json> ensurePlan() async => {};
  @override
  Future<Json> preferences() async => {};
  @override
  Future<Json> savePreferences(Json body) async => body;
  @override
  Future<Json> progress() async => {};
  @override
  Future<Json> openActivity(String attemptId, String runId) async => {};
  @override
  Future<Json> sendSegments(String sessionId, List<Json> segments) async => {};
}

class _StubGrammarRepository implements GrammarRepository {
  @override
  Future<List<GrammarLevelSummary>> fetchLevels() async => const [
    GrammarLevelSummary(cefrLevel: 'A1', topicCount: 1, lessonCount: 1, completedCount: 0),
    GrammarLevelSummary(cefrLevel: 'A2', topicCount: 1, lessonCount: 1, completedCount: 0),
    GrammarLevelSummary(cefrLevel: 'B1', topicCount: 2, lessonCount: 2, completedCount: 1),
  ];

  @override
  Future<List<GrammarTreeNode>> fetchTree() async => const [
    GrammarTreeNode(
      id: 'grp-1',
      code: 'grammar.tenses',
      parentCode: 'grammar',
      cefrLevel: 'A1',
      isLeaf: false,
      titleEn: 'Tenses',
      titleVi: 'Các thì động từ',
      summaryVi: '',
      orderIndex: 1,
      prerequisiteCodes: [],
      lessonCount: 4,
      learnerStatus: null,
      children: [
        GrammarTreeNode(
          id: 't-a1',
          code: 'grammar.tenses.present_simple',
          parentCode: 'grammar.tenses',
          cefrLevel: 'A1',
          isLeaf: true,
          titleEn: 'Present Simple',
          titleVi: 'Thì Hiện tại đơn',
          summaryVi: '',
          orderIndex: 1,
          prerequisiteCodes: [],
          lessonCount: 1,
          learnerStatus: 'AVAILABLE',
          children: [],
        ),
        GrammarTreeNode(
          id: 't-b1-open',
          code: 'grammar.tenses.present_perfect',
          parentCode: 'grammar.tenses',
          cefrLevel: 'B1',
          isLeaf: true,
          titleEn: 'Present Perfect',
          titleVi: 'Thì Hiện tại hoàn thành',
          summaryVi: '',
          orderIndex: 2,
          prerequisiteCodes: ['grammar.tenses.present_simple'],
          lessonCount: 1,
          learnerStatus: 'AVAILABLE',
          children: [],
        ),
        GrammarTreeNode(
          id: 't-b1-locked',
          code: 'grammar.tenses.present_perfect_cont',
          parentCode: 'grammar.tenses',
          cefrLevel: 'B1',
          isLeaf: true,
          titleEn: 'Present Perfect Continuous',
          titleVi: 'Thì Hiện tại hoàn thành tiếp diễn',
          summaryVi: '',
          orderIndex: 3,
          prerequisiteCodes: [
            'grammar.tenses.present_simple',
            'grammar.tenses.present_perfect',
          ],
          lessonCount: 1,
          learnerStatus: 'LOCKED',
          children: [],
        ),
      ],
    ),
  ];

  @override
  Future<GrammarTopicDetail> fetchTopicDetail(String code) async => GrammarTopicDetail(
    id: 'detail-$code',
    code: code,
    cefrLevel: code.contains('present_simple') ? 'A1' : 'B1',
    titleEn: code,
    titleVi: code == 'grammar.tenses.present_perfect'
        ? 'Thì Hiện tại hoàn thành'
        : 'Chi tiết $code',
    summaryVi: 'Tóm tắt $code',
    parent: null,
    formulas: const [],
    usageNotes: const [],
    examples: const [],
    prerequisites: const [],
    dependents: const [],
    lessons: const [],
  );
}

class _B1PreviewApi extends FakeApi {
  _B1PreviewApi() : super(signedIn: true, completed: true);

  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Duration? receiveTimeout,
  }) async {
    requestedPaths.add(path);
    if (path == '/placement/status') {
      return {
        'status': 'COMPLETED',
        'estimatedCefr': 'B1',
        'currentIndex': 10,
        'currentSessionId': 'session-b1',
        'totalItems': 10,
      };
    }
    if (path == '/learning/home') {
      final todayStr = homeLearningDate();
      return {
        'date': todayStr,
        'planStatus': 'ready',
        'placementCefr': 'B1',
        'plan': {'items': []},
        'continueLesson': null,
        'preferences': {'dailyGoalMinutes': 15, 'preferredKinds': ['READING']},
        'today': {
          'date': todayStr,
          'goalMinutes': 15,
          'activeMinutes': 10,
          'activeSeconds': 600,
          'metGoal': false,
          'plannedCount': 2,
          'completedPlannedCount': 1,
          'timeMeasured': true,
        },
        'days': [
          {'date': todayStr, 'activeSeconds': 600, 'timeMeasured': true},
        ],
        'totals': {'completedLessonCount': 3, 'totalLessons': 68},
      };
    }
    if (path == '/learning/progress') {
      final todayStr = homeLearningDate();
      return {
        'placementCefr': 'B1',
        'today': {
          'date': todayStr,
          'goalMinutes': 15,
          'activeMinutes': 10,
          'activeSeconds': 600,
          'metGoal': false,
          'plannedCount': 2,
          'completedPlannedCount': 1,
          'timeMeasured': true,
        },
        'streak': {'currentDays': 2, 'longestDays': 4},
        'days': [
          {'date': todayStr, 'activeSeconds': 600, 'timeMeasured': true},
        ],
        'milestones': [
          {'cefrLevel': 'A1', 'totalLessons': 12, 'completedLessonCount': 0, 'status': 'UPCOMING'},
          {'cefrLevel': 'A2', 'totalLessons': 14, 'completedLessonCount': 0, 'status': 'UPCOMING'},
          {'cefrLevel': 'B1', 'totalLessons': 18, 'completedLessonCount': 3, 'status': 'IN_PROGRESS'},
          {'cefrLevel': 'B2', 'totalLessons': 13, 'completedLessonCount': 0, 'status': 'UPCOMING'},
          {'cefrLevel': 'C1', 'totalLessons': 7, 'completedLessonCount': 0, 'status': 'UPCOMING'},
          {'cefrLevel': 'C2', 'totalLessons': 4, 'completedLessonCount': 0, 'status': 'UPCOMING'},
        ],
        'scoreStats': {'averageScore': 88, 'deltaPercent': 4},
        'totals': {'averageStudyMinutes': 15, 'completedLessonCount': 3, 'totalLessons': 68},
      };
    }
    if (path == '/learning/lessons') {
      return {
        'items': [
          {'id': 'v-a1', 'title': 'Từ vựng A1 Gia đình', 'kind': 'VOCABULARY', 'cefrLevel': 'A1', 'description': 'Từ vựng cơ bản', 'estimatedMinutes': 5, 'state': 'NOT_STARTED'},
          {'id': 'v-b1', 'title': 'Từ vựng B1 Công việc', 'kind': 'VOCABULARY', 'cefrLevel': 'B1', 'description': 'Từ vựng trung cấp', 'estimatedMinutes': 8, 'state': 'NOT_STARTED'},
        ],
      };
    }
    if (path == '/grammar/levels') {
      return {
        'levels': [
          {'cefrLevel': 'A1', 'topicCount': 0, 'lessonCount': 0, 'completedCount': 0},
          {'cefrLevel': 'B1', 'topicCount': 0, 'lessonCount': 0, 'completedCount': 0},
        ],
      };
    }
    if (path.startsWith('/grammar/tree')) {
      return {'tree': []};
    }
    if (path == '/vocabulary/summary') {
      return {'totals': {'totalWords': 20, 'rememberedWords': 10}, 'decks': []};
    }
    if (path == '/vocabulary/curated-topics') {
      return {'topics': []};
    }
    if (path == '/learning/preferences') {
      return {'dailyGoalMinutes': 15, 'version': 1, 'preferredKinds': ['READING']};
    }
    return super.request(method, path, data: data, auth: auth, receiveTimeout: receiveTimeout);
  }
}

Future<void> _pumpApp(
  WidgetTester tester,
  Widget child, {
  Size size = const Size(393, 852),
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.runAsync(loadUiFonts);
  await tester.pumpWidget(
    MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      home: Scaffold(body: child),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets(
    'tapping progressMilestone_B1 opens CefrMilestoneDetailPage with filters and locked dialog',
    (tester) async {
      final grammarController = GrammarController(repository: _StubGrammarRepository());
      final daily = DailyLearningController(
        repository: _StubDailyRepository(),
        accountId: 'user-b1',
        isCurrent: () => true,
      )..progress = {
        'placementCefr': 'B1',
        'milestones': [
          {'cefrLevel': 'B1', 'totalLessons': 4, 'completedLessonCount': 1, 'status': 'IN_PROGRESS'},
        ],
      };
      final learning = LearningController(
        repository: _StubLearningRepository(),
        accountId: 'user-b1',
        daily: daily,
      )
        ..summary = {'completedLessonCount': 1, 'totalLessons': 4}
        ..lessons = [
          LearningLesson({'id': 'r-b1', 'title': 'Đọc B1', 'kind': 'READING', 'cefrLevel': 'B1', 'estimatedMinutes': 8, 'state': 'COMPLETED'}),
          LearningLesson({'id': 'w-b1', 'title': 'Viết B1', 'kind': 'WRITING', 'cefrLevel': 'B1', 'estimatedMinutes': 10, 'state': 'NOT_STARTED'}),
          LearningLesson({'id': 's-b1', 'title': 'Nói B1', 'kind': 'SPEAKING', 'cefrLevel': 'B1', 'estimatedMinutes': 10, 'state': 'NOT_STARTED'}),
        ];

      await _pumpApp(
        tester,
        ProgressDashboard(
          model: PreviewModel(),
          level: 'B1',
          learning: learning,
          daily: daily,
          grammarController: grammarController,
        ),
      );

      await tester.tap(find.byKey(const Key('progressMilestone_B1')));
      await tester.pumpAndSettle();

      expect(find.byType(CefrMilestoneDetailPage), findsOneWidget);
      expect(find.byKey(const Key('milestoneFilterAll')), findsOneWidget);
      expect(find.byKey(const Key('milestoneFilterGrammar')), findsOneWidget);
      expect(find.byKey(const Key('milestoneFilterListening')), findsOneWidget);
      expect(find.byKey(const Key('milestoneFilterReading')), findsOneWidget);

      // No Writing or Speaking shown
      expect(find.text('Viết B1'), findsNothing);
      expect(find.text('Nói B1'), findsNothing);
      expect(find.text('Đọc B1'), findsOneWidget);
      expect(find.text('Chưa có bài nghe ở mốc B1.'), findsOneWidget);

      // Filter to Listening empty state
      await tester.ensureVisible(find.byKey(const Key('milestoneFilterListening')));
      await tester.tap(find.byKey(const Key('milestoneFilterListening')));
      await tester.pumpAndSettle();
      expect(find.text('Chưa có bài nghe ở mốc B1.'), findsOneWidget);
      expect(find.text('Đọc B1'), findsNothing);

      // Filter to Reading
      await tester.ensureVisible(find.byKey(const Key('milestoneFilterReading')));
      await tester.tap(find.byKey(const Key('milestoneFilterReading')));
      await tester.pumpAndSettle();
      expect(find.text('Đọc B1'), findsOneWidget);

      // Filter to Grammar & test locked dialog flow (A1 prereq exempted, B1 prereq blocks)
      await tester.ensureVisible(find.byKey(const Key('milestoneFilterGrammar')));
      await tester.tap(find.byKey(const Key('milestoneFilterGrammar')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('milestoneGrammar_grammar.tenses.present_perfect_cont')));
      await tester.tap(find.byKey(const Key('milestoneGrammar_grammar.tenses.present_perfect_cont')));
      await tester.pumpAndSettle();

      expect(find.textContaining('Thì Hiện tại hoàn thành'), findsWidgets);
      expect(find.textContaining('Thì Hiện tại đơn'), findsNothing);

      await tester.tap(find.byKey(const ValueKey('grammar-locked-learn')));
      await tester.pumpAndSettle();
      expect(find.byType(GrammarTopicDetailPage), findsOneWidget);
      expect(find.text('Thì Hiện tại hoàn thành'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('narrow 320px viewport on ProgressDashboard and CefrMilestoneDetailPage renders without overflow', (
    tester,
  ) async {
    final daily =
        DailyLearningController(
            repository: _StubDailyRepository(),
            accountId: 'user-2',
            isCurrent: () => true,
          )
          ..progress = {
            'units': [],
            'days': [],
            'scoreStats': {'averageScore': null, 'deltaPercent': null},
            'totals': {'averageStudyMinutes': 0},
          };
    final learning = LearningController(
      repository: _StubLearningRepository(),
      accountId: 'user-2',
      daily: daily,
    )..summary = {'completedLessonCount': 0, 'totalLessons': 4};

    await _pumpApp(
      tester,
      ProgressDashboard(
        model: PreviewModel(),
        level: 'A1',
        onLevelTap: () {},
        learning: learning,
        daily: daily,
      ),
      size: const Size(320, 640),
    );

    await tester.scrollUntilVisible(
      find.byKey(const Key('progressAverageScore')),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pumpAndSettle();

    expect(find.text('—'), findsOneWidget);
    expect(find.text('Chưa đủ dữ liệu tuần trước'), findsOneWidget);
    expect(find.text('0p'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await _pumpApp(
      tester,
      const CefrMilestoneDetailPage(milestoneCefr: 'B1'),
      size: const Size(320, 640),
    );
    expect(find.text('Mốc B1'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('LearningCatalogue hides < placementCefr by default and toggles previous levels', (
    tester,
  ) async {
    final repo = ApiLearningRepository(_B1PreviewApi());
    final learning = LearningController(
      repository: repo,
      accountId: 'user-b1',
      fetchHome: repo.home,
    );
    await tester.runAsync(learning.loadCatalogue);
    bool showPrevious = false;

    await _pumpApp(
      tester,
      Scaffold(
        body: StatefulBuilder(
          builder: (context, setState) => SingleChildScrollView(
            child: LearningCatalogue(
              controller: learning,
              kinds: const ['VOCABULARY'],
              placementCefr: 'B1',
              showPreviousLevels: showPrevious,
              onTogglePreviousLevels: () => setState(() => showPrevious = !showPrevious),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Từ vựng A1 Gia đình'), findsNothing);
    expect(find.text('Từ vựng B1 Công việc'), findsOneWidget);
    expect(find.byKey(const Key('catalogueTogglePreviousLevels')), findsOneWidget);

    await tester.ensureVisible(find.byKey(const Key('catalogueTogglePreviousLevels')));
    await tester.tap(find.byKey(const Key('catalogueTogglePreviousLevels')));
    await tester.pumpAndSettle();

    expect(find.text('Từ vựng A1 Gia đình'), findsOneWidget);
    expect(find.text('Ẩn các bậc trước đó'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('LearningCatalogue shows placement hint instead of empty-published when all lessons are below placementCefr', (
    tester,
  ) async {
    final repo = ApiLearningRepository(_OnlyA1VocabApi());
    final learning = LearningController(
      repository: repo,
      accountId: 'user-b1-only-a1',
      fetchHome: repo.home,
    );
    await tester.runAsync(learning.loadCatalogue);
    bool showPrevious = false;

    await _pumpApp(
      tester,
      Scaffold(
        body: StatefulBuilder(
          builder: (context, setState) => SingleChildScrollView(
            child: LearningCatalogue(
              controller: learning,
              kinds: const ['VOCABULARY'],
              placementCefr: 'B1',
              showPreviousLevels: showPrevious,
              onTogglePreviousLevels: () => setState(() => showPrevious = !showPrevious),
            ),
          ),
        ),
      ),
    );

    expect(find.text('Chưa có bài học được xuất bản.'), findsNothing);
    expect(find.textContaining('Chưa có bài học từ bậc B1 trở lên'), findsOneWidget);
    expect(find.byKey(const Key('catalogueTogglePreviousLevels')), findsOneWidget);

    await tester.tap(find.byKey(const Key('catalogueTogglePreviousLevels')));
    await tester.pumpAndSettle();

    expect(find.text('Từ vựng A1 Gia đình'), findsOneWidget);
    expect(find.text('Ẩn các bậc trước đó'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

class _OnlyA1VocabApi extends _B1PreviewApi {
  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Duration? receiveTimeout,
  }) async {
    if (path == '/learning/lessons') {
      return {
        'items': [
          {
            'id': 'v-a1',
            'code': 'vocab-a1',
            'kind': 'VOCABULARY',
            'title': 'Từ vựng A1 Gia đình',
            'description': 'A1',
            'estimatedMinutes': 5,
            'cefrLevel': 'A1',
            'state': 'NOT_STARTED',
          },
        ],
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
