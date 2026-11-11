import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/features/speaking/conversation_history_chat.dart';
import 'package:mobile/features/speaking/speaking_controller.dart';
import 'speaking_workflow_test.dart' show FakeSpeakingRepository, FakeRecorder;

class TranscriptRepository extends FakeSpeakingRepository {
  int calls = 0;
  bool fail = false;
  Completer<Json>? pending;
  @override
  Future<Json> conversationTranscript(String id) async {
    calls++;
    if (fail) throw const ApiFailure('offline');
    return pending?.future ??
        Future.value({
          'items': [
            {'id': 'user', 'role': 'USER', 'transcript': 'My reply.'},
          ],
        });
  }
}

void main() {
  testWidgets(
    'chat fetches on first expansion and reuses the response on reopen',
    (tester) async {
      final repo = TranscriptRepository()..pending = Completer<Json>();
      final controller = SpeakingController(
        repository: repo,
        recorder: FakeRecorder('unused'),
        accountId: 'a',
        isCurrent: () => true,
      );
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ConversationHistoryChat(
                controller: controller,
                id: 'call',
              ),
            ),
          ),
        ),
      );
      expect(repo.calls, 0);
      await tester.tap(find.text('Lịch sử chat'));
      await tester.pump();
      expect(repo.calls, 1);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      repo.pending!.complete({
        'items': [
          {'id': 'user', 'role': 'USER', 'transcript': 'My reply.'},
        ],
      });
      await tester.pumpAndSettle();
      expect(find.text('My reply.'), findsOneWidget);
      await tester.tap(find.text('Lịch sử chat'));
      await tester.pumpAndSettle();
      expect(find.text('My reply.'), findsNothing);
      await tester.tap(find.text('Lịch sử chat'));
      await tester.pumpAndSettle();
      expect(repo.calls, 1);
      expect(find.text('My reply.'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );

  testWidgets(
    'failed fetch can be retried and account change hides transcript',
    (tester) async {
      var active = true;
      final repo = TranscriptRepository()..fail = true;
      final controller = SpeakingController(
        repository: repo,
        recorder: FakeRecorder('unused'),
        accountId: 'a',
        isCurrent: () => active,
      );
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ConversationHistoryChat(
                controller: controller,
                id: 'call',
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('Lịch sử chat'));
      await tester.pumpAndSettle();
      expect(find.text('Chưa tải được lời thoại.'), findsOneWidget);
      repo.fail = false;
      await tester.tap(find.text('Tải lại lời thoại'));
      await tester.pumpAndSettle();
      expect(repo.calls, 2);
      expect(find.text('My reply.'), findsOneWidget);
      active = false;
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('My reply.'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );
}
