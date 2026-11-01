import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/learning/learning_controller.dart';
import 'package:mobile/features/learning/learning_pages.dart';
import 'package:mobile/features/learning/learning_repository.dart';

Json copy(Json data) =>
    Map<String, dynamic>.from(jsonDecode(jsonEncode(data)) as Map);

class MemoryLearningRepository implements LearningRepository {
  Json state = {
    'id': 'attempt',
    'version': 0,
    'status': 'IN_PROGRESS',
    'lesson': {
      'id': 'lesson',
      'title': 'Everyday Introductions',
      'kind': 'READING',
    },
    'position': {'phase': 'QUIZ', 'index': 0},
    'content': {'steps': []},
    'questions': [
      for (var i = 0; i < 5; i++)
        {
          'id': 'q$i',
          'prompt': 'Question $i',
          'options': [
            {'id': 'a', 'text': 'Answer A'},
            {'id': 'b', 'text': 'Answer B'},
          ],
        },
    ],
    'answers': [],
    'result': null,
  };
  bool offline = false;
  bool dropCheckResponse = false;
  int checks = 0;
  Completer<void>? delayed;
  LearningAttempt snapshot() => LearningAttempt(copy(state));
  void _guard(Json body) {
    if (offline) throw const ApiFailure('Offline');
    if (body['expectedVersion'] != state['version']) {
      throw const ApiFailure('Conflict', status: 409);
    }
  }

  @override
  Future<LearningAttempt> attempt(String id) async => snapshot();
  @override
  Future<LearningAttempt> start(String id) async {
    if (offline) throw const ApiFailure('Offline');
    return snapshot();
  }

  @override
  Future<LearningAttempt> progress(String id, Json body) async {
    await delayed?.future;
    _guard(body);
    state['position'] = {'phase': body['phase'], 'index': body['index']};
    if (body.containsKey('questionId')) {
      final answers = state['answers'] as List;
      answers.removeWhere((a) => a['questionId'] == body['questionId']);
      answers.add({
        'questionId': body['questionId'],
        'optionId': body['optionId'],
        'checked': false,
      });
    }
    state['version'] = (state['version'] as int) + 1;
    return snapshot();
  }

  @override
  Future<LearningAttempt> check(String id, String questionId, Json body) async {
    if (snapshot().answer(questionId)?['checked'] == true &&
        snapshot().answer(questionId)?['optionId'] == body['optionId']) {
      return snapshot();
    }
    _guard(body);
    checks++;
    final answers = state['answers'] as List;
    answers.removeWhere((a) => a['questionId'] == questionId);
    answers.add({
      'questionId': questionId,
      'optionId': body['optionId'],
      'checked': true,
      'isCorrect': body['optionId'] == 'a',
      'correctOptionId': 'a',
      'explanation': 'Server explanation',
    });
    state['version'] = (state['version'] as int) + 1;
    if (dropCheckResponse) {
      dropCheckResponse = false;
      throw const ApiFailure('Response lost');
    }
    return snapshot();
  }

  @override
  Future<LearningAttempt> submit(String id, int version) async {
    _guard({'expectedVersion': version});
    if ((state['answers'] as List).where((a) => a['checked'] == true).length !=
        5) {
      throw const ApiFailure('Incomplete', status: 400);
    }
    state['status'] = 'COMPLETED';
    state['result'] = {
      'correctCount': (state['answers'] as List)
          .where((a) => a['isCorrect'] == true)
          .length,
      'totalQuestions': 5,
      'scoreRatio': 0,
    };
    state['version'] = version + 1;
    return snapshot();
  }

  @override
  Future<Json> catalogue() async => {'items': []};
  @override
  Future<Json> history({String? cursor}) async => {
    'items': [],
    'nextCursor': null,
  };
  @override
  Future<Json> summary() async => {};
  @override
  String audioUrl(String path) => path;
}

class DelayedHistoryRepository extends MemoryLearningRepository {
  final requests = <Completer<Json>>[];
  @override
  Future<Json> history({String? cursor}) {
    final request = Completer<Json>();
    requests.add(request);
    return request.future;
  }
}

