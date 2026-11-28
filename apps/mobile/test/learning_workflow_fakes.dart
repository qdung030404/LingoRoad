part of 'learning_workflow_test.dart';

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
  bool failCancel = false;
  bool dropCheckResponse = false;
  int checks = 0;
  int progressCalls = 0;
  Json? nextSubmitLevelChange;
  final List<String> cancelledIds = [];
  int _seq = 1;
  Completer<void>? delayed;
  final Map<String, String> questionEvidence = {};
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
    progressCalls++;
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
      if (questionEvidence[questionId] case final String evidence)
        'evidence': evidence,
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
        (state['questions'] as List).length) {
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
    final out = snapshot();
    if (nextSubmitLevelChange != null) {
      out.json['levelChange'] = copy(nextSubmitLevelChange!);
      nextSubmitLevelChange = null;
    }
    return out;
  }

  @override
  Future<void> cancel(String id) async {
    if (offline || failCancel) throw const ApiFailure('Offline');
    cancelledIds.add(id);
    state['id'] = 'attempt-${++_seq}';
    state['version'] = 0;
    state['status'] = 'IN_PROGRESS';
    state['position'] = {
      'phase': ((state['content'] as Json)['steps'] as List).isNotEmpty
          ? 'STUDY'
          : 'QUIZ',
      'index': 0,
    };
    state['answers'] = [];
    state['result'] = null;
  }

  @override
  Future<Json> catalogue() async => {'items': []};

  @override
  Future<Json> lesson(String lessonId) async => {
    ...(state['lesson'] as Json),
    'content': state['content'],
  };
  @override
  Future<Json> explainAnswer(String id, String questionId) async {
    explainCalls++;
    if (explainHandler != null) return explainHandler!(id, questionId);
    return {
      'questionId': questionId,
      'explanation': 'Server explanation',
      'source': 'CURRICULUM',
    };
  }

  int explainCalls = 0;
  Future<Json> Function(String id, String questionId)? explainHandler;

  final historyRows = <Json>[];
  final hiddenHistoryIds = <String>[];
  final hiddenHistoryBatches = <List<String>>[];

  @override
  Future<void> hideHistory(String id) async {
    if (offline) throw const ApiFailure('Offline');
    hiddenHistoryIds.add(id);
    historyRows.removeWhere((item) => item['id'] == id);
  }

  @override
  Future<void> hideHistoryBatch(List<String> ids) async {
    if (offline) throw const ApiFailure('Offline');
    hiddenHistoryBatches.add(List.of(ids));
    historyRows.removeWhere((item) => ids.contains(item['id']));
  }

  @override
  Future<Json> history({String? cursor, String? kind}) async => {
    'items': List<Json>.of(historyRows),
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
  Future<Json> history({String? cursor, String? kind}) {
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


class _MemoryVocabularyRepository implements VocabularyRepository {
  @override
  Future<Json> uploadImage(String filePath) =>
      throw UnsupportedError('Unexpected image upload');

  final List<Json> activeItems = [];
  final List<Json> savedBodies = [];
  Completer<void>? delayedGetReadingWords;

  @override
  Future<Json> request(String method, String path, {Json? body}) async {
    if (method == 'GET' && path == '/vocabulary/reading-words') {
      final snapshot = [for (final item in activeItems) copy(item)];
      await delayedGetReadingWords?.future;
      return {
        'deck': {'id': 'reading-deck', 'name': 'Từ vựng Bài đọc'},
        'items': snapshot,
      };
    }
    if (method == 'POST' && path == '/vocabulary/reading-words') {
      final entry = copy(body ?? {});
      savedBodies.add(entry);
      activeItems.add({
        'id': 'word-${savedBodies.length}',
        'english': entry['english'],
        'meaning': entry['meaning'],
        'phonetic': entry['phonetic'],
      });
      return {
        'receipt': {'commandId': entry['commandId']},
        'deck': {'id': 'reading-deck', 'name': 'Từ vựng Bài đọc'},
        'word': copy(activeItems.last),
        'alreadyExisted': false,
      };
    }
    if (method == 'GET' && path == '/vocabulary/summary') {
      return {
        'deckCount': 1,
        'wordCount': activeItems.length,
        'dueCount': 0,
        'masteredCount': 0,
      };
    }
    if (method == 'GET' && path.startsWith('/vocabulary/decks')) {
      return {'items': [], 'nextCursor': null};
    }
    return {};
  }
}

class _MemoryDailyRepository implements DailyRepository {
  final List<String> openedAttempts = [];
  final List<Json> sentSegments = [];
  String? lastSessionId;

  @override
  Future<Json> openActivity(String attemptId, String runId) async {
    openedAttempts.add(attemptId);
    lastSessionId = runId;
    return {
      'sessionId': runId,
      'anchorAt': '2026-11-02T00:00:00Z',
      'serverNow': '2026-11-02T00:00:00Z',
      'collectUntil': '2026-11-03T00:00:00Z',
      'uploadUntil': '2026-11-09T00:00:00Z',
    };
  }

  @override
  Future<Json> sendSegments(String sessionId, List<Json> segments) async {
    sentSegments.addAll(segments);
    return {
      'acks': [
        for (final row in segments) {'seq': row['seq']},
      ],
    };
  }

  @override
  Future<Json> ensurePlan() async => {'plan': null};

  @override
  Future<Json> preferences() async => {
    'version': 0,
    'dailyGoalMinutes': 10,
    'preferredKinds': ['READING'],
  };

  @override
  Future<Json> progress() async => {
    'today': {'activeSeconds': 0, 'goalMet': false},
    'days': [],
    'totals': {},
  };

  @override
  Future<Json> savePreferences(Json body) async => body;
}
