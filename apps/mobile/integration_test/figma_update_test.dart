import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/main.dart';
import 'package:mobile/features/auth/session_controller.dart';
import '../test/test_helpers.dart';

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('LingoRoad2 new screens and five-tab navigation on Android', (
    tester,
  ) async {
    // Avoid Android IME overwriting injected text while its connection opens.
    tester.testTextInput.register();
    addTearDown(tester.testTextInput.unregister);
    await binding.convertFlutterSurfaceToImage();
    Future<void> shot(String name) async {
      await tester.pumpAndSettle();
      if (const bool.fromEnvironment('CAPTURE_EVIDENCE')) {
        await binding.takeScreenshot(name);
      }
      expect(tester.takeException(), isNull);
    }

    Future<void> tap(Finder finder) async {
      FocusManager.instance.primaryFocus?.unfocus();
      await SystemChannels.textInput.invokeMethod<void>('TextInput.hide');
      await tester.pumpAndSettle();
      await tester.ensureVisible(finder);
      await tester.pumpAndSettle();
      await tester.tap(finder);
      await tester.pumpAndSettle();
    }

    await tester.pumpWidget(MyApp(session: SessionController(FakeApi())));
    for (
      var i = 0;
      i < 30 && find.text('Tiếp tục với Email').evaluate().isEmpty;
      i++
    ) {
      await tester.pump(const Duration(milliseconds: 200));
    }
    await shot('01-welcome-logo');
    await tap(find.text('Tiếp tục với Email'));
    await shot('02-login-font');
    await tap(find.byKey(const Key('authSwitch')));
    await shot('03-register-font');
    await tap(find.text('Quay lại'));
    await tap(find.byKey(const Key('openLearningPreview')));
    await shot('04-home');
    await tap(find.byKey(const Key('previewTab1')));
    await shot('05-learn');
    await tap(find.byKey(const Key('previewTab2')));
    await shot('06-my-words');
    await tester.enterText(find.byKey(const Key('wordDeckSearch')), 'Gia đình');
    await tester.pumpAndSettle();
    expect(find.text('Công việc').hitTestable(), findsNothing);
    await shot('07-word-search');
    await tap(find.text('Tiếp tục học').hitTestable());
    await shot('08-family-word-list');
    await tap(find.byTooltip('Nghe mother'));
    await shot('09-family-native-audio');
    await tap(find.byKey(const Key('practiceWordDeck')));
    await shot('10-review-front');
    await tap(find.byKey(const Key('srsFlashcard')));
    expect(find.text('mẹ'), findsOneWidget);
    await shot('11-review-back');
    // This flow only reads the user's preview library; rating persistence is
    // covered by isolated widget tests with mock preferences.
    await tap(find.text('Lộ trình'));
    expect(find.text('Học'), findsOneWidget);
    await tap(find.byKey(const Key('previewTab3')));
    await shot('12-practice');
    await tap(find.byKey(const Key('previewTab4')));
    await shot('13-progress');
    // Warm all five pages and exercise both directions without rebuilding tabs.
    for (final target in [3, 2, 1, 0, 1, 2, 3, 4]) {
      final pager = tester.widget<PageView>(
        find.byKey(const Key('learningPages')),
      );
      final before = pager.controller!.page!;
      await tester.timedDrag(
        find.byKey(const Key('learningPages')),
        Offset(target > before ? -310 : 310, 0),
        const Duration(milliseconds: 300),
      );
      await tester.pumpAndSettle();
      expect(pager.controller!.page, closeTo(target, .01));
    }
    await tap(find.byKey(const Key('previewTab0')));
    await tap(find.byKey(const Key('previewAvatar')));
    await shot('14-avatar-logout');
    await tap(find.byKey(const Key('previewLogout')));
    expect(find.byKey(const Key('openLearningPreview')), findsOneWidget);
  });
}
