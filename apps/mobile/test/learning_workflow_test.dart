import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/learning/activity_clock.dart';
import 'package:mobile/features/learning/daily_learning.dart';
import 'package:mobile/features/learning/learning_controller.dart';
import 'package:mobile/features/learning/learning_pages.dart';
import 'package:mobile/features/learning/learning_repository.dart';
import 'package:mobile/features/learning/learning_widgets.dart';
import 'package:mobile/features/vocabulary/vocabulary_controller.dart';
import 'package:mobile/features/vocabulary/vocabulary_repository.dart';
import 'package:mobile/shared/app_button.dart';
import 'package:mobile/shared/figma_widgets.dart';

Json copy(Json data) =>
    Map<String, dynamic>.from(jsonDecode(jsonEncode(data)) as Map);

class MemoryLearningRepository implements LearningRepository {
  Json state = {
    'id': 'attempt',
    'version': 0,
    'status': 'IN_PROGRESS',
    'lesson': {
      'id': 'lesson',
      'title': 'Everyday Introductions',
      'kind': 'READING',
    },
    'position': {'phase': 'QUIZ', 'index': 0},
    'content': {'steps': []},
    'questions': [
      for (var i = 0; i < 5; i++)
        {
          'id': 'q$i',
          'prompt': 'Question $i',
          'options': [
            {'id': 'a', 'text': 'Answer A'},
            {'id': 'b', 'text': 'Answer B'},
          ],
        },
    ],
    'answers': [],
    'result': null,
  };
  bool offline = false;
  bool failCancel = false;
  bool dropCheckResponse = false;
  int checks = 0;
  int progressCalls = 0;
  Json? nextSubmitLevelChange;
  final List<String> cancelledIds = [];
  int _seq = 1;
  Completer<void>? delayed;
  final Map<String, String> questionEvidence = {};
  LearningAttempt snapshot() => LearningAttempt(copy(state));
  void _guard(Json body) {
    if (offline) throw const ApiFailure('Offline');
    if (body['expectedVersion'] != state['version']) {
      throw const ApiFailure('Conflict', status: 409);
    }
  }

  @override
  Future<LearningAttempt> attempt(String id) async => snapshot();
  @override
  Future<LearningAttempt> start(String id) async {
    if (offline) throw const ApiFailure('Offline');
    return snapshot();
  }

  @override
  Future<LearningAttempt> progress(String id, Json body) async {
    progressCalls++;
    await delayed?.future;
    _guard(body);
    state['position'] = {'phase': body['phase'], 'index': body['index']};
    if (body.containsKey('questionId')) {
      final answers = state['answers'] as List;
      answers.removeWhere((a) => a['questionId'] == body['questionId']);
      answers.add({
        'questionId': body['questionId'],
        'optionId': body['optionId'],
        'checked': false,
      });
    }
    state['version'] = (state['version'] as int) + 1;
    return snapshot();
  }

  @override
  Future<LearningAttempt> check(String id, String questionId, Json body) async {
    if (snapshot().answer(questionId)?['checked'] == true &&
        snapshot().answer(questionId)?['optionId'] == body['optionId']) {
      return snapshot();
    }
    _guard(body);
    checks++;
    final answers = state['answers'] as List;
    answers.removeWhere((a) => a['questionId'] == questionId);
    answers.add({
      'questionId': questionId,
      'optionId': body['optionId'],
      'checked': true,
      'isCorrect': body['optionId'] == 'a',
      'correctOptionId': 'a',
      'explanation': 'Server explanation',
      if (questionEvidence[questionId] case final String evidence)
        'evidence': evidence,
    });
    state['version'] = (state['version'] as int) + 1;
    if (dropCheckResponse) {
      dropCheckResponse = false;
      throw const ApiFailure('Response lost');
    }
    return snapshot();
  }

  @override
  Future<LearningAttempt> submit(String id, int version) async {
    _guard({'expectedVersion': version});
    if ((state['answers'] as List).where((a) => a['checked'] == true).length !=
        (state['questions'] as List).length) {
      throw const ApiFailure('Incomplete', status: 400);
    }
    state['status'] = 'COMPLETED';
    state['result'] = {
      'correctCount': (state['answers'] as List)
          .where((a) => a['isCorrect'] == true)
          .length,
      'totalQuestions': 5,
      'scoreRatio': 0,
    };
    state['version'] = version + 1;
    final out = snapshot();
    if (nextSubmitLevelChange != null) {
      out.json['levelChange'] = copy(nextSubmitLevelChange!);
      nextSubmitLevelChange = null;
    }
    return out;
  }

  @override
  Future<void> cancel(String id) async {
    if (offline || failCancel) throw const ApiFailure('Offline');
    cancelledIds.add(id);
    state['id'] = 'attempt-${++_seq}';
    state['version'] = 0;
    state['status'] = 'IN_PROGRESS';
    state['position'] = {
      'phase': ((state['content'] as Json)['steps'] as List).isNotEmpty
          ? 'STUDY'
          : 'QUIZ',
      'index': 0,
    };
    state['answers'] = [];
    state['result'] = null;
  }

  @override
  Future<Json> catalogue() async => {'items': []};

  @override
  Future<Json> lesson(String lessonId) async => {
    ...(state['lesson'] as Json),
    'content': state['content'],
  };
  @override
  Future<Json> explainReadingAnswer(String id, String questionId) async {
    explainCalls++;
    if (explainHandler != null) return explainHandler!(id, questionId);
    return {
      'questionId': questionId,
      'explanation': 'Server explanation',
      'source': 'CURRICULUM',
    };
  }

  int explainCalls = 0;
  Future<Json> Function(String id, String questionId)? explainHandler;

  @override
  Future<Json> history({String? cursor}) async => {
    'items': [],
    'nextCursor': null,
  };
  @override
  Future<Json> summary() async => {};
  @override
  String audioUrl(String path) => path;
}

