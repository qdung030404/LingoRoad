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
import 'package:mobile/features/learning/preview_navigation_bar.dart';
import 'package:mobile/features/learning/learning_preview.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/learning/word_library.dart';
import 'package:mobile/features/learning/word_collection_pages.dart';
import 'package:mobile/features/learning/srs_review_page.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/main.dart';
import 'test_helpers.dart';
import 'support/ui_fonts.dart';

part 'learning_preview_extra_cases.dart';

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

final boundaryKey = GlobalKey();

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
  await tester.runAsync(loadUiFonts);
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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
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
        await tester.scrollUntilVisible(
          find.byKey(const Key('logoutButton')),
          200,
          scrollable: find.byType(Scrollable).last,
        );
        expect(find.text('Đăng xuất'), findsOneWidget);
        await tap(tester, find.byKey(const Key('logoutButton')));
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

  testWidgets('practice history opens with the active listening or reading filter', (
    tester,
  ) async {
    final api = FakeApi(signedIn: true, completed: true);
    await tester.pumpWidget(MyApp(session: SessionController(api)));
    await tester.pumpAndSettle();
    await tap(tester, find.byKey(const Key('previewTab3')));
    final history = find.byKey(const ValueKey('practice-history'));
    expect(tester.widget<IconButton>(history).tooltip, 'Lịch sử làm bài');
    expect(find.text('Lịch sử làm bài'), findsNothing);
    await tap(tester, history);
    expect(find.text('Lịch sử luyện nghe'), findsOneWidget);
    expect(api.requestedPaths, contains('/learning/history?limit=20&kind=LISTENING'));
    await tap(tester, find.byTooltip('Quay lại'));
    await tap(tester, find.text('Đọc').first);
    await tap(tester, history);
    expect(find.text('Lịch sử luyện đọc'), findsOneWidget);
    expect(api.requestedPaths, contains('/learning/history?limit=20&kind=READING'));
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
    final catalogue = find.byKey(const PageStorageKey('preview-content-2'));
    final scrollable = find
        .descendant(of: catalogue, matching: find.byType(Scrollable))
        .first;
    for (final skill in PracticeSkill.values) {
      tester.state<ScrollableState>(scrollable).position.jumpTo(0);
      await tester.pumpAndSettle();
      final tab = find.text(skill.label);
      expect(
        tab,
        findsWidgets,
        reason: 'The ${skill.label} tab is visible in the catalogue.',
      );
      await tap(tester, tab.first);
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

  _registerLearningPreviewExtraTests();
}
