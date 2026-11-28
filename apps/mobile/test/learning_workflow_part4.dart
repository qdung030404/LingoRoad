part of 'learning_workflow_test.dart';

void _registerLearningWorkflowPart4Tests() {
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
            .widget<CustomAppButton>(
              find.byKey(const Key('learningPrimaryAction')),
            )
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

      expect(
        find.byKey(const Key('learningLevelChangeBanner')),
        findsOneWidget,
      );
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
