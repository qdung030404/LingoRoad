import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/conversation_assessment.dart';

void main() {
  testWidgets('segmented answer exposes word details directly without per-answer score summary', (tester) async {
    await tester.pumpWidget(MaterialApp(theme: AppTheme.lightTheme, home: Scaffold(body: SingleChildScrollView(
      child: ConversationAnswerAssessment(index: 0, answer: {
        'question': 'What is your name?', 'answer': 'Anna.',
        'pronunciation': {'mode': 'TOPIC', 'transcript': 'Anna.', 'words': [
          {'word': 'Anna', 'accuracy': 55.5, 'errorType': 'Mispronunciation', 'phonemes': [], 'syllables': []},
        ]},
      }),
    ))));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('speaking-summary')), findsNothing);
    await tester.tap(find.byKey(const ValueKey('speaking-reference-0')));
    await tester.pumpAndSettle();
    expect(find.text('Âm vị'), findsOneWidget);
    expect(find.text('55.5'), findsOneWidget);
  });
}
