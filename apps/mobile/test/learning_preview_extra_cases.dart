part of 'learning_preview_test.dart';

void _registerLearningPreviewExtraTests() {
  testWidgets(
    'quick ratings highlight for 1.5 seconds then animate and persist through last card',
    (tester) async {
      final library = WordLibrary()..decks.clear();
      const words = [
        PreviewWord('quick-0', 'one', 'một', '', ''),
        PreviewWord('quick-1', 'two', 'hai', '', ''),
        PreviewWord('quick-2', 'three', 'ba', '', ''),
      ];
      library.decks.add(const WordDeck('quick', 'Ôn nhanh', words));
      await show(tester, SrsReviewPage(library: library, deckId: 'quick'));
      await tester.tap(find.byKey(const Key('srs-remember')));
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.text('one'), findsOneWidget);
      final chosen = tester.widget<OutlinedButton>(
        find.byKey(const Key('srs-remember')),
      );
      expect(chosen.onPressed, isNull);
      expect(
        chosen.style!.backgroundColor!.resolve({WidgetState.disabled}),
        const Color(0xFF0A5D21),
      );
      await capture(tester, 'flashcard-rating-selected');
      await tester.pump(const Duration(milliseconds: 1300));
      expect(find.text('one'), findsOneWidget);
      expect(
        tester.widget<Opacity>(find.byKey(const Key('ratingCardFade'))).opacity,
        1,
      );
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 130));
      final fade = tester
          .widget<Opacity>(find.byKey(const Key('ratingCardFade')))
          .opacity;
      expect(fade, greaterThan(0));
      expect(fade, lessThan(1));
      await tester.pumpAndSettle();
      expect(find.text('two'), findsOneWidget);
      expect(library.ratings['quick-0'], 'remember');
      await tap(tester, find.byKey(const Key('srsFlashcard')));
      await tap(tester, find.byKey(const Key('srs-hard')));
      expect(find.text('three'), findsOneWidget);
      expect(find.byKey(const Key('wordRecallAnswer')), findsNothing);
      await tap(tester, find.byKey(const Key('srs-forgot')));
      expect(find.text('Bạn đã ôn hết từ'), findsOneWidget);
      final restored = WordLibrary();
      await tester.runAsync(restored.restore);
      expect(restored.ratings, {
        'quick-0': 'remember',
        'quick-1': 'hard',
        'quick-2': 'forgot',
      });
      library.dispose();
      restored.dispose();
    },
  );

  testWidgets(
    'horizontal swipes skip or requeue without rating, and short drags cancel',
    (tester) async {
      final library = WordLibrary()..decks.clear();
      library.decks.add(
        const WordDeck('swipe', 'Vuốt thẻ', [
          PreviewWord('swipe-0', 'one', 'một', '', ''),
          PreviewWord('swipe-1', 'two', 'hai', '', ''),
          PreviewWord('swipe-2', 'three', 'ba', '', ''),
        ]),
      );
      await show(tester, SrsReviewPage(library: library, deckId: 'swipe'));
      final card = find.byKey(const Key('srsFlashcard'));
      await capture(tester, 'flashcard-swipe');
      await tester.timedDrag(
        card,
        const Offset(45, 0),
        const Duration(milliseconds: 600),
      );
      await tester.pumpAndSettle();
      expect(find.text('one'), findsOneWidget);
      expect(find.text('Định nghĩa : một'), findsNothing);
      final gesture = await tester.startGesture(tester.getCenter(card));
      await gesture.moveBy(const Offset(-65, 0));
      await gesture.moveBy(const Offset(-20, 0));
      await tester.pump();
      expect(find.text('← Bỏ qua từ này'), findsOneWidget);
      final tilted = tester.widget<AnimatedContainer>(
        find.byKey(const Key('flashcardSwipeTransform')),
      );
      expect(tilted.transform!.storage[1], lessThan(0));
      expect(
        tester
            .widget<Text>(find.byKey(const Key('flashcardSwipeLabel')))
            .style!
            .color,
        const Color(0xFFDC2626),
      );
      await gesture.moveBy(const Offset(-60, 0));
      await tester.pump();
      await capture(tester, 'flashcard-swipe-red');
      await gesture.cancel();
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('flashcardSwipeFeedback')), findsNothing);
      final rightGesture = await tester.startGesture(tester.getCenter(card));
      await rightGesture.moveBy(const Offset(40, 0));
      await rightGesture.moveBy(const Offset(90, 0));
      await tester.pump();
      expect(
        tester
            .widget<Text>(find.byKey(const Key('flashcardSwipeLabel')))
            .style!
            .color,
        const Color(0xFF16A34A),
      );
      await capture(tester, 'flashcard-swipe-green');
      await rightGesture.cancel();
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<AnimatedContainer>(
              find.byKey(const Key('flashcardSwipeTransform')),
            )
            .transform!
            .storage[1],
        0,
      );
      expect(find.text('one'), findsOneWidget);
      await tester.timedDrag(
        card,
        const Offset(180, 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('two'), findsOneWidget);
      // Requeue also works from the meaning side and resets the next card.
      await tap(tester, card);
      await tester.timedDrag(
        card,
        const Offset(180, 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('three'), findsOneWidget);
      await tester.timedDrag(
        card,
        const Offset(-180, 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('one'), findsOneWidget);
      await tester.timedDrag(
        card,
        const Offset(-180, 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('two'), findsOneWidget);
      await tester.timedDrag(
        card,
        const Offset(-180, 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('Bạn đã ôn hết từ'), findsOneWidget);
      expect(library.ratings, isEmpty);
      expect(
        (await SharedPreferences.getInstance()).getString(
          WordLibrary.storageKey,
        ),
        isNull,
      );
      library.dispose();
    },
  );

  testWidgets(
    'one remaining card can be requeued, flipped and skipped with reduced motion',
    (tester) async {
      final library = WordLibrary()..decks.clear();
      library.decks.add(
        const WordDeck('single', 'Một từ', [
          PreviewWord('single-0', 'hello', 'xin chào', '', ''),
        ]),
      );
      await show(
        tester,
        SrsReviewPage(library: library, deckId: 'single'),
        size: const Size(320, 640),
        reduceMotion: true,
      );
      final card = find.byKey(const Key('srsFlashcard'));
      await tester.timedDrag(
        card,
        const Offset(170, 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('hello'), findsOneWidget);
      await tap(tester, card);
      expect(find.text('Định nghĩa : xin chào'), findsOneWidget);
      // A vertical scroll must not advance the queue.
      await tester.timedDrag(
        card,
        const Offset(0, -80),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('Định nghĩa : xin chào'), findsOneWidget);
      await tester.timedDrag(
        card,
        const Offset(-170, 0),
        const Duration(milliseconds: 400),
      );
      await tester.pumpAndSettle();
      expect(find.text('Bạn đã ôn hết từ'), findsOneWidget);
      expect(library.ratings, isEmpty);
      library.dispose();
    },
  );

  testWidgets(
    'pending or failed rating cannot move the queue and can be retried',
    (tester) async {
      final library = _ControlledWordLibrary()..decks.clear();
      library.decks.add(
        const WordDeck('pending', 'Lưu đánh giá', [
          PreviewWord('pending-0', 'one', 'một', '', ''),
          PreviewWord('pending-1', 'two', 'hai', '', ''),
        ]),
      );
      await show(tester, SrsReviewPage(library: library, deckId: 'pending'));
      library.pending = Completer<void>();
      library.fail = true;
      await tester.tap(find.byKey(const Key('srs-remember')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('srs-remember')));
      await tester.drag(
        find.byKey(const Key('srsFlashcard')),
        const Offset(-180, 0),
      );
      await tester.pumpAndSettle();
      expect(find.text('one'), findsOneWidget);
      expect(library.calls, 1);
      expect(
        tester
            .widget<FilledButton>(find.byKey(const Key('skipPracticeWord')))
            .onPressed,
        isNull,
      );
      library.pending!.complete();
      await tester.pumpAndSettle();
      expect(
        find.text('Không lưu được lượt ôn. Vui lòng thử lại.'),
        findsOneWidget,
      );
      expect(find.text('one'), findsOneWidget);
      expect(library.ratings, isEmpty);
      library.pending = null;
      library.fail = false;
      await tap(tester, find.byKey(const Key('srs-forgot')));
      expect(find.text('two'), findsOneWidget);
      expect(library.calls, 2);
      expect(library.ratings, {'pending-0': 'forgot'});
      library.dispose();
    },
  );

  testWidgets(
    'quick rating honors reduced motion and safely finishes after leaving',
    (tester) async {
      final library = WordLibrary()..decks.clear();
      library.decks.add(
        const WordDeck('motion', 'Ôn từ', [
          PreviewWord('motion-0', 'hello', 'xin chào', '', ''),
        ]),
      );
      await show(
        tester,
        SrsReviewPage(library: library, deckId: 'motion'),
        reduceMotion: true,
      );
      await tester.tap(find.byKey(const Key('srs-hard')));
      await tester.pump(const Duration(milliseconds: 1000));
      expect(find.text('hello'), findsOneWidget);
      expect(
        tester.widget<Opacity>(find.byKey(const Key('ratingCardFade'))).opacity,
        1,
      );
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();
      expect(find.text('Bạn đã ôn hết từ'), findsOneWidget);
      await tap(tester, find.byKey(const Key('replayWordDeck')));
      await tester.tap(find.byKey(const Key('srs-forgot')));
      await tester.pump();
      Navigator.of(tester.element(find.byType(SrsReviewPage))).pop();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 2));
      expect(tester.takeException(), isNull);
      library.dispose();
    },
  );
}
