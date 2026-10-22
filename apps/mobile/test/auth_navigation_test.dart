import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/main.dart';
import 'test_helpers.dart';

class _PendingLoginApi extends FakeApi {
  final login = Completer<Json>();
  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
  }) => path == '/auth/login'
      ? login.future
      : super.request(method, path, data: data, auth: auth);
}

void main() {
  Future<void> open(WidgetTester tester, FakeApi api) async {
    await tester.pumpWidget(MyApp(session: SessionController(api)));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Tiếp tục với Email'));
    await tester.tap(find.text('Tiếp tục với Email'));
    await tester.pumpAndSettle();
  }

  Future<void> fillLogin(WidgetTester tester) async {
    await tester.enterText(find.byKey(const Key('email')), 'anna@example.com');
    await tester.enterText(find.byKey(const Key('password')), 'ValidPass123');
    await tester.ensureVisible(find.byKey(const Key('authSubmit')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('authSubmit')));
  }

  testWidgets(
    'auth sheet slides over welcome both ways without duplicate routes',
    (tester) async {
      await tester.pumpWidget(MyApp(session: SessionController(FakeApi())));
      await tester.pumpAndSettle();
      await tester.drag(
        find.text('Ứng dụng học\ntiếng Anh'),
        const Offset(-260, 0),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Tiếp tục với Email'));
      final emailButton = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Tiếp tục với Email'),
      );
      emailButton.onPressed!();
      emailButton.onPressed!();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 70));
      final email = find.byKey(const Key('email'));
      final slide = find
          .ancestor(of: email, matching: find.byType(SlideTransition))
          .first;
      expect(tester.widget<SlideTransition>(slide).position.value.dx, 0);
      expect(
        tester.widget<SlideTransition>(slide).position.value.dy,
        inExclusiveRange(0, 1),
      );
      await tester.pumpAndSettle();
      final sheet = find.byKey(const Key('authSheet'));
      final route = ModalRoute.of(tester.element(email))!;
      expect(route.opaque, isFalse);
      expect(route.barrierColor, const Color(0x66000000));
      expect(tester.getTopLeft(sheet).dy, greaterThan(0));
      expect(
        tester.widget<ClipRRect>(sheet).borderRadius,
        const BorderRadius.vertical(top: Radius.circular(24)),
      );
      expect(find.text('Học tiếng anh\nmọi nơi'), findsOneWidget);
      expect(
        find.byKey(const Key('email'), skipOffstage: false),
        findsOneWidget,
      );
      await tester.tap(find.byKey(const Key('authSwitch')));
      await tester.pumpAndSettle();
      expect(find.byType(TextFormField), findsNWidgets(4));
      expect(ModalRoute.of(tester.element(email)), same(route));
      await tester.tap(find.text('Quay lại'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 70));
      expect(
        tester.widget<SlideTransition>(slide).position.value.dy,
        inExclusiveRange(0, 1),
      );
      await tester.pumpAndSettle();
      expect(email, findsNothing);
      expect(find.text('Học tiếng anh\nmọi nơi'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'successful email login dismisses the form and opens account flow',
    (tester) async {
      await open(tester, FakeApi(onboarding: true));
      await fillLogin(tester);
      await tester.pumpAndSettle();
      expect(find.text('Mục tiêu của bạn'), findsOneWidget);
      expect(
        find.byKey(const Key('authSubmit'), skipOffstage: false),
        findsNothing,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'pending login blocks back; failed login retains form and allows back',
    (tester) async {
      final api = _PendingLoginApi();
      await open(tester, api);
      await fillLogin(tester);
      await tester.pump(const Duration(milliseconds: 100));
      await tester.binding.handlePopRoute();
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byKey(const Key('email')), findsOneWidget);
      api.login.completeError(const ApiFailure('Mất kết nối. Thử lại.'));
      await tester.pumpAndSettle();
      expect(find.text('Mất kết nối. Thử lại.'), findsOneWidget);
      expect(find.text('anna@example.com'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Tiếp tục với Email'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
