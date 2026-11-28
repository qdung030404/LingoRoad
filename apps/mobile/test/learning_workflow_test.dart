import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_colors.dart';
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
import 'package:mobile/shared/history_controls.dart';

part 'learning_workflow_fakes.dart';
part 'learning_workflow_part2.dart';
part 'learning_workflow_part3.dart';
part 'learning_workflow_part4.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  test(
    'failed cancellation keeps an offline answer until the retry succeeds',
    () async {
      final repo = MemoryLearningRepository()..offline = true;
      final owner = LearningController(repository: repo, accountId: 'alice');
      final controller = LearningAttemptController(owner: owner);
      await controller.load(attemptId: 'attempt');
      await controller.select('q0', 'b');
      expect(await controller.cancel(), isFalse);
      expect(controller.selected('q0'), 'b');
      controller.dispose();

      final restored = LearningAttemptController(owner: owner);
      await restored.load(attemptId: 'attempt');
      expect(restored.selected('q0'), 'b');
      expect(repo.cancelledIds, isEmpty);
      repo.offline = false;
      expect(await restored.cancel(), isTrue);
      expect(repo.cancelledIds, ['attempt']);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.containsKey('learning.pending.alice.attempt'), isFalse);
      restored.dispose();
      owner.dispose();
    },
  );
  testWidgets(
    'catalogue shows the empty message only after a successful fetch',
    (tester) async {
      final owner = LearningController(
        repository: MemoryLearningRepository(),
        accountId: 'alice',
        fetchHome: () async => {},
      );
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ListenableBuilder(
              listenable: owner,
              builder: (_, _) => LearningCatalogue(
                controller: owner,
                kinds: const ['READING'],
              ),
            ),
          ),
        ),
      );
      const label = 'Chưa có bài học được xuất bản.';
      expect(find.text(label), findsNothing);
      await owner.loadCatalogue();
      await tester.pumpAndSettle();
      expect(find.text(label), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
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
  testWidgets('level dropdown fits beside history and can reset the filter', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 720));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final owner =
        LearningController(
            repository: MemoryLearningRepository(),
            accountId: 'alice',
          )
          ..lessons = [
            for (final level in ['A1', 'A2', 'B1', 'B2', 'C1'])
              LearningLesson({
                'id': level,
                'title': 'Bài đọc $level',
                'kind': 'READING',
                'cefrLevel': level,
              }),
          ];
    addTearDown(owner.dispose);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: LearningCatalogue(
              controller: owner,
              kinds: const ['READING'],
              onOpenHistory: () {},
            ),
          ),
        ),
      ),
    );
    final dropdown = find.byKey(const ValueKey('practice-level-dropdown'));
    final history = find.byTooltip('Lịch sử làm bài');
    final historyPosition = tester.getCenter(history);
    final all = find.widgetWithText(
      CheckedPopupMenuItem<String>,
      'Tất cả cấp độ',
    );
    final c1 = find.widgetWithText(CheckedPopupMenuItem<String>, 'C1');
    expect(tester.getCenter(dropdown).dy, historyPosition.dy);
    expect(c1, findsNothing);
    await tester.tap(dropdown);
    await tester.pumpAndSettle();
    expect(tester.widget<CheckedPopupMenuItem<String>>(all).checked, isTrue);
    await tester.tap(c1);
    await tester.pumpAndSettle();
    expect(tester.getCenter(history), historyPosition);
    expect(find.text('Bài đọc C1'), findsOneWidget);
    expect(find.text('Bài đọc A1'), findsNothing);
    await tester.tap(dropdown);
    await tester.pumpAndSettle();
    expect(tester.widget<CheckedPopupMenuItem<String>>(c1).checked, isTrue);
    await tester.tap(all);
    await tester.pumpAndSettle();
    expect(find.text('Bài đọc A1'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

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
      await tester.tap(find.byKey(const ValueKey('practice-level-dropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(CheckedPopupMenuItem<String>, 'A2'));
      await tester.pumpAndSettle();
      expect(
        tester.widget<Text>(find.text('Cấp độ A2')).style?.color,
        Colors.white,
      );
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
          (widget) =>
              widget is FigmaAsset && widget.asset == 'reading/imgCheck',
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
    'long press confirms hiding one completed history card and handles failure',
    (tester) async {
      final repository = MemoryLearningRepository();
      for (final id in ['first', 'second']) {
        repository.historyRows.add({
          ...historyItem(id),
          'lesson': {'title': 'Same lesson'},
          'status': 'COMPLETED',
          'result': {'correctCount': 1, 'totalQuestions': 5},
        });
      }
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      await tester.pumpWidget(
        MaterialApp(
          home: LearningHistoryPage(controller: owner, kind: 'LISTENING'),
        ),
      );
      await tester.pumpAndSettle();
      final first = find.byKey(const ValueKey('learning-history-first'));
      final second = find.byKey(const ValueKey('learning-history-second'));
      final confirm = find.text('Xóa 1 lượt');

      await tester.longPress(first);
      await tester.pumpAndSettle();
      expect(confirm, findsOneWidget);
      await tester.tap(find.text('Hủy'));
      await tester.pumpAndSettle();
      expect(repository.hiddenHistoryIds, isEmpty);

      repository.offline = true;
      await tester.longPress(first);
      await tester.pumpAndSettle();
      await tester.tap(confirm);
      await tester.pumpAndSettle();
      expect(find.text('Offline'), findsOneWidget);
      expect(first, findsOneWidget);

      repository.offline = false;
      await tester.longPress(first);
      await tester.pumpAndSettle();
      await tester.tap(confirm);
      await tester.pumpAndSettle();
      expect(repository.hiddenHistoryIds, ['first']);
      expect(first, findsNothing);
      expect(second, findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );

  testWidgets(
    'history selection confirms a batch, keeps it on failure, and hides only chosen cards',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 680);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final repository = MemoryLearningRepository();
      for (final id in ['first', 'second', 'third']) {
        repository.historyRows.add({
          ...historyItem(id),
          'lesson': {'title': 'Lesson $id'},
          'status': 'COMPLETED',
          'result': {'correctCount': 1, 'totalQuestions': 5},
        });
      }
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningHistoryPage(controller: owner, kind: 'READING'),
        ),
      );
      await tester.pumpAndSettle();
      final enter = find.byTooltip('Chọn lượt để xóa');
      final first = find.byKey(const ValueKey('learning-history-select-first'));
      final second = find.byKey(
        const ValueKey('learning-history-select-second'),
      );
      final submit = find.text('Xóa');
      final confirm = find.text('Xóa 2 lượt');
      expect(first, findsNothing);
      final title = find.text('Lịch sử luyện đọc');
      final trashCenter = tester.getCenter(enter);
      expect(trashCenter.dx, greaterThan(tester.getCenter(title).dx));
      expect(tester.getTopRight(enter).dx, lessThanOrEqualTo(320 - 12));
      final lessonTitle = find.text('Lesson first');
      final initialTitleX = tester.getTopLeft(lessonTitle).dx;

      await tester.tap(enter);
      await tester.pumpAndSettle();
      final exitSelection = find.byWidgetPredicate(
        (widget) =>
            widget is IconButton && widget.tooltip == 'Thoát chế độ chọn',
      );
      expect(tester.getCenter(exitSelection), trashCenter);
      expect(
        tester.getCenter(find.byTooltip('Quay lại')).dx,
        lessThan(tester.getCenter(title).dx),
      );
      expect(tester.getSize(exitSelection), const Size.square(48));
      final exitStyle = tester.widget<IconButton>(exitSelection).style;
      expect(exitStyle?.fixedSize?.resolve({}), const Size.square(44));
      expect(exitStyle?.backgroundColor?.resolve({}), AppColors.error0);
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).enabled,
        false,
      );
      await tester.tap(first);
      await tester.tap(find.text('Lesson second'));
      await tester.pumpAndSettle();
      expect(tester.getTopLeft(lessonTitle).dx, initialTitleX);
      expect(tester.getCenter(first).dx, greaterThan(initialTitleX));
      expect(
        find.descendant(
          of: first,
          matching: find.byWidgetPredicate(
            (widget) =>
                widget is FigmaAsset &&
                widget.asset == 'review/imgVuesaxLinearTickCircle',
          ),
        ),
        findsOneWidget,
      );
      expect(tester.widget<HistorySelectionMark>(first).selected, true);
      expect(tester.widget<HistorySelectionMark>(second).selected, true);

      await tester.tap(submit);
      await tester.pumpAndSettle();
      expect(find.text('Xóa 2 lượt khỏi lịch sử?'), findsOneWidget);
      final sheet = find.byType(BottomSheet);
      expect(find.descendant(of: sheet, matching: lessonTitle), findsOneWidget);
      expect(
        find.descendant(
          of: sheet,
          matching: find.text('Điểm và tiến độ học đã ghi nhận vẫn được giữ.'),
        ),
        findsOneWidget,
      );
      await tester.tap(find.text('Hủy'));
      await tester.pumpAndSettle();
      expect(repository.hiddenHistoryBatches, isEmpty);
      expect(find.text('Đã chọn 2 lượt'), findsOneWidget);

      await tester.tap(exitSelection);
      await tester.pumpAndSettle();
      expect(first, findsNothing);
      expect(lessonTitle, findsOneWidget);
      expect(repository.hiddenHistoryBatches, isEmpty);
      await tester.tap(enter);
      await tester.pumpAndSettle();
      expect(find.text('Chưa chọn lượt nào'), findsOneWidget);
      await tester.tap(first);
      await tester.tap(second);
      await tester.pumpAndSettle();

      repository.offline = true;
      await tester.tap(submit);
      await tester.pumpAndSettle();
      await tester.tap(confirm);
      await tester.pumpAndSettle();
      expect(find.text('Offline'), findsOneWidget);
      expect(tester.widget<HistorySelectionMark>(first).selected, true);
      expect(tester.widget<HistorySelectionMark>(second).selected, true);
      await tester.pump(const Duration(seconds: 5));
      await tester.pumpAndSettle();

      repository.offline = false;
      await tester.tap(submit);
      await tester.pumpAndSettle();
      await tester.tap(confirm);
      await tester.pumpAndSettle();
      expect(repository.hiddenHistoryBatches, [
        <String>['first', 'second'],
      ]);
      expect(find.text('Lesson first'), findsNothing);
      expect(find.text('Lesson second'), findsNothing);
      expect(find.text('Lesson third'), findsOneWidget);
      expect(enter, findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );

  _registerLearningWorkflowPart2Tests();
  _registerLearningWorkflowPart3Tests();
  _registerLearningWorkflowPart4Tests();
}
