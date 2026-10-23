import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/main.dart';

// Run against a seeded demo backend, never the user's normal database:
// flutter test integration_test/first_demo_test.dart -d emulator-5554
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'Real API: register, onboard, resume, reading/listening, result and session restore',
    (tester) async {
      final store = SecureTokenStore();
      // Account and results stay in the dedicated demo database for evidence.
      await store.clear();
      SessionController newSession() =>
          SessionController(ApiClient(config: AppConfig(), store: store));
      var session = newSession();
      await tester.pumpWidget(
        MyApp(key: const ValueKey('initial'), session: session),
      );
      await tester.pumpAndSettle();
      const capture = bool.fromEnvironment('CAPTURE_EVIDENCE');
      if (capture) {
        await binding.convertFlutterSurfaceToImage();
        await tester.pumpAndSettle();
      }
      Future<void> screenshot(String name, {bool settle = true}) async {
        if (capture) {
          if (settle) {
            await tester.pumpAndSettle();
          } else {
            await tester.pump();
          }
          await binding.takeScreenshot(name);
        }
      }

      Future<void> tap(Finder finder) async {
        FocusManager.instance.primaryFocus?.unfocus();
        await tester.runAsync(() async {
          await SystemChannels.textInput.invokeMethod<void>('TextInput.hide');
          // Android IME animation is native and can finish after Flutter settles.
          await Future<void>.delayed(const Duration(milliseconds: 500));
        });
        await tester.pumpAndSettle();
        await tester.ensureVisible(finder);
        await tester.pumpAndSettle();
        await tester.tap(finder);
        await tester.pumpAndSettle(const Duration(milliseconds: 100));
      }

      await screenshot('00-welcome');
      await tap(find.text('Tiếp tục với Email'));
      await screenshot('00-login');
      await tap(find.byKey(const Key('authSwitch')));
      await screenshot('01-register');
      final email =
          'mobile-demo-${DateTime.now().millisecondsSinceEpoch}@example.com';
      await tester.enterText(find.byType(TextFormField).at(0), 'Demo Mobile');
      await tester.enterText(find.byType(TextFormField).at(1), email);
      await tester.enterText(find.byType(TextFormField).at(2), 'DemoPass123');
      await tester.enterText(find.byType(TextFormField).at(3), 'DemoPass123');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tap(find.byKey(const Key('authSubmit')));
      expect(find.text('Mục tiêu của bạn'), findsOneWidget);
      await screenshot('02-onboarding');
      await tap(find.byKey(const Key('learningPurpose')));
      await tap(find.text('Giao tiếp hằng ngày').last);
      await tap(find.text('20 phút'));
      await tap(find.text('Lưu và tiếp tục'));
      await screenshot('02-placement-intro');
      await tap(find.text('Bắt đầu kiểm tra'));
      await screenshot('03-reading');

      await tap(find.byKey(const ValueKey('option-0')));
      await tap(find.text('Tiếp theo'));
      expect(find.text('Câu 2/5'), findsOneWidget);
      final resumedId = session.placement['currentSessionId'];
      // Recreate app/session: reads refresh token from platform secure storage.
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      session = newSession();
      await tester.pumpWidget(
        MyApp(key: const ValueKey('resumed'), session: session),
      );
      await tester.pumpAndSettle();
      expect(find.text('Tiếp tục bài kiểm tra'), findsOneWidget);
      if (resumedId != null) {
        expect(session.placement['currentSessionId'], resumedId);
      }
      await tap(find.text('Tiếp tục bài đang làm'));
      expect(find.text('Câu 2/5'), findsOneWidget);
      for (var index = 1; index < 10; index++) {
        if (index == 5) {
          await tap(find.text('Bắt đầu phần Nghe'));
          await screenshot('04-listening');
        }
        if (index == 5) {
          // A live timeline continuously schedules frames: settling here would
          // wait for the whole clip and miss the actual playing state.
          await tester.ensureVisible(find.byTooltip('Nghe audio'));
          await tester.pumpAndSettle();
          await tester.tap(find.byTooltip('Nghe audio'));
          await tester.pump();
          for (
            var attempt = 0;
            attempt < 100 && find.byTooltip('Tạm dừng').evaluate().isEmpty;
            attempt++
          ) {
            await tester.runAsync(
              () => Future<void>.delayed(const Duration(milliseconds: 100)),
            );
            await tester.pump();
          }
          expect(find.textContaining('Không tải được audio'), findsNothing);
          // Pause or stop will also happen when the answer is submitted.
          expect(find.byTooltip('Tạm dừng'), findsOneWidget);
          await tester.runAsync(
            () => Future<void>.delayed(const Duration(seconds: 1)),
          );
          await tester.pump();
          expect(
            tester
                .widget<LinearProgressIndicator>(
                  find.byKey(const Key('audioProgress')),
                )
                .value,
            greaterThan(0),
          );
          await screenshot('04-listening-playing', settle: false);
          await tester.tap(find.byTooltip('Tạm dừng'));
          await tester.pumpAndSettle();
        }
        await tap(find.byKey(const ValueKey('option-0')));
        await tap(find.byKey(const Key('submitAnswer')));
      }
      expect(find.text('Đây là điểm\nxuất phát của bạn'), findsOneWidget);
      expect(
        find.textContaining(RegExp(r'^CEFR (A1|A2|B1|B2)')),
        findsOneWidget,
      );
      expect(find.text('Chưa đánh giá'), findsNWidgets(2));
      await screenshot('05-result');
      await tap(find.text('Xem lại bài làm'));
      await screenshot('06-review');
      for (var reviewed = 0; reviewed < 10; reviewed++) {
        expect(find.text('Đáp án'), findsOneWidget);
        expect(find.text('Đáp án đã nộp được khóa.'), findsOneWidget);
        await tap(find.byKey(const Key('nextReview')));
      }

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      session = newSession();
      await tester.pumpWidget(
        MyApp(key: const ValueKey('completed'), session: session),
      );
      await tester.pumpAndSettle();
      expect(find.text('Đây là điểm\nxuất phát của bạn'), findsOneWidget);
      await tap(find.byTooltip('Hồ sơ của tôi'));
      expect(find.text(email), findsOneWidget);
      expect(find.text('Giao tiếp hằng ngày'), findsOneWidget);
      expect(session.profile['dailyGoalMinutes'], 20);
      await tester.enterText(
        find.byType(TextFormField).first,
        'Demo Mobile Updated',
      );
      await tap(find.text('10 phút'));
      await tap(find.text('Lưu thay đổi'));
      expect(find.text('Đã lưu hồ sơ.'), findsOneWidget);
      expect(session.profile['dailyGoalMinutes'], 10);
      await tap(find.text('Đổi mật khẩu'));
      await tester.enterText(find.byType(TextFormField).at(0), 'DemoPass123');
      await tester.enterText(find.byType(TextFormField).at(1), 'DemoPass456');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tap(find.widgetWithText(ElevatedButton, 'Đổi mật khẩu'));
      await tap(find.text('Tiếp tục với Email'));
      await tester.enterText(find.byType(TextFormField).at(0), email);
      await tester.enterText(find.byType(TextFormField).at(1), 'DemoPass456');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tap(find.byKey(const Key('authSubmit')));
      expect(find.text('Đây là điểm\nxuất phát của bạn'), findsOneWidget);
      expect(session.user?['name'], 'Demo Mobile Updated');
      expect(session.profile['dailyGoalMinutes'], 10);
      binding.reportData = {
        ...?binding.reportData,
        'email': email,
        'sessionId': session.placement['currentSessionId'],
        'scenario': 'first-demo-full-happy-path',
      };
    },
  );
}