class DelayedHistoryRepository extends MemoryLearningRepository {
  final requests = <Completer<Json>>[];
  @override
  Future<Json> history({String? cursor}) {
    final request = Completer<Json>();
    requests.add(request);
    return request.future;
  }
}

Json historyItem(String id) => {
  'id': id,
  'lesson': {'title': id},
  'status': 'IN_PROGRESS',
  'updatedAt': '2026-11-01T10:00:00Z',
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  test(
    'offline draft survives controller recreation and belongs only to its account',
    () async {
      final repository = MemoryLearningRepository()..offline = true;
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      final first = LearningAttemptController(owner: owner);
      await first.load(attemptId: 'attempt');
      await first.select('q0', 'b');
      expect(await first.flush(), false);
      expect(repository.checks, 0);
      first.dispose();
      final restored = LearningAttemptController(owner: owner);
      await restored.load(attemptId: 'attempt');
      expect(restored.selected('q0'), 'b');
      expect(restored.unsynced, true);
      final bob = LearningController(repository: repository, accountId: 'bob');
      final other = LearningAttemptController(owner: bob);
      await other.load(attemptId: 'attempt');
      expect(other.selected('q0'), null);
      repository.offline = false;
      expect(await restored.flush(), true);
      await restored.check('q0');
      expect(restored.attempt!.answer('q0')!['checked'], true);
      restored.dispose();
      other.dispose();
      owner.dispose();
      bob.dispose();
    },
  );
  test(
    'stale draft reloads locked server answer and does not overwrite it',
    () async {
      final repository = MemoryLearningRepository();
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      final controller = LearningAttemptController(owner: owner);
      await controller.load(attemptId: 'attempt');
      await controller.select('q0', 'b');
      await repository.check('attempt', 'q0', {
        'expectedVersion': 0,
        'optionId': 'a',
      });
      expect(await controller.flush(), false);
      expect(controller.selected('q0'), 'a');
      expect(controller.notice, isNotNull);
      expect(controller.unsynced, false);
      expect(repository.checks, 1);
      controller.dispose();
      owner.dispose();
    },
  );
  test(
    'account invalidation ignores delayed responses and keeps pending account draft',
    () async {
      var current = true;
      final repository = MemoryLearningRepository()
        ..delayed = Completer<void>();
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
        isAccountCurrent: () => current,
      );
      final controller = LearningAttemptController(owner: owner);
      await controller.load(attemptId: 'attempt');
      await controller.select('q0', 'b');
      final sync = controller.flush();
      await Future<void>.delayed(Duration.zero);
      current = false;
      repository.delayed!.complete();
      expect(await sync, false);
      expect(controller.attempt!.version, 0);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.containsKey('learning.pending.alice.attempt'), true);
      controller.dispose();
      owner.dispose();
    },
  );
  test(
    'failed position move stays on server position and resumes after retry',
    () async {
      final repository = MemoryLearningRepository();
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      final controller = LearningAttemptController(owner: owner);
      await controller.load(attemptId: 'attempt');
      repository.offline = true;
      await controller.move('QUIZ', 1);
      expect(controller.index, 0);
      expect(controller.unsynced, true);
      repository.offline = false;
      expect(await controller.flush(), true);
      expect(controller.index, 1);
      controller.dispose();
      owner.dispose();
    },
  );
  testWidgets(
    'lost check response exposes retry that recovers feedback without grading twice',
    (tester) async {
      final repository = MemoryLearningRepository()..dropCheckResponse = true;
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(owner: owner, lessonId: 'lesson'),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('learning-option-b')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();
      expect(find.text('Response lost'), findsOneWidget);
      expect(find.text('Server explanation'), findsNothing);
      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();
      expect(find.text('Server explanation'), findsOneWidget);
      expect(find.text('Response lost'), findsNothing);
      expect(repository.checks, 1);
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
  testWidgets(
    'filters reading by CEFR and opens the passage without losing a choice',
    (tester) async {
      final repository = MemoryLearningRepository();
      final a2 = <String, dynamic>{
        'id': 'lesson',
        'title': 'A New Time for the Club Meeting',
        'kind': 'READING',
        'cefrLevel': 'A2',
      };
      const passage = 'The book club will meet in Room 12.';
      repository.state['lesson'] = a2;
      repository.state['content'] = {'steps': [], 'passage': passage};
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      owner.lessons = [
        LearningLesson({
          'id': 'a1',
          'title': 'Everyday Introductions',
          'kind': 'READING',
          'cefrLevel': 'A1',
        }),
        LearningLesson(a2),
      ];
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: SingleChildScrollView(
              child: LearningCatalogue(
                controller: owner,
                kinds: const ['READING'],
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.widgetWithText(ChoiceChip, 'A2'));
      await tester.pumpAndSettle();
      expect(find.text('Everyday Introductions'), findsNothing);
      await tester.tap(find.text('A New Time for the Club Meeting'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('learningStart')));
      await tester.pumpAndSettle();
      final option = find.byKey(const ValueKey('learning-option-a'));
      await tester.tap(option);
      await tester.pump();
      expect(tester.widget<AnswerOption>(option).selected, isTrue);
      expect(
        find.byWidgetPredicate(
          (widget) => widget is FigmaAsset && widget.asset == 'reading/imgCheck',
        ),
        findsNothing,
      );
      await tester.tap(find.text('Xem toàn bộ'));
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsOneWidget);
      expect(find.text(passage), findsWidgets);
      Navigator.of(tester.element(find.byType(BottomSheet))).pop();
      await tester.pumpAndSettle();
      expect(find.text('Câu 1/5'), findsOneWidget);
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();
      expect(repository.snapshot().answer('q0')?['isCorrect'], isTrue);
      await tester.drag(find.byType(ListView), const Offset(0, -400));
      await tester.pumpAndSettle();
      expect(find.text('Chính xác!'), findsOneWidget);
      await tester.tap(find.text('1/5'));
      await tester.pumpAndSettle();
      expect(find.text('Danh sách câu hỏi'), findsOneWidget);
      expect(
        tester.widget<ListTile>(find.widgetWithText(ListTile, 'Câu 3')).enabled,
        isFalse,
      );
      await tester.tap(find.text('Câu 2'));
      await tester.pumpAndSettle();
      expect(find.text('Câu 2/5'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
  testWidgets(
    'checks each question, shows server feedback, and submits zero correct answers',
    (tester) async {
      final repository = MemoryLearningRepository();
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(owner: owner, lessonId: 'lesson'),
        ),
      );
      await tester.pumpAndSettle();
      for (var i = 0; i < 5; i++) {
        expect(find.text('Question $i'), findsOneWidget);
        await tester.tap(find.byKey(const ValueKey('learning-option-b')));
        await tester.pump();
        await tester.tap(find.byKey(const Key('learningPrimaryAction')));
        await tester.pumpAndSettle();
        expect(find.text('Server explanation'), findsOneWidget);
        expect(find.text('Chưa chính xác'), findsOneWidget);
        await tester.tap(find.byKey(const Key('learningPrimaryAction')));
        await tester.pumpAndSettle();
      }
      expect(find.text('0/5 câu đúng'), findsOneWidget);
      expect(repository.checks, 5);
      expect(repository.state['status'], 'COMPLETED');
      repository.offline = true;
      await tester.tap(find.text('Làm lại'));
      await tester.pumpAndSettle();
      expect(find.text('Offline'), findsOneWidget);
      expect(find.text('0/5 câu đúng'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
  testWidgets(
    'refresh supersedes in-flight history pagination without duplicated stale rows',
    (tester) async {
      final repository = DelayedHistoryRepository();
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningHistoryPage(controller: owner),
        ),
      );
      repository.requests[0].complete({
        'items': [historyItem('initial')],
        'nextCursor': 'page2',
      });
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xem thêm'));
      await tester.pump();
      final refresh = tester
          .widget<RefreshIndicator>(find.byType(RefreshIndicator))
          .onRefresh();
      await tester.pump();
      expect(repository.requests, hasLength(3));
      repository.requests[2].complete({
        'items': [historyItem('fresh')],
        'nextCursor': null,
      });
      await refresh;
      await tester.pumpAndSettle();
      repository.requests[1].complete({
        'items': [historyItem('stale')],
        'nextCursor': null,
      });
      await tester.pumpAndSettle();
      expect(find.text('fresh'), findsOneWidget);
      expect(find.text('stale'), findsNothing);
      expect(find.text('initial'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
  testWidgets(
    'shows reading evidence after check, highlights it in full-passage bottom sheet, renders questionCount, and preserves evidence in result view',
    (tester) async {
      const startEvidence = 'Subject: A new time for our book club meeting';
      const endEvidence =
          'If you cannot come on Thursday, please email me by Wednesday evening.';
      final passage =
          '$startEvidence\n\n'
          '${'The school library is closed on Wednesday afternoon so members cannot gather there as planned earlier this semester. ' * 2}'
          '$endEvidence I will send a book list.';
      final repository = MemoryLearningRepository();
      repository.state['lesson'] = {
        'id': 'lesson',
        'title': 'Club Schedule',
        'kind': 'READING',
        'cefrLevel': 'A2',
        'estimatedMinutes': 7,
        'questionCount': 8,
      };
      repository.state['content'] = {'steps': [], 'passage': passage};
      repository.questionEvidence['q0'] = startEvidence;
      repository.questionEvidence['q4'] = endEvidence;

      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      )..lessons = [LearningLesson(copy(repository.state['lesson'] as Json))];

      List<Text> highlightedTexts(Finder scope, String needle) => tester
          .widgetList<Text>(scope)
          .where((widget) => widget.textSpan is TextSpan)
          .where(
            (widget) =>
                ((widget.textSpan! as TextSpan).children ?? const [])
                    .whereType<TextSpan>()
                    .any(
                      (span) =>
                          span.text == needle &&
                          span.style?.backgroundColor == const Color(0xFFFFF3C4),
                    ),
          )
          .toList();

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningLessonIntroPage(owner: owner, lessonId: 'lesson'),
        ),
      );
      expect(find.text('7 phút · 8 câu luyện tập'), findsOneWidget);

      await tester.tap(find.byKey(const Key('learningStart')));
      await tester.pumpAndSettle();

      // Q1: evidence near the start highlights both in the 3-line preview card and in the full-passage BottomSheet.
      expect(find.text('Dẫn chứng trong bài'), findsNothing);
      await tester.tap(find.byKey(const ValueKey('learning-option-a')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();

      await tester.drag(find.byType(ListView), const Offset(0, -300));
      await tester.pumpAndSettle();
      expect(find.text('Dẫn chứng trong bài'), findsOneWidget);
      expect(find.text('"$startEvidence"'), findsOneWidget);

      await tester.drag(find.byType(ListView), const Offset(0, 300));
      await tester.pumpAndSettle();
      final q1Collapsed = highlightedTexts(find.byType(Text), startEvidence);
      expect(q1Collapsed, hasLength(1));
      expect(q1Collapsed.single.maxLines, 3);
      expect(q1Collapsed.single.overflow, TextOverflow.ellipsis);

      await tester.tap(find.text('Xem toàn bộ'));
      await tester.pumpAndSettle();
      final q1Sheet = highlightedTexts(
        find.descendant(
          of: find.byType(BottomSheet),
          matching: find.byType(Text),
        ),
        startEvidence,
      );
      expect(q1Sheet, hasLength(1));
      expect(q1Sheet.single.maxLines, isNull);
      Navigator.of(tester.element(find.byType(BottomSheet))).pop();
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();
      for (var i = 1; i < 4; i++) {
        await tester.tap(find.byKey(const ValueKey('learning-option-a')));
        await tester.pump();
        await tester.tap(find.byKey(const Key('learningPrimaryAction')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('learningPrimaryAction')));
        await tester.pumpAndSettle();
      }

      // Q5: evidence near the end keeps 3-line clipping on card and shows highlight in BottomSheet.
      await tester.tap(find.byKey(const ValueKey('learning-option-a')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();

      await tester.drag(find.byType(ListView), const Offset(0, -300));
      await tester.pumpAndSettle();
      expect(find.text('Dẫn chứng trong bài'), findsOneWidget);
      expect(find.text('"$endEvidence"'), findsOneWidget);

      await tester.drag(find.byType(ListView), const Offset(0, 300));
      await tester.pumpAndSettle();
      final q5Collapsed = highlightedTexts(find.byType(Text), endEvidence);
      expect(q5Collapsed, hasLength(1));
      expect(q5Collapsed.single.maxLines, 3);
      expect(q5Collapsed.single.overflow, TextOverflow.ellipsis);

      await tester.tap(find.text('Xem toàn bộ'));
      await tester.pumpAndSettle();
      final q5Sheet = highlightedTexts(
        find.descendant(
          of: find.byType(BottomSheet),
          matching: find.byType(Text),
        ),
        endEvidence,
      );
      expect(q5Sheet, hasLength(1));
      expect(q5Sheet.single.maxLines, isNull);
      Navigator.of(tester.element(find.byType(BottomSheet))).pop();
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();

      expect(find.text('Kết quả bài học'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('"$startEvidence"'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.byType(LearningResultQuestionCard), findsWidgets);
      expect(find.text('Dẫn chứng trong bài'), findsWidgets);
      expect(find.text('"$startEvidence"'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('"$endEvidence"'),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(find.byType(LearningResultQuestionCard), findsWidgets);
      expect(find.text('"$endEvidence"'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
  testWidgets(
    'keeps ActivityCollector counting while viewing full passage bottom sheet, stops on idle >60s, and pauses on background',
    (tester) async {
      var clockMs = 10000;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            NativeActivityClock.channel,
            (_) async => clockMs,
          );
      addTearDown(() {
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(NativeActivityClock.channel, null);
      });

      final dailyRepo = _MemoryDailyRepository();
      final daily = DailyLearningController(
        repository: dailyRepo,
        accountId: 'alice',
        isCurrent: () => true,
      );
      final learningRepo = MemoryLearningRepository();
      learningRepo.state['lesson'] = {
        'id': 'lesson',
        'title': 'Club Meeting',
        'kind': 'READING',
        'cefrLevel': 'A2',
      };
      learningRepo.state['content'] = {
        'steps': [],
        'passage': List.filled(40, 'Sample sentence in reading passage.').join(' '),
      };
      final owner = LearningController(
        repository: learningRepo,
        accountId: 'alice',
        daily: daily,
      );

      int totalRecordedMs() =>
          dailyRepo.sentSegments.fold<int>(
            0,
            (sum, row) =>
                sum +
                ((row['endOffsetMs'] as num) - (row['startOffsetMs'] as num))
                    .toInt(),
          ) +
          (owner.activity?.entries
                  .where((e) => e['expired'] != true && e['rejected'] != true)
                  .fold<int>(
                    0,
                    (sum, row) =>
                        sum +
                        ((row['endOffsetMs'] as num) -
                                (row['startOffsetMs'] as num))
                            .toInt(),
                  ) ??
              0);

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(owner: owner, lessonId: 'lesson'),
        ),
      );
      await tester.pumpAndSettle();
      await tester.pump();
      expect(dailyRepo.openedAttempts, hasLength(1));

      await tester.tap(find.text('Xem toàn bộ'));
      await tester.pumpAndSettle();
      expect(find.byType(BottomSheet), findsOneWidget);

      // Actively interact inside the bottom sheet over 6 seconds while ModalRoute beneath is inactive.
      for (var i = 0; i < 6; i++) {
        clockMs += 1000;
        await tester.drag(
          find.descendant(
            of: find.byType(BottomSheet),
            matching: find.byType(SingleChildScrollView),
          ),
          const Offset(0, -40),
        );
        await tester.pump(const Duration(seconds: 1));
        await tester.pump();
      }
      expect(totalRecordedMs(), greaterThanOrEqualTo(5000));

      // Leave idle inside bottom sheet past 60s; sampling must stop adding time past the 60s window.
      for (var i = 0; i < 65; i++) {
        clockMs += 1000;
        await tester.pump(const Duration(seconds: 1));
        await tester.pump();
      }
      final recordedAtIdle = totalRecordedMs();
      for (var i = 0; i < 10; i++) {
        clockMs += 1000;
        await tester.pump(const Duration(seconds: 1));
        await tester.pump();
      }
      expect(totalRecordedMs(), recordedAtIdle);

      // Interacting again inside the bottom sheet resumes counting.
      await tester.drag(
        find.descendant(
          of: find.byType(BottomSheet),
          matching: find.byType(SingleChildScrollView),
        ),
        const Offset(0, -40),
      );
      await tester.pump();
      for (var i = 0; i < 6; i++) {
        clockMs += 1000;
        await tester.pump(const Duration(seconds: 1));
        await tester.pump();
      }
      expect(totalRecordedMs(), greaterThan(recordedAtIdle));

      // Backgrounding app flushes open segment and pauses further counting.
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();
      await tester.pump();
      expect(dailyRepo.sentSegments, isNotEmpty);
      final recordedOnPause = totalRecordedMs();
      for (var i = 0; i < 6; i++) {
        clockMs += 1000;
        await tester.pump(const Duration(seconds: 1));
        await tester.pump();
      }
      expect(totalRecordedMs(), recordedOnPause);

      Navigator.of(tester.element(find.byType(BottomSheet))).pop();
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
      daily.dispose();
    },
  );

  testWidgets(
    'supports reading STUDY steps, question type badges, Not Given without evidence, and reading word saving/reopen sync',
    (tester) async {
      final vocabRepo = _MemoryVocabularyRepository();
      final vocabController = VocabularyController(
        repository: vocabRepo,
        accountId: 'alice',
        isCurrent: () => true,
      );
      final learningRepo = MemoryLearningRepository();
      learningRepo.state = {
        'id': 'attempt-b1',
        'version': 0,
        'status': 'IN_PROGRESS',
        'lesson': {
          'id': 'reading-b1',
          'title': 'Remote Work Charter',
          'kind': 'READING',
          'cefrLevel': 'B1',
        },
        'position': {'phase': 'STUDY', 'index': 0},
        'content': {
          'steps': [
            {
              'id': 's1',
              'title': 'Từ khóa: asynchronous',
              'word': 'asynchronous',
              'phonetic': '/eɪˈsɪŋkrənəs/',
              'meaning': 'không đồng thời',
              'body': 'Giao tiếp không đòi hỏi phản hồi tức thì.',
              'example': 'Teams rely on asynchronous updates.',
            },
            {
              'id': 's2',
              'title': 'Mẹo đọc nhanh',
              'body': 'Đọc lướt câu đầu từng đoạn trước khi trả lời.',
            },
          ],
          'passage':
              'Employees may choose core hours while sharing asynchronous notes every morning.',
          'keyVocabulary': [
            {
              'id': 'w1',
              'word': 'asynchronous',
              'phonetic': '/eɪˈsɪŋkrənəs/',
              'meaning': 'không đồng thời',
              'example': 'Teams rely on asynchronous updates.',
            },
          ],
        },
        'questions': [
          {
            'id': 'q0',
            'type': 'GAP_FILL',
            'prompt': 'Staff share ___ updates every morning.',
            'options': [
              {'id': 'a', 'text': 'asynchronous'},
              {'id': 'b', 'text': 'delayed'},
              {'id': 'c', 'text': 'manual'},
              {'id': 'd', 'text': 'weekly'},
            ],
          },
          {
            'id': 'q1',
            'type': 'TRUE_FALSE_NOT_GIVEN',
            'prompt': 'The company pays for home internet bills.',
            'options': [
              {'id': 'a', 'text': 'True'},
              {'id': 'b', 'text': 'False'},
              {'id': 'c', 'text': 'Not Given'},
            ],
          },
          {
            'id': 'q2',
            'type': 'MULTIPLE_CHOICE',
            'prompt': 'What is the main topic?',
            'options': [
              {'id': 'a', 'text': 'Flexible work norms'},
              {'id': 'b', 'text': 'Office lunches'},
              {'id': 'c', 'text': 'Travel refunds'},
              {'id': 'd', 'text': 'Annual audits'},
            ],
          },
        ],
        'answers': [],
        'result': null,
      };
      learningRepo.questionEvidence['q0'] = 'sharing asynchronous notes';

      final owner = LearningController(
        repository: learningRepo,
        accountId: 'alice',
        vocabulary: vocabController,
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningLessonIntroPage(owner: owner, lessonId: 'reading-b1'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Từ vựng trọng tâm'), findsOneWidget);
      final saveWord = find.byKey(const ValueKey('reading-save-word-w1'));
      await tester.ensureVisible(saveWord);
      await tester.tap(saveWord);
      await tester.pumpAndSettle();
      expect(find.text('Đã lưu'), findsOneWidget);
      expect(vocabRepo.savedBodies, hasLength(1));
      expect(vocabRepo.savedBodies.single['english'], 'asynchronous');
      expect(vocabRepo.savedBodies.single['commandId'], isNotEmpty);
      await tester.tap(find.byKey(const Key('learningStart')));
      await tester.pumpAndSettle();

      // STUDY phase hides question-picker button and advances to QUIZ.
      expect(find.text('Học 1/2'), findsOneWidget);
      expect(find.text('asynchronous'), findsOneWidget);
      expect(find.text('1/2'), findsNothing);

      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();
      expect(find.text('Học 2/2'), findsOneWidget);
      expect(find.text('Bắt đầu luyện tập'), findsOneWidget);

      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();

      // Q1 shows the passage without the vocabulary section from the intro.
      expect(find.text('Staff share ___ updates every morning.'), findsOneWidget);
      expect(find.text('Điền khuyết'), findsNothing);
      await tester.tap(find.text('Xem toàn bộ'));
      await tester.pumpAndSettle();
      expect(find.text('Từ vựng trọng tâm'), findsNothing);
      expect(saveWord, findsNothing);

      Navigator.of(tester.element(find.byType(BottomSheet))).pop();
      await tester.pumpAndSettle();

      // Answer Q1 and move to Q2 (TRUE_FALSE_NOT_GIVEN without evidence).
      await tester.tap(find.byKey(const ValueKey('learning-option-a')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();

      expect(find.text('The company pays for home internet bills.'), findsOneWidget);
      expect(find.text('Đúng / Sai / Không đề cập'), findsNothing);
      expect(find.text('Trắc nghiệm'), findsNothing);
      await tester.drag(find.byType(ListView), const Offset(0, -250));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('learning-option-c')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();
      expect(find.text('Dẫn chứng trong bài'), findsNothing);

      // Reopen the intro after deleting the word on the server.
      vocabRepo.activeItems.clear();
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningLessonIntroPage(owner: owner, lessonId: 'reading-b1'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Lưu'), findsOneWidget);
      expect(find.text('Đã lưu'), findsNothing);

      await tester.pumpWidget(const SizedBox());
      vocabController.dispose();
      owner.dispose();
    },
  );

  testWidgets(
    'keeps saved state when delayed initial GET resolves after POST',
    (tester) async {
      final getGate = Completer<void>();
      final vocabRepo = _MemoryVocabularyRepository()
        ..delayedGetReadingWords = getGate;
      final vocabController = VocabularyController(
        repository: vocabRepo,
        accountId: 'alice',
        isCurrent: () => true,
      );
      final learningRepo = MemoryLearningRepository();
      learningRepo.state = {
        'id': 'attempt-race',
        'version': 0,
        'status': 'IN_PROGRESS',
        'lesson': {
          'id': 'reading-race',
          'title': 'Race Guard Reading',
          'kind': 'READING',
          'cefrLevel': 'B1',
        },
        'position': {'phase': 'QUIZ', 'index': 0},
        'content': {
          'steps': [],
          'passage': 'Teams rely on asynchronous updates every morning.',
          'keyVocabulary': [
            {
              'id': 'w1',
              'word': 'asynchronous',
              'meaning': 'không đồng thời',
            },
          ],
        },
        'questions': [
          {
            'id': 'q0',
            'type': 'MULTIPLE_CHOICE',
            'prompt': 'What do teams rely on?',
            'options': [
              {'id': 'a', 'text': 'Asynchronous updates'},
              {'id': 'b', 'text': 'Paper memos'},
            ],
          },
        ],
        'answers': [],
        'result': null,
      };
      final owner = LearningController(
        repository: learningRepo,
        accountId: 'alice',
        vocabulary: vocabController,
      );

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningLessonIntroPage(owner: owner, lessonId: 'reading-race'),
        ),
      );
      await tester.pumpAndSettle();

      // Save from the intro before the initial saved-word request resolves.
      final saveWord = find.byKey(const ValueKey('reading-save-word-w1'));
      await tester.ensureVisible(saveWord);
      await tester.tap(saveWord);
      await tester.pumpAndSettle();
      expect(find.text('Đã lưu'), findsOneWidget);

      // Now let the stale initial GET (captured empty before POST) complete afterwards.
      getGate.complete();
      await tester.pumpAndSettle();
      expect(find.text('Đã lưu'), findsOneWidget);
      expect(find.text('Lưu'), findsNothing);

      await tester.pumpWidget(const SizedBox());
      vocabController.dispose();
      owner.dispose();
    },
  );

  testWidgets(
    'asks AI to explain checked reading questions, deduplicates fallback text, allows retry on transient failure, and hides retry when context is insufficient',
    (tester) async {
      final repo = MemoryLearningRepository();
      repo.state = {
        'id': 'attempt-ai-explain',
        'version': 0,
        'status': 'IN_PROGRESS',
        'lesson': {
          'id': 'reading-ai',
          'title': 'Urban Parks',
          'kind': 'READING',
          'cefrLevel': 'B2',
        },
        'position': {'phase': 'QUIZ', 'index': 0},
        'content': {
          'steps': [],
          'passage':
              'Urban pocket parks cool nearby streets. City planners measure shade in July.',
        },
        'questions': [
          {
            'id': 'q0',
            'type': 'MULTIPLE_CHOICE',
            'prompt': 'What do pocket parks cool?',
            'options': [
              {'id': 'a', 'text': 'Nearby streets'},
              {'id': 'b', 'text': 'Subways'},
            ],
          },
          {
            'id': 'q1',
            'type': 'TRUE_FALSE_NOT_GIVEN',
            'prompt': 'Planners will plant palms next winter.',
            'options': [
              {'id': 'a', 'text': 'True'},
              {'id': 'b', 'text': 'False'},
              {'id': 'c', 'text': 'Not Given'},
            ],
          },
        ],
        'answers': [],
        'result': null,
      };
      final q0FirstGate = Completer<Json>();
      final q0RetryGate = Completer<Json>();
      var q0Attempts = 0;
      repo.explainHandler = (id, qId) {
        if (qId == 'q0') {
          q0Attempts++;
          return q0Attempts == 1 ? q0FirstGate.future : q0RetryGate.future;
        }
        return Future.value({
          'questionId': qId,
          'explanation': 'Server explanation',
          'source': 'CURRICULUM',
          'retryable': false,
        });
      };

      final owner = LearningController(repository: repo, accountId: 'alice');
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(owner: owner, lessonId: 'reading-ai'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const ValueKey('learning-ai-explain-q0')), findsNothing);
      await tester.tap(find.byKey(const ValueKey('learning-option-a')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();

      final listScrollable = find.descendant(
        of: find.byType(ListView),
        matching: find.byType(Scrollable),
      );
      final explainBtn = find.byKey(const ValueKey('learning-ai-explain-q0'));
      await tester.scrollUntilVisible(explainBtn, 250, scrollable: listScrollable);
      await tester.drag(listScrollable, const Offset(0, -140));
      await tester.pumpAndSettle();
      await tester.tap(explainBtn);
      await tester.pump();
      expect(find.text('Đang giải thích...'), findsOneWidget);
      await tester.tap(explainBtn, warnIfMissed: false);
      await tester.pump();
      expect(repo.explainCalls, 1);

      // Transient fallback: keeps original explanation once and keeps retry button enabled.
      q0FirstGate.complete({
        'questionId': 'q0',
        'explanation': 'Server explanation',
        'source': 'CURRICULUM',
        'retryable': true,
      });
      await tester.pumpAndSettle();
      expect(find.text('Giải thích từ học liệu'), findsOneWidget);
      expect(find.text('Server explanation'), findsOneWidget);
      expect(find.text('Thử lại giải thích AI'), findsOneWidget);

      await tester.scrollUntilVisible(explainBtn, 200, scrollable: listScrollable);
      await tester.drag(listScrollable, const Offset(0, -100));
      await tester.pumpAndSettle();
      await tester.tap(explainBtn);
      await tester.pump();
      expect(find.text('Đang giải thích...'), findsOneWidget);
      q0RetryGate.complete({
        'questionId': 'q0',
        'explanation': 'Đoạn văn nêu rõ "cool nearby streets" nên đáp án đúng là Nearby streets.',
        'source': 'AI',
      });
      await tester.pumpAndSettle();
      expect(find.text('Giải thích AI'), findsOneWidget);
      expect(find.byType(ReadingAnswerFeedbackCard), findsOneWidget);
      expect(find.byType(ReadingAiExplainCard), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(ReadingAnswerFeedbackCard),
          matching: find.byType(ReadingAiExplainCard),
        ),
        findsNothing,
      );
      expect(
        find.text('Đoạn văn nêu rõ "cool nearby streets" nên đáp án đúng là Nearby streets.'),
        findsOneWidget,
      );
      expect(explainBtn, findsNothing);

      // Insufficient context fallback: keeps one curriculum explanation and hides retry button.
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();
      final q1OptC = find.byKey(const ValueKey('learning-option-c'));
      await tester.scrollUntilVisible(q1OptC, 200, scrollable: listScrollable);
      await tester.tap(q1OptC);
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();

      final q1Btn = find.byKey(const ValueKey('learning-ai-explain-q1'));
      await tester.scrollUntilVisible(q1Btn, 250, scrollable: listScrollable);
      await tester.drag(listScrollable, const Offset(0, -140));
      await tester.pumpAndSettle();
      await tester.tap(q1Btn);
      await tester.pumpAndSettle();
      expect(find.text('Giải thích từ học liệu'), findsOneWidget);
      expect(find.text('Server explanation'), findsOneWidget);
      expect(q1Btn, findsNothing);

      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
  testWidgets(
    'strips redundant Markdown explanation headers and renders inline bold safely',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const ReadingAnswerFeedbackCard(
                    isCorrect: true,
                    explanation: 'Đáp án khớp câu dẫn chứng.',
                    evidence: 'manicured lawns with decorative fences',
                  ),
                  const SizedBox(height: 12),
                  ReadingAiExplainCard(
                    questionId: 'q-md',
                    originalExplanation: 'Đáp án khớp câu dẫn chứng.',
                    ai: const {
                      'source': 'AI',
                      'explanation':
                          'Lựa chọn của bạn chính xác.\n\n**Giải thích:**\nTác giả nhắc **manicured lawns** như ví dụ.',
                    },
                    explaining: false,
                    errorText: null,
                    onExplain: () {},
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Dẫn chứng trong bài'), findsOneWidget);
      expect(
        find.text('"manicured lawns with decorative fences"'),
        findsOneWidget,
      );
      expect(find.text('Giải thích AI'), findsOneWidget);
      expect(find.textContaining('**'), findsNothing);
      final boldSpans = tester
          .widgetList<Text>(find.byType(Text))
          .map((widget) => widget.textSpan)
          .whereType<TextSpan>()
          .expand((root) => root.children ?? const <InlineSpan>[])
          .whereType<TextSpan>()
          .where(
            (span) =>
                span.text == 'manicured lawns' &&
                span.style?.fontWeight == FontWeight.w600,
          );
      expect(boldSpans, hasLength(1));
    },
  );
  testWidgets(
    'confirming exit cancels attempt, clears outbox and draft, and resets on next start',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      var clockMs = 10000;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(NativeActivityClock.channel, (call) async {
            if (call.method == 'elapsedRealtimeMilliseconds') {
              return clockMs += 500;
            }
            return null;
          });
      addTearDown(
        () => TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(NativeActivityClock.channel, null),
      );
      final repository = MemoryLearningRepository();
      final dailyRepository = _MemoryDailyRepository();
      final daily = DailyLearningController(
        repository: dailyRepository,
        accountId: 'alice',
        isCurrent: () => true,
      );
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
        daily: daily,
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Builder(
            builder: (context) => Scaffold(
              body: ElevatedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) =>
                        LearningAttemptPage(owner: owner, lessonId: 'lesson'),
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

      await tester.tap(find.byKey(const ValueKey('learning-option-a')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();
      expect(find.text('Câu 2/5'), findsOneWidget);

      final sessionId = dailyRepository.lastSessionId!;
      await owner.activity!.add({
        'sessionId': sessionId,
        'seq': 99,
        'startOffsetMs': 0,
        'endOffsetMs': 4000,
      });

      // Tapping Thoát opens confirmation; Ở lại preserves current question.
      await tester.tap(find.byTooltip('Thoát'));
      await tester.pumpAndSettle();
      expect(find.text('Hủy bài đang làm?'), findsOneWidget);
      await tester.tap(find.text('Ở lại'));
      await tester.pumpAndSettle();
      expect(find.text('Câu 2/5'), findsOneWidget);
      expect(repository.cancelledIds, isEmpty);

      // Confirming Hủy bài & thoát cancels attempt and pops back.
      await tester.tap(find.byTooltip('Thoát'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Hủy bài & thoát'));
      await tester.pumpAndSettle();
      expect(find.text('Open lesson'), findsOneWidget);
      expect(repository.cancelledIds, ['attempt']);
      expect(
        owner.activity!.entries.where((e) => e['sessionId'] == sessionId),
        isEmpty,
      );

      final prefs = await SharedPreferences.getInstance();
      expect(
        prefs.getKeys().where((k) => k.startsWith('learning.pending.')),
        isEmpty,
      );

      // Reopening starts from scratch at Câu 1/5 with clean answers.
      await tester.tap(find.text('Open lesson'));
      await tester.pumpAndSettle();
      expect(find.text('Câu 1/5'), findsOneWidget);
      expect(repository.snapshot().answers, isEmpty);

      await tester.pumpWidget(const SizedBox());
      owner.dispose();
      daily.dispose();
    },
  );
  testWidgets(
    'exiting completed result screen leaves without cancel confirmation',
    (tester) async {
      final repository = MemoryLearningRepository();
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Builder(
            builder: (context) => Scaffold(
              body: ElevatedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) =>
                        LearningAttemptPage(owner: owner, lessonId: 'lesson'),
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
      for (var i = 0; i < 5; i++) {
        await tester.tap(find.byKey(const ValueKey('learning-option-a')));
        await tester.pump();
        await tester.tap(find.byKey(const Key('learningPrimaryAction')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('learningPrimaryAction')));
        await tester.pumpAndSettle();
      }
      expect(find.text('Kết quả bài học'), findsOneWidget);

      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();
      expect(find.text('Hủy bài đang làm?'), findsNothing);
      expect(find.text('Open lesson'), findsOneWidget);
      expect(repository.cancelledIds, isEmpty);

      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
  testWidgets(
    'selecting and changing options stays responsive without debounced progress lock',
    (tester) async {
      final repository = MemoryLearningRepository()
        ..delayed = Completer<void>();
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(owner: owner, lessonId: 'lesson'),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey('learning-option-a')));
      await tester.pump();
      expect(
        tester
            .widget<CustomAppButton>(find.byKey(const Key('learningPrimaryAction')))
            .onPressed,
        isNotNull,
      );

      // Even past the legacy 500ms debounce window, no progress sync locks UI.
      await tester.pump(const Duration(milliseconds: 800));
      expect(repository.progressCalls, 0);

      await tester.tap(find.byKey(const ValueKey('learning-option-b')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();

      expect(repository.progressCalls, 0);
      expect(repository.checks, 1);
      expect(find.text('Server explanation'), findsOneWidget);

      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
  testWidgets(
    'shows recommended reading level banner on submit UP/DOWN and omits it when reopening from history',
    (tester) async {
      final repository = MemoryLearningRepository()
        ..nextSubmitLevelChange = {
          'kind': 'READING',
          'from': 'A2',
          'to': 'B1',
          'direction': 'UP',
        };
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(owner: owner, lessonId: 'lesson'),
        ),
      );
      await tester.pumpAndSettle();

      for (var i = 0; i < 5; i++) {
        await tester.tap(find.byKey(const ValueKey('learning-option-a')));
        await tester.pump();
        await tester.tap(find.byKey(const Key('learningPrimaryAction')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('learningPrimaryAction')));
        await tester.pumpAndSettle();
      }

      expect(find.byKey(const Key('learningLevelChangeBanner')), findsOneWidget);
      expect(find.text('Mức luyện tập đề xuất: Đọc B1 ↑'), findsOneWidget);

      // Reopening completed attempt from history does not carry transient levelChange banner.
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(
            key: const Key('historyAttemptPage'),
            owner: owner,
            attemptId: 'attempt',
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Kết quả bài học'), findsOneWidget);
      expect(find.byKey(const Key('learningLevelChangeBanner')), findsNothing);

      // Verify DOWN banner wording.
      final downRepo = MemoryLearningRepository()
        ..nextSubmitLevelChange = {
          'kind': 'READING',
          'from': 'B1',
          'to': 'A2',
          'direction': 'DOWN',
        };
      final downOwner = LearningController(
        repository: downRepo,
        accountId: 'alice',
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(owner: downOwner, lessonId: 'lesson'),
        ),
      );
      await tester.pumpAndSettle();
      for (var i = 0; i < 5; i++) {
        await tester.tap(find.byKey(const ValueKey('learning-option-b')));
        await tester.pump();
        await tester.tap(find.byKey(const Key('learningPrimaryAction')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('learningPrimaryAction')));
        await tester.pumpAndSettle();
      }
      expect(
        find.text('Điều chỉnh mức luyện tập đề xuất: Đọc A2 ↓'),
        findsOneWidget,
      );

      await tester.pumpWidget(const SizedBox());
      owner.dispose();
      downOwner.dispose();
    },
  );
}

class _MemoryVocabularyRepository implements VocabularyRepository {
  final List<Json> activeItems = [];
  final List<Json> savedBodies = [];
  Completer<void>? delayedGetReadingWords;

  @override
  Future<Json> request(String method, String path, {Json? body}) async {
    if (method == 'GET' && path == '/vocabulary/reading-words') {
      final snapshot = [for (final item in activeItems) copy(item)];
      await delayedGetReadingWords?.future;
      return {
        'deck': {'id': 'reading-deck', 'name': 'Từ vựng Bài đọc'},
        'items': snapshot,
      };
    }
    if (method == 'POST' && path == '/vocabulary/reading-words') {
      final entry = copy(body ?? {});
      savedBodies.add(entry);
      activeItems.add({
        'id': 'word-${savedBodies.length}',
        'english': entry['english'],
        'meaning': entry['meaning'],
        'phonetic': entry['phonetic'],
      });
      return {
        'receipt': {'commandId': entry['commandId']},
        'deck': {'id': 'reading-deck', 'name': 'Từ vựng Bài đọc'},
        'word': copy(activeItems.last),
        'alreadyExisted': false,
      };
    }
    if (method == 'GET' && path == '/vocabulary/summary') {
      return {
        'deckCount': 1,
        'wordCount': activeItems.length,
        'dueCount': 0,
        'masteredCount': 0,
      };
    }
    if (method == 'GET' && path.startsWith('/vocabulary/decks')) {
      return {'items': [], 'nextCursor': null};
    }
    return {};
  }
}

class _MemoryDailyRepository implements DailyRepository {
  final List<String> openedAttempts = [];
  final List<Json> sentSegments = [];
  String? lastSessionId;

  @override
  Future<Json> openActivity(String attemptId, String runId) async {
    openedAttempts.add(attemptId);
    lastSessionId = runId;
    return {
      'sessionId': runId,
      'anchorAt': '2026-11-02T00:00:00Z',
      'serverNow': '2026-11-02T00:00:00Z',
      'collectUntil': '2026-11-03T00:00:00Z',
      'uploadUntil': '2026-11-09T00:00:00Z',
    };
  }

  @override
  Future<Json> sendSegments(String sessionId, List<Json> segments) async {
    sentSegments.addAll(segments);
    return {
      'acks': [
        for (final row in segments) {'seq': row['seq']},
      ],
    };
  }

  @override
  Future<Json> ensurePlan() async => {'plan': null};

  @override
  Future<Json> preferences() async => {
    'version': 0,
    'dailyGoalMinutes': 10,
    'preferredKinds': ['READING'],
  };

  @override
  Future<Json> progress() async => {
    'today': {'activeSeconds': 0, 'goalMet': false},
    'days': [],
    'totals': {},
  };

  @override
  Future<Json> savePreferences(Json body) async => body;
}
