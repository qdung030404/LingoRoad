import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/shared/app_button.dart';
import 'package:mobile/features/learning/learning_preview.dart';
import 'package:mobile/features/learning/lesson_pages.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/learning/practice_pages.dart';
import 'package:mobile/features/learning/word_library.dart';
import 'package:mobile/features/learning/word_collection_pages.dart';
import 'package:mobile/features/learning/srs_review_page.dart';
import 'package:mobile/features/learning/preview_navigation_bar.dart';
import 'package:mobile/features/learning/daily_learning.dart';
import 'package:mobile/features/learning/home_dashboard.dart';
import 'package:mobile/features/learning/learning_controller.dart';
import 'package:mobile/features/learning/learning_repository.dart';
import 'package:mobile/features/auth/welcome_page.dart';
import 'test_helpers.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final boundaryKey = GlobalKey();
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    for (final name in [
      'xyz.luan/audioplayers.global',
      'xyz.luan/audioplayers.global/events',
    ]) {
      messenger.setMockMethodCallHandler(
        MethodChannel(name),
        (_) async => null,
      );
    }
    messenger.setMockMethodCallHandler(
      const MethodChannel('xyz.luan/audioplayers'),
      (call) async {
        if (call.method == 'create') {
          final id = (call.arguments as Map)['playerId'];
          messenger.setMockMethodCallHandler(
            MethodChannel('xyz.luan/audioplayers/events/$id'),
            (_) async => null,
          );
        }
        return null;
      },
    );
  });

  Future<void> show(
    WidgetTester tester,
    Widget page, {
    Size size = const Size(393, 852),
    bool reduceMotion = false,
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.runAsync(() async {
      await (FontLoader(
        'Inter',
      )..addFont(rootBundle.load('assets/fonts/Inter-Variable.ttf'))).load();
      await (FontLoader('Be Vietnam Pro')
            ..addFont(rootBundle.load('assets/fonts/BeVietnamPro-Medium.ttf')))
          .load();
      await (FontLoader('Hanken Grotesk')
            ..addFont(rootBundle.load('assets/fonts/HankenGrotesk[wght].ttf')))
          .load();
      await (FontLoader(
        'Madimi One',
      )..addFont(rootBundle.load('assets/fonts/MadimiOne-Regular.ttf'))).load();
    });
    await tester.pumpWidget(
      RepaintBoundary(
        key: boundaryKey,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          key: UniqueKey(),
          theme: AppTheme.lightTheme,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(disableAnimations: reduceMotion),
            child: child!,
          ),
          initialRoute: '/capture',
          routes: {
            '/': (_) => const SizedBox.shrink(),
            '/capture': (_) => page,
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  Future<void> tap(WidgetTester tester, Finder finder) async {
    for (var i = 0; i < 8 && finder.evaluate().isEmpty; i++) {
      await tester.drag(find.byType(ListView).last, const Offset(0, -200));
      await tester.pumpAndSettle();
    }
    await tester.ensureVisible(finder);
    await tester.pumpAndSettle();
    final quickRating = const [
      'srs-remember',
      'srs-hard',
      'srs-forgot',
    ].any((key) => finder.evaluate().any((e) => e.widget.key == Key(key)));
    await tester.tap(finder);
    if (quickRating) await tester.pump(const Duration(milliseconds: 1500));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  }

  Future<void> capture(WidgetTester tester, String name) async {
    await tester.runAsync(() async {
      for (final e in find.byType(Image).evaluate()) {
        await precacheImage((e.widget as Image).image, e);
      }
    });
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    if (!const bool.fromEnvironment('CAPTURE_UI')) return;
    await tester.runAsync(() async {
      final boundary =
          boundaryKey.currentContext!.findRenderObject()
              as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 1);
      final png = await image.toByteData(format: ui.ImageByteFormat.png);
      final file = File('../../.demo/learning-preview/widgets/$name.png');
      await file.parent.create(recursive: true);
      await file.writeAsBytes(png!.buffer.asUint8List());
      image.dispose();
    });
  }

  testWidgets('empty collections accept a word and survive reopening', (
    tester,
  ) async {
    final library = WordLibrary();
    await tester.runAsync(library.restore);
    await show(tester, MyWordsTab(library: library));
    await tap(tester, find.byKey(const Key('addWordDeck')));
    await tester.enterText(find.byType(TextField).last, 'Bộ từ cá nhân');
    await tap(tester, find.text('Tạo'));
    final deck = library.decks.last;
    expect(deck.name, 'Bộ từ cá nhân');
    await show(tester, WordListPage(library: library, deckId: deck.id));
    expect(find.text('Bộ từ chưa có từ vựng.'), findsOneWidget);
    await tap(tester, find.text('Thêm từ đầu tiên'));
    await tester.enterText(find.byType(TextFormField).first, 'hello');
    await tester.enterText(find.byType(TextFormField).last, 'xin chào');
    await tap(tester, find.text('Lưu'));
    expect(find.text('hello'), findsOneWidget);
    final restored = WordLibrary();
    await tester.runAsync(restored.restore);
    expect(restored.decks.last.words.single.meaning, 'xin chào');
    library.dispose();
    restored.dispose();
  });

  testWidgets('new collection and review screens fit a narrow device', (
    tester,
  ) async {
    final library = WordLibrary();
    for (final page in <Widget>[
      MyWordsTab(library: library),
      WordListPage(library: library, deckId: 'family'),
      SrsReviewPage(library: library, deckId: 'work'),
    ]) {
      await show(tester, page, size: const Size(320, 640), reduceMotion: true);
      expect(tester.takeException(), isNull);
    }
    await tester.tap(find.byKey(const Key('srsFlashcard')));
    await tester.pumpAndSettle();
    expect(find.text('Định nghĩa : Sự tình cờ may mắn'), findsOneWidget);
    expect(tester.takeException(), isNull);
    library.dispose();
  });

  testWidgets(
    'incorrect recall, skip and completion retain truthful local ratings',
    (tester) async {
      final library = WordLibrary()..decks.clear();
      const first = PreviewWord('custom-first', 'hello', 'xin chào', '', '');
      const second = PreviewWord(
        'custom-second',
        'goodbye',
        'tạm biệt',
        '',
        '',
      );
      library.decks.add(
        const WordDeck('custom', 'Bộ từ cá nhân', [first, second]),
      );
      int? destination;
      await show(
        tester,
        SrsReviewPage(
          library: library,
          deckId: 'custom',
          onNavigate: (value) => destination = value,
        ),
      );
      await tap(tester, find.byKey(const Key('wordPracticeNext')));
      await tap(tester, find.byKey(const Key('wordPracticeNext')));
      await tester.enterText(
        find.byKey(const Key('wordRecallAnswer')),
        'wrong',
      );
      await tap(tester, find.byKey(const Key('wordPracticeNext')));
      expect(find.text('Chưa đúng. Đáp án: hello'), findsOneWidget);
      await tap(tester, find.byKey(const Key('wordPracticeNext')));
      expect(library.ratings[first.id], 'forgot');
      expect(library.rememberedWords, 0);
      await tap(tester, find.byKey(const Key('skipPracticeWord')));
      expect(find.text('Bạn đã ôn hết từ'), findsOneWidget);
      expect(library.ratings.containsKey(second.id), isFalse);
      expect(find.byType(PreviewNavigationBar), findsNothing);
      await capture(tester, 'word-review-complete');
      await tap(tester, find.byKey(const Key('replayWordDeck')));
      expect(find.text('hello'), findsOneWidget);
      expect(library.ratings[first.id], 'forgot');
      expect(library.ratings.containsKey(second.id), isFalse);
      await tap(tester, find.byKey(const Key('skipPracticeWord')));
      await tap(tester, find.byKey(const Key('skipPracticeWord')));
      await tap(tester, find.byKey(const Key('returnToMyWords')));
      expect(destination, 2);
      final restored = WordLibrary();
      await tester.runAsync(restored.restore);
      expect(restored.ratings[first.id], 'forgot');
      expect(restored.ratings.containsKey(second.id), isFalse);
      library.dispose();
      restored.dispose();
    },
  );

  testWidgets(
    'five destinations keep identical nav geometry and live vocabulary totals',
    (tester) async {
      final model = PreviewModel();
      await show(tester, LearningPreview(model: model));
      final expectedWidth = tester
          .getSize(find.byKey(const Key('previewNavigationBar')))
          .width;
      expect(expectedWidth, 393 - 48);
      final weeklyRect = tester.getRect(
        find.byKey(const Key('homeWeeklyCard')),
      );
      final semantics = tester.ensureSemantics();
      expect(
        tester
            .getSemantics(find.byKey(const Key('previewDestination2')))
            .getSemanticsData()
            .hasAction(ui.SemanticsAction.tap),
        isTrue,
      );
      semantics.dispose();
      for (final i in [1, 2, 3, 4, 0]) {
        await tap(tester, find.byKey(Key('previewTab$i')));
        expect(
          tester.getSize(find.byKey(const Key('previewNavigationBar'))).width,
          expectedWidth,
        );
        expect(
          tester
              .widget<PreviewNavigationBar>(find.byType(PreviewNavigationBar))
              .selectedIndex,
          i,
        );
      }
      await tester.scrollUntilVisible(
        find.byKey(const Key('homeTotalWords')),
        250,
        scrollable: find
            .descendant(
              of: find.byKey(const PageStorageKey('preview-content-0')),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      expect(
        tester.widget<Text>(find.byKey(const Key('homeTotalWords'))).data,
        '51',
      );
      expect(
        tester.widget<Text>(find.byKey(const Key('homeRememberedWords'))).data,
        '15',
      );
      expect(
        tester.widget<Text>(find.byKey(const Key('homeDueWords'))).data,
        '36',
      );
      expect(
        tester
            .widget<Transform>(find.byKey(const Key('homeBackgroundScroll')))
            .transform
            .getTranslation()
            .y,
        lessThan(0),
      );
      await capture(tester, 'home-vocabulary-summary');
      final chartRect = tester.getRect(
        find.byKey(const Key('homeVocabularySummary')),
      );
      expect(chartRect.width, weeklyRect.width);
      expect(chartRect.left, weeklyRect.left);
      await tap(tester, find.byKey(const Key('homeReviewWords')));
      expect(find.byType(SrsReviewPage), findsOneWidget);
      expect(find.byType(PreviewNavigationBar), findsNothing);
      await tap(tester, find.byTooltip('Quay lại bộ từ'));
      expect(find.byType(PreviewNavigationBar), findsOneWidget);
      final homeScroll = find
          .descendant(
            of: find.byKey(const PageStorageKey('preview-content-0')),
            matching: find.byType(Scrollable),
          )
          .first;
      await tester.scrollUntilVisible(
        find.byKey(const Key('homeWordDecks')),
        200,
        scrollable: homeScroll,
      );
      final decksSection = find.byKey(const Key('homeWordDecks'));
      final vocabularyCard = find.byKey(const Key('homeVocabularySummary'));
      expect(
        find.descendant(of: vocabularyCard, matching: decksSection),
        findsOneWidget,
      );
      expect(
        find.descendant(of: vocabularyCard, matching: find.text('Từ của tôi')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: decksSection, matching: find.byType(WordDeckCard)),
        findsNWidgets(2),
      );
      await capture(tester, 'home-word-decks');
      final workDeck = find.byKey(const ValueKey('home-deck-work'));
      await tester.ensureVisible(workDeck);
      await tester.pumpAndSettle();
      await tap(
        tester,
        find.descendant(of: workDeck, matching: find.text('Tiếp tục học')),
      );
      expect(
        tester.widget<WordListPage>(find.byType(WordListPage)).deckId,
        'work',
      );
      await tap(tester, find.byTooltip('Quay lại'));
      await tester.pumpAndSettle();
      await tap(tester, find.byKey(const Key('homeAllWordDecks')));
      expect(
        tester
            .widget<PreviewNavigationBar>(find.byType(PreviewNavigationBar))
            .selectedIndex,
        2,
      );
      model.dispose();
    },
  );

  testWidgets('all five navigation destinations share one responsive width', (
    tester,
  ) async {
    for (final size in [
      const Size(320, 640),
      const Size(393, 852),
      const Size(480, 960),
    ]) {
      final model = PreviewModel();
      await show(
        tester,
        LearningPreview(model: model),
        size: size,
        reduceMotion: true,
      );
      for (var tab = 0; tab < 5; tab++) {
        await tap(tester, find.byKey(Key('previewTab$tab')));
        expect(
          tester.getSize(find.byKey(const Key('previewNavigationBar'))).width,
          size.width - 2 * PreviewNavigationBar.horizontalInset,
        );
        expect(
          tester.getSize(find.byKey(const Key('previewNavigationBar'))).height,
          56,
        );
        expect(
          tester.getTopLeft(find.byKey(const Key('previewNavigationBar'))).dx,
          24,
        );
      }
      model.dispose();
    }
  });

  testWidgets(
    'remembered words can be replayed without clearing stored ratings',
    (tester) async {
      final library = WordLibrary()..decks.clear();
      const word = PreviewWord('remembered', 'hello', 'xin chào', '', '');
      library.decks.add(const WordDeck('finished', 'Gia đình', [word]));
      await tester.runAsync(() => library.rate(word, 'remember'));
      await show(tester, SrsReviewPage(library: library, deckId: 'finished'));
      expect(find.text('Bạn đã ôn hết từ'), findsOneWidget);
      expect(
        tester.getTopLeft(find.byKey(const Key('wordReviewCompletion'))).dy,
        118,
      );
      expect(
        tester.getSize(find.byKey(const Key('replayWordDeck'))).width,
        369,
      );
      await capture(tester, 'word-review-complete-family');
      await tap(tester, find.byKey(const Key('replayWordDeck')));
      expect(find.text('hello'), findsOneWidget);
      expect(library.ratings[word.id], 'remember');
      final restored = WordLibrary();
      await tester.runAsync(restored.restore);
      expect(restored.ratings[word.id], 'remember');
      await tap(tester, find.byKey(const Key('skipPracticeWord')));
      await tap(tester, find.byKey(const Key('replayWordDeck')));
      expect(find.text('hello'), findsOneWidget);
      expect(library.ratings[word.id], 'remember');
      await tap(tester, find.byKey(const Key('skipPracticeWord')));
      await tap(tester, find.byKey(const Key('returnToMyWords')));
      expect(find.byType(SrsReviewPage), findsNothing);
      library.dispose();
      restored.dispose();
    },
  );

  testWidgets(
    'empty review fits a narrow device and cannot replay an empty deck',
    (tester) async {
      final library = WordLibrary()..decks.clear();
      library.decks.add(const WordDeck('empty', 'Bộ từ trống', []));
      await show(
        tester,
        SrsReviewPage(library: library, deckId: 'empty'),
        size: const Size(320, 640),
      );
      expect(find.text('Bộ từ chưa có từ vựng'), findsOneWidget);
      expect(
        tester
            .widget<CustomAppButton>(find.byKey(const Key('replayWordDeck')))
            .onPressed,
        isNull,
      );
      expect(
        find.byKey(const Key('returnToMyWords')).hitTestable(),
        findsOneWidget,
      );
      expect(find.byType(PreviewNavigationBar), findsNothing);
      expect(tester.takeException(), isNull);
      library.dispose();
    },
  );

  testWidgets(
    'recall fits a narrow screen with keyboard and previous keeps answer',
    (tester) async {
      final library = WordLibrary();
      await show(
        tester,
        SrsReviewPage(library: library, deckId: 'family'),
        size: const Size(320, 640),
        reduceMotion: true,
      );
      await tap(tester, find.byKey(const Key('wordPracticeNext')));
      await tap(tester, find.byKey(const Key('wordPracticeNext')));
      tester.view.viewInsets = const FakeViewPadding(bottom: 240);
      addTearDown(tester.view.resetViewInsets);
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('wordRecallAnswer')),
        'mother',
      );
      expect(
        find.byKey(const Key('wordPracticeNext')).hitTestable(),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
      tester.view.resetViewInsets();
      await tester.pumpAndSettle();
      await tap(tester, find.byKey(const Key('wordPracticeBack')));
      await tap(tester, find.byKey(const Key('wordPracticeNext')));
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('wordRecallAnswer')))
            .controller!
            .text,
        'mother',
      );
      await tap(tester, find.byKey(const Key('wordPracticeNext')));
      await tap(tester, find.byKey(const Key('wordPracticeNext')));
      expect(library.ratings['family-0'], 'hard');
      library.dispose();
    },
  );

  testWidgets(
    'plan validation and local storage preserve drafts across models',
    (tester) async {
      final model = PreviewModel();
      await tester.runAsync(model.restore);
      await show(tester, WeeklyPlanPage(model: model));
      await capture(tester, 'plan');
      await tap(tester, find.text('Điều chỉnh kế hoạch'));
      await capture(tester, 'adjust');
      await tap(tester, find.text('Đọc: Ngữ pháp'));
      await tap(tester, find.text('Nghe'));
      expect(find.text('Chọn ít nhất một kỹ năng.'), findsOneWidget);
      expect(
        tester
            .widget<ElevatedButton>(
              find.widgetWithText(ElevatedButton, 'Lưu kế hoạch'),
            )
            .onPressed,
        isNull,
      );
      await tap(tester, find.text('Nói'));
      await tap(tester, find.text('20 phút'));
      await tap(tester, find.text('Lưu kế hoạch'));
      expect(model.focus, {'Nói'});
      expect(model.dailyMinutes, 20);
      await tester.runAsync(
        () => model.saveDraft(0, 'My own text survives reopening.'),
      );
      final restored = PreviewModel();
      await tester.runAsync(restored.restore);
      expect(restored.dailyMinutes, 20);
      expect(restored.focus, {'Nói'});
      expect(restored.drafts.first, 'My own text survives reopening.');
    },
  );

  testWidgets(
    'lessons, checked answers and writing review retain user content',
    (tester) async {
      final model = PreviewModel();
      await show(tester, GrammarLessonPage(model: model));
      await capture(tester, 'grammar-lesson');
      await tap(tester, find.text('Bắt đầu học'));
      await tap(tester, find.byKey(const ValueKey('previewOption0')));
      await tap(tester, find.byKey(const Key('previewNext')));
      expect(find.text('Chính xác!'), findsOneWidget);
      await show(tester, VocabularyLessonPage(model: model));
      await capture(tester, 'vocabulary-lesson');
      await tap(tester, find.text('Bắt đầu học'));
      await capture(tester, 'vocabulary-word');
      for (var i = 0; i < 10; i++) {
        await tap(tester, find.byKey(const Key('previewNext')));
      }
      await capture(tester, 'vocabulary-quiz');
      expect(find.text('My father and mother are my …'), findsOneWidget);
      await show(tester, WritingPreviewPage(model: model));
      await capture(tester, 'writing');
      await tap(tester, find.byKey(const Key('writingHints')));
      await capture(tester, 'writing-hints');
      await tap(tester, find.byKey(const Key('writingHints')));
      await tap(tester, find.text('Điền bài mẫu'));
      await tap(tester, find.byKey(const Key('previewNext')));
      await tester.enterText(
        find.byKey(const Key('writingInput')),
        'My best friend is Mai. She is kind.',
      );
      await tester.pumpAndSettle();
      await tap(tester, find.byKey(const Key('previewNext')));
      expect(model.completed, contains('writing'));
      await capture(tester, 'writing-result');
      await tap(tester, find.text('Xem chi tiết từng bài'));
      await capture(tester, 'writing-review');
      await tap(tester, find.byKey(const Key('previewNext')));
      expect(find.text('My best friend is Mai. She is kind.'), findsOneWidget);
    },
  );

  testWidgets(
    'speaking simulation transitions and narrow keyboard layout work',
    (tester) async {
      final model = PreviewModel();
      await show(tester, MicrophonePreviewPage(model: model));
      await capture(tester, 'microphone');
      await tap(tester, find.text('Tiếp tục với bản mẫu'));
      await capture(tester, 'speaking');
      await tap(tester, find.byKey(const Key('previewRecord')));
      await tester.pump(const Duration(seconds: 2));
      await tap(tester, find.byKey(const Key('previewRecord')));
      expect(find.text('Bản ghi mẫu'), findsOneWidget);
      await capture(tester, 'speaking-recorded');
      await tap(tester, find.byKey(const Key('previewNext')));
      await capture(tester, 'speaking-feedback');
      expect(find.text('Chúng tôi nghe được'), findsOneWidget);
      await tap(tester, find.text('Câu tiếp'));
      await tap(tester, find.byKey(const Key('previewNext')));
      await tap(tester, find.byKey(const Key('previewNext')));
      await capture(tester, 'speaking-prompt');
      await tap(tester, find.byKey(const Key('previewNext')));
      await capture(tester, 'speaking-open-recording');
      await tap(tester, find.byKey(const Key('previewRecord')));
      await show(
        tester,
        LearningPreview(model: model),
        size: const Size(320, 640),
      );
      await tap(tester, find.byKey(const Key('previewTab1')));
      await tap(tester, find.byKey(const Key('previewTab3')));
      await show(
        tester,
        WritingPreviewPage(model: model),
        size: const Size(320, 640),
      );
      tester.view.viewInsets = const FakeViewPadding(bottom: 250);
      addTearDown(tester.view.resetViewInsets);
      await tester.pumpAndSettle();
      await tap(tester, find.byKey(const Key('writingInput')));
      await tester.enterText(
        find.byKey(const Key('writingInput')),
        'I went to the park.',
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('previewNext')));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(
        find.byKey(const Key('previewNext')).hitTestable(),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'HomeDashboard maps rolling 7-day dates to weekday labels and handles missing totals safely',
    (tester) async {
      final api = FakeApi(signedIn: true, completed: true);
      final daily = DailyLearningController(
        repository: ApiDailyRepository(api),
        accountId: 'user-1',
        isCurrent: () => true,
      );
      final learning = LearningController(
        repository: ApiLearningRepository(api),
        accountId: 'user-1',
        daily: daily,
        isAccountCurrent: () => true,
      );
      learning.summary = {'completedLessonCount': 7};
      // Rolling 7 days ending on Thursday 2026-11-12 (weekday 4 -> T5) without 'totals' first
      daily.progress = {
        'today': {'date': '2026-11-12', 'activeSeconds': 1200, 'goalMet': true},
        'days': [
          {'date': '2026-11-06', 'activeSeconds': 0, 'completedLessonCount': 0, 'goalMet': false},
          {'date': '2026-11-07', 'activeSeconds': 0, 'completedLessonCount': 0, 'goalMet': false},
          {'date': '2026-11-08', 'activeSeconds': 0, 'completedLessonCount': 0, 'goalMet': false},
          {'date': '2026-11-09', 'activeSeconds': 300, 'completedLessonCount': 1, 'goalMet': false},
          {'date': '2026-11-10', 'activeSeconds': 0, 'completedLessonCount': 0, 'goalMet': false},
          {'date': '2026-11-11', 'activeSeconds': 600, 'completedLessonCount': 0, 'goalMet': true},
          {'date': '2026-11-12', 'activeSeconds': 1200, 'completedLessonCount': 2, 'goalMet': true},
        ],
      };

      final model = PreviewModel();
      final library = WordLibrary();
      await show(
        tester,
        Scaffold(
          body: HomeDashboard(
            model: model,
            library: library,
            onProfile: () {},
            onLesson: () {},
            onGrammar: () {},
            onWords: () {},
            onReview: () {},
            onDeck: (_) {},
            learning: learning,
            vocabularyWordsCount: 48,
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      expect(find.text('48'), findsOneWidget);
      expect(find.text('7'), findsOneWidget);
      // Missing 'totals' safely renders '—'
      expect(find.text('—'), findsWidgets);

      // Populate 'totals' and verify minutes render
      daily.progress = {
        ...daily.progress!,
        'totals': {'activeSeconds': 1800},
      };
      await show(
        tester,
        Scaffold(
          body: HomeDashboard(
            model: model,
            library: library,
            onProfile: () {},
            onLesson: () {},
            onGrammar: () {},
            onWords: () {},
            onReview: () {},
            onDeck: (_) {},
            learning: learning,
            vocabularyWordsCount: 48,
          ),
        ),
      );
      expect(find.text('30 phút'), findsOneWidget);
      // All 7 weekday labels T2..CN appear from the rolling window
      for (final label in ['T6', 'T7', 'CN', 'T2', 'T3', 'T4', 'T5']) {
        expect(find.text(label), findsOneWidget);
      }

      learning.dispose();
      daily.dispose();
      library.dispose();
      model.dispose();
    },
  );

  testWidgets(
    'QuizSummaryPage returns to LearningPreview without escaping Guest shell to WelcomePage',
    (tester) async {
      await show(
        tester,
        WelcomePage(onGoogle: () {}, onEmail: () {}),
      );
      await tap(tester, find.byKey(const Key('openLearningPreview')));
      expect(find.byType(LearningPreview), findsOneWidget);

      final previewContext = tester.element(find.byType(LearningPreview));
      Navigator.of(previewContext).push(
        MaterialPageRoute<void>(
          builder: (_) => const QuizSummaryPage(
            correct: 3,
            total: 3,
            title: 'Ngữ pháp mẫu',
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Đã hoàn thành bài tập'), findsOneWidget);

      await tap(tester, find.text('Về trang chủ'));
      expect(find.byType(LearningPreview), findsOneWidget);
      expect(find.byKey(const Key('openLearningPreview')), findsNothing);
    },
  );
}
