import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/learning/daily_learning.dart';
import 'package:mobile/features/learning/learning_controller.dart';
import 'package:mobile/features/learning/learning_preview.dart';
import 'package:mobile/features/learning/learning_repository.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/learning/progress_dashboard.dart';
import 'package:mobile/features/vocabulary/vocabulary_controller.dart';
import 'package:mobile/features/vocabulary/vocabulary_repository.dart';

class _StubLearningRepository implements LearningRepository {
  @override
  Future<Json> catalogue() async => {'items': []};

  @override
  Future<Json> lesson(String lessonId) => throw UnimplementedError();

  @override
  Future<Json> summary() async => {};

  @override
  Future<LearningAttempt> start(String lessonId) =>
      throw UnimplementedError();

  @override
  Future<LearningAttempt> attempt(String id) => throw UnimplementedError();

  @override
  Future<LearningAttempt> progress(String id, Json body) =>
      throw UnimplementedError();

  @override
  Future<LearningAttempt> check(String id, String questionId, Json body) =>
      throw UnimplementedError();

  @override
  Future<LearningAttempt> submit(String id, int version) =>
      throw UnimplementedError();

  @override
  Future<void> cancel(String id) async {}

  @override
  Future<Json> explainReadingAnswer(String id, String questionId) =>
      throw UnimplementedError();

  @override
  Future<Json> history({String? cursor}) async => {'items': []};

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
  Future<Json> request(String method, String path, {Json? body}) async => {};
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
  await tester.runAsync(() async {
    await (FontLoader(
      'Inter',
    )..addFont(rootBundle.load('assets/fonts/Inter-Variable.ttf'))).load();
    await (FontLoader(
      'Be Vietnam Pro',
    )..addFont(rootBundle.load('assets/fonts/BeVietnamPro-Medium.ttf'))).load();
  });
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

  testWidgets('sample preview renders roadmap, improvement stats and disclaimer', (
    tester,
  ) async {
    final model = PreviewModel();
    await _pumpApp(tester, LearningPreview(model: model));

    await tester.tap(find.byKey(const Key('previewTab4')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('progressRoadmapCard')), findsOneWidget);
    expect(find.text('Tiến độ'), findsWidgets);
    expect(find.text('Lộ trình A1'), findsOneWidget);
    expect(find.text('Đã hoàn thành 3 trên 26 bài'), findsOneWidget);
    expect(find.text('Chặng 1 · Làm quen và giới thiệu'), findsOneWidget);
    expect(find.text('3'), findsWidgets);
    expect(find.text('Còn 4 bài'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.byKey(const Key('progressImprovementCard')),
      200,
      scrollable: find.byType(Scrollable).first,
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
  });

  testWidgets('live progress renders completed unit, practice stats and daily card', (
    tester,
  ) async {
    final daily = DailyLearningController(
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
            'title': 'Làm quen và giới thiệu',
            'description': 'Chào hỏi, giới thiệu bản thân',
            'totalLessons': 3,
            'completedLessonCount': 3,
            'status': 'COMPLETED',
          },
          {
            'orderIndex': 2,
            'title': 'Gia đình và đồ vật',
            'description': 'Nói về gia đình, đồ vật',
            'totalLessons': 1,
            'completedLessonCount': 0,
            'status': 'IN_PROGRESS',
          },
          {
            'orderIndex': 3,
            'title': 'Thói quen và sở thích',
            'description': 'Kể thói quen',
            'totalLessons': 0,
            'completedLessonCount': 0,
            'status': 'UPCOMING',
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
      };
    final learning = LearningController(
      repository: _StubLearningRepository(),
      accountId: 'user-1',
      daily: daily,
    )..summary = {'completedLessonCount': 3, 'totalLessons': 4};
    final vocab = VocabularyController(
      repository: _StubVocabularyRepository(),
      accountId: 'user-1',
      isCurrent: () => true,
    )..summary = {
        'totals': {'rememberedWords': 18},
      };

    var openedDaily = false;
    var openedHistory = false;

    await _pumpApp(
      tester,
      ProgressDashboard(
        model: PreviewModel(),
        level: 'A1',
        onLevelTap: () {},
        learning: learning,
        daily: daily,
        vocabularyController: vocab,
        onOpenDailyPlan: () => openedDaily = true,
        onOpenHistory: () => openedHistory = true,
      ),
    );

    expect(find.text('Đã hoàn thành 3 trên 4 bài'), findsOneWidget);
    expect(find.text('Đang học chặng 2 · Gia đình và đồ vật'), findsOneWidget);
    expect(find.text('Hoàn thành 3/3 bài'), findsOneWidget);
    expect(find.text('Còn 1 bài'), findsOneWidget);

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
    expect(
      find.text('Điểm bài luyện tập đã nộp; không đổi mức CEFR.'),
      findsOneWidget,
    );
    expect(find.text('Hoạt động 7 ngày'), findsOneWidget);

    await tester.tap(find.byKey(const Key('dailyPlanOpen')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('learningHistory')));
    await tester.pumpAndSettle();
    expect(openedDaily, isTrue);
    expect(openedHistory, isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets('narrow 320px viewport and null stats render without overflow', (
    tester,
  ) async {
    final daily = DailyLearningController(
      repository: _StubDailyRepository(),
      accountId: 'user-2',
      isCurrent: () => true,
    )..progress = {
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
  });
}
