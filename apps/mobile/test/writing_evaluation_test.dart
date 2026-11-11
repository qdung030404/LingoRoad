import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/learning/writing_evaluation_service.dart';
import 'package:mobile/features/learning/writing_practice_page.dart';

void main() {
  group('WritingEvaluationResult', () {
    test('parses full valid qualitative JSON correctly', () {
      final json = <String, dynamic>{
        'levelEvaluation': {
          'status': 'MEETS_EXPECTATIONS',
          'summaryVi': 'Bài viết đạt chuẩn kỳ vọng cho trình độ B2.',
          'encouragementVi': 'Cố gắng tiếp tục phát huy vốn từ vựng phong phú!',
        },
        'grammarChecklist': [
          {
            'grammarPoint': 'Mệnh đề quan hệ',
            'status': 'MASTERED',
            'evidenceSentence': 'Students can easily access information which helps them.',
            'feedbackVi': 'Đã áp dụng tốt mệnh đề quan hệ.',
          },
          {
            'grammarPoint': 'Thì hiện tại hoàn thành',
            'status': 'NOT_USED',
            'evidenceSentence': '',
            'feedbackVi': 'Chưa thấy câu văn áp dụng thì hiện tại hoàn thành.',
          },
        ],
        'improvementSteps': [
          'Thêm ví dụ minh họa cụ thể cho luận điểm 2.',
          'Sử dụng liên từ nối đa dạng hơn.',
        ],
        'feedback': [
          {
            'originalSentence': 'I will going to market.',
            'issueVi': 'Sai cấu trúc thì tương lai đơn.',
            'suggestion': 'I will go to the market.',
            'explanationVi': 'Sau will là động từ nguyên mẫu.',
          }
        ],
        'overallCommentVi': 'Bài viết tốt, lập luận rõ ràng.',
      };

      final result = WritingEvaluationResult.fromJson(json);

      expect(result.levelEvaluation.status, LevelEvaluationStatus.meetsExpectations);
      expect(result.levelEvaluation.labelVi, 'Đạt chuẩn kỳ vọng');
      expect(result.levelEvaluation.summaryVi, 'Bài viết đạt chuẩn kỳ vọng cho trình độ B2.');
      expect(result.grammarChecklist.length, 2);
      expect(result.grammarChecklist[0].status, GrammarStatus.mastered);
      expect(result.grammarChecklist[0].statusLabelVi, 'Đã áp dụng tốt');
      expect(result.grammarChecklist[1].status, GrammarStatus.notUsed);
      expect(result.grammarChecklist[1].statusLabelVi, 'Chưa sử dụng');
      expect(result.improvementSteps.length, 2);
      expect(result.feedback.length, 1);
      expect(result.feedback.first.originalSentence, 'I will going to market.');
      expect(result.feedback.first.issueVi, 'Sai cấu trúc thì tương lai đơn.');
      expect(result.feedback.first.suggestion, 'I will go to the market.');
      expect(result.feedback.first.explanationVi, 'Sau will là động từ nguyên mẫu.');
      expect(result.overallCommentVi, 'Bài viết tốt, lập luận rõ ràng.');
    });

    test('handles empty or missing fields gracefully with fallback defaults', () {
      final json = <String, dynamic>{};

      final result = WritingEvaluationResult.fromJson(json);

      expect(result.levelEvaluation.status, LevelEvaluationStatus.meetsExpectations);
      expect(result.grammarChecklist, isEmpty);
      expect(result.improvementSteps, isEmpty);
      expect(result.feedback, isEmpty);
      expect(result.overallCommentVi, '');
    });

    test('PreviewModel.getEvaluation fallback accurately maps full CEFR spectrum', () {
      final model = PreviewModel();
      model.itemScores['itm-c2'] = 9.8;
      model.itemScores['itm-c1'] = 8.8;
      model.itemScores['itm-b2'] = 7.5;
      model.itemScores['itm-b1'] = 6.0;
      model.itemScores['itm-a2'] = 4.0;
      model.itemScores['itm-a1'] = 2.0;

      expect(model.getEvaluation('itm-c2')?.estimatedCefr, 'C2');
      expect(model.getEvaluation('itm-c1')?.estimatedCefr, 'C1');
      expect(model.getEvaluation('itm-b2')?.estimatedCefr, 'B2');
      expect(model.getEvaluation('itm-b1')?.estimatedCefr, 'B1');
      expect(model.getEvaluation('itm-a2')?.estimatedCefr, 'A2');
      expect(model.getEvaluation('itm-a1')?.estimatedCefr, 'A1');
    });
  });

  group('WritingPracticeItem', () {
    test('parses database API json with rubricCriteria and targetGrammars correctly', () {
      final itemJson = <String, dynamic>{
        'id': 'cefr-write-b2-001',
        'groupId': 'grp-cefr-write-b2',
        'cefrLevel': 'B2',
        'skillCode': 'writing.opinion_essay',
        'prompt': 'Discuss remote work vs office work.',
        'rubricCriteria': {
          'wordCount': {'min': 140, 'max': 220},
          'expectedPoints': [
            'Benefits of WFH',
            'Benefits of Office',
            'Personal stance'
          ],
          'targetGrammars': [
            'Mệnh đề nhượng bộ (While, Whereas)',
            'Thể bị động (It is argued that)',
          ],
        },
      };

      final item = WritingPracticeItem.fromJson(itemJson);

      expect(item.id, 'cefr-write-b2-001');
      expect(item.cefrLevel, 'B2');
      expect(item.skillCode, 'writing.opinion_essay');
      expect(item.prompt, 'Discuss remote work vs office work.');
      expect(item.minWords, 140);
      expect(item.maxWords, 220);
      expect(item.targetGrammars.length, 2);
      expect(item.targetGrammars.first, 'Mệnh đề nhượng bộ (While, Whereas)');
      expect(item.expectedPoints, [
        'Benefits of WFH',
        'Benefits of Office',
        'Personal stance'
      ]);
      expect(item.skillTitle, 'Bài luận (Opinion Essay)');
      expect(item.sampleText, isNotNull);
    });

    test('defaultItems contain valid pre-seeded database prompts with targetGrammars', () {
      expect(WritingPracticeItem.defaultItems.length, 7);
      final item1 = WritingPracticeItem.defaultItems[0];
      expect(item1.cefrLevel, 'A2');
      expect(item1.expectedPoints, isNotEmpty);
      expect(item1.targetGrammars, isNotEmpty);
      expect(item1.skillTitle, 'Thư tín / Email');

      final item2 = WritingPracticeItem.defaultItems[1];
      expect(item2.cefrLevel, 'B2');
      expect(item2.minWords, 140);
      expect(item2.targetGrammars, isNotEmpty);
      expect(item2.skillTitle, 'Bài luận (Opinion Essay)');
    });
  });

  group('WritingPracticeListPage & WritingTaskPage Widget Tests', () {
    testWidgets('WritingPracticeListPage renders list of tasks with CEFR filters',
        (tester) async {
      final model = PreviewModel();
      await tester.pumpWidget(
        MaterialApp(
          home: WritingPracticeListPage(model: model),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Đề Luyện Viết (CEFR)'), findsOneWidget);
      expect(find.text('Tất cả loại bài'), findsOneWidget);
      expect(find.text('Thư tín / Email'), findsWidgets);
      expect(find.text('Bài luận (Essay)'), findsOneWidget);
      expect(find.text('Bắt đầu viết'), findsWidgets);
    });

    testWidgets('WritingTaskPage renders prompt, target grammars, and updates word count',
        (tester) async {
      final model = PreviewModel();
      final item = WritingPracticeItem.defaultItems[0];

      await tester.pumpWidget(
        MaterialApp(
          home: WritingTaskPage(model: model, item: item),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Luyện Viết'), findsOneWidget);
      expect(find.text('Thư tín / Email'), findsOneWidget);
      expect(find.text('Thu gọn đề'), findsOneWidget);
      expect(find.text('Thử thách Ngữ pháp Mục tiêu'), findsOneWidget);
      expect(find.text('Gửi bài để AI đánh giá'), findsOneWidget);

      await tester.scrollUntilVisible(
        find.byKey(const Key('writingInput')),
        200,
      );
      await tester.enterText(
        find.byKey(const Key('writingInput')),
        'Dear Sir, I am writing to report my lost jacket.',
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('10 từ', skipOffstage: false), findsOneWidget);
    });

    testWidgets('WritingReviewPage renders submitted content and rubric info',
        (tester) async {
      final model = PreviewModel();
      model.drafts[0] = 'My completed essay content here.';

      await tester.pumpWidget(
        MaterialApp(
          home: WritingReviewPage(model: model),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('Bài viết 1/'), findsOneWidget);
      expect(find.text('My completed essay content here.'), findsOneWidget);
      expect(find.text('Chấm bài này với AI (CEFR)'), findsOneWidget);
      expect(
        find.text('Thông tin tiêu chí Rubric CEFR', skipOffstage: false),
        findsOneWidget,
      );
    });

    testWidgets(
        'WritingTaskPage shows Xem đánh giá của AI when evaluated and reverts when rewriting',
        (tester) async {
      final model = PreviewModel();
      final item = WritingPracticeItem.defaultItems[0];
      await model.saveScore(item.id, 8.0);
      await model.saveEvaluation(
        item.id,
        const WritingEvaluationResult(
          levelEvaluation: LevelEvaluation(
            status: LevelEvaluationStatus.meetsExpectations,
            summaryVi: 'Bài viết đạt chuẩn A2.',
            encouragementVi: 'Tiếp tục luyện tập nhé!',
          ),
          grammarChecklist: [
            GrammarChecklistItem(
              grammarPoint: 'Thì quá khứ đơn',
              status: GrammarStatus.mastered,
              evidenceSentence: 'I stayed in room 302.',
              feedbackVi: 'Sử dụng tốt quá khứ đơn.',
            ),
          ],
          improvementSteps: ['Bổ sung thêm mô tả chi tiết'],
          feedback: [],
          overallCommentVi: 'Bài viết tốt.',
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: WritingTaskPage(model: model, item: item),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Xem đánh giá của AI'), findsOneWidget);
      expect(find.text('Gửi bài để AI đánh giá'), findsNothing);

      await tester.tap(find.text('Xem đánh giá của AI'));
      await tester.pumpAndSettle();

      expect(find.text('Đánh giá Bài viết AI'), findsOneWidget);
      expect(find.text('Thử thách Ngữ pháp Mục tiêu'), findsOneWidget);
      expect(find.text('Đã áp dụng tốt'), findsOneWidget);

      await tester.scrollUntilVisible(
        find.text('Viết lại để áp dụng góp ý'),
        200,
      );
      expect(find.text('Viết lại để áp dụng góp ý'), findsOneWidget);

      await tester.tap(find.text('Viết lại để áp dụng góp ý'));
      await tester.pumpAndSettle();

      expect(find.text('Gửi bài để AI đánh giá'), findsOneWidget);
      expect(find.text('Xem đánh giá của AI'), findsNothing);
    });
  });
}
