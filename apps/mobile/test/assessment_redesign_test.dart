import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/assessment_annotation.dart';
import 'package:mobile/features/speaking/conversation_score_details.dart';
import 'package:mobile/features/speaking/conversation_score_summary.dart';

import 'support/ui_fonts.dart';

void main() {
  testWidgets('detailed scores group both criteria and keep partial feedback', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.runAsync(loadUiFonts);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: const MediaQuery(
          data: MediaQueryData(textScaler: TextScaler.linear(2)),
          child: Scaffold(
            body: SingleChildScrollView(
              padding: EdgeInsets.all(16),
              child: ConversationScoreDetails(
                pronunciation: {'accuracy': 92, 'fluency': 89.5},
                content: {
                  'status': 'succeeded',
                  'vocabulary': 55,
                  'grammar': 55,
                  'topic': 55,
                  'strengths': ['Trả lời đúng câu hỏi.'],
                },
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Chính xác'), findsNothing);
    await tester.tap(find.text('Điểm chi tiết'));
    await tester.pumpAndSettle();
    expect(find.text('Phát âm'), findsOneWidget);
    expect(find.text('Nội dung bài nói'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNWidgets(6));
    expect(find.text('92.0'), findsOneWidget);
    expect(find.text('55.0'), findsNWidgets(3));
    expect(find.text('—'), findsOneWidget);
    expect(find.text('Điểm làm tốt'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('score bars align and compact annotations fit in two rows', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.runAsync(loadUiFonts);
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: const MediaQuery(
          data: MediaQueryData(textScaler: TextScaler.linear(1.5)),
          child: Scaffold(
            body: SingleChildScrollView(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ConversationScoreSummary(
                    pronunciation: {'overall': 87.5},
                    content: {'status': 'succeeded', 'overall': 55},
                  ),
                  AssessmentAnnotation(compact: true),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final progressBars = find.byType(LinearProgressIndicator);
    expect(progressBars, findsNWidgets(2));
    expect(find.text('Cần luyện thêm'), findsOneWidget);
    expect(
      tester.getCenter(progressBars.first).dy,
      closeTo(tester.getCenter(progressBars.last).dy, .01),
    );

    double rowOf(String label) => tester.getCenter(find.text(label)).dy;
    expect(rowOf('Phát âm cần luyện'), closeTo(rowOf('Ngắt nghỉ sai'), .01));
    expect(rowOf('Cần ngắt nghỉ'), closeTo(rowOf('Giọng đều'), .01));
    expect(rowOf('Cần ngắt nghỉ'), greaterThan(rowOf('Phát âm cần luyện')));
    expect(tester.takeException(), isNull);
  });

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
                    content: {'status': 'succeeded', 'overall': 51.7},
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
    expect(find.text('69'), findsOneWidget);
    expect(find.text('86.8'), findsOneWidget);
    expect(find.text('51.7'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNWidgets(2));
    expect(find.text('Annotation'), findsOneWidget);
    expect(find.byType(FilterChip), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
