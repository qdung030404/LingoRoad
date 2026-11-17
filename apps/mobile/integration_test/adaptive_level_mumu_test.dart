import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/learning/learning_preview.dart';

// Đợt F1 acceptance on MuMu: starts with a clean A2-eligible account against real Flutter -> NestJS -> PostgreSQL,
// completes both A2 reading lessons (club-meeting v4 & weekend-market), verifies the B1 upgrade banner,
// daily plan replanning to reading-b1-hybrid-workday, and ProgressRecommendedLevelCard.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'adaptive reading A2->B1 promotes on 2nd A2 completion, updates daily plan and progress card',
    (tester) async {
      const emulator = String.fromEnvironment('LEARNING_TEST_EMULATOR');
      const email = String.fromEnvironment('F1_TEST_EMAIL');
      const password = String.fromEnvironment('F1_TEST_PASSWORD');
      const capture = bool.fromEnvironment('CAPTURE_EVIDENCE');
      expect(emulator, isNotEmpty, reason: 'Requires a local Auth Emulator.');
      expect(email, isNotEmpty, reason: 'Requires seeded test account email.');
      expect(password, isNotEmpty, reason: 'Requires test account password.');

      final api = ApiClient(config: AppConfig(), store: _MemoryTokens());
      late SessionController account;
      late List<Json> lessons;
      await tester.runAsync(() async {
        final identity = await Dio().post<Map<String, dynamic>>(
          'http://$emulator/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-key',
          data: {
            'email': email,
            'password': password,
            'returnSecureToken': true,
          },
        );
        api.accessToken = identity.data!['idToken'] as String;
        final user = await api.request('GET', '/auth/me');
        final placement = await api.request('GET', '/placement/status');
        final placementResult = await api.request(
          'GET',
          '/placement/${placement['currentSessionId']}/result',
        );
        account = SessionController(api)
          ..user = user
          ..placement = placement
          ..placementResult = placementResult
          ..stage = SessionStage.ready;
        lessons = (await api.request(
          'GET',
          '/learning/lessons',
        ))['items'].cast<Map<String, dynamic>>();
      });

      String lessonId(String code) =>
          lessons.firstWhere((row) => row['code'] == code)['id'] as String;
      final clubId = lessonId('reading-a2-club-meeting');
      final marketId = lessonId('reading-a2-weekend-market');
      final b1Id = lessonId('reading-b1-hybrid-workday');

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

      Finder verticalScrollable() => find.byWidgetPredicate(
        (widget) =>
            widget is Scrollable && widget.axisDirection == AxisDirection.down,
      );

      Future<void> reveal(Finder finder, {double alignment = 0.35}) async {
        if (finder.evaluate().isEmpty) {
          await tester.scrollUntilVisible(
            finder,
            220,
            scrollable: verticalScrollable().last,
          );
        }
        await Scrollable.ensureVisible(
          finder.evaluate().first,
          alignment: alignment,
        );
        await tester.pumpAndSettle();
      }

      Future<void> tap(Finder finder, {bool scroll = false}) async {
        if (scroll) {
          await reveal(finder);
        } else {
          await waitFor(finder);
          await tester.ensureVisible(finder.first);
          await tester.pumpAndSettle();
        }
        await tester.tap(finder.first);
        await tester.pumpAndSettle();
      }

      Future<void> screenshot(String name) async {
        if (!capture) return;
        await tester.pumpAndSettle();
        await binding.takeScreenshot(name);
      }

      Future<void> completeReadingLesson(
        String id,
        List<String> optionLetters,
      ) async {
        await tap(find.byKey(ValueKey('daily-plan-$id')), scroll: true);
        await tap(find.byKey(const Key('learningStart')));
        await waitFor(find.text('Câu 1/${optionLetters.length}'));
        for (var i = 0; i < optionLetters.length; i++) {
          await waitFor(find.text('Câu ${i + 1}/${optionLetters.length}'));
          await tap(
            find.byKey(ValueKey('learning-option-${optionLetters[i]}')),
            scroll: true,
          );
          await tap(find.byKey(const Key('learningPrimaryAction')));
          await waitFor(
            find.text(i == optionLetters.length - 1 ? 'Nộp bài' : 'Tiếp theo'),
          );
          await tap(find.byKey(const Key('learningPrimaryAction')));
        }
        await waitFor(find.text('Kết quả bài học'));
        expect(
          find.text('${optionLetters.length}/${optionLetters.length} câu đúng'),
          findsOneWidget,
        );
      }

      await tester.pumpWidget(
        MaterialApp(
          key: UniqueKey(),
          theme: AppTheme.lightTheme,
          home: LearningPreview(account: account),
        ),
      );
      await tester.pumpAndSettle();
      if (capture) {
        await binding.convertFlutterSurfaceToImage();
        await tester.pumpAndSettle();
      }
      await waitFor(find.byKey(const Key('dailyTaskProgress')));

      // 1. Complete 1st A2 Reading lesson (reading-a2-club-meeting v4) -> still A2, no banner yet.
      await completeReadingLesson(clubId, const ['B', 'D', 'A', 'C', 'B']);
      expect(find.byKey(const Key('learningLevelChangeBanner')), findsNothing);
      await tap(find.byIcon(Icons.arrow_back));
      await waitFor(find.byKey(const Key('dailyTaskProgress')));
      await waitFor(find.textContaining('1/4 bài kế hoạch hoàn thành'));

      // 2. Complete 2nd A2 Reading lesson (reading-a2-weekend-market) -> triggers A2 -> B1 banner.
      await completeReadingLesson(marketId, const ['B', 'B', 'C', 'C', 'B']);
      await waitFor(find.byKey(const Key('learningLevelChangeBanner')));
      expect(find.text('Mức luyện tập đề xuất: Đọc B1 ↑'), findsOneWidget);
      expect(
        find.text(
          '2 bài Đọc khác nhau đạt từ 80%. Kế hoạch tiếp theo sẽ ưu tiên mức B1.',
        ),
        findsOneWidget,
      );
      await Scrollable.ensureVisible(
        find.byKey(const Key('learningLevelChangeBanner')).evaluate().first,
        alignment: 0.1,
      );
      await screenshot('f1-01-mumu-banner-b1');

      // 3. Return to Home -> daily plan refreshes and suggests reading-b1-hybrid-workday.
      await tap(find.byIcon(Icons.arrow_back));
      final b1PlanItem = find.byKey(ValueKey('daily-plan-$b1Id'));
      await waitFor(b1PlanItem);
      await reveal(b1PlanItem, alignment: 0.65);
      expect(
        find.descendant(
          of: b1PlanItem,
          matching: find.text('Lịch làm việc kết hợp của nhóm thiết kế'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: b1PlanItem,
          matching: find.textContaining('Bài mới · đúng mức B1'),
        ),
        findsOneWidget,
      );
      await screenshot('f1-02-mumu-plan-b1');

      // 4. Switch to Tiến độ tab -> verify ProgressRecommendedLevelCard renders B1 ↑.
      await tap(find.byKey(const Key('previewTab4')));
      final recommendedCard = find.byKey(const Key('progressRecommendedLevel'));
      await waitFor(recommendedCard);
      await reveal(recommendedCard, alignment: 0.45);
      expect(
        find.descendant(
          of: recommendedCard,
          matching: find.text('Mức luyện tập đề xuất'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: recommendedCard,
          matching: find.text('Tự điều chỉnh từ kết quả học'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(of: recommendedCard, matching: find.text('B1 ↑')),
        findsOneWidget,
      );
      await screenshot('f1-03-mumu-progress-card');

      await tester.runAsync(() async {
        final progress = await api.request('GET', '/learning/progress');
        final readingLevel = progress['recommendedLevels']['reading'] as Map;
        expect(readingLevel['cefrLevel'], 'B1');
        expect(readingLevel['source'], 'ADAPTIVE');
        expect(readingLevel['previousCefr'], 'A2');
      });

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      account.dispose();
      api.dio.close();
    },
  );
}

class _MemoryTokens implements TokenStore {
  @override
  Future<void> clear() async {}
  @override
  Future<String?> read() async => null;
  @override
  Future<void> write(String token) async {}
}
