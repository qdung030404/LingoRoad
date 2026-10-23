import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/learning/learning_preview.dart';
import 'package:mobile/features/learning/lesson_pages.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/learning/practice_pages.dart';
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
  }) async {
    if (path == '/auth/logout') {
      logoutCalls++;
      if (offline) throw const ApiFailure('Offline');
    }
    return super.request(method, path, data: data, auth: auth);
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
    await tester.tap(finder);
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

  for (final offline in [false, true]) {
    testWidgets(
      'avatar logout clears authenticated session (offline=$offline)',
      (tester) async {
        final api = _LogoutApi(offline: offline);
        final session = SessionController(api);
        await tester.pumpWidget(MyApp(session: session));
        await tester.pumpAndSettle();
        await tap(tester, find.text('Xem lộ trình mẫu'));
        await tap(tester, find.byTooltip('Quay lại'));
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
      await tap(tester, find.byKey(const Key('previewTab2')));
      await tap(tester, find.byKey(const Key('previewTab0')));
      expect(offset(), closeTo(savedOffset, 1));
      await tester.tap(find.byKey(const Key('previewTab3')));
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.byKey(const Key('previewTab1')));
      await tester.pumpAndSettle();
      expect(pager.controller!.page, closeTo(1, .01));
      expect(tester.takeException(), isNull);
      await model.savePlan(20, {'Nghe'});
      await tester.pumpAndSettle();
      await tap(tester, find.byKey(const Key('previewTab0')));
      expect(find.text('0/20 phút'), findsOneWidget);
    },
  );

  testWidgets('tab buttons respect reduced motion', (tester) async {
    await show(
      tester,
      LearningPreview(model: PreviewModel()),
      reduceMotion: true,
    );
    await tester.tap(find.byKey(const Key('previewTab3')));
    await tester.pump();
    expect(
      tester
          .widget<PageView>(find.byKey(const Key('learningPages')))
          .controller!
          .page,
      3,
    );
    expect(tester.takeException(), isNull);
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
    await tap(tester, find.byKey(const Key('previewTab2')));
    await capture(tester, 'practice');
    for (final skill in PracticeSkill.values) {
      await tap(tester, find.text(skill.label).first);
      await tap(tester, find.text(skill.title));
      expect(find.text(skill.title), findsOneWidget);
      await capture(tester, skill.source);
      await tap(tester, find.byTooltip('Quay lại'));
      await tester.pumpAndSettle();
    }
    await tap(tester, find.byKey(const Key('previewTab3')));
    expect(
      find.text('Tiến độ minh họa trên thiết bị; không phải kết quả đánh giá.'),
      findsOneWidget,
    );
  });

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
      await tap(tester, find.byKey(const Key('previewTab2')));
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
