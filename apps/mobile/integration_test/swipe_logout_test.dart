import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/main.dart';
import 'package:mobile/features/auth/session_controller.dart';
import '../test/test_helpers.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('welcome and main swipes, rapid tabs and avatar logout', (
    tester,
  ) async {
    await binding.convertFlutterSurfaceToImage();
    Future<void> tap(Finder finder) async {
      await tester.ensureVisible(finder);
      await tester.tap(finder);
      await tester.pumpAndSettle();
    }

    Future<void> shot(String name) async {
      if (const bool.fromEnvironment('CAPTURE_EVIDENCE')) {
        await binding.takeScreenshot(name);
      }
      expect(tester.takeException(), isNull);
    }

    double page(String key) =>
        tester.widget<PageView>(find.byKey(Key(key))).controller!.page!;

    Future<void> followFinger(String key, Finder title) async {
      final x = tester.getTopLeft(title).dx;
      final drag = await tester.startGesture(tester.getCenter(title));
      await drag.moveBy(const Offset(-20, 0));
      await tester.pump(const Duration(milliseconds: 16));
      await drag.moveBy(const Offset(-110, 0));
      await tester.pump(const Duration(milliseconds: 16));
      expect(tester.getTopLeft(title).dx, lessThan(x - 40));
      expect(page(key), inExclusiveRange(0, 1));
      await drag.moveBy(const Offset(-180, 0));
      await drag.up();
      await tester.pumpAndSettle();
      expect(page(key), closeTo(1, .01));
    }

    // The fixture uses no real account, backend or secure-storage credentials.
    await tester.pumpWidget(MyApp(session: SessionController(FakeApi())));
    await tester.pumpAndSettle();
    await shot('01-welcome');
    final welcomeTitle = find.text('Ứng dụng học\ntiếng Anh');
    final titleX = tester.getTopLeft(welcomeTitle).dx;
    final welcomeDrag = await tester.startGesture(
      tester.getCenter(welcomeTitle),
    );
    await welcomeDrag.moveBy(const Offset(-20, 0));
    await tester.pump(const Duration(milliseconds: 16));
    await welcomeDrag.moveBy(const Offset(-110, 0));
    await tester.pump(const Duration(milliseconds: 16));
    expect(tester.getTopLeft(welcomeTitle).dx, titleX);
    expect(page('welcomePages'), 0);
    await welcomeDrag.up();
    await tester.pumpAndSettle();
    expect(page('welcomePages'), closeTo(1, .01));
    await shot('02-welcome-audio');
    await tester.timedDrag(
      find.text('Học tiếng anh\nmọi nơi'),
      const Offset(-310, 0),
      const Duration(milliseconds: 300),
    );
    await tester.pumpAndSettle();
    expect(page('welcomePages'), closeTo(2, .01));
    await shot('03-welcome-path');
    await tap(find.byKey(const Key('welcomeDot0')));
    expect(page('welcomePages'), closeTo(0, .01));

    await tap(find.byKey(const Key('openLearningPreview')));
    await followFinger('learningPages', find.text('Hello, Anna!'));
    await shot('04-learn');
    await tester.timedDrag(
      find.byKey(const Key('learningPages')),
      const Offset(-310, 0),
      const Duration(milliseconds: 300),
    );
    await tester.pumpAndSettle();
    expect(page('learningPages'), closeTo(2, .01));
    await shot('05-practice');
    await tap(find.byKey(const Key('previewTab3')));
    expect(page('learningPages'), closeTo(3, .01));
    await shot('06-progress');
    await tap(find.byKey(const Key('previewTab0')));
    final home = find.byKey(const PageStorageKey('preview-content-0'));
    await tester.drag(home, const Offset(0, -180));
    await tester.pumpAndSettle();
    double offset() => tester
        .state<ScrollableState>(
          find.descendant(of: home, matching: find.byType(Scrollable)).first,
        )
        .position
        .pixels;
    final saved = offset();
    expect(saved, greaterThan(0));
    await tap(find.byKey(const Key('previewTab2')));
    await tap(find.byKey(const Key('previewTab0')));
    expect(offset(), closeTo(saved, 1));
    await tester.tap(find.byKey(const Key('previewTab3')));
    await tester.pump(const Duration(milliseconds: 50));
    await tester.tap(find.byKey(const Key('previewTab1')));
    await tester.pumpAndSettle();
    expect(page('learningPages'), closeTo(1, .01));
    await tap(find.byKey(const Key('previewTab0')));
    await tester.drag(home, const Offset(0, 500));
    await tester.pumpAndSettle();
    await tap(find.byKey(const Key('previewAvatar')));
    await shot('07-avatar-popup');
    await tap(find.byKey(const Key('previewLogout')));
    expect(find.text('Tiếp tục với Email'), findsOneWidget);
    expect(find.byKey(const Key('previewAvatar')), findsNothing);
    await shot('08-logged-out');
    binding.reportData ??= <String, dynamic>{};
    binding.reportData!['swipeLogout'] = {
      'welcomeOriginalFixedCard': true,
      'allMainTabs': true,
      'mainFollowsFinger': true,
      'scrollRestored': true,
      'rapidTabs': true,
      'guestLogout': true,
    };
  });
}
