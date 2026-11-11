import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/speaking_content_feedback.dart';

void main() {
  for (final scale in [1.0, 2.0]) {
    testWidgets(
      'feedback expands with readable evidence at 320px and scale $scale',
      (tester) async {
        tester.view.physicalSize = const Size(320, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.lightTheme,
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(scale)),
              child: const Scaffold(
                body: SingleChildScrollView(
                  padding: EdgeInsets.all(16),
                  child: SpeakingContentFeedback(
                    strengths: [
                      'Trả lời trực tiếp các câu hỏi cơ bản.',
                      'Sử dụng được các câu đơn giản.',
                    ],
                    improvements: [
                      {
                        'quote': 'I play chess in.',
                        'explanationVi':
                            'Câu chưa hoàn chỉnh. Hãy thêm thông tin về nơi bạn chơi cờ.',
                        'suggestion': 'I play chess in a club.',
                      },
                      {
                        'quote': 'Play child',
                        'explanationVi': 'Dùng cấu trúc play with children.',
                        'suggestion': 'I enjoy playing with children.',
                      },
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('I play chess in.'), findsNothing);
        await tester.tap(find.text('Điểm làm tốt'));
        await tester.pumpAndSettle();
        expect(
          find.text('Trả lời trực tiếp các câu hỏi cơ bản.'),
          findsOneWidget,
        );
        await tester.ensureVisible(find.text('Gợi ý cải thiện'));
        await tester.tap(find.text('Gợi ý cải thiện'));
        await tester.pumpAndSettle();
        expect(find.text('Bạn đã nói'), findsNWidgets(2));
        expect(find.text('Gợi ý diễn đạt'), findsNWidgets(2));
        expect(find.text('I play chess in a club.'), findsOneWidget);
        for (final tile in tester.widgetList<ExpansionTile>(
          find.byType(ExpansionTile),
        )) {
          expect((tile.shape as RoundedRectangleBorder).side, BorderSide.none);
          expect(
            (tile.collapsedShape as RoundedRectangleBorder).side,
            BorderSide.none,
          );
          expect(tile.minTileHeight, greaterThanOrEqualTo(48));
        }
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets('empty feedback produces no expansion headers', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SpeakingContentFeedback(strengths: [], improvements: []),
        ),
      ),
    );
    expect(find.byType(ExpansionTile), findsNothing);
  });
}
