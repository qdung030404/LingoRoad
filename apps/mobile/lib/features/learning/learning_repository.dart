import '../../core/api/api_client.dart';

List<Json> learningItems(dynamic value) => (value as List? ?? const [])
    .map((e) => Map<String, dynamic>.from(e as Map))
    .toList();

class LearningLesson {
  LearningLesson(this.json);
  final Json json;
  String get id => json['id'] as String;
  String get title => json['title'] as String;
  String get kind => json['kind'] as String;
  String? get cefrLevel => json['cefrLevel'] as String?;
  String? get coverImageUrl => json['coverImageUrl'] as String?;
  String get description => json['description'] as String? ?? '';
  int get minutes => json['estimatedMinutes'] as int? ?? 0;
  int get questionCount => json['questionCount'] as int? ?? 5;
  String get state => json['state'] as String? ?? 'NOT_STARTED';
  String? get activeAttemptId => json['activeAttemptId'] as String?;
}

class LearningAttempt {
  LearningAttempt(this.json);
  final Json json;
  String get id => json['id'] as String;
  int get version => json['version'] as int;
  bool get completed => json['status'] == 'COMPLETED';
  LearningLesson get lesson =>
      LearningLesson(Map<String, dynamic>.from(json['lesson'] as Map));
  Json get position => Map<String, dynamic>.from(json['position'] as Map);
  String get phase => position['phase'] as String;
  int get index => position['index'] as int;
  Json get content => Map<String, dynamic>.from(json['content'] as Map);
  List<Json> get steps => learningItems(content['steps']);
  List<Json> get questions => learningItems(json['questions']);
  List<Json> get answers => learningItems(json['answers']);
  Json? get levelChange =>
      (json['levelChange'] as Map?)?.cast<String, dynamic>();
  Json? answer(String questionId) {
    for (final a in answers) {
      if (a['questionId'] == questionId) return a;
    }
    return null;
  }

  bool get allChecked =>
      questions.isNotEmpty &&
      questions.every((q) => answer(q['id'] as String)?['checked'] == true);
}

abstract class LearningRepository {
  Future<Json> catalogue();
  Future<Json> lesson(String lessonId);
  Future<Json> summary();
  Future<LearningAttempt> start(String lessonId);
  Future<LearningAttempt> attempt(String id);
  Future<LearningAttempt> progress(String id, Json body);
  Future<LearningAttempt> check(String id, String questionId, Json body);
  Future<LearningAttempt> submit(String id, int version);
  Future<void> cancel(String id);
  Future<Json> explainAnswer(String id, String questionId);
  Future<Json> history({String? cursor, String? kind});
  Future<void> hideHistory(String id);
  Future<void> hideHistoryBatch(List<String> ids);
  String audioUrl(String path);
}

class ApiLearningRepository implements LearningRepository {
  ApiLearningRepository(this.api);
  final ApiClient api;
  @override
  Future<Json> catalogue() => api.request('GET', '/learning/lessons');
  @override
  Future<Json> lesson(String lessonId) =>
      api.request('GET', '/learning/lessons/$lessonId');
  @override
  Future<Json> summary() => api.request('GET', '/learning/summary');
  Future<Json> home() => api.request('GET', '/learning/home');
  @override
  Future<LearningAttempt> start(String lessonId) async => LearningAttempt(
    await api.request('POST', '/learning/lessons/$lessonId/attempts', data: {}),
  );
  @override
  Future<LearningAttempt> attempt(String id) async =>
      LearningAttempt(await api.request('GET', '/learning/attempts/$id'));
  @override
  Future<LearningAttempt> progress(String id, Json body) async =>
      LearningAttempt(
        await api.request(
          'PATCH',
          '/learning/attempts/$id/progress',
          data: body,
        ),
      );
  @override
  Future<LearningAttempt> check(
    String id,
    String questionId,
    Json body,
  ) async => LearningAttempt(
    await api.request(
      'PUT',
      '/learning/attempts/$id/answers/$questionId/check',
      data: body,
    ),
  );
  @override
  Future<LearningAttempt> submit(String id, int version) async =>
      LearningAttempt(
        await api.request(
          'POST',
          '/learning/attempts/$id/submit',
          data: {'expectedVersion': version},
        ),
      );
  @override
  Future<void> cancel(String id) async {
    await api.request('DELETE', '/learning/attempts/$id');
  }

  @override
  Future<Json> explainAnswer(String id, String questionId) => api.request(
    'POST',
    '/learning/attempts/$id/answers/$questionId/explain',
    data: {},
  );
  @override
  Future<Json> history({String? cursor, String? kind}) => api.request(
    'GET',
    Uri(
      path: '/learning/history',
      queryParameters: {'limit': '20', 'cursor': ?cursor, 'kind': ?kind},
    ).toString(),
  );
  @override
  Future<void> hideHistory(String id) async {
    await api.request('DELETE', '/learning/history/$id');
  }

  @override
  Future<void> hideHistoryBatch(List<String> ids) async {
    await api.request(
      'POST',
      '/learning/history/hide',
      data: {'attemptIds': ids},
    );
  }

  @override
  String audioUrl(String path) => api.config.resolve(path).toString();
}
