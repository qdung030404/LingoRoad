import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/speaking/conversation_timeline.dart';

void main() {
  testWidgets(
    'new chat returns to latest message after scrolling through earlier turns',
    (tester) async {
      Widget page(int count) => MaterialApp(
        home: Scaffold(
          body: ConversationTimeline(
            revision: count,
            children: [
              for (var i = 0; i < count; i++)
                SizedBox(height: 100, child: Text('Turn $i')),
            ],
          ),
        ),
      );
      await tester.pumpWidget(page(20));
      final scroll = tester.state<ScrollableState>(find.byType(Scrollable));
      expect(scroll.position.pixels, 0);
      scroll.position.jumpTo(700);
      await tester.pumpWidget(page(21));
      await tester.pumpAndSettle();
      expect(scroll.position.pixels, 0);
      expect(
        tester
            .getRect(find.text('Turn 20'))
            .overlaps(tester.getRect(find.byType(Scaffold))),
        isTrue,
      );
    },
  );
}
