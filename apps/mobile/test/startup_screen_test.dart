import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/auth/auth_page.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/demo_shell.dart';
import 'package:mobile/features/learning/home_cache.dart';

import 'test_helpers.dart';

void main() {
  testWidgets('Startup stays on the loading screen when a snapshot exists', (
    tester,
  ) async {
    final session = SessionController(FakeApi())
      ..cachedHome = {
        'date': homeLearningDate(),
        'totals': {'completedLessonCount': 5, 'activeSeconds': 1200},
      };
    addTearDown(session.dispose);

    await tester.pumpWidget(MaterialApp(home: DemoShell(session: session)));

    expect(find.text('LingoRoad'), findsOneWidget);
    expect(find.text('Đang tải…'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(find.text('Tiến độ học tập'), findsNothing);
    expect(find.text('Đăng xuất'), findsNothing);

    await session.initialize();
    await tester.pumpWidget(MaterialApp(home: DemoShell(session: session)));

    expect(find.text('Đang tải…'), findsNothing);
    expect(find.byType(AuthPage), findsOneWidget);
  });

  testWidgets('Connection error can still reveal saved progress', (
    tester,
  ) async {
    final session = SessionController(FakeApi())
      ..stage = SessionStage.error
      ..cachedHome = {
        'date': homeLearningDate(),
        'totals': {'completedLessonCount': 5, 'activeSeconds': 1200},
      };
    addTearDown(session.dispose);

    await tester.pumpWidget(MaterialApp(home: DemoShell(session: session)));

    expect(find.text('Đang tải…'), findsNothing);
    expect(find.text('Đang xem dữ liệu đã lưu'), findsOneWidget);
    expect(find.text('5 bài đã hoàn thành'), findsOneWidget);
    expect(find.text('Đăng xuất'), findsOneWidget);
  });
}
