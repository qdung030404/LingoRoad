import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/placement/placement_pages.dart';
import 'package:mobile/main.dart';
import 'test_helpers.dart';

void main() {
  testWidgets('Android back pops account pages without ending the session', (
    tester,
  ) async {
    final session = SessionController(FakeApi(signedIn: true));
    await tester.pumpWidget(MyApp(session: session));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Hồ sơ của tôi'));
    await tester.pumpAndSettle();
    expect(find.text('Hồ sơ của tôi'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Cùng tìm điểm xuất phát của bạn'), findsOneWidget);
    expect(session.stage, SessionStage.ready);
  });
  testWidgets('Welcome opens registration and validates required fields', (
    tester,
  ) async {
    await tester.pumpWidget(MyApp(session: SessionController(FakeApi())));
    await tester.pumpAndSettle();
    expect(find.text('Tiếp tục với Email'), findsOneWidget);
    await tester.ensureVisible(find.text('Tiếp tục với Email'));
    await tester.tap(find.text('Tiếp tục với Email'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('authSwitch')));
    await tester.tap(find.byKey(const Key('authSwitch')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.byKey(const Key('authSubmit')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('authSubmit')));
    await tester.pumpAndSettle();
    expect(find.text('Họ tên cần từ 2 đến 100 ký tự.'), findsOneWidget);
    expect(find.text('Nhập địa chỉ email hợp lệ.'), findsOneWidget);
  });
  testWidgets(
    'Incomplete profile routes to onboarding and saves selected goal',
    (tester) async {
      final api = FakeApi(signedIn: true, onboarding: true);
      await tester.pumpWidget(MyApp(session: SessionController(api)));
      await tester.pumpAndSettle();
      expect(find.text('Mục tiêu của bạn'), findsOneWidget);
      await tester.tap(find.byKey(const Key('learningPurpose')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Thi chứng chỉ').last);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('20 phút'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('20 phút'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Lưu và tiếp tục'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Lưu và tiếp tục'));
      await tester.pumpAndSettle();
      expect(api.profile['dailyGoalMinutes'], 20);
      expect(api.profile['learningPurpose'], 'EXAM');
      expect(find.text('Cùng tìm điểm xuất phát của bạn'), findsOneWidget);
    },
  );
  testWidgets(
    'Question requires selection and keeps it after failed submission',
    (tester) async {
      final api = FakeApi()..failAnswer = true;
      await tester.pumpWidget(
        MaterialApp(home: QuestionPage(session: SessionController(api))),
      );
      await tester.pumpAndSettle();
      final next = find.descendant(
        of: find.byKey(const Key('submitAnswer')),
        matching: find.byType(ElevatedButton),
      );
      await tester.ensureVisible(next);
      expect(tester.widget<ElevatedButton>(next).onPressed, null);
      await tester.ensureVisible(find.byKey(const ValueKey('option-0')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('option-0')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(next);
      await tester.pumpAndSettle();
      await tester.tap(next);
      await tester.pumpAndSettle();
      expect(find.text('Mất kết nối. Thử lại.'), findsOneWidget);
      expect(tester.widget<ElevatedButton>(next).onPressed, isNotNull);
      api.failAnswer = false;
      await tester.ensureVisible(next);
      await tester.pumpAndSettle();
      await tester.tap(next);
      await tester.pumpAndSettle();
      expect(api.submitted.single['selectedOption'], 'Hanoi');
      await tester.ensureVisible(find.text('Câu 2/5'));
      expect(find.text('Câu 2/5'), findsOneWidget);
    },
  );
  testWidgets(
    'Completed startup shows provisional result and unassessed skills',
    (tester) async {
      await tester.pumpWidget(
        MyApp(
          session: SessionController(FakeApi(signedIn: true, completed: true)),
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.textContaining('CEFR B1'), 200);
      expect(find.textContaining('CEFR B1'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Viết'), 250);
      expect(find.text('Chưa đánh giá'), findsNWidgets(2));
      await tester.ensureVisible(find.text('Xem lại bài làm'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xem lại bài làm'));
      await tester.pumpAndSettle();
      expect(find.text('Xem lại bài làm'), findsOneWidget);
    },
  );
}
