import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/main.dart';
import 'test_helpers.dart';

// Optional exports are actual widget renders, never runtime backgrounds.
// flutter test test/figma_visual_test.dart --dart-define=CAPTURE_UI=true
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  Future<void> prepare(
    WidgetTester tester, {
    Size size = const Size(393, 852),
  }) async {
    tester.view.physicalSize = size;
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.runAsync(() async {
      final font = FontLoader('Inter')
        ..addFont(rootBundle.load('assets/fonts/Inter-Variable.ttf'));
      await font.load();
    });
  }

  final boundaryKey = GlobalKey();
  Future<void> capture(WidgetTester tester, String name) async {
    await tester.runAsync(() async {
      for (final element in find.byType(Image).evaluate()) {
        await precacheImage((element.widget as Image).image, element);
      }
    });
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    if (!const bool.fromEnvironment('CAPTURE_UI')) return;
    await tester.runAsync(() async {
      final boundary =
          boundaryKey.currentContext!.findRenderObject()!
              as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 1);
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      final file = File('../../.demo/figma-ui-v2/widgets/$name.png');
      await file.parent.create(recursive: true);
      await file.writeAsBytes(data!.buffer.asUint8List());
      image.dispose();
    });
  }

  Future<void> app(WidgetTester tester, FakeApi api) async {
    await tester.pumpWidget(
      RepaintBoundary(
        key: boundaryKey,
        child: MyApp(session: SessionController(api)),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    '393x852 welcome, carousel and auth match their layout constraints',
    (tester) async {
      await prepare(tester);
      await app(tester, FakeApi());
      await capture(tester, 'welcome');
      await tester.drag(
        find.text('Ứng dụng học\ntiếng Anh'),
        const Offset(-320, 0),
      );
      await tester.pumpAndSettle();
      expect(find.text('Học tiếng anh\nmọi nơi'), findsOneWidget);
      await capture(tester, 'welcome-audio');
      await tester.drag(
        find.text('Học tiếng anh\nmọi nơi'),
        const Offset(-320, 0),
      );
      await tester.pumpAndSettle();
      await capture(tester, 'welcome-path');
      await tester.tap(find.text('Tiếp tục với Email'));
      await capture(tester, 'login');
      await tester.tap(find.byKey(const Key('authSwitch')));
      await capture(tester, 'register');
      expect(find.byType(TextFormField), findsNWidgets(4));
      await tester.enterText(find.byType(TextFormField).at(2), 'ValidPass123');
      await tester.enterText(find.byType(TextFormField).at(3), 'Different123');
      await tester.ensureVisible(find.byKey(const Key('authSubmit')));
      await tester.tap(find.byKey(const Key('authSubmit')));
      await tester.pumpAndSettle();
      expect(find.text('Không khớp với mật khẩu đã nhập'), findsOneWidget);
    },
  );
  testWidgets(
    '393x852 placement and selected options render without overflow',
    (tester) async {
      await prepare(tester);
      final api = FakeApi(signedIn: true);
      await app(tester, api);
      await capture(tester, 'intro');
      await tester.tap(find.text('Bắt đầu kiểm tra'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('option-1')));
      await capture(tester, 'reading-selected');
      expect(find.byKey(const Key('submitAnswer')), findsOneWidget);
    },
  );
  testWidgets(
    '393x852 result and read-only review keep real assessment semantics',
    (tester) async {
      await prepare(tester);
      final api = FakeApi(signedIn: true, completed: true)..index = 1;
      await app(tester, api);
      await capture(tester, 'result');
      expect(find.text('Chưa đánh giá'), findsNWidgets(2));
      await tester.tap(find.text('Xem lại bài làm'));
      await capture(tester, 'review');
      expect(find.text('Đáp án'), findsOneWidget);
      expect(find.text('Đáp án đã nộp được khóa.'), findsOneWidget);
    },
  );
  testWidgets(
    '320x640 and open keyboard retain access to authentication actions',
    (tester) async {
      await prepare(tester, size: const Size(320, 640));
      await app(tester, FakeApi());
      await tester.ensureVisible(find.text('Tiếp tục với Email'));
      await tester.tap(find.text('Tiếp tục với Email'));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('authSwitch')));
      await tester.pumpAndSettle();
      tester.view.viewInsets = const FakeViewPadding(bottom: 260);
      addTearDown(tester.view.resetViewInsets);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byKey(const Key('authSubmit')));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.byKey(const Key('authSubmit')).hitTestable(), findsOneWidget);
    },
  );
}
