part of 'listening_practice_test.dart';

void _registerListeningPracticeExtraTests() {
  testWidgets(
    'renders listening hero banner, 2x2 visual MCQ grid, review badges and speaker avatars',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      // 1. ListeningPreparation Hero Scene Banner + keyVocabulary thumbnails
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: ListeningPreparation(
                coverImageUrl: '/media/learning/v1/images/scene-first-class.jpg',
                preparation: const {
                  'situation': 'Hai bạn trao đổi trước giờ học.',
                  'objective': 'Nghe môn học đầu tiên và đồ cần mang.',
                },
                words: const [
                  {
                    'id': 'v1',
                    'word': 'timetable',
                    'meaning': 'thời khóa biểu',
                    'imageUrl': '/media/learning/v1/images/vocab-timetable.jpg',
                  },
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        resolveBundledIllustrationAsset('/media/learning/v1/images/scene-first-class.svg'),
        'assets/illustrations/scene-first-class.jpg',
      );
      expect(
        resolveNetworkLearningImageUrl(
          '/media/learning/v1/images/unbundled-photo.jpg',
          config: AppConfig(apiBaseUrl: 'https://cdn.lingoroad.example/'),
        ),
        'https://cdn.lingoroad.example/media/learning/v1/images/unbundled-photo.jpg',
      );
      expect(
        resolveNetworkLearningImageUrl(
          '/media/learning/v1/images/unbundled-photo.jpg',
          baseUrlResolver: (p) => 'https://api.example.com$p',
        ),
        'https://api.example.com/media/learning/v1/images/unbundled-photo.jpg',
      );
      expect(
        find.byKey(const ValueKey('listening-prep-hero-image')),
        findsOneWidget,
      );
      expect(find.byType(LearningMediaImage), findsNWidgets(2));
      expect(find.text('timetable'), findsOneWidget);
      expect(tester.takeException(), isNull);

      // 2. LearningAttemptPage with scene strip & 2x2 visual MCQ grid
      final repo = MemoryLearningRepository()
        ..state = {
          'id': 'visual-attempt',
          'version': 0,
          'status': 'IN_PROGRESS',
          'lesson': {
            'id': 'fc',
            'title': 'Checking Timetable',
            'kind': 'LISTENING',
            'coverImageUrl':
                '/media/learning/v1/images/scene-first-class.jpg',
          },
          'position': {'phase': 'QUIZ', 'index': 0},
          'content': {
            'listeningVersion': 1,
            'steps': [],
            'audioUrl': '/media/learning/v1/listening-first-class-v1.wav',
            'coverImageUrl':
                '/media/learning/v1/images/scene-first-class.jpg',
            'audioDurationMs': 54139,
          },
          'questions': [
            {
              'id': 'q02',
              'prompt': 'What is the first lesson tomorrow?',
              'options': [
                {
                  'id': 'a',
                  'text': 'Science',
                  'imageUrl': '/media/learning/v1/images/opt-lesson-science.jpg',
                },
                {
                  'id': 'b',
                  'text': 'English',
                  'imageUrl': '/media/learning/v1/images/opt-lesson-english.jpg',
                },
                {
                  'id': 'c',
                  'text': 'Art',
                  'imageUrl': '/media/learning/v1/images/opt-lesson-art.jpg',
                },
                {
                  'id': 'd',
                  'text': 'Music',
                  'imageUrl': '/media/learning/v1/images/opt-lesson-music.jpg',
                },
              ],
            },
          ],
          'answers': [],
          'result': null,
        };
      final owner = LearningController(repository: repo, accountId: 'alice')
        ..lessons = [
          LearningLesson({
            'id': 'fc',
            'title': 'Checking Timetable',
            'kind': 'LISTENING',
            'coverImageUrl': '/media/learning/v1/images/scene-first-class.jpg',
          }),
        ];
      final engine = FakeListeningEngine();
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(
            owner: owner,
            lessonId: 'fc',
            audioEngineFactory: () => engine,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('listening-attempt-scene-strip')),
        findsOneWidget,
      );
      expect(find.byType(PracticeImageAnswerGrid), findsOneWidget);
      for (final opt in ['a', 'b', 'c', 'd']) {
        expect(find.byKey(ValueKey('learning-option-$opt')), findsOneWidget);
      }
      await tester.ensureVisible(find.byKey(const ValueKey('learning-option-a')));
      await tester.tap(find.byKey(const ValueKey('learning-option-a')));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Phát audio'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();
      expect(find.text('Đúng'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());

      // 3. PracticeReviewPage with 2x2 image review badges & speaker avatar evidence
      final audio = ListeningAudioController(
        url: 'visual.wav',
        isCurrent: () => true,
        engine: FakeListeningEngine(),
      );
      final completedAttempt = LearningAttempt({
        'id': 'visual-review',
        'status': 'COMPLETED',
        'lesson': {'id': 'fc', 'kind': 'LISTENING'},
        'content': {
          'transcriptSegments': [
            {
              'id': 's04',
              'speaker': 'Lily',
              'speakerAvatar': '/media/learning/v1/images/avatar-lily.jpg',
              'text': 'No. Our first lesson is science.',
              'translationVi': 'Không. Buổi đầu là khoa học.',
              'startMs': 0,
              'endMs': 3000,
            },
          ],
        },
        'questions': [
          {
            'id': 'q02',
            'prompt': 'What is the first lesson tomorrow?',
            'options': [
              {
                'id': 'A',
                'text': 'Science',
                'imageUrl': '/media/learning/v1/images/opt-lesson-science.jpg',
              },
              {
                'id': 'B',
                'text': 'English',
                'imageUrl': '/media/learning/v1/images/opt-lesson-english.jpg',
              },
              {
                'id': 'C',
                'text': 'Art',
                'imageUrl': '/media/learning/v1/images/opt-lesson-art.jpg',
              },
              {
                'id': 'D',
                'text': 'Music',
                'imageUrl': '/media/learning/v1/images/opt-lesson-music.jpg',
              },
            ],
          },
        ],
        'answers': [
          {
            'questionId': 'q02',
            'optionId': 'A',
            'correctOptionId': 'A',
            'checked': true,
            'isCorrect': true,
            'evidenceSegmentIds': ['s04'],
          },
        ],
      });
      final reviewController = LearningAttemptController(owner: owner)
        ..attempt = completedAttempt;
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: PracticeReviewPage(
            attempt: completedAttempt,
            controller: reviewController,
            audio: audio,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Đoạn dẫn chứng'), findsOneWidget);
      await tester.scrollUntilVisible(
        find.byKey(const ValueKey('review-option-A')),
        160,
      );
      expect(find.text('Đáp án đúng · Bạn chọn'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      reviewController.dispose();
      audio.dispose();
      owner.dispose();
    },
  );

  testWidgets(
    'renders reading hero cover in intro prep even without vocab and scene strip in attempt page',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      SharedPreferences.setMockInitialValues({});

      final repo = MemoryLearningRepository()
        ..state = {
          'id': 'rd-attempt',
          'version': 0,
          'status': 'IN_PROGRESS',
          'lesson': {
            'id': 'rd',
            'title': 'A New Time for the Club Meeting',
            'kind': 'READING',
            'coverImageUrl':
                '/media/learning/v1/images/scene-reading-book-club.jpg',
          },
          'position': {'phase': 'QUIZ', 'index': 0},
          'content': {
            'steps': [],
            'coverImageUrl':
                '/media/learning/v1/images/scene-reading-book-club.jpg',
            'passage': 'Paragraph one of reading passage.',
          },
          'questions': [
            {
              'id': 'q0',
              'prompt': 'Where will the club meet?',
              'options': [
                {'id': 'a', 'text': 'Room 12'},
                {'id': 'b', 'text': 'Hall A'},
              ],
            },
          ],
          'answers': [],
          'result': null,
        };
      final owner = LearningController(repository: repo, accountId: 'alice')
        ..lessons = [
          LearningLesson({
            'id': 'rd',
            'title': 'A New Time for the Club Meeting',
            'kind': 'READING',
            'description': 'Đọc email đổi lịch câu lạc bộ.',
            'coverImageUrl':
                '/media/learning/v1/images/scene-reading-book-club.jpg',
          }),
        ];

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningLessonIntroPage(owner: owner, lessonId: 'rd'),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('reading-prep-hero-image')),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(owner: owner, lessonId: 'rd'),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.byKey(const ValueKey('reading-attempt-scene-strip')),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
}
