import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/vocabulary/vocabulary_controller.dart';
import 'package:mobile/features/vocabulary/vocabulary_pages.dart';
import 'package:mobile/features/vocabulary/vocabulary_review_page.dart';
import 'vocabulary_controller_test.dart'
    show FakeVocabularyRepository, attempt, summary;

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  Future<void> mount(WidgetTester tester, Widget widget) async {
    tester.view.physicalSize = const Size(430, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(theme: AppTheme.lightTheme, home: widget),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'rating highlights while ACK pending and only switches after confirmation',
    (tester) async {
      final gate = Completer<void>();
      Json? sent;
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (path == '/vocabulary/summary') return summary();
        if (method == 'GET') return {'attempt': attempt()};
        sent = body;
        await gate.future;
        final state = attempt(version: 1)
          ..['queue'] = []
          ..['currentItem'] = null;
        if (body!['action'] == 'SUBMIT') state['status'] = 'COMPLETED';
        return {
          'receipt': {'commandId': body['commandId']},
          'attempt': state,
        };
      });
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      await mount(
        tester,
        VocabularyReviewPage(controller: owner, attemptId: 'review'),
      );
      await tester.tap(find.byKey(const Key('vocabularyRateEASY')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 2));
      expect(find.text('apple'), findsOneWidget);
      expect(sent?['rating'], 'EASY');
      final button = tester.widget<OutlinedButton>(
        find.byKey(const Key('vocabularyRateEASY')),
      );
      expect(button.onPressed, isNull);
      gate.complete();
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('vocabularyReviewComplete')), findsOneWidget);
      expect(
        repo.calls
            .where((c) => (c['body'] as Map?)?['action'] == 'RATE')
            .length,
        1,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      owner.dispose();
    },
  );
  testWidgets(
    'swipe tilts with directional feedback and no local queue advancement on error',
    (tester) async {
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (method == 'GET') return {'attempt': attempt()};
        throw const ApiFailure('Không lưu được thao tác.');
      });
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      await mount(
        tester,
        VocabularyReviewPage(controller: owner, attemptId: 'review'),
      );
      final card = find.byKey(const Key('vocabularyFlashcard'));
      final gesture = await tester.startGesture(tester.getCenter(card));
      // Win the horizontal gesture arena before delivering a drag update.
      await gesture.moveBy(const Offset(-32, 0));
      await tester.pump();
      await gesture.moveBy(const Offset(-120, 0));
      await tester.pump();
      expect(find.byKey(const Key('vocabularySwipeFeedback')), findsOneWidget);
      expect(find.text('← Bỏ qua'), findsOneWidget);
      final transform = tester
          .widget<AnimatedContainer>(
            find.byKey(const Key('vocabularySwipeTransform')),
          )
          .transform!;
      expect(transform.entry(0, 1), isNot(0));
      await gesture.up();
      await tester.pumpAndSettle();
      expect(find.text('Không lưu được thao tác.'), findsOneWidget);
      expect(find.text('apple'), findsOneWidget);
      expect((repo.calls.last['body'] as Map)['action'], 'SKIP');
      await tester.pumpWidget(const SizedBox.shrink());
      owner.dispose();
    },
  );
  testWidgets(
    'new account library uses empty server state and failed create keeps typed name',
    (tester) async {
      var offline = true;
      final ids = <String>[];
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (path == '/vocabulary/summary') return summary();
        if (method == 'GET') return {'items': [], 'nextCursor': null};
        ids.add(body!['commandId'] as String);
        if (offline) throw const ApiFailure('Mạng chưa sẵn sàng.');
        return {
          'receipt': {'commandId': body['commandId']},
          'deck': {'id': 'deck', 'name': 'Cá nhân', 'version': 0},
        };
      });
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      await mount(tester, VocabularyWordsTab(controller: owner));
      expect(find.textContaining('Chưa có bộ từ phù hợp'), findsOneWidget);
      expect(find.text('Công việc'), findsNothing);
      await tester.tap(find.byKey(const Key('vocabularyAddDeck')));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const Key('vocabularyDeckName')),
        'Cá nhân',
      );
      await tester.tap(find.byKey(const Key('vocabularySaveDeck')));
      await tester.pumpAndSettle();
      expect(find.text('Mạng chưa sẵn sàng.'), findsWidgets);
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('vocabularyDeckName')))
            .controller!
            .text,
        'Cá nhân',
      );
      offline = false;
      await tester.tap(find.byKey(const Key('vocabularySaveDeck')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('vocabularyDeckName')), findsNothing);
      expect(ids.length, 2);
      expect(ids.first, ids.last);
      await tester.pumpWidget(const SizedBox.shrink());
      owner.dispose();
    },
  );
}
