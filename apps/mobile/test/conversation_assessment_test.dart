import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/conversation_assessment.dart';
import 'package:mobile/features/speaking/conversation_audio.dart';
import 'package:mobile/features/speaking/conversation_result_page.dart';
import 'package:mobile/features/speaking/speaking_controller.dart';
import 'speaking_workflow_test.dart' show FakeSpeakingRepository, FakeRecorder;

class AssessmentRepository extends FakeSpeakingRepository {
  Json row = {'id': 'call', 'assessmentStatus': 'UNASSESSED'};
  int requests = 0;
  String? receivedPath;
  bool loseAck = false;
  final historyChoices = <bool>[];
  @override
  Future<Json> chooseConversationHistory(
    String id, {
    required bool save,
  }) async {
    historyChoices.add(save);
    return row = {...row, 'historyStatus': 'SAVED'};
  }

  @override
  Future<Json> conversation(String id) async => Map.of(row);
  @override
  Future<Json> assessConversation(String id, {String? audioPath}) async {
    requests++;
    receivedPath = audioPath;
    row = {
      ...row,
      'assessmentStatus': 'PROCESSING',
      'assessment': {'segmentHash': 'pending'},
    };
    if (loseAck) throw const ApiFailure('offline');
    return Map.of(row);
  }
}

void main() {
  testWidgets(
    'uploads captured microphone, recovers lost ACK and shows saved content scores',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(393, 850));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final repository = AssessmentRepository()..loseAck = true;
      final controller = SpeakingController(
        repository: repository,
        recorder: FakeRecorder('unused'),
        accountId: 'a',
        isCurrent: () => true,
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: ConversationAssessment(
              controller: controller,
              conversation: Map.of(repository.row),
              audioPath: '/temporary/user.wav',
              fullPage: true,
            ),
          ),
        ),
      );
      await tester.tap(find.text('Chấm điểm hội thoại'));
      await tester.pumpAndSettle();
      expect(repository.receivedPath, '/temporary/user.wav');
      await tester.tap(find.text('Chấm điểm hội thoại'));
      await tester.pump();
      expect(repository.requests, 1);
      expect(find.text('Đang chấm hội thoại'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Phát âm'), findsNothing);
      expect(find.text('Nội dung'), findsNothing);
      repository.row = {
        ...repository.row,
        'assessmentStatus': 'PARTIAL',
        'assessment': {
          'schemaVersion': 2,
          'turns': [
            {
              'question': 'Who is in your family?',
              'answer': 'I live with my sister.',
            },
          ],
          'content': {
            'status': 'succeeded',
            'overall': 72.5,
            'vocabulary': 70.5,
            'grammar': 72.5,
            'topic': 74.5,
          },
        },
      };
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('content-score-circle')),
          matching: find.text('72.5'),
        ),
        findsOneWidget,
      );
      expect(find.text('Chưa có điểm phát âm cho phiên này.'), findsOneWidget);
      final heading = find.text('Chi tiết hội thoại');
      final annotation = find.text('Annotation');
      final question = find.text('Who is in your family?');
      await tester.ensureVisible(heading);
      expect(
        tester.getTopLeft(heading).dy,
        lessThan(tester.getTopLeft(annotation).dy),
      );
      expect(
        tester.getTopLeft(annotation).dy,
        lessThan(tester.getTopLeft(question).dy),
      );
      final first = tester.getTopLeft(find.text('Phát âm cần luyện'));
      final second = tester.getTopLeft(find.text('Ngắt nghỉ ngoài dự kiến'));
      final third = tester.getTopLeft(find.text('Cần ngắt nghỉ'));
      final fourth = tester.getTopLeft(find.text('Giọng đều'));
      expect(first.dx, third.dx);
      expect(second.dx, fourth.dx);
      expect(second.dx, greaterThan(first.dx));
      expect(third.dy, greaterThan(first.dy));
      expect(find.textContaining('Phản hồi nội dung dựa trên'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );

  testWidgets('result returns without saving and only saves on explicit tap', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(393, 850));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    final repository = AssessmentRepository()
      ..row = {
        'id': 'call',
        'historyStatus': 'PENDING',
        'assessmentStatus': 'PARTIAL',
        'assessment': {
          'schemaVersion': 2,
          'content': {'status': 'succeeded', 'overall': 72.5},
        },
      };
    final controller = SpeakingController(
      repository: repository,
      recorder: FakeRecorder('unused'),
      accountId: 'a',
      isCurrent: () => true,
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => ConversationResultPage(
                    controller: controller,
                    conversation: repository.row,
                    audio: ConversationAudio(),
                  ),
                ),
              ),
              child: const Text('Mở kết quả'),
            ),
          ),
        ),
      ),
    );

    final open = find.text('Mở kết quả');
    final save = find.text('Lưu lịch sử trò chuyện');
    final back = find.text('Quay lại');
    await tester.tap(open);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(back, 150);
    expect(tester.getTopLeft(save).dy, lessThan(tester.getTopLeft(back).dy));
    await tester.tap(back);
    await tester.pumpAndSettle();
    expect(repository.historyChoices, isEmpty);

    await tester.tap(open);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(save, 150);
    await tester.tap(save);
    await tester.pumpAndSettle();
    expect(repository.historyChoices, [true]);
    expect(find.text('Đã lưu lịch sử trò chuyện'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });
}
