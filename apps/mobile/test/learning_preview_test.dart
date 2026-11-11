import 'dart:io';
import 'dart:async';
import 'dart:convert';
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
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/main.dart';
import 'test_helpers.dart';

class _LogoutApi extends FakeApi {
  _LogoutApi({required this.offline}) : super(signedIn: true, completed: true);
  final bool offline;
  int logoutCalls = 0;
  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Duration? receiveTimeout,
  }) async {
    if (path == '/auth/logout') {
      logoutCalls++;
      if (offline) throw const ApiFailure('Offline');
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

class _ControlledWordLibrary extends WordLibrary {
  Completer<void>? pending;
  bool fail = false;
  int calls = 0;

  @override
  Future<void> rate(PreviewWord word, String rating) async {
    calls++;
    await pending?.future;
    if (fail) throw StateError('Storage unavailable');
    await super.rate(word, rating);
  }
}

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

  test(
    'legacy word storage and new optional metadata survive saving',
    () async {
      SharedPreferences.setMockInitialValues({
        WordLibrary.storageKey: jsonEncode({
          'ratings': {'family-0': 'remember', 'legacy-word': 'hard'},
          'decks': [
            {
              'id': 'legacy',
              'name': 'Bộ từ cũ',
              'words': [
                {
                  'id': 'legacy-word',
                  'word': 'hello',
                  'meaning': 'xin chào',
                  'phonetic': '',
                  'example': '',
                },
              ],
            },
          ],
        }),
      });
      final library = WordLibrary();
      await library.restore();
      expect(library.ratings['family-0'], 'remember');
      expect(library.decks.last.words.single.translation, isEmpty);
      const translated = PreviewWord(
        'translated',
        'world',
        'thế giới',
        '',
        'Hello world!',
        translation: 'Xin chào thế giới!',
        partOfSpeech: 'danh từ',
      );
      library.decks.add(const WordDeck('metadata', 'Bộ từ mới', [translated]));
      await library.rate(translated, 'forgot');
      final restored = WordLibrary();
      await restored.restore();
      expect(restored.ratings['family-0'], 'remember');
      expect(restored.ratings['legacy-word'], 'hard');
      expect(
        restored.decks.last.words.single.translation,
        'Xin chào thế giới!',
      );
      expect(restored.decks.last.words.single.partOfSpeech, 'danh từ');
      library.dispose();
      restored.dispose();
    },
  );

  for (final offline in [false, true]) {
    testWidgets(
      'avatar logout clears authenticated session (offline=$offline)',
      (tester) async {
        final api = _LogoutApi(offline: offline);
        final session = SessionController(api);
        await tester.pumpWidget(MyApp(session: session));
        await tester.pumpAndSettle();
        await tap(tester, find.byKey(const Key('previewAvatar')));
        expect(find.text('Đăng xuất'), findsOneWidget);
        await tap(tester, find.byKey(const Key('previewLogout')));
        expect(api.logoutCalls, 1);
        expect(api.accessToken, isNull);
        expect(await api.store.read(), isNull);
        expect(session.user, isNull);
        expect(session.placement, isEmpty);
        expect(session.stage, SessionStage.signedOut);
        expect(find.byKey(const Key('openLearningPreview')), findsOneWidget);
        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('previewAvatar')), findsNothing);
      },
    );
  }

  testWidgets('welcome card stays fixed while swipes change artwork and text', (
    tester,
  ) async {
    await tester.pumpWidget(MyApp(session: SessionController(FakeApi())));
    await tester.pumpAndSettle();
    final title = find.text('Ứng dụng học\ntiếng Anh');
    final before = tester.getTopLeft(title).dx;
    final gesture = await tester.startGesture(tester.getCenter(title));
    await gesture.moveBy(const Offset(-20, 0));
    await tester.pump(const Duration(milliseconds: 16));
    await gesture.moveBy(const Offset(-120, 0));
    await tester.pump(const Duration(milliseconds: 16));
    expect(tester.getTopLeft(title).dx, before);
    expect(find.text('Học tiếng anh\nmọi nơi'), findsNothing);
    await gesture.up();
    await tester.pumpAndSettle();
    expect(find.text('Học tiếng anh\nmọi nơi'), findsOneWidget);
    await tester.drag(
      find.text('Học tiếng anh\nmọi nơi'),
      const Offset(250, 0),
    );
    await tester.pumpAndSettle();
    expect(find.text('Ứng dụng học\ntiếng Anh'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'main page swipes synchronize navigation and preserve vertical scroll',
    (tester) async {
      final model = PreviewModel();
      await show(tester, LearningPreview(model: model));
      final homeBeforeSwipe = tester.widget<ListView>(
        find.byKey(const PageStorageKey('preview-content-0')),
      );
      final title = find.text('Hello, Anna!');
      final x = tester.getTopLeft(title).dx;
      final drag = await tester.startGesture(tester.getCenter(title));
      await drag.moveBy(const Offset(-20, 0));
      await tester.pump(const Duration(milliseconds: 16));
      await drag.moveBy(const Offset(-110, 0));
      await tester.pump(const Duration(milliseconds: 16));
      expect(tester.getTopLeft(title).dx, lessThan(x - 40));
      await drag.moveBy(const Offset(-170, 0));
      await drag.up();
      await tester.pumpAndSettle();
      final pager = tester.widget<PageView>(
        find.byKey(const Key('learningPages')),
      );
      expect(pager.controller!.page, closeTo(1, .01));
      // A navigation notification must not reconstruct the page content.
      expect(
        identical(
          homeBeforeSwipe,
          tester.widget<ListView>(
            find.byKey(
              const PageStorageKey('preview-content-0'),
              skipOffstage: false,
            ),
          ),
        ),
        isTrue,
      );
      expect(find.text('Học'), findsOneWidget);
      await tap(tester, find.byKey(const Key('previewTab0')));
      final home = find.byKey(const PageStorageKey('preview-content-0'));
      await tester.drag(home, const Offset(0, -180));
      await tester.pumpAndSettle();
      double offset() => tester
          .state<ScrollableState>(
            find.descendant(of: home, matching: find.byType(Scrollable)).first,
          )
          .position
          .pixels;
      final savedOffset = offset();
      expect(savedOffset, greaterThan(0));
      await tap(tester, find.byKey(const Key('previewTab3')));
      await tap(tester, find.byKey(const Key('previewTab0')));
      expect(offset(), closeTo(savedOffset, 1));
      await tester.tap(find.byKey(const Key('previewTab4')));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.byKey(const Key('previewTab1')));
      await tester.pumpAndSettle();
      expect(pager.controller!.page, closeTo(1, .01));
      expect(tester.takeException(), isNull);
      await model.savePlan(20, {'Nghe'});
      await tester.pumpAndSettle();
      await tap(tester, find.byKey(const Key('previewTab0')));
      expect(model.dailyMinutes, 20);
      expect(find.text('Kế hoạch hôm nay'), findsOneWidget);
    },
  );

  testWidgets('tab buttons respect reduced motion', (tester) async {
    await show(
      tester,
      LearningPreview(model: PreviewModel()),
      reduceMotion: true,
    );
    await tester.tap(find.byKey(const Key('previewTab4')));
    await tester.pump();
    expect(
      tester
          .widget<PageView>(find.byKey(const Key('learningPages')))
          .controller!
          .page,
      4,
    );
    expect(tester.takeException(), isNull);
  });

  test('writing drafts and scores are stored per account', () async {
    final first = PreviewModel(accountId: 'first');
    final second = PreviewModel(accountId: 'second');
    final reopened = PreviewModel(accountId: 'first');
    addTearDown(first.dispose);
    addTearDown(second.dispose);
    addTearDown(reopened.dispose);

    await first.restore();
    await first.saveItemDraft('writing-item', 'My private draft.', 0);
    await first.saveScore('writing-item', 7.5, 0);

    await second.restore();
    expect(second.getDraft('writing-item', 0), isEmpty);
    expect(second.getScore('writing-item', 0), 0);

    await reopened.restore();
    expect(reopened.getDraft('writing-item', 0), 'My private draft.');
    expect(reopened.getScore('writing-item', 0), 7.5);
  });

  testWidgets('signed-in writing uses the active session API', (tester) async {
    final api = FakeApi(signedIn: true, completed: true);
    await tester.pumpWidget(MyApp(session: SessionController(api)));
    await tester.pumpAndSettle();
    await tap(tester, find.byKey(const Key('previewTab3')));
    await tap(tester, find.text('Viết').first);

    expect(find.text('Ngân hàng Đề Luyện Viết (CEFR)'), findsOneWidget);
    expect(api.requestedPaths, contains('/api/v1/assessment/writing/items'));
  });

  testWidgets('guest avatar logout returns to welcome without signing in', (
    tester,
  ) async {
    await tester.pumpWidget(MyApp(session: SessionController(FakeApi())));
    await tester.pumpAndSettle();
    await tap(tester, find.byKey(const Key('openLearningPreview')));
    await tap(tester, find.byKey(const Key('previewAvatar')));
    await tap(tester, find.byKey(const Key('previewLogout')));
    expect(find.text('Tiếp tục với Email'), findsOneWidget);
    expect(find.byKey(const Key('previewAvatar')), findsNothing);
  });

  testWidgets('catalogue tabs and all four practice introductions navigate', (
    tester,
  ) async {
    final model = PreviewModel();
    await show(tester, LearningPreview(model: model));
    await capture(tester, 'home');
    await tap(tester, find.byKey(const Key('previewTab1')));
    await capture(tester, 'grammar-road');
    await tap(tester, find.text('Từ vựng'));
    await capture(tester, 'vocabulary-road');
    await tap(tester, find.byKey(const Key('previewTab3')));
    await capture(tester, 'practice');
    for (final skill in PracticeSkill.values) {
      await tap(tester, find.text(skill.label).first);
      if (skill == PracticeSkill.writing) {
        expect(find.text('Ngân hàng Đề Luyện Viết (CEFR)'), findsOneWidget);
        await capture(tester, skill.source);
        continue;
      }
      await tap(tester, find.text(skill.title));
      expect(find.text(skill.title), findsOneWidget);
      await capture(tester, skill.source);
      await tap(tester, find.byTooltip('Quay lại'));
      await tester.pumpAndSettle();
    }
    await tap(tester, find.byKey(const Key('previewTab4')));
    expect(
      find.text('Tiến độ minh họa trên thiết bị; không phải kết quả đánh giá.'),
      findsOneWidget,
    );
  });

  testWidgets('word library searches, opens a deck, flips and rates a card', (
    tester,
  ) async {
    final library = WordLibrary();
    await tester.runAsync(library.restore);
    await show(tester, MyWordsTab(library: library));
    await capture(tester, 'my-words');
    await tester.enterText(find.byKey(const Key('wordDeckSearch')), 'Gia đình');
    await tester.pumpAndSettle();
    expect(find.text('Công việc'), findsNothing);
    expect(
      find.descendant(
        of: find.byType(WordDeckCard),
        matching: find.text('Gia đình'),
      ),
      findsOneWidget,
    );
    await tap(tester, find.text('Tiếp tục học'));
    await capture(tester, 'word-list');
    expect(find.text('mother'), findsOneWidget);
    await tap(tester, find.byKey(const Key('practiceWordDeck')));
    expect(find.text('Dễ'), findsOneWidget);
    expect(find.byType(PreviewNavigationBar), findsNothing);
    await capture(tester, 'srs-front');
    await tester.tap(find.byKey(const Key('srsFlashcard')));
    await tester.pump(const Duration(milliseconds: 140));
    expect(tester.binding.hasScheduledFrame, isTrue);
    await tester.pumpAndSettle();
    expect(find.text('Định nghĩa : mẹ'), findsOneWidget);
    expect(find.text('Mẹ tôi là giáo viên.'), findsOneWidget);
    await capture(tester, 'srs-back');
    // Next still offers typed recall without choosing a quick rating.
    expect(library.ratings, isEmpty);
    await tap(tester, find.byKey(const Key('wordPracticeNext')));
    await capture(tester, 'word-recall');
    expect(find.text('Viết lại từ'), findsOneWidget);
    await tap(tester, find.byKey(const Key('wordPracticeNext')));
    expect(find.text('Nhập từ tiếng Anh trước khi kiểm tra.'), findsOneWidget);
    await tester.enterText(
      find.byKey(const Key('wordRecallAnswer')),
      ' Mother ',
    );
    await tap(tester, find.byKey(const Key('wordPracticeNext')));
    expect(find.text('Chính xác!'), findsOneWidget);
    expect(library.ratings, isEmpty);
    await tap(tester, find.byKey(const Key('wordPracticeNext')));
    expect(find.text('Father'), findsOneWidget);
    final restored = WordLibrary();
    await tester.runAsync(restored.restore);
    expect(restored.ratings['family-0'], 'hard');
    expect(restored.remembered(restored.decks[1]), 5);
    expect(restored.due(restored.decks[1]).length, 12);
    library.dispose();
    restored.dispose();
  });

  testWidgets(
    'quick ratings highlight for 1.5 seconds then animate and persist through last card',
    (tester) async {
      final library = WordLibrary()..decks.clear();
      const words = [
        PreviewWord('quick-0', 'one', 'một', '', ''),
        PreviewWord('quick-1', 'two', 'hai', '', ''),
        PreviewWord('quick-2', 'three', 'ba', '', ''),
      ];
      library.decks.add(const WordDeck('quick', 'Ôn nhanh', words));
      await show(tester, SrsReviewPage(library: library, deckId: 'quick'));
      await tester.tap(find.byKey(const Key('srs-remember')));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('one'), findsOneWidget);
      final chosen = tester.widget<OutlinedButton>(
        find.byKey(const Key('srs-remember')),
      );
      expect(chosen.onPressed, isNull);
      expect(
        chosen.style!.backgroundColor!.resolve({WidgetState.disabled}),
        const Color(0xFF0A5D21),
      );
      await capture(tester, 'flashcard-rating-selected');
      await tester.pump(const Duration(milliseconds: 1300));
      expect(find.text('one'), findsOneWidget);
      expect(
        tester.widget<Opacity>(find.byKey(const Key('ratingCardFade'))).opacity,
        1,
      );
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 130));
      final fade = tester
          .widget<Opacity>(find.byKey(const Key('ratingCardFade')))
          .opacity;
      expect(fade, greaterThan(0));
      expect(fade, lessThan(1));
      await tester.pumpAndSettle();
      expect(find.text('two'), findsOneWidget);
      expect(library.ratings['quick-0'], 'remember');
      await tap(tester, find.byKey(const Key('srsFlashcard')));
      await tap(tester, find.byKey(const Key('srs-hard')));
      expect(find.text('three'), findsOneWidget);
      expect(find.byKey(const Key('wordRecallAnswer')), findsNothing);
      await tap(tester, find.byKey(const Key('srs-forgot')));
      expect(find.text('Bạn đã ôn hết từ'), findsOneWidget);
      final restored = WordLibrary();
      await tester.runAsync(restored.restore);
      expect(restored.ratings, {
        'quick-0': 'remember',
        'quick-1': 'hard',
        'quick-2': 'forgot',
      });
      library.dispose();
      restored.dispose();
    },
  );

  testWidgets(
    'horizontal swipes skip or requeue without rating, and short drags cancel',
    (tester) async {
      final library = WordLibrary()..decks.clear();
      library.decks.add(
        const WordDeck('swipe', 'Vuốt thẻ', [
          PreviewWord('swipe-0', 'one', 'một', '', ''),
          PreviewWord('swipe-1', 'two', 'hai', '', ''),
          PreviewWord('swipe-2', 'three', 'ba', '', ''),
        ]),
      );
      await show(tester, SrsReviewPage(library: library, deckId: 'swipe'));
      final card = find.byKey(const Key('srsFlashcard'));
      await capture(tester, 'flashcard-swipe');
      await tester.timedDrag(
        card,
        const Offset(45, 0),
        const Duration(milliseconds: 600),
      );
      await tester.pumpAndSettle();
      expect(find.text('one'), findsOneWidget);
      expect(find.text('Định nghĩa : một'), findsNothing);
      final gesture = await tester.startGesture(tester.getCenter(card));
      await gesture.moveBy(const Offset(-65, 0));
      await gesture.moveBy(const Offset(-20, 0));
      await tester.pump();
      expect(find.text('← Bỏ qua từ này'), findsOneWidget);
      final tilted = tester.widget<AnimatedContainer>(
        find.byKey(const Key('flashcardSwipeTransform')),
      );
      expect(tilted.transform!.storage[1], lessThan(0));
      expect(
        tester
            .widget<Text>(find.byKey(const Key('flashcardSwipeLabel')))
            .style!
            .color,
        const Color(0xFFDC2626),
      );
      await gesture.moveBy(const Offset(-60, 0));
      await tester.pump();
      await capture(tester, 'flashcard-swipe-red');
      await gesture.cancel();
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('flashcardSwipeFeedback')), findsNothing);
      final rightGesture = await tester.startGesture(tester.getCenter(card));
      await rightGesture.moveBy(const Offset(40, 0));
      await rightGesture.moveBy(const Offset(90, 0));
      await tester.pump();
      expect(
        tester
            .widget<Text>(find.byKey(const Key('flashcardSwipeLabel')))
            .style!
            .color,
        const Color(0xFF16A34A),
      );
      await capture(tester, 'flashcard-swipe-green');
      await rightGesture.cancel();
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<AnimatedContainer>(
              find.byKey(const Key('flashcardSwipeTransform')),
            )
            .transform!
            .storage[1],
        0,
      );
      expect(find.text('one'), findsOneWidget);
      await tester.timedDrag(
        card,
        const Offset(180, 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('two'), findsOneWidget);
      // Requeue also works from the meaning side and resets the next card.
      await tap(tester, card);
      await tester.timedDrag(
        card,
        const Offset(180, 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('three'), findsOneWidget);
      await tester.timedDrag(
        card,
        const Offset(-180, 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('one'), findsOneWidget);
      await tester.timedDrag(
        card,
        const Offset(-180, 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('two'), findsOneWidget);
      await tester.timedDrag(
        card,
        const Offset(-180, 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('Bạn đã ôn hết từ'), findsOneWidget);
      expect(library.ratings, isEmpty);
      expect(
        (await SharedPreferences.getInstance()).getString(
          WordLibrary.storageKey,
        ),
        isNull,
      );
      library.dispose();
    },
  );

  testWidgets(
    'one remaining card can be requeued, flipped and skipped with reduced motion',
    (tester) async {
      final library = WordLibrary()..decks.clear();
      library.decks.add(
        const WordDeck('single', 'Một từ', [
          PreviewWord('single-0', 'hello', 'xin chào', '', ''),
        ]),
      );
      await show(
        tester,
        SrsReviewPage(library: library, deckId: 'single'),
        size: const Size(320, 640),
        reduceMotion: true,
      );
      final card = find.byKey(const Key('srsFlashcard'));
      await tester.timedDrag(
        card,
        const Offset(170, 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('hello'), findsOneWidget);
      await tap(tester, card);
      expect(find.text('Định nghĩa : xin chào'), findsOneWidget);
      // A vertical scroll must not advance the queue.
      await tester.timedDrag(
        card,
        const Offset(0, -80),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('Định nghĩa : xin chào'), findsOneWidget);
      await tester.timedDrag(
        card,
        const Offset(-170, 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('Bạn đã ôn hết từ'), findsOneWidget);
      expect(library.ratings, isEmpty);
      library.dispose();
    },
  );

  testWidgets(
    'pending or failed rating cannot move the queue and can be retried',
    (tester) async {
      final library = _ControlledWordLibrary()..decks.clear();
      library.decks.add(
        const WordDeck('pending', 'Lưu đánh giá', [
          PreviewWord('pending-0', 'one', 'một', '', ''),
          PreviewWord('pending-1', 'two', 'hai', '', ''),
        ]),
      );
      await show(tester, SrsReviewPage(library: library, deckId: 'pending'));
      library.pending = Completer<void>();
      library.fail = true;
      await tester.tap(find.byKey(const Key('srs-remember')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('srs-remember')));
      await tester.drag(
        find.byKey(const Key('srsFlashcard')),
        const Offset(-180, 0),
      );
      await tester.pumpAndSettle();
      expect(find.text('one'), findsOneWidget);
      expect(library.calls, 1);
      expect(
        tester
            .widget<FilledButton>(find.byKey(const Key('skipPracticeWord')))
            .onPressed,
        isNull,
      );
      library.pending!.complete();
      await tester.pumpAndSettle();
      expect(
        find.text('Không lưu được lượt ôn. Vui lòng thử lại.'),
        findsOneWidget,
      );
      expect(find.text('one'), findsOneWidget);
      expect(library.ratings, isEmpty);
      library.pending = null;
      library.fail = false;
      await tap(tester, find.byKey(const Key('srs-forgot')));
      expect(find.text('two'), findsOneWidget);
      expect(library.calls, 2);
      expect(library.ratings, {'pending-0': 'forgot'});
      library.dispose();
    },
  );

  testWidgets(
    'quick rating honors reduced motion and safely finishes after leaving',
    (tester) async {
      final library = WordLibrary()..decks.clear();
      library.decks.add(
        const WordDeck('motion', 'Ôn từ', [
          PreviewWord('motion-0', 'hello', 'xin chào', '', ''),
        ]),
      );
      await show(
        tester,
        SrsReviewPage(library: library, deckId: 'motion'),
        reduceMotion: true,
      );
      await tester.tap(find.byKey(const Key('srs-hard')));
      await tester.pump(const Duration(milliseconds: 1000));
      expect(find.text('hello'), findsOneWidget);
      expect(
        tester.widget<Opacity>(find.byKey(const Key('ratingCardFade'))).opacity,
        1,
      );
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();
      expect(find.text('Bạn đã ôn hết từ'), findsOneWidget);
      await tap(tester, find.byKey(const Key('replayWordDeck')));
      await tester.tap(find.byKey(const Key('srs-forgot')));
      await tester.pump();
      Navigator.of(tester.element(find.byType(SrsReviewPage))).pop();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 2));
      expect(tester.takeException(), isNull);
      library.dispose();
    },
  );

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
}
