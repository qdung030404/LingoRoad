import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/speaking/conversation_message.dart';

void main() {
  testWidgets('AI translation is explicit, retryable and reused when toggled', (tester) async {
    var calls = 0;
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: ConversationMessage(
      isUser: false, text: 'Where do you live?', onTranslate: () async {
        calls++;
        if (calls == 1) throw Exception('offline');
        return 'Bạn sống ở đâu?';
      },
    ))));
    expect(calls, 0);
    await tester.tap(find.text('Dịch sang tiếng Việt'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Dịch lại'));
    await tester.pumpAndSettle();
    expect(find.text('Bạn sống ở đâu?'), findsOneWidget);
    await tester.tap(find.text('Ẩn bản dịch'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Dịch sang tiếng Việt'));
    await tester.pumpAndSettle();
    expect(calls, 2);
  });

  testWidgets('user bubbles have no translate action and fit narrow large text', (tester) async {
    tester.view.physicalSize = const Size(320, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(home: MediaQuery(data: const MediaQueryData(textScaler: TextScaler.linear(1.6)),
      child: Scaffold(body: ListView(children: const [ConversationMessage(isUser: true, text: 'I live in Ho Chi Minh City.')])))));
    expect(find.text('Dịch sang tiếng Việt'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
