import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/learning/daily_learning.dart';
import 'package:mobile/features/learning/home_cache.dart';
import 'package:mobile/features/learning/learning_controller.dart';
import 'package:mobile/features/learning/learning_preview.dart';
import 'package:mobile/features/learning/learning_repository.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/learning/progress_dashboard.dart';
import 'package:mobile/features/placement/placement_pages.dart' show ResultPage;
import 'package:mobile/features/profile/profile_page.dart';
import 'package:mobile/features/vocabulary/vocabulary_controller.dart';
import 'package:mobile/features/vocabulary/vocabulary_repository.dart';
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

class _StubVocabularyRepository implements VocabularyRepository {
  @override
  Future<Json> uploadImage(String filePath) => throw UnsupportedError('Unexpected image upload');
  @override
  Future<Json> request(String method, String path, {Json? body}) async => {};
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
          {'id': 'r-b1', 'title': 'Đọc hiểu B1 Công nghệ', 'kind': 'READING', 'cefrLevel': 'B1', 'description': 'Bài đọc B1', 'estimatedMinutes': 10, 'state': 'COMPLETED'},
          {'id': 'l-b1', 'title': 'Nghe hiểu B1 Du lịch', 'kind': 'LISTENING', 'cefrLevel': 'B1', 'description': 'Bài nghe B1', 'estimatedMinutes': 7, 'state': 'NOT_STARTED'},
          {'id': 'w-b1', 'title': 'Viết B1 Email', 'kind': 'WRITING', 'cefrLevel': 'B1', 'description': 'Không hiển thị', 'estimatedMinutes': 12, 'state': 'NOT_STARTED'},
        ],
      };
    }
    if (path == '/grammar/levels') {
      return {
        'levels': [
          {'cefrLevel': 'A1', 'topicCount': 1, 'lessonCount': 1, 'completedCount': 0},
          {'cefrLevel': 'A2', 'topicCount': 1, 'lessonCount': 1, 'completedCount': 0},
          {'cefrLevel': 'B1', 'topicCount': 1, 'lessonCount': 1, 'completedCount': 0},
          {'cefrLevel': 'B2', 'topicCount': 0, 'lessonCount': 0, 'completedCount': 0},
          {'cefrLevel': 'C1', 'topicCount': 0, 'lessonCount': 0, 'completedCount': 0},
          {'cefrLevel': 'C2', 'topicCount': 0, 'lessonCount': 0, 'completedCount': 0},
        ],
      };
    }
    if (path.startsWith('/grammar/tree')) {
      return {
        'tree': [
          {
            'id': 'g-root',
            'code': 'grammar.tenses',
            'parentCode': 'grammar',
            'cefrLevel': 'A1',
            'isLeaf': false,
            'titleEn': 'Tenses',
            'titleVi': 'Các thì',
            'summaryVi': '',
            'orderIndex': 1,
            'prerequisiteCodes': [],
            'lessonCount': 3,
            'children': [
              {'id': 'g-a1', 'code': 'grammar.a1_to_be', 'parentCode': 'grammar.tenses', 'cefrLevel': 'A1', 'isLeaf': true, 'titleEn': 'To Be A1', 'titleVi': 'Động từ To Be (A1)', 'summaryVi': '', 'orderIndex': 1, 'prerequisiteCodes': [], 'lessonCount': 1, 'learnerStatus': 'AVAILABLE', 'children': []},
              {'id': 'g-a2', 'code': 'grammar.a2_past', 'parentCode': 'grammar.tenses', 'cefrLevel': 'A2', 'isLeaf': true, 'titleEn': 'Past Simple', 'titleVi': 'Quá khứ đơn (A2)', 'summaryVi': '', 'orderIndex': 2, 'prerequisiteCodes': [], 'lessonCount': 1, 'learnerStatus': 'AVAILABLE', 'children': []},
              {'id': 'g-b1', 'code': 'grammar.b1_perfect', 'parentCode': 'grammar.tenses', 'cefrLevel': 'B1', 'isLeaf': true, 'titleEn': 'Present Perfect', 'titleVi': 'Hiện tại hoàn thành (B1)', 'summaryVi': '', 'orderIndex': 3, 'prerequisiteCodes': [], 'lessonCount': 1, 'learnerStatus': 'AVAILABLE', 'children': []},
            ],
          },
        ],
      };
    }
    if (path == '/vocabulary/summary') {
      return {
        'totals': {'totalWords': 20, 'rememberedWords': 10},
        'decks': [],
      };
    }
    if (path == '/vocabulary/curated-topics') {
      return {
        'topics': [
          {
            'slug': 'daily-life',
            'titleVi': 'Cuộc sống hằng ngày',
            'titleEn': 'Daily Life',
            'cefrLevel': 'B1',
            'totalWords': 10,
          },
        ],
      };
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
  bool settle = true,
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
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets(
    'sample preview renders CEFR milestones, improvement stats and disclaimer',
    (tester) async {
      final model = PreviewModel();
      await _pumpApp(tester, LearningPreview(model: model));

      await tester.tap(find.byKey(const Key('previewTab4')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('progressRoadmapCard')), findsOneWidget);
      expect(find.byKey(const Key('progressAvatar')), findsOneWidget);
      expect(find.text('Tiến độ'), findsWidgets);
      expect(find.text('Lộ trình A1'), findsOneWidget);
      expect(find.text('Đã hoàn thành 3 trên 12 bài'), findsOneWidget);
      expect(find.byKey(const Key('progressMilestone_A1')), findsOneWidget);
      expect(find.byKey(const Key('progressMilestone_B1')), findsOneWidget);
      expect(find.text('3/12 bài'), findsOneWidget);
      expect(find.text('0/18 bài'), findsOneWidget);
      expect(find.text('Mốc hiện tại'), findsOneWidget);

      await tester.scrollUntilVisible(
        find.byKey(const Key('progressImprovementCard')),
        200,
        scrollable: find.descendant(
          of: find.byKey(const PageStorageKey('preview-content-3')),
          matching: find.byType(Scrollable),
        ).first,
      );
      await tester.pumpAndSettle();

      expect(find.text('Bạn đã tiến bộ thế nào'), findsOneWidget);
      expect(find.text('Điểm trung bình'), findsOneWidget);
      expect(find.text('6% so với tuần trước'), findsOneWidget);
      expect(find.text('40p'), findsOneWidget);
      expect(find.text('49'), findsOneWidget);
      expect(
        find.text('Tiến độ minh họa trên thiết bị; không phải kết quả đánh giá.'),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'live progress renders unit fallback milestone, stats, daily card and avatar tap',
    (tester) async {
      final daily =
          DailyLearningController(
              repository: _StubDailyRepository(),
              accountId: 'user-1',
              isCurrent: () => true,
            )
            ..preferences = {'dailyTargetMinutes': 15}
            ..progress = {
              'today': {
                'date': '2026-11-13',
                'goalMinutes': 15,
                'activeMinutes': 25,
                'activeSeconds': 1500,
                'metGoal': true,
                'plannedCount': 2,
                'completedPlannedCount': 1,
                'timeMeasured': true,
              },
              'streak': {'currentDays': 3, 'longestDays': 5},
              'days': [
                for (var i = 0; i < 6; i++)
                  {
                    'date': '2026-11-0${i + 7}',
                    'activeMinutes': 10,
                    'activeSeconds': 600,
                    'metGoal': false,
                    'timeMeasured': true,
                  },
                {
                  'date': '2026-11-13',
                  'activeMinutes': 25,
                  'activeSeconds': 1500,
                  'metGoal': true,
                  'timeMeasured': true,
                },
              ],
              'units': [
                {
                  'orderIndex': 1,
                  'title': 'Làm quen',
                  'totalLessons': 3,
                  'completedLessonCount': 3,
                  'status': 'COMPLETED',
                },
                {
                  'orderIndex': 2,
                  'title': 'Gia đình',
                  'totalLessons': 1,
                  'completedLessonCount': 0,
                  'status': 'IN_PROGRESS',
                },
              ],
              'scoreStats': {'averageScore': 84, 'deltaPercent': -5},
              'totals': {
                'activeSeconds': 5100,
                'averageActiveSeconds': 728,
                'averageStudyMinutes': 12,
                'completedLessonCount': 3,
                'totalLessons': 4,
                'submittedAttemptCount': 3,
              },
              'recommendedLevels': {
                'reading': {
                  'cefrLevel': 'B1',
                  'source': 'ADAPTIVE',
                  'previousCefr': 'A2',
                  'changedAt': DateTime.now().toIso8601String(),
                },
              },
            };
      final learning = LearningController(
        repository: _StubLearningRepository(),
        accountId: 'user-1',
        daily: daily,
      )..summary = {'completedLessonCount': 3, 'totalLessons': 4};
      final vocab =
          VocabularyController(
              repository: _StubVocabularyRepository(),
              accountId: 'user-1',
              isCurrent: () => true,
            )
            ..summary = {
              'totals': {'rememberedWords': 18},
            };

      var openedProfile = false;
      var openedDaily = false;
      var openedHistory = false;

      await _pumpApp(
        tester,
        ProgressDashboard(
          model: PreviewModel(),
          level: 'A1',
          onProfile: () => openedProfile = true,
          learning: learning,
          daily: daily,
          vocabularyController: vocab,
          onOpenDailyPlan: () => openedDaily = true,
          onOpenHistory: () => openedHistory = true,
        ),
      );

      await tester.tap(find.byKey(const Key('progressAvatar')));
      await tester.pumpAndSettle();
      expect(openedProfile, isTrue);

      expect(find.text('Đã hoàn thành 3 trên 4 bài'), findsOneWidget);
      expect(find.byKey(const Key('progressMilestone_A1')), findsOneWidget);
      expect(find.text('3/4 bài'), findsOneWidget);

      await tester.scrollUntilVisible(
        find.byKey(const Key('progressRecommendedLevel')),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      expect(find.text('Mức luyện tập đề xuất'), findsOneWidget);
      expect(find.text('B1 ↑'), findsOneWidget);

      await tester.scrollUntilVisible(
        find.byKey(const Key('learningHistory')),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('84'), findsOneWidget);
      expect(find.text('5% so với tuần trước'), findsOneWidget);
      expect(find.text('12p'), findsOneWidget);
      expect(find.text('18'), findsOneWidget);

      await tester.tap(find.byKey(const Key('dailyPlanOpen')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('learningHistory')));
      await tester.pumpAndSettle();
      expect(openedDaily, isTrue);
      expect(openedHistory, isTrue);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('loading progress shows spinner and never 0 trên 0 bài', (tester) async {
    final daily = DailyLearningController(
      repository: _StubDailyRepository(),
      accountId: 'user-loading',
      isCurrent: () => true,
    )..loading = true;
    final learning = LearningController(
      repository: _StubLearningRepository(),
      accountId: 'user-loading',
      daily: daily,
    );

    await _pumpApp(
      tester,
      ProgressDashboard(
        model: PreviewModel(),
        level: 'B1',
        learning: learning,
        daily: daily,
      ),
      settle: false,
    );

    expect(
      find.descendant(
        of: find.byKey(const Key('progressRoadmapCard')),
        matching: find.byType(CircularProgressIndicator),
      ),
      findsOneWidget,
    );
    expect(find.text('Đã hoàn thành 0 trên 0 bài'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'B1 user hides A1/A2 by default, keeps Y=18, syncs toggle between Tab 5 and Tab 2, and opens ProfilePage',
    (tester) async {
      final api = _B1PreviewApi();
      final session = SessionController(api);
      await tester.runAsync(session.initialize);

      await _pumpApp(
        tester,
        LearningPreview(account: session),
      );

      // Go to Tab 5 (Progress)
      await tester.tap(find.byKey(const Key('previewTab4')));
      await tester.pumpAndSettle();

      expect(find.text('Đã hoàn thành 3 trên 18 bài'), findsOneWidget);
      expect(find.byKey(const Key('progressMilestone_A1')), findsNothing);
      expect(find.byKey(const Key('progressMilestone_A2')), findsNothing);
      expect(find.byKey(const Key('progressMilestone_B1')), findsOneWidget);
      expect(find.byKey(const Key('progressMilestone_C2')), findsOneWidget);
      expect(find.text('Xem các bậc trước đó'), findsOneWidget);

      // Toggle previous levels ON in Tab 5
      await tester.ensureVisible(find.byKey(const Key('progressTogglePreviousLevels')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('progressTogglePreviousLevels')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('progressMilestone_A1')), findsOneWidget);
      expect(find.byKey(const Key('progressMilestone_A2')), findsOneWidget);
      expect(find.text('Đã hoàn thành 3 trên 18 bài'), findsOneWidget);
      expect(find.text('Ẩn các bậc trước đó'), findsOneWidget);

      // Switch to Tab 2 (Road) and verify sync
      await tester.tap(find.byKey(const Key('previewTab1')));
      await tester.pumpAndSettle();
      expect(find.text('Động từ To Be (A1)'), findsOneWidget);
      expect(find.text('Hiện tại hoàn thành (B1)'), findsOneWidget);

      // Check Vocabulary sub-tab while showPreviousLevels = true vs false
      await tester.tap(find.text('Từ vựng'));
      await tester.pumpAndSettle();
      expect(find.text('Từ vựng A1 Gia đình'), findsOneWidget);
      expect(find.text('Từ vựng B1 Công việc'), findsOneWidget);

      await tester.tap(find.text('Ngữ pháp'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('grammarTogglePreviousLevels')));
      await tester.tap(find.byKey(const Key('grammarTogglePreviousLevels')));
      await tester.pumpAndSettle();
      expect(find.text('Động từ To Be (A1)'), findsNothing);
      expect(find.text('Hiện tại hoàn thành (B1)'), findsOneWidget);

      // Verify Vocabulary hides < B1 when toggled off
      await tester.tap(find.text('Từ vựng'));
      await tester.pumpAndSettle();
      expect(find.text('Từ vựng A1 Gia đình'), findsNothing);
      expect(find.text('Từ vựng B1 Công việc'), findsOneWidget);

      // Switch back to Tab 5 and verify synced off + ProfilePage flow
      await tester.tap(find.byKey(const Key('previewTab4')));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.byKey(const Key('progressAvatar')),
        -200,
        scrollable: find.descendant(
          of: find.byType(ProgressDashboard),
          matching: find.byType(Scrollable),
        ).first,
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('progressMilestone_A1')), findsNothing);
      expect(find.text('Đã hoàn thành 3 trên 18 bài'), findsOneWidget);

      await tester.tap(find.byKey(const Key('progressAvatar')));
      await tester.pumpAndSettle();
      expect(find.byType(ProfilePage), findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('viewPlacementResultButton')));
      await tester.tap(find.byKey(const Key('viewPlacementResultButton')));
      await tester.pumpAndSettle();
      expect(find.byType(ResultPage), findsOneWidget);
      Navigator.of(tester.element(find.byType(ResultPage))).pop();
      await tester.pumpAndSettle();

      await tester.scrollUntilVisible(
        find.byKey(const Key('logoutButton')),
        200,
        scrollable: find.descendant(
          of: find.byType(ProfilePage),
          matching: find.byType(Scrollable),
        ).first,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('logoutButton')));
      await tester.pumpAndSettle();
      expect(session.user, isNull);
      expect(session.stage, SessionStage.signedOut);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'completed B1+B2 with empty C1/C2 shows last populated milestone B2 instead of 0/0',
    (tester) async {
      final daily = DailyLearningController(
        repository: _StubDailyRepository(),
        accountId: 'user-b2-done',
        isCurrent: () => true,
      )..progress = {
          'placementCefr': 'B1',
          'totals': {'completedLessonCount': 4, 'totalLessons': 4},
          'milestones': [
            {'cefrLevel': 'A1', 'totalLessons': 2, 'completedLessonCount': 0, 'status': 'UPCOMING'},
            {'cefrLevel': 'A2', 'totalLessons': 2, 'completedLessonCount': 0, 'status': 'UPCOMING'},
            {'cefrLevel': 'B1', 'totalLessons': 2, 'completedLessonCount': 2, 'status': 'COMPLETED'},
            {'cefrLevel': 'B2', 'totalLessons': 2, 'completedLessonCount': 2, 'status': 'COMPLETED'},
            {'cefrLevel': 'C1', 'totalLessons': 0, 'completedLessonCount': 0, 'status': 'UPCOMING'},
            {'cefrLevel': 'C2', 'totalLessons': 0, 'completedLessonCount': 0, 'status': 'UPCOMING'},
          ],
          'days': const [],
        };
      final learning = LearningController(
        repository: _StubLearningRepository(),
        accountId: 'user-b2-done',
        daily: daily,
      );

      await _pumpApp(
        tester,
        ProgressDashboard(
          model: PreviewModel(),
          level: 'B1',
          learning: learning,
          daily: daily,
        ),
      );

      expect(find.text('Lộ trình B2'), findsOneWidget);
      expect(find.text('Đã hoàn thành 2 trên 2 bài'), findsOneWidget);
      expect(find.text('Đã hoàn thành 0 trên 0 bài'), findsNothing);
      expect(find.text('Đã hoàn thành các bài học hiện có trong lộ trình'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
