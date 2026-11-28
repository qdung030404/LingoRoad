part of 'learning_workflow_test.dart';

void _registerLearningWorkflowPart2Tests() {
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
            (widget) => ((widget.textSpan! as TextSpan).children ?? const [])
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
      expect(find.text('Khoảng 7 phút'), findsOneWidget);
      expect(find.text('8 câu luyện tập'), findsOneWidget);

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
      final wrong = find.byKey(const ValueKey('learning-option-b'));
      await tester.ensureVisible(wrong);
      await tester.pumpAndSettle();
      await tester.tap(wrong);
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
      await tester.tap(find.text('Quay lại câu hỏi'));
      await tester.pumpAndSettle();
      expect(find.text('Câu 5/5'), findsOneWidget);
      expect(
        tester
            .widget<AnswerOption>(
              find.byKey(const ValueKey('learning-option-b')),
            )
            .selected,
        isTrue,
      );

      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();

      expect(find.text('Kết quả bài học'), findsOneWidget);
      expect(find.text('4/5 câu đúng'), findsOneWidget);
      for (final label in ['Làm lại', 'Về danh sách']) {
        final action = find.widgetWithText(CustomAppButton, label);
        expect(tester.widget<CustomAppButton>(action).isSecondary, isTrue);
      }
      await tester.tap(find.text('Xem lại đáp án'));
      await tester.pumpAndSettle();
      expect(find.text('Xem lại câu 1/5'), findsOneWidget);
      expect(find.text(startEvidence), findsOneWidget);
      expect(find.text('Dẫn chứng trong bài'), findsOneWidget);
      await tester.tap(find.text('Câu tiếp theo'));
      await tester.pumpAndSettle();
      expect(find.text('Xem lại câu 2/5'), findsOneWidget);
      expect(find.text('Dẫn chứng trong bài'), findsNothing);
      await tester.tap(find.text('Câu sai (1)'));
      await tester.pumpAndSettle();
      expect(find.text('Xem lại câu 5/5'), findsOneWidget);
      expect(find.text(endEvidence), findsOneWidget);
      expect(find.text('Bạn chọn'), findsOneWidget);
      expect(find.text('Đáp án đúng'), findsOneWidget);
      expect(find.text('Về kết quả'), findsOneWidget);
      await tester.tap(find.text('Về kết quả'));
      await tester.pumpAndSettle();
      expect(find.text('Kết quả bài học'), findsOneWidget);

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
        'passage': List.filled(
          40,
          'Sample sentence in reading passage.',
        ).join(' '),
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
      await tester.pumpAndSettle();
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
      expect(
        find.text('Staff share ___ updates every morning.'),
        findsOneWidget,
      );
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

      expect(
        find.text('The company pays for home internet bills.'),
        findsOneWidget,
      );
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

}