Json historyItem(String id) => {
  'id': id,
  'lesson': {'title': id},
  'status': 'IN_PROGRESS',
  'updatedAt': '2026-11-01T10:00:00Z',
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));
  test(
    'offline draft survives controller recreation and belongs only to its account',
    () async {
      final repository = MemoryLearningRepository()..offline = true;
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      final first = LearningAttemptController(owner: owner);
      await first.load(attemptId: 'attempt');
      await first.select('q0', 'b');
      expect(await first.flush(), false);
      expect(repository.checks, 0);
      first.dispose();
      final restored = LearningAttemptController(owner: owner);
      await restored.load(attemptId: 'attempt');
      expect(restored.selected('q0'), 'b');
      expect(restored.unsynced, true);
      final bob = LearningController(repository: repository, accountId: 'bob');
      final other = LearningAttemptController(owner: bob);
      await other.load(attemptId: 'attempt');
      expect(other.selected('q0'), null);
      repository.offline = false;
      expect(await restored.flush(), true);
      await restored.check('q0');
      expect(restored.attempt!.answer('q0')!['checked'], true);
      restored.dispose();
      other.dispose();
      owner.dispose();
      bob.dispose();
    },
  );
  test(
    'stale draft reloads locked server answer and does not overwrite it',
    () async {
      final repository = MemoryLearningRepository();
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      final controller = LearningAttemptController(owner: owner);
      await controller.load(attemptId: 'attempt');
      await controller.select('q0', 'b');
      await repository.check('attempt', 'q0', {
        'expectedVersion': 0,
        'optionId': 'a',
      });
      expect(await controller.flush(), false);
      expect(controller.selected('q0'), 'a');
      expect(controller.notice, isNotNull);
      expect(controller.unsynced, false);
      expect(repository.checks, 1);
      controller.dispose();
      owner.dispose();
    },
  );
  test(
    'account invalidation ignores delayed responses and keeps pending account draft',
    () async {
      var current = true;
      final repository = MemoryLearningRepository()
        ..delayed = Completer<void>();
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
        isAccountCurrent: () => current,
      );
      final controller = LearningAttemptController(owner: owner);
      await controller.load(attemptId: 'attempt');
      await controller.select('q0', 'b');
      final sync = controller.flush();
      await Future<void>.delayed(Duration.zero);
      current = false;
      repository.delayed!.complete();
      expect(await sync, false);
      expect(controller.attempt!.version, 0);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.containsKey('learning.pending.alice.attempt'), true);
      controller.dispose();
      owner.dispose();
    },
  );
  test(
    'failed position move stays on server position and resumes after retry',
    () async {
      final repository = MemoryLearningRepository();
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      final controller = LearningAttemptController(owner: owner);
      await controller.load(attemptId: 'attempt');
      repository.offline = true;
      await controller.move('QUIZ', 1);
      expect(controller.index, 0);
      expect(controller.unsynced, true);
      repository.offline = false;
      expect(await controller.flush(), true);
      expect(controller.index, 1);
      controller.dispose();
      owner.dispose();
    },
  );
  testWidgets(
    'lost check response exposes retry that recovers feedback without grading twice',
    (tester) async {
      final repository = MemoryLearningRepository()..dropCheckResponse = true;
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(owner: owner, lessonId: 'lesson'),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('learning-option-b')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('learningPrimaryAction')));
      await tester.pumpAndSettle();
      expect(find.text('Response lost'), findsOneWidget);
      expect(find.text('Server explanation'), findsNothing);
      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();
      expect(find.text('Server explanation'), findsOneWidget);
      expect(find.text('Response lost'), findsNothing);
      expect(repository.checks, 1);
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
  testWidgets(
    'checks each question, shows server feedback, and submits zero correct answers',
    (tester) async {
      final repository = MemoryLearningRepository();
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningAttemptPage(owner: owner, lessonId: 'lesson'),
        ),
      );
      await tester.pumpAndSettle();
      for (var i = 0; i < 5; i++) {
        expect(find.text('Question $i'), findsOneWidget);
        await tester.tap(find.byKey(const ValueKey('learning-option-b')));
        await tester.pump();
        await tester.tap(find.byKey(const Key('learningPrimaryAction')));
        await tester.pumpAndSettle();
        expect(find.text('Server explanation'), findsOneWidget);
        expect(find.text('Chưa chính xác'), findsOneWidget);
        await tester.tap(find.byKey(const Key('learningPrimaryAction')));
        await tester.pumpAndSettle();
      }
      expect(find.text('0/5 câu đúng'), findsOneWidget);
      expect(repository.checks, 5);
      expect(repository.state['status'], 'COMPLETED');
      repository.offline = true;
      await tester.tap(find.text('Làm lại'));
      await tester.pumpAndSettle();
      expect(find.text('Offline'), findsOneWidget);
      expect(find.text('0/5 câu đúng'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
  testWidgets(
    'refresh supersedes in-flight history pagination without duplicated stale rows',
    (tester) async {
      final repository = DelayedHistoryRepository();
      final owner = LearningController(
        repository: repository,
        accountId: 'alice',
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.lightTheme,
          home: LearningHistoryPage(controller: owner),
        ),
      );
      repository.requests[0].complete({
        'items': [historyItem('initial')],
        'nextCursor': 'page2',
      });
      await tester.pumpAndSettle();
      await tester.tap(find.text('Xem thêm'));
      await tester.pump();
      final refresh = tester
          .widget<RefreshIndicator>(find.byType(RefreshIndicator))
          .onRefresh();
      await tester.pump();
      expect(repository.requests, hasLength(3));
      repository.requests[2].complete({
        'items': [historyItem('fresh')],
        'nextCursor': null,
      });
      await refresh;
      await tester.pumpAndSettle();
      repository.requests[1].complete({
        'items': [historyItem('stale')],
        'nextCursor': null,
      });
      await tester.pumpAndSettle();
      expect(find.text('fresh'), findsOneWidget);
      expect(find.text('stale'), findsNothing);
      expect(find.text('initial'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      owner.dispose();
    },
  );
}
