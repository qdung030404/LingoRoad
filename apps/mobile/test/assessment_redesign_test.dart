import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/assessment_annotation.dart';
import 'package:mobile/features/speaking/conversation_score_summary.dart';
import 'package:mobile/features/speaking/speaking_assessment.dart';

void main() {
  testWidgets('static annotation and combined scores fit narrow large text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2)),
          child: Scaffold(
            body: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  const ConversationScoreSummary(
                    pronunciation: {
                      'overall': 86.8,
                      'accuracy': 90.5,
                      'fluency': 85,
                      'prosody': null,
                    },
                  ),
                  const SizedBox(height: 16),
                  const SpeakingContentAssessment(
                    data: {
                      'status': 'succeeded',
                      'overall': 51.7,
                      'vocabulary': 45,
                      'grammar': 45,
                      'topic': 65,
                    },
                    showOverall: false,
                    circularHeading: true,
                  ),
                  const SizedBox(height: 24),
                  const AssessmentAnnotation(reading: true),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Phát âm'), findsOneWidget);
    expect(find.text('Nội dung'), findsOneWidget);
    expect(
      find.byKey(const ValueKey('pronunciation-score-circle')),
      findsOneWidget,
    );
    expect(find.byKey(const ValueKey('content-score-circle')), findsOneWidget);
    final pronunciation = find.byType(ConversationScoreSummary);
    expect(
      find.descendant(of: pronunciation, matching: find.byType(Divider)),
      findsNothing,
    );
    expect(
      find.descendant(
        of: pronunciation,
        matching: find.byType(LinearProgressIndicator),
      ),
      findsNWidgets(3),
    );
    expect(find.text('Annotation'), findsOneWidget);
    expect(find.byType(FilterChip), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
