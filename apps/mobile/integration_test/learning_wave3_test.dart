import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/learning/learning_preview.dart';
import 'package:mobile/shared/figma_widgets.dart';

// Đợt 3 acceptance on MuMu: exercises both CURRICULUM (timeout fallback + retry,
// single explanation) and AI explanation branches across real Flutter -> NestJS -> Python ML.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('wave 3 reading AI explain: CURRICULUM fallback retry and AI branches', (
    tester,
  ) async {
    const emulator = String.fromEnvironment('LEARNING_TEST_EMULATOR');
    expect(emulator, isNotEmpty, reason: 'Requires a local Auth Emulator.');
    const capture = bool.fromEnvironment('CAPTURE_EVIDENCE');
    final api = ApiClient(config: AppConfig(), store: _MemoryTokens());
    late SessionController account;
    late List<Json> lessons;
    await tester.runAsync(() async {
      final identity = await Dio().post<Map<String, dynamic>>(
        'http://$emulator/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',
        data: {
          'email':
              'learning-mumu-${DateTime.now().millisecondsSinceEpoch}@example.com',
          'password': 'LearningDevice123!',
          'returnSecureToken': true,
        },
      );
      api.accessToken = identity.data!['idToken'] as String;
      account = SessionController(api)
        ..user = await api.request('GET', '/auth/me')
        ..stage = SessionStage.ready;
      lessons = (await api.request(
        'GET',
        '/learning/lessons',
      ))['items'].cast<Map<String, dynamic>>();
    });

    Future<void> mount() async {
      await tester.pumpWidget(
        MaterialApp(
          key: UniqueKey(),
          theme: AppTheme.lightTheme,
          home: LearningPreview(account: account),
        ),
      );
      await tester.pumpAndSettle();
    }

    Future<void> waitFor(
      Finder finder, {
      int maxTicks = 180,
      bool settle = true,
    }) async {
      for (var i = 0; i < maxTicks && finder.evaluate().isEmpty; i++) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 100)),
        );
        await tester.pump();
      }
      expect(finder, findsWidgets);
      if (settle) await tester.pumpAndSettle();
    }

    Finder listScrollable() => find.byWidgetPredicate(
      (widget) =>
          widget is Scrollable && widget.axisDirection == AxisDirection.down,
    );

    Future<void> tap(Finder finder) async {
      await waitFor(finder);
      await tester.ensureVisible(finder.first);
      await tester.pumpAndSettle();
      await tester.tap(finder.first);
      await tester.pumpAndSettle();
    }

    Future<void> reveal(Finder finder) async {
      await tester.scrollUntilVisible(
        finder,
        180,
        scrollable: listScrollable(),
      );
      await Scrollable.ensureVisible(finder.evaluate().first, alignment: 0.35);
      await tester.pumpAndSettle();
    }

    Future<void> scrollAndTap(Finder finder) async {
      await reveal(finder);
      await tester.tap(finder.first);
      await tester.pumpAndSettle();
    }

    Future<void> screenshot(String name) async {
      if (!capture) return;
      await tester.pumpAndSettle();
      await binding.takeScreenshot(name);
    }

    await mount();
    if (capture) {
      await binding.convertFlutterSurfaceToImage();
      await tester.pumpAndSettle();
    }

    // 1. B1 Câu 1: lần gọi #1 ML timeout 9s -> fallback CURRICULUM (không lặp lời giải + hiện nút thử lại).
    final readingB1 = lessons.firstWhere(
      (row) => row['code'] == 'reading-b1-hybrid-workday',
    );
    await tap(find.byKey(ValueKey('learning-lesson-${readingB1['id']}')));
    await tap(find.byKey(const Key('learningStart')));
    await waitFor(find.text('Học 1/3'));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Học 2/3'));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Học 3/3'));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Câu 1/6'));

    final b1WrongOption = find.byKey(const ValueKey('learning-option-A'));
    await scrollAndTap(b1WrongOption);
    expect(tester.widget<AnswerOption>(b1WrongOption).selected, isTrue);
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Tiếp theo'));
    await reveal(find.text('Chưa chính xác'));

    const b1Q1Original =
        'Hana cho biết nhóm vẫn giữ mô hình kết hợp sau giai đoạn thử nghiệm kèm hai điều chỉnh nhỏ áp dụng từ thứ Hai tới.';
    expect(find.text(b1Q1Original), findsOneWidget);

    final b1ExplainBtn = find.byKey(
      const ValueKey('learning-ai-explain-hybrid-main-purpose'),
    );
    await scrollAndTap(b1ExplainBtn);
    await waitFor(find.text('Giải thích từ học liệu'), maxTicks: 220);
    expect(find.text(b1Q1Original), findsOneWidget);
    expect(find.text('Thử lại giải thích AI'), findsOneWidget);
    await Scrollable.ensureVisible(
      find.text('Thử lại giải thích AI').evaluate().first,
      alignment: 0.55,
    );
    await tester.pumpAndSettle();
    await screenshot('learning-14-b1-curriculum-retry');

    // 2. Bấm Thử lại trên chính B1 Câu 1 -> lần gọi #2 nhận Giải thích AI.
    await Scrollable.ensureVisible(
      b1ExplainBtn.evaluate().first,
      alignment: 0.35,
    );
    await tester.pumpAndSettle();
    await tap(b1ExplainBtn);
    await waitFor(find.text('Giải thích AI'), maxTicks: 150);
    expect(b1ExplainBtn, findsNothing);
    await Scrollable.ensureVisible(
      find.text('Giải thích AI').evaluate().first,
      alignment: 0.4,
    );
    await tester.pumpAndSettle();
    await screenshot('learning-15-b1-ai-retried');
    await tap(find.byTooltip('Thoát'));
    await waitFor(find.text('Hủy bài & thoát'));
    await tap(find.text('Hủy bài & thoát'));

    // 3. B2 Câu 6 (Not Given): kiểm tra Giải thích AI cho dạng TRUE_FALSE_NOT_GIVEN.
    final readingB2 = lessons.firstWhere(
      (row) => row['code'] == 'reading-b2-urban-pocket-parks',
    );
    await tap(find.byKey(ValueKey('learning-lesson-${readingB2['id']}')));
    await tap(find.byKey(const Key('learningStart')));
    await waitFor(find.text('Học 1/3'));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Học 2/3'));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Học 3/3'));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Câu 1/6'));

    for (var index = 0; index < 5; index++) {
      await waitFor(find.text('Câu ${index + 1}/6'));
      await scrollAndTap(find.byKey(const ValueKey('learning-option-A')));
      await tap(find.byKey(const Key('learningPrimaryAction')));
      await waitFor(find.text('Tiếp theo'));
      await tap(find.byKey(const Key('learningPrimaryAction')));
    }
    await waitFor(find.text('Câu 6/6'));
    await scrollAndTap(find.byKey(const ValueKey('learning-option-C')));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Nộp bài'));
    await reveal(find.text('Chính xác!'));

    final b2Q6Btn = find.byKey(
      const ValueKey('learning-ai-explain-pocket-tfng-maintenance'),
    );
    await scrollAndTap(b2Q6Btn);
    await waitFor(find.text('Giải thích AI'), maxTicks: 150);
    await Scrollable.ensureVisible(
      find.text('Giải thích AI').evaluate().first,
      alignment: 0.4,
    );
    await tester.pumpAndSettle();
    await screenshot('learning-16-b2-not-given-ai');
    await tap(find.byTooltip('Thoát'));
    await waitFor(find.text('Hủy bài & thoát'));
    await tap(find.text('Hủy bài & thoát'));

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    account.dispose();
    api.dio.close();
  });
}

class _MemoryTokens implements TokenStore {
  @override
  Future<void> clear() async {}
  @override
  Future<String?> read() async => null;
  @override
  Future<void> write(String token) async {}
}
