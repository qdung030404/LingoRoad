import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/learning/learning_preview.dart';

// REST Emulator identities only; never initializes/logs out Firebase cloud SDK.
// Host must forward API and Auth Emulator ports to device loopback.
void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('personal vocabulary CRUD, review resume and isolated statistics', (
    tester,
  ) async {
    const emulator = String.fromEnvironment('LEARNING_TEST_EMULATOR');
    expect(
      RegExp(r'^(127\.0\.0\.1|localhost):\d+$').hasMatch(emulator),
      isTrue,
      reason: 'Requires a forwarded local Firebase Auth Emulator.',
    );
    const capture = bool.fromEnvironment('CAPTURE_EVIDENCE');
    final stamp = DateTime.now().millisecondsSinceEpoch;
    final apis = <ApiClient>[];
    final accounts = <SessionController>[];
    late SessionController owner, other;

    Future<SessionController> identity(String suffix) async {
      final api = ApiClient(config: AppConfig(), store: _MemoryTokens());
      apis.add(api);
      final response = await Dio().post<Map<String, dynamic>>(
        'http://$emulator/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',
        data: {
          'email': 'vocabulary-mumu-$stamp-$suffix@example.com',
          'password': 'VocabularyDevice123!',
          'returnSecureToken': true,
        },
      );
      api.accessToken = response.data!['idToken'] as String;
      final account = SessionController(api)
        ..user = await api.request('GET', '/auth/me')
        ..stage = SessionStage.ready;
      accounts.add(account);
      return account;
    }

    Future<void> elapse(Duration duration) async {
      final end = DateTime.now().add(duration);
      while (DateTime.now().isBefore(end)) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 100)),
        );
        await tester.pump();
      }
    }

    Future<void> waitFor(Finder finder) async {
      for (var i = 0; i < 180 && finder.evaluate().isEmpty; i++) {
        await elapse(const Duration(milliseconds: 100));
      }
      expect(finder, findsWidgets);
      await tester.pumpAndSettle();
    }

    Future<void> gone(Finder finder) async {
      for (var i = 0; i < 180 && finder.evaluate().isNotEmpty; i++) {
        await elapse(const Duration(milliseconds: 100));
      }
      expect(finder, findsNothing);
    }

    Future<void> tap(Finder finder) async {
      await waitFor(finder);
      await tester.ensureVisible(finder.first);
      await tester.pumpAndSettle();
      await tester.tap(finder.first);
      await tester.pumpAndSettle();
    }

    Future<Json> requestApi(SessionController account, String path) async {
      late Json data;
      await tester.runAsync(() async {
        data = await account.api.request('GET', path);
      });
      return data;
    }

    Future<void> mount(SessionController account) async {
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      await tester.pumpWidget(
        MaterialApp(
          key: UniqueKey(),
          theme: AppTheme.lightTheme,
          home: LearningPreview(account: account),
        ),
      );
      await tester.pumpAndSettle();
      await tap(find.byKey(const Key('previewTab2')));
      await waitFor(find.byKey(const Key('vocabularyAddDeck')));
    }

    Future<void> screenshot(String name) async {
      if (!capture) return;
      await tester.pumpAndSettle();
      await binding.takeScreenshot(name);
    }

    try {
      await tester.runAsync(() async {
        owner = await identity('a');
        other = await identity('b');
        await owner.api.request('POST', '/learning/plan/today', data: {});
      });
      final before = await requestApi(owner, '/learning/progress');
      final initialPlan = await requestApi(owner, '/learning/plan/today');
      await mount(owner);
      if (capture) {
        await binding.convertFlutterSurfaceToImage();
        await tester.pumpAndSettle();
      }
      expect(
        (await requestApi(
          owner,
          '/vocabulary/summary',
        ))['totals']['totalWords'],
        0,
      );

      await tap(find.byKey(const Key('vocabularyAddDeck')));
      await tester.enterText(
        find.byKey(const Key('vocabularyDeckName')),
        'Bộ từ MuMu $stamp',
      );
      await tap(find.byKey(const Key('vocabularySaveDeck')));
      await gone(find.byKey(const Key('vocabularySaveDeck')));
      final decks = await requestApi(owner, '/vocabulary/decks');
      final deck = (decks['items'] as List).single as Map;
      final deckId = deck['id'] as String;
      await tap(find.byKey(ValueKey('vocabulary-deck-$deckId')));

      for (final entry in [
        ('apple', 'quả táo'),
        ('pear', 'quả lê'),
        ('orange', 'quả cam'),
      ]) {
        await tap(find.byKey(const Key('vocabularyAddWord')));
        await tester.enterText(
          find.byKey(const Key('vocabularyEnglish')),
          entry.$1,
        );
        await tester.enterText(
          find.byKey(const Key('vocabularyMeaning')),
          entry.$2,
        );
        await tap(find.byKey(const Key('vocabularySaveWord')));
        await gone(find.byKey(const Key('vocabularySaveWord')));
      }
      var totals = (await requestApi(owner, '/vocabulary/summary'))['totals'];
      expect(totals['totalWords'], 3);
      expect(totals['rememberedWords'], 0);
      await screenshot('vocabulary-01-library');

      await tap(find.byKey(const Key('vocabularyStartReview')));
      await waitFor(find.byKey(const Key('vocabularyFlashcard')));
      expect(find.text('apple'), findsWidgets);
      final detail = await requestApi(owner, '/vocabulary/decks/$deckId');
      final attemptId = (detail['deck'] as Map)['activeAttemptId'] as String;
      await tester.drag(
        find.byKey(const Key('vocabularyFlashcard')),
        const Offset(220, 0),
      );
      await tester.pumpAndSettle();
      await waitFor(find.text('pear'));
      var attempt = (await requestApi(
        owner,
        '/vocabulary/reviews/$attemptId',
      ))['attempt'];
      expect((attempt['queue'] as List).length, 3);
      expect((attempt['queue'] as List).toSet().length, 3);
      await tester.tap(find.byKey(const Key('vocabularyRateEASY')));
      await tester.pump();
      await elapse(const Duration(milliseconds: 600));
      expect(find.text('pear'), findsWidgets);
      await elapse(const Duration(milliseconds: 1200));
      await waitFor(find.text('orange'));
      totals = (await requestApi(owner, '/vocabulary/summary'))['totals'];
      expect(totals['rememberedWords'], 1);
      await tester.drag(
        find.byKey(const Key('vocabularyFlashcard')),
        const Offset(-220, 0),
      );
      await tester.pumpAndSettle();
      await waitFor(find.text('apple'));
      await tap(find.byKey(const Key('vocabularyFlashcard')));
      await tap(find.byKey(const Key('vocabularyNext')));
      await waitFor(find.byKey(const Key('vocabularyRecallAnswer')));
      await tester.enterText(
        find.byKey(const Key('vocabularyRecallAnswer')),
        'wrong spelling',
      );
      await tap(find.byKey(const Key('vocabularyNext')));
      await waitFor(find.textContaining('Chưa đúng'));
      await screenshot('vocabulary-02-checked-answer');

      // Fresh widget/controller tree must read the persisted checked answer.
      await mount(owner);
      await tap(find.byKey(ValueKey('vocabulary-deck-$deckId')));
      await tap(find.byKey(const Key('vocabularyStartReview')));
      await waitFor(find.textContaining('Chưa đúng'));
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('vocabularyRecallAnswer')))
            .controller!
            .text,
        'wrong spelling',
      );
      await tap(find.byKey(const Key('vocabularyNext')));
      await waitFor(find.byKey(const Key('vocabularyReviewComplete')));
      await screenshot('vocabulary-03-completed');

      attempt = (await requestApi(
        owner,
        '/vocabulary/reviews/$attemptId',
      ))['attempt'];
      expect(attempt['status'], 'COMPLETED');
      expect(attempt['counts']['reviewedCount'], 2);
      expect(attempt['counts']['skippedCount'], 1);
      expect(attempt['counts']['correctCount'], 0);
      expect(attempt['counts']['checkedCount'], 1);
      totals = (await requestApi(owner, '/vocabulary/summary'))['totals'];
      expect(totals['rememberedWords'], 1);
      expect(totals['needsReviewWords'], 2);
      final history = await requestApi(owner, '/vocabulary/history');
      expect((history['items'] as List).single['id'], attemptId);

      await mount(owner);
      await tap(find.byKey(const Key('vocabularyHistory')));
      await screenshot('vocabulary-04-history');
      final after = await requestApi(owner, '/learning/progress');
      expect(after['totals'], before['totals']);
      expect(after['today']['activeSeconds'], before['today']['activeSeconds']);
      expect(after['today']['goalMet'], before['today']['goalMet']);
      expect(await requestApi(owner, '/learning/plan/today'), initialPlan);

      await mount(other);
      expect(find.byKey(ValueKey('vocabulary-deck-$deckId')), findsNothing);
      expect(find.text('apple'), findsNothing);
      expect(
        (await requestApi(
          other,
          '/vocabulary/summary',
        ))['totals']['totalWords'],
        0,
      );
      await mount(owner);
      await waitFor(find.byKey(ValueKey('vocabulary-deck-$deckId')));
      await screenshot('vocabulary-05-restored-account');
      binding.reportData = {
        ...?binding.reportData,
        'scenario': 'real-vocabulary-review',
        'reviewedCount': 2,
        'skippedCount': 1,
        'rememberedWords': 1,
        'needsReviewWords': 2,
        'dailyUnchanged': true,
        'accountIsolationVerified': true,
      };
    } finally {
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpAndSettle();
      for (final account in accounts) {
        account.dispose();
      }
      for (final api in apis) {
        api.dio.close();
      }
    }
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
