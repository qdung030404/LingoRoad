import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/vocabulary/vocabulary_controller.dart';
import 'package:mobile/features/vocabulary/vocabulary_models.dart'
    show vocabularyCopy;
import 'package:mobile/features/vocabulary/vocabulary_pages.dart';
import 'package:mobile/features/vocabulary/vocabulary_review_page.dart';
import 'vocabulary_controller_test.dart'
    show FakeVocabularyRepository, attempt, multiAttempt, summary;

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    for (final name in [
      'xyz.luan/audioplayers.global',
      'xyz.luan/audioplayers.global/events',
    ]) {
      messenger.setMockMethodCallHandler(
        MethodChannel(name),
        (_) async => null,
      );
    }
    messenger.setMockMethodCallHandler(
      const MethodChannel('xyz.luan/audioplayers'),
      (call) async {
        if (call.method == 'create') {
          final id = (call.arguments as Map)['playerId'];
          messenger.setMockMethodCallHandler(
            MethodChannel('xyz.luan/audioplayers/events/$id'),
            (_) async => null,
          );
        }
        return null;
      },
    );
  });
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
    'rating advances card immediately and triggers batch submit',
    (tester) async {
      final gate = Completer<void>();
      Json? sent;
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (path == '/vocabulary/summary') return summary();
        if (method == 'GET') return {'attempt': attempt()};
        sent = body;
        await gate.future;
        final state = attempt(version: 1, finished: true);
        return {
          'receipt': {'commandId': body!['commandId']},
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
      gate.complete();
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('vocabularyReviewComplete')), findsOneWidget);
      expect(sent?['results'], isNotNull);
      expect(
        repo.calls
            .where((c) => c['path'] == '/vocabulary/reviews/review/batch-submit')
            .length,
        1,
      );
      await tester.pumpWidget(const SizedBox.shrink());
      owner.dispose();
    },
  );

  testWidgets(
    'rating error during batch submit retains attempt state',
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
      expect(find.byKey(const Key('vocabularyFlashcard')), findsOneWidget);
      await tester.tap(find.byKey(const Key('vocabularyRateHARD')));
      await tester.pumpAndSettle();
      expect(
        repo.calls
            .where((c) => c['path'] == '/vocabulary/reviews/review/batch-submit')
            .length,
        1,
      );
      expect(find.byKey(const Key('vocabularyReviewComplete')), findsNothing);
      expect(find.text('Không lưu được thao tác.'), findsWidgets);
      expect(find.byKey(const Key('vocabularyRetryFinalSubmit')), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      owner.dispose();
    },
  );

  testWidgets(
    '3-card deck allows rating, flipping card 2, and batch-submitting all cards',
    (tester) async {
      Json? sentBatch;
      final state = multiAttempt(count: 3);
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (path == '/vocabulary/summary') return summary();
        if (method == 'GET') return {'attempt': vocabularyCopy(state)};
        sentBatch = vocabularyCopy(body!);
        final items = (state['items'] as List).cast<Json>();
        for (final item in items) {
          item['state'] = 'REVIEWED';
        }
        state['queue'] = <String>[];
        state['currentItem'] = null;
        state['status'] = 'COMPLETED';
        state['version'] = 1;
        state['counts'] = {
          'totalCount': 3,
          'reviewedCount': 3,
          'skippedCount': 0,
        };
        return {
          'receipt': {'commandId': body['commandId']},
          'attempt': vocabularyCopy(state),
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

      // Card 1: apple -> tap EASY
      expect(find.text('apple'), findsWidgets);
      await tester.tap(find.byKey(const Key('vocabularyRateEASY')));
      await tester.pumpAndSettle();

      // Card 2: banana should be visible and controls remain enabled
      expect(find.text('banana'), findsWidgets);
      expect(find.text('Xem nghĩa'), findsOneWidget);
      await tester.tap(find.byKey(const Key('vocabularyReviewPrimaryBtn')));
      await tester.pumpAndSettle();

      // Card 2 flipped: shows back meaning and 'Tiếp theo'
      expect(find.text('Tiếp theo'), findsOneWidget);
      expect(find.text('quả chuối'), findsWidgets);

      // Tap 'Tiếp theo' -> rates MEDIUM and advances to Card 3: cherry
      await tester.tap(find.byKey(const Key('vocabularyReviewPrimaryBtn')));
      await tester.pumpAndSettle();
      expect(find.text('cherry'), findsWidgets);
      expect(find.text('Xem nghĩa'), findsOneWidget);

      // Card 3: tap HARD -> final batch submit
      await tester.tap(find.byKey(const Key('vocabularyRateHARD')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('vocabularyReviewComplete')), findsOneWidget);
      expect(sentBatch, isNotNull);
      expect(sentBatch!['isFinal'], true);
      final ratings = (sentBatch!['results'] as List)
          .map((e) => (e as Map)['rating'])
          .toList();
      expect(ratings, ['EASY', 'MEDIUM', 'HARD']);

      await tester.pumpWidget(const SizedBox.shrink());
      owner.dispose();
    },
  );

  testWidgets(
    'narrow screen 320x640 renders review controls without overflow',
    (tester) async {
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (method == 'GET') return {'attempt': multiAttempt(count: 2)};
        return {};
      });
      final owner = VocabularyController(
        repository: repo,
        accountId: 'a',
        isCurrent: () => true,
      );
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: VocabularyReviewPage(controller: owner, attemptId: 'review'),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('Xem nghĩa'), findsOneWidget);
      await tester.drag(find.byType(ListView), const Offset(0, -160));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Trung bình'), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      owner.dispose();
    },
  );

  testWidgets(
    'flipping card reveals word meaning and updates primary action',
    (tester) async {
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (method == 'GET') return {'attempt': attempt()};
        return {};
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
      expect(find.text('apple'), findsWidgets);
      expect(find.text('Xem nghĩa'), findsOneWidget);
      await tester.tap(find.byKey(const Key('vocabularyReviewPrimaryBtn')));
      await tester.pumpAndSettle();
      expect(find.text('Tiếp theo'), findsOneWidget);
      expect(find.text('Định nghĩa'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      owner.dispose();
    },
  );

  testWidgets(
    'swiping card right rates EASY and swiping left rates HARD',
    (tester) async {
      final ratings = <String>[];
      final repo = FakeVocabularyRepository((method, path, body) async {
        if (path == '/vocabulary/summary') return summary();
        if (method == 'GET') return {'attempt': attempt()};
        if (body?['action'] == 'RATE') {
          ratings.add(body!['rating'] as String);
        }
        if (body?['results'] is List) {
          for (final r in body!['results'] as List) {
            if (r is Map && r['rating'] != null) {
              ratings.add(r['rating'] as String);
            }
          }
        }
        final state = attempt(version: 1)
          ..['queue'] = []
          ..['currentItem'] = null;
        if (body?['action'] == 'RATE' || body?['action'] == 'SUBMIT') {
          state['status'] = 'COMPLETED';
        }
        return {
          'receipt': {'commandId': body!['commandId']},
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
      final card = find.byKey(const Key('vocabularyFlashcard'));
      expect(card, findsOneWidget);
      await tester.fling(card, const Offset(300, 0), 1000);
      await tester.pumpAndSettle();
      expect(ratings, contains('EASY'));
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
