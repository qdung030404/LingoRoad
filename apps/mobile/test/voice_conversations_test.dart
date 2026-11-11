import 'package:mobile/features/speaking/speaking_repository.dart'
    show ConversationSettings;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/speaking/speaking_controller.dart';
import 'package:mobile/features/speaking/voice_conversations_page.dart';
import 'speaking_workflow_test.dart' show FakeSpeakingRepository, FakeRecorder;

class ConversationRepository extends FakeSpeakingRepository {
  bool available = true;
  bool offlineHistory = false;
  int preparationCalls = 0, createCalls = 0;
  @override
  Future<Json> conversationTopic(String id) async {
    preparationCalls++;
    return {
      'id': id,
      'text': 'Topic 0',
      'enabled': available,
      'hints': ['What is your name?'],
      'preparation': {
        'goal': 'Giới thiệu bản thân.',
        'vocabulary': [
          {
            'word': 'hometown',
            'meaningVi': 'quê quán',
            'example': 'My hometown is Hanoi.',
          },
        ],
        'phrases': [
          {'text': 'My name is Linh.', 'meaningVi': 'Tôi tên là Linh.'},
        ],
      },
    };
  }

  @override
  Future<Json> createConversation(
    String topicId,
    String requestId, {
    ConversationSettings? settings,
  }) async {
    createCalls++;
    return {};
  }

  @override
  Future<Json> conversationTopics() async => {
    'enabled': available,
    'items': [
      for (var i = 0; i < 6; i++)
        {
          'id': 'topic-$i',
          'text': 'Topic $i',
          'hints': ['What is your name?'],
        },
    ],
  };
  @override
  Future<Json> conversations({String? cursor}) async {
    if (offlineHistory) throw const ApiFailure('offline');
    return {
      'items': [
        {
          'id': 'session',
          'topicSnapshot': {'text': 'My family'},
          'status': 'ENDED',
        },
      ],
    };
  }

  @override
  Future<Json> conversation(String id) async => {
    'id': id,
    'topicSnapshot': {'text': 'My family'},
    'status': 'ENDED',
    'turns': [
      {'role': 'ASSISTANT', 'transcript': 'Tell me about your family.'},
      {'role': 'USER', 'transcript': 'I live with my parents.'},
    ],
  };
}

void main() {
  Future<SpeakingController> open(
    WidgetTester tester,
    ConversationRepository repository,
  ) async {
    final controller = SpeakingController(
      repository: repository,
      recorder: FakeRecorder('unused'),
      accountId: 'test-account',
      isCurrent: () => true,
    );
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.lightTheme,
        home: VoiceConversationsPage(controller: controller),
      ),
    );
    await tester.pumpAndSettle();
    return controller;
  }

  testWidgets(
    'six topics and persisted conversation are accessible without starting a call',
    (tester) async {
      final controller = await open(tester, ConversationRepository());
      expect(find.text('Topic 0'), findsOneWidget);
      await tester.scrollUntilVisible(find.text('Topic 5'), 200);
      await tester.pumpAndSettle();
      expect(find.text('Topic 5'), findsOneWidget);
      await tester.tap(find.byTooltip('Lịch sử hội thoại'));
      await tester.pumpAndSettle();
      expect(find.text('My family'), findsOneWidget);
      await tester.tap(find.text('Xem hội thoại'));
      await tester.pumpAndSettle();
      expect(find.text('I live with my parents.'), findsNothing);
      await tester.ensureVisible(find.text('Lịch sử chat'));
      await tester.tap(find.text('Lịch sử chat'));
      await tester.pumpAndSettle();
      expect(find.text('I live with my parents.'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );

  testWidgets('history remains readable while new conversations are disabled', (
    tester,
  ) async {
    final repository = ConversationRepository()..available = false;
    final controller = await open(tester, repository);
    await tester.tap(find.text('Topic 0'));
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Bắt đầu hội thoại'),
          )
          .onPressed,
      isNull,
    );
    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Lịch sử hội thoại'));
    await tester.pumpAndSettle();
    expect(find.text('Xem hội thoại'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });

  testWidgets('topic names open guidance on demand without allocating a call', (
    tester,
  ) async {
    final repository = ConversationRepository();
    final controller = await open(tester, repository);
    expect(find.text('What is your name?'), findsNothing);
    expect(find.text('Chọn chủ đề'), findsNothing);
    expect(repository.preparationCalls, 0);
    await tester.tap(find.text('Topic 0'));
    await tester.pumpAndSettle();
    expect(find.text('Chuẩn bị hội thoại'), findsOneWidget);
    expect(find.text('hometown'), findsOneWidget);
    expect(find.text('Bắt đầu hội thoại'), findsOneWidget);
    expect(repository.preparationCalls, 1);
    expect(repository.createCalls, 0);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    controller.dispose();
  });

  testWidgets(
    'background history failure is handled while topics are visible',
    (tester) async {
      final controller = await open(
        tester,
        ConversationRepository()..offlineHistory = true,
      );
      expect(find.text('Topic 0'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.tap(find.byTooltip('Lịch sử hội thoại'));
      await tester.pumpAndSettle();
      expect(find.text('Chưa tải được hội thoại.'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );
}
