part of 'learning_workflow_test.dart';

void _registerLearningWorkflowPart3Tests() {
  testWidgets('keeps saved state when delayed initial GET resolves after POST', (
    tester,
  ) async {
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
          {'id': 'w1', 'word': 'asynchronous', 'meaning': 'không đồng thời'},
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
    await tester.pumpAndSettle();
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
  });

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

      expect(
        find.byKey(const ValueKey('learning-ai-explain-q0')),
        findsNothing,
      );
      await tester.tap(find.byKey(const ValueKey('learning-option-a')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();

      final listScrollable = find.descendant(
        of: find.byType(ListView),
        matching: find.byType(Scrollable),
      );
      final explainBtn = find.byKey(const ValueKey('learning-ai-explain-q0'));
      await tester.scrollUntilVisible(
        explainBtn,
        250,
        scrollable: listScrollable,
      );
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

      await tester.scrollUntilVisible(
        explainBtn,
        200,
        scrollable: listScrollable,
      );
      await tester.drag(listScrollable, const Offset(0, -100));
      await tester.pumpAndSettle();
      await tester.tap(explainBtn);
      await tester.pump();
      expect(find.text('Đang giải thích...'), findsOneWidget);
      q0RetryGate.complete({
        'questionId': 'q0',
        'explanation':
            'Đoạn văn nêu rõ "cool nearby streets" nên đáp án đúng là Nearby streets.',
        'source': 'AI',
      });
      await tester.pumpAndSettle();
      expect(find.text('Giải thích AI'), findsOneWidget);
      expect(find.byType(ReadingAnswerFeedbackCard), findsOneWidget);
      expect(find.byType(PracticeAiExplainCard), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(ReadingAnswerFeedbackCard),
          matching: find.byType(PracticeAiExplainCard),
        ),
        findsNothing,
      );
      expect(
        find.text(
          'Đoạn văn nêu rõ "cool nearby streets" nên đáp án đúng là Nearby streets.',
        ),
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
                  PracticeAiExplainCard(
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
}
