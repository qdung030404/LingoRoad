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
          debugShowCheckedModeBanner: false,
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
    await tap(find.byTooltip('Thoát'));
    await waitFor(find.text('Hủy bài & thoát'));
    await tap(find.text('Hủy bài & thoát'));
    await waitFor(find.byKey(ValueKey('learning-lesson-${reading['id']}')));

    // Recreate the whole learning shell and its controllers. Cancelling mid-way
    // must discard the incomplete attempt so reopening starts from Câu 1/5.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpAndSettle();
    await mount();
    await tap(find.byKey(ValueKey('learning-lesson-${reading['id']}')));
    await tap(find.byKey(const Key('learningStart')));
    await waitFor(find.text('Câu 1/5'));
    final restartedOption = find.byKey(const ValueKey('learning-option-A'));
    expect(tester.widget<AnswerOption>(restartedOption).selected, isFalse);
    await tap(restartedOption);
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Tiếp theo'));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Câu 2/5'));
    for (var index = 1; index < 5; index++) {
      await tap(find.byKey(const ValueKey('learning-option-A')));
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
      expect((item['result'] as Map)['correctCount'], 2);
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
      expect(items.length, 1);
      expect(items.first['id'], completedId);
      expect(items.first['status'], 'COMPLETED');
    });
    await tap(find.byTooltip('Thoát'));
    await waitFor(find.text('Hủy bài & thoát'));
    await tap(find.text('Hủy bài & thoát'));
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
    await tap(find.byTooltip('Thoát'));
    await waitFor(find.text('Hủy bài & thoát'));
    await tap(find.text('Hủy bài & thoát'));

    // Vocabulary must also cancel cleanly and restart from Học 1/10 on next entry.
    final vocabulary = lesson('VOCABULARY');
    await tap(find.byKey(ValueKey('learning-lesson-${vocabulary['id']}')));
    await tap(find.byKey(const Key('learningStart')));
    await waitFor(find.text('Học 1/10'));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Học 2/10'));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Học 3/10'));
    await tap(find.byTooltip('Thoát'));
    await waitFor(find.text('Hủy bài & thoát'));
    await tap(find.text('Hủy bài & thoát'));
    await tap(find.byKey(ValueKey('learning-lesson-${vocabulary['id']}')));
    await tap(find.byKey(const Key('learningStart')));
    await waitFor(find.text('Học 1/10'));
    await tap(find.byTooltip('Thoát'));
    await waitFor(find.text('Hủy bài & thoát'));
    await tap(find.text('Hủy bài & thoát'));

    // New A2 v2 reading attempt: inspect start evidence on Q1 card, end evidence in Q5 BottomSheet, and history review.
    final readingA2 = lessons.firstWhere(
      (row) => row['code'] == 'reading-a2-club-meeting',
    );
    const a2StartEvidence = 'Subject: A new time for our book club meeting';
    const a2EndEvidence =
        'If you can’t come on Thursday, please email me by Wednesday evening.';
    await tap(find.byKey(ValueKey('learning-lesson-${readingA2['id']}')));
    await tap(find.byKey(const Key('learningStart')));
    await waitFor(find.text('Câu 1/5'));
    await tap(find.byKey(const ValueKey('learning-option-B')));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Chính xác!'));
    await waitFor(find.text('Dẫn chứng trong bài'));
    await waitFor(find.text('"$a2StartEvidence"'));
    final q1CardHighlight = tester
        .widgetList<Text>(find.byType(Text))
        .map((widget) => widget.textSpan)
        .whereType<TextSpan>()
        .expand((root) => root.children ?? const <InlineSpan>[])
        .whereType<TextSpan>()
        .where(
          (span) =>
              span.text == a2StartEvidence &&
              span.style?.backgroundColor == const Color(0xFFFFF3C4),
        );
    expect(q1CardHighlight, hasLength(1));
    await screenshot('learning-06-a2-q1-evidence');

    await tap(find.byKey(const Key('learningPrimaryAction')));
    for (var index = 1; index < 4; index++) {
      await waitFor(find.text('Câu ${index + 1}/5'));
      await tap(find.byKey(const ValueKey('learning-option-A')));
      await tap(find.byKey(const Key('learningPrimaryAction')));
      await waitFor(find.text('Tiếp theo'));
      await tap(find.byKey(const Key('learningPrimaryAction')));
    }
    await waitFor(find.text('Câu 5/5'));
    await tap(find.byKey(const ValueKey('learning-option-B')));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Dẫn chứng trong bài'));
    await waitFor(find.text('"$a2EndEvidence"'));
    await tester.ensureVisible(find.text('Xem toàn bộ'));
    await tester.pumpAndSettle();
    await tap(find.text('Xem toàn bộ'));
    await waitFor(find.byType(BottomSheet));
    await tester.drag(
      find.descendant(
        of: find.byType(BottomSheet),
        matching: find.byType(SingleChildScrollView),
      ),
      const Offset(0, -300),
    );
    await tester.pumpAndSettle();
    final q5SheetHighlight = tester
        .widgetList<Text>(
          find.descendant(
            of: find.byType(BottomSheet),
            matching: find.byType(Text),
          ),
        )
        .map((widget) => widget.textSpan)
        .whereType<TextSpan>()
        .expand((root) => root.children ?? const <InlineSpan>[])
        .whereType<TextSpan>()
        .where(
          (span) =>
              span.text == a2EndEvidence &&
              span.style?.backgroundColor == const Color(0xFFFFF3C4),
        );
    expect(q5SheetHighlight, hasLength(1));
    await screenshot('learning-07-a2-q5-bottom-sheet');
    Navigator.of(tester.element(find.byType(BottomSheet))).pop();
    await tester.pumpAndSettle();

    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Kết quả bài học'));
    late String a2CompletedId;
    await tester.runAsync(() async {
      final history = await api.request('GET', '/learning/history');
      final item = (history['items'] as List).cast<Map>().firstWhere(
        (row) => (row['lesson'] as Map)['code'] == 'reading-a2-club-meeting',
      );
      a2CompletedId = item['id'] as String;
      expect(item['status'], 'COMPLETED');
    });
    await tap(find.byIcon(Icons.arrow_back));
    await tap(find.byKey(const Key('previewTab4')));
    await tap(find.byKey(const Key('learningHistory')));
    await tap(find.byKey(ValueKey('learning-history-$a2CompletedId')));
    await waitFor(find.text('Kết quả bài học'));
    expect(find.text('Làm lại'), findsOneWidget);
    expect(find.text('Về danh sách'), findsOneWidget);
    await tap(find.text('Xem lại đáp án'));
    await waitFor(find.text('Xem lại câu 1/5'));
    await tap(find.textContaining('Câu sai ('));
    expect(find.text('Bạn chọn'), findsOneWidget);
    await screenshot('learning-08-a2-history-review');
    await tap(find.text('Tất cả'));
    for (
      var i = 0;
      i < 5 && find.text('Xem lại câu 5/5').evaluate().isEmpty;
      i++
    ) {
      await tap(find.text('Câu tiếp theo'));
    }
    expect(find.text(a2EndEvidence), findsOneWidget);
    await tap(find.text('Về kết quả'));
    await tap(find.byIcon(Icons.arrow_back));
    await tap(find.byTooltip('Quay lại'));

    // B1: save a word in the intro, then resume STUDY and verify GAP_FILL.
    await tap(find.byKey(const Key('previewTab0')));
    final readingB1 = lessons.firstWhere(
      (row) => row['code'] == 'reading-b1-hybrid-workday',
    );
    await tap(find.byKey(ValueKey('learning-lesson-${readingB1['id']}')));
    await waitFor(find.text('Từ vựng trọng tâm'));
    final saveB1Word = find.byKey(const ValueKey('reading-save-word-b1-kv-1'));
    await tester.scrollUntilVisible(
      saveB1Word,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tap(saveB1Word);
    await waitFor(find.text('Đã lưu'));
    await screenshot('learning-11-b1-saved-word');
    await tap(find.byTooltip('Quay lại'));

    await tap(find.byKey(ValueKey('learning-lesson-${readingB1['id']}')));
    await waitFor(find.text('Từ vựng trọng tâm'));
    await tester.scrollUntilVisible(
      saveB1Word,
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await waitFor(find.text('Đã lưu'));
    await screenshot('learning-12-b1-reopened-word');
    await tap(find.byKey(const Key('learningStart')));
    await waitFor(find.text('Học 1/3'));
    expect(find.text('hybrid arrangement'), findsWidgets);
    await screenshot('learning-09-b1-study');
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Học 2/3'));
    await tap(find.byTooltip('Thoát'));
    await waitFor(find.text('Hủy bài & thoát'));
    await tap(find.text('Hủy bài & thoát'));

    // Reopen B1 after cancel: must start fresh from STUDY step 1/3, then reach QUIZ.
    await tap(find.byKey(ValueKey('learning-lesson-${readingB1['id']}')));
    await tap(find.byKey(const Key('learningStart')));
    await waitFor(find.text('Học 1/3'));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Học 2/3'));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Học 3/3'));
    expect(find.text('Bắt đầu luyện tập'), findsOneWidget);
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Câu 1/6'));

    for (var index = 0; index < 5; index++) {
      await tap(find.byKey(const ValueKey('learning-option-A')));
      await tap(find.byKey(const Key('learningPrimaryAction')));
      await waitFor(find.text('Tiếp theo'));
      await tap(find.byKey(const Key('learningPrimaryAction')));
    }
    await waitFor(find.text('Câu 6/6'));
    expect(find.text('Điền khuyết'), findsNothing);
    await tap(find.byKey(const ValueKey('learning-option-A')));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Chính xác!'));
    await screenshot('learning-10-b1-gapfill');

    await tester.ensureVisible(find.text('Xem toàn bộ'));
    await tester.pumpAndSettle();
    await tap(find.text('Xem toàn bộ'));
    await waitFor(find.byType(BottomSheet));
    expect(find.text('Từ vựng trọng tâm'), findsNothing);
    expect(saveB1Word, findsNothing);
    Navigator.of(tester.element(find.byType(BottomSheet))).pop();
    await tester.pumpAndSettle();
    await tap(find.byTooltip('Thoát'));
    await waitFor(find.text('Hủy bài & thoát'));
    await tap(find.text('Hủy bài & thoát'));

    // Đợt 2: B2 Pre-reading STUDY -> Q6 TRUE_FALSE_NOT_GIVEN ('Not Given') checks with explanation & no evidence.
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
      await tap(find.byKey(const ValueKey('learning-option-A')));
      await tap(find.byKey(const Key('learningPrimaryAction')));
      await waitFor(find.text('Tiếp theo'));
      await tap(find.byKey(const Key('learningPrimaryAction')));
    }
    await waitFor(find.text('Câu 6/6'));
    expect(find.text('Đúng / Sai / Không đề cập'), findsNothing);
    await tester.scrollUntilVisible(
      find.byKey(const ValueKey('learning-option-C')),
      200,
      scrollable: find.byWidgetPredicate(
        (widget) =>
            widget is Scrollable && widget.axisDirection == AxisDirection.down,
      ),
    );
    await tap(find.byKey(const ValueKey('learning-option-C')));
    await tap(find.byKey(const Key('learningPrimaryAction')));
    await waitFor(find.text('Chính xác!'));
    expect(find.text('Dẫn chứng trong bài'), findsNothing);
    await tester.drag(find.byType(ListView), const Offset(0, -250));
    await tester.pumpAndSettle();
    await screenshot('learning-13-b2-q6-not-given');
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
