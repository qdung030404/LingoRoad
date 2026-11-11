import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/features/speaking/conversation_preparation.dart';
import 'package:mobile/features/speaking/speaking_controller.dart';
import 'voice_conversations_test.dart' show ConversationRepository;
import 'speaking_workflow_test.dart' show FakeRecorder;

class PreparationRepository extends ConversationRepository {
  bool fail = false;
  int loads = 0;
  int extraWords = 0;
  int extraSentences = 0;
  Completer<Json>? pending;

  @override
  Future<Json> conversationTopic(String id) async {
    loads++;
    if (fail) throw const ApiFailure('offline');
    if (pending != null) return pending!.future;
    return {
      ...await super.conversationTopic(id),
      'preparation': {
        'goal': 'Giới thiệu bản thân.',
        'vocabulary': [
          {
            'word': 'hometown',
            'meaningVi': 'quê quán',
            'example': 'My hometown is Hanoi.',
          },
          for (var i = 1; i <= extraWords; i++)
            {
              'word': 'Word $i',
              'meaningVi': 'Nghĩa $i',
              'example': 'Example sentence $i.',
            },
        ],
        'phrases': [
          {'text': 'My name is Linh.', 'meaningVi': 'Tôi tên là Linh.'},
          for (var i = 1; i <= extraSentences; i++)
            {
              'text': 'I live near park number $i.',
              'meaningVi': 'Tôi sống gần công viên số $i.',
            },
        ],
        'helpPhrases': [
          {
            'text': 'Could you repeat that, please?',
            'meaningVi': 'Bạn có thể nhắc lại được không?',
          },
        ],
        'tips': ['Trả lời bằng một câu đầy đủ.'],
      },
    };
  }
}

void main() {
  Future<SpeakingController> open(
    WidgetTester tester,
    PreparationRepository repository, {
    ValueChanged<Json>? onStart,
    bool Function()? isCurrent,
    double scale = 1,
    bool showActivities = false,
  }) async {
    final controller = SpeakingController(
      repository: repository,
      recorder: FakeRecorder('unused'),
      accountId: 'account',
      isCurrent: isCurrent ?? () => true,
    );
    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(scale)),
          child: child!,
        ),
        home: ConversationPreparation(
          controller: controller,
          topicId: 'topic-0',
          onStart: onStart ?? (_) {},
          activities: showActivities ? (_) => const SizedBox.shrink() : null,
        ),
      ),
    );
    await tester.pump();
    return controller;
  }

  testWidgets(
    'loading never offers start, failed guide retries before starting',
    (tester) async {
      final repo = PreparationRepository()..pending = Completer<Json>();
      Json? started;
      final controller = await open(
        tester,
        repo,
        onStart: (value) => started = value,
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Bắt đầu hội thoại'), findsNothing);
      repo.pending!.completeError(const ApiFailure('offline'));
      await tester.pumpAndSettle();
      expect(
        find.text('Chưa tải được hướng dẫn cho chủ đề này.'),
        findsOneWidget,
      );
      repo.pending = null;
      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();
      expect(repo.loads, 2);
      expect(find.text('hometown'), findsOneWidget);
      expect(started, isNull);
      expect(repo.createCalls, 0);
      await tester.tap(find.text('Bắt đầu hội thoại'));
      expect(started?['id'], 'topic-0');
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );

  testWidgets('guidance remains scrollable at 320px with large text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final controller = await open(tester, PreparationRepository(), scale: 2);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    for (final heading in [
      'Từ vựng gợi ý',
      'Mẫu câu thông dụng',
      'Câu hỏi có thể gặp',
      'Khi cần hỗ trợ',
      'Cách luyện',
    ]) {
      final title = find.text(heading);
      final page = tester.state<ScrollableState>(find.byType(Scrollable).first);
      for (var i = 0; i < 12 && title.evaluate().isEmpty; i++) {
        final position = page.position;
        position.jumpTo(
          (position.pixels + 160).clamp(0.0, position.maxScrollExtent),
        );
        await tester.pumpAndSettle();
      }
      await tester.ensureVisible(title);
      await tester.pumpAndSettle();
      expect(tester.getRect(title).center.dy, inInclusiveRange(0, 800));
      expect(tester.takeException(), isNull);
    }
    expect(find.text('Bắt đầu hội thoại'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });

  testWidgets('expanded vocabulary scrolls independently on a narrow screen', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final controller = await open(
      tester,
      PreparationRepository()..extraWords = 11,
      showActivities: true,
      scale: 1.5,
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Từ vựng gợi ý'));
    await tester.pumpAndSettle();

    final list = find.byKey(const ValueKey('suggestedVocabularyList'));
    expect(find.text('12 từ và cụm từ'), findsOneWidget);
    expect(tester.getSize(list).height, lessThanOrEqualTo(288));
    await tester.ensureVisible(list);
    await tester.pumpAndSettle();
    final listPosition = tester.getTopLeft(list);
    await tester.scrollUntilVisible(
      find.text('Example sentence 11.'),
      200,
      scrollable: find.descendant(of: list, matching: find.byType(Scrollable)),
    );
    expect(find.text('Word 11'), findsOneWidget);
    expect(find.text('Nghĩa 11'), findsOneWidget);
    expect(tester.getTopLeft(list), listPosition);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });

  testWidgets(
    'common sentences show both languages and scroll to the last card',
    (tester) async {
      tester.view.physicalSize = const Size(320, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final controller = await open(
        tester,
        PreparationRepository()..extraSentences = 7,
        showActivities: true,
        scale: 1.5,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Mẫu câu thông dụng'));
      await tester.pumpAndSettle();

      final list = find.byKey(const ValueKey('commonSentencesList'));
      expect(find.text('8 câu mẫu'), findsOneWidget);
      expect(find.text('My name is Linh.'), findsOneWidget);
      expect(find.text('Tôi tên là Linh.'), findsOneWidget);
      await tester.ensureVisible(list);
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('Tôi sống gần công viên số 7.'),
        160,
        scrollable: find.descendant(
          of: list,
          matching: find.byType(Scrollable),
        ),
      );
      expect(find.text('I live near park number 7.'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );

  testWidgets('account change during guide fetch prevents starting', (
    tester,
  ) async {
    var active = true;
    final repo = PreparationRepository()..pending = Completer<Json>();
    final controller = await open(tester, repo, isCurrent: () => active);
    active = false;
    repo.pending!.complete({'enabled': true, 'text': 'Private topic'});
    await tester.pumpAndSettle();
    expect(find.text('Phiên đăng nhập đã thay đổi.'), findsOneWidget);
    expect(find.text('Private topic'), findsNothing);
    expect(find.text('Bắt đầu hội thoại'), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    controller.dispose();
  });
}
