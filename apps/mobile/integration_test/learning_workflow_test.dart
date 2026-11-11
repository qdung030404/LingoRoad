import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/learning/learning_preview.dart';

// Uses an emulator REST token only. It never initializes/signs out the Firebase
// SDK, so the developer's cloud account on the device remains untouched.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('real learning: resume, submit, history, retake and audio', (
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
    Json lesson(String kind) =>
        lessons.firstWhere((row) => row['kind'] == kind);
    final reading = lesson('READING');

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

    Future<void> waitFor(Finder finder, {bool settle = true}) async {
      for (var i = 0; i < 120 && finder.evaluate().isEmpty; i++) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 100)),
        );
        await tester.pump();
      }
      expect(finder, findsWidgets);
      if (settle) await tester.pumpAndSettle();
    }

    Future<void> tap(Finder finder) async {
      await waitFor(finder);
      await tester.ensureVisible(finder.first);
      await tester.pumpAndSettle();
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
    await tap(find.byKey(ValueKey('learning-lesson-${reading['id']}')));
    await tap(find.byKey(const Key('learningStart')));
    await waitFor(find.text('Câu 1/5'));
    await tap(find.byKey(const ValueKey('learning-option-B')));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Chưa chính xác'));
    await screenshot('learning-01-reading-feedback');
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Câu 2/5'));
    await tap(find.byKey(const ValueKey('learning-option-A')));
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 800)),
    );
    await tester.pumpAndSettle();
    await tap(find.byTooltip('Lưu và thoát'));

    // Recreate the whole learning shell and its controllers. Saved position and
    // checked answers must come from HTTP/PostgreSQL, not the old widget tree.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    await mount();
    await tap(find.byKey(const Key('learningContinue')));
    await waitFor(find.text('Câu 2/5'));
    final resumedOption = find.byKey(const ValueKey('learning-option-A'));
    expect(
      find.descendant(
        of: resumedOption,
        matching: find.byIcon(Icons.radio_button_checked),
      ),
      findsOneWidget,
    );
    await screenshot('learning-02-resumed-draft');
    for (var index = 1; index < 5; index++) {
      if (index > 1) {
        await tap(find.byKey(const ValueKey('learning-option-A')));
      }
      await tap(find.byKey(const Key('learningPrimaryAction')));
      await waitFor(find.text(index == 4 ? 'Nộp bài' : 'Tiếp theo'));
      await tap(find.byKey(const Key('learningPrimaryAction')));
      if (index < 4) await waitFor(find.text('Câu ${index + 2}/5'));
    }
    await waitFor(find.text('Kết quả bài học'));
    expect(find.text('Đã hoàn thành'), findsOneWidget);
    await screenshot('learning-03-result');
    late String completedId;
    await tester.runAsync(() async {
      final history = await api.request('GET', '/learning/history');
      final item = (history['items'] as List).first as Map;
      completedId = item['id'] as String;
      expect(item['status'], 'COMPLETED');
      expect((item['result'] as Map)['correctCount'], 1);
    });
    await tap(find.byIcon(Icons.arrow_back));
    await tap(find.byKey(const Key('previewTab4')));
    await tap(find.byKey(const Key('learningHistory')));
    await tap(find.byKey(ValueKey('learning-history-$completedId')));
    await waitFor(find.text('Kết quả bài học'));
    await tap(find.text('Làm lại'));
    await waitFor(find.text('Câu 1/5'));
    await tester.runAsync(() async {
      final history = await api.request('GET', '/learning/history');
      final items = (history['items'] as List).cast<Map>();
      expect(items.length, 2);
      expect(items.first['id'], isNot(completedId));
      expect(items.first['status'], 'IN_PROGRESS');
      expect(items.last['status'], 'COMPLETED');
    });
    await tap(find.byTooltip('Lưu và thoát'));
    await tap(find.byTooltip('Quay lại'));
    await tap(find.byKey(const Key('previewTab0')));

    // Listening uses real URL media and Android's native audio player.
    final listening = lesson('LISTENING');
    await tap(find.byKey(ValueKey('learning-lesson-${listening['id']}')));
    await tap(find.byKey(const Key('learningStart')));
    await waitFor(find.text('Câu 1/5'));
    await tester.ensureVisible(find.byTooltip('Phát audio'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Phát audio'));
    await tester.pump();
    await waitFor(find.byTooltip('Tạm dừng'), settle: false);
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 1200)),
    );
    await tester.pump();
    await tester.tap(find.byTooltip('Tạm dừng'));
    await tester.pumpAndSettle();
    final slider = tester.widget<Slider>(find.byType(Slider));
    expect(slider.max, greaterThan(1000));
    expect(slider.value, greaterThan(0));
    await tester.drag(find.byType(Slider), const Offset(60, 0));
    await tester.pumpAndSettle();
    expect(find.textContaining('Không tải được audio'), findsNothing);
    await screenshot('learning-04-listening');
    await tap(find.byTooltip('Lưu và thoát'));

    // Vocabulary must restore the exact word step, not reset to the first word.
    final vocabulary = lesson('VOCABULARY');
    await tap(find.byKey(ValueKey('learning-lesson-${vocabulary['id']}')));
    await tap(find.byKey(const Key('learningStart')));
    await waitFor(find.text('Học 1/10'));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Học 2/10'));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Học 3/10'));
    await tap(find.byTooltip('Lưu và thoát'));
    await tap(find.byKey(ValueKey('learning-lesson-${vocabulary['id']}')));
    await waitFor(find.text('Học 3/10'));
    expect(find.text('sister'), findsWidgets);
    await screenshot('learning-05-vocabulary-resume');
    await tap(find.byTooltip('Lưu và thoát'));
    await tester.pumpWidget(const SizedBox.shrink());
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
