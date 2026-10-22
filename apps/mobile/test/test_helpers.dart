import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/config/app_config.dart';

class MemoryTokenStore implements TokenStore {
  MemoryTokenStore([this.token]);
  String? token;
  @override
  Future<String?> read() async => token;
  @override
  Future<void> write(String token) async => this.token = token;
  @override
  Future<void> clear() async => token = null;
}

Json testItem([int index = 0]) => {
  'id': 'item-$index',
  'index': index,
  'type': 'MULTIPLE_CHOICE',
  'skill': index < 5 ? 'READING' : 'LISTENING',
  'sectionIndex': index % 5,
  'sectionTotal': 5,
  'prompt': 'Where does Anna live?',
  'passage': index < 5 ? 'Anna lives in Hanoi.' : null,
  'mediaUrl': null,
  'options': ['Hanoi', 'Hue', 'London', 'Paris'],
};

Json testResult() => {
  'sessionId': 'session',
  'estimatedCefr': 'B1',
  'correctCount': 7,
  'totalItems': 10,
  'completionRate': 1,
  'confidenceScore': null,
  'resultStatus': 'PROVISIONAL',
  'scoringMethod': 'PROVISIONAL_RATIO_V1',
  'skills': {
    'reading': {
      'estimatedCefr': 'B1',
      'correctCount': 4,
      'totalItems': 5,
      'status': 'PROVISIONAL',
    },
    'listening': {
      'estimatedCefr': 'A2',
      'correctCount': 3,
      'totalItems': 5,
      'status': 'PROVISIONAL',
    },
    'speaking': {'estimatedCefr': null, 'status': 'NOT_ASSESSED'},
    'writing': {'estimatedCefr': null, 'status': 'NOT_ASSESSED'},
  },
};

class FakeApi extends ApiClient {
  FakeApi({
    bool signedIn = false,
    bool onboarding = false,
    bool completed = false,
  }) : super(
         config: AppConfig(),
         store: MemoryTokenStore(signedIn ? 'refresh' : null),
       ) {
    if (signedIn) accessToken = 'access';
    profile = {
      'dailyGoalMinutes': 10,
      'learningPurpose': onboarding ? null : 'EXAM',
      'selfAssessedCefr': null,
      'onboardingCompletedAt': onboarding ? null : '2026-10-19T00:00:00Z',
    };
    status = completed ? 'COMPLETED' : null;
  }
  late Json profile;
  String? status;
  int index = 0;
  bool failAnswer = false;
  final List<Json> submitted = [];
  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
  }) async {
    if (path == '/auth/login' || path == '/auth/register') {
      return {'accessToken': 'access', 'refreshToken': 'refresh'};
    }
    if (path == '/auth/me') {
      if (method == 'PATCH') profile.addAll(data!);
      if (method == 'PATCH') {
        profile['onboardingCompletedAt'] = '2026-10-19T00:00:00Z';
      }
      return {
        'id': 'user',
        'name': data?['name'] ?? 'Anna',
        'email': 'anna@example.com',
        'profile': profile,
      };
    }
    if (path == '/placement/status') {
      return {
        'status': status,
        'currentIndex': index,
        'currentSessionId': 'session',
        'totalItems': 10,
      };
    }
    if (path == '/placement/start') {
      status = 'IN_PROGRESS';
      return {
        'sessionId': 'session',
        'totalItems': 10,
        'firstItem': testItem(index),
      };
    }
    if (path.endsWith('/answer')) {
      if (failAnswer) throw const ApiFailure('Mất kết nối. Thử lại.');
      submitted.add(Map.of(data!));
      index++;
      if (index == 10) {
        status = 'COMPLETED';
        return {'isFinished': true, 'result': testResult()};
      }
      return {'isFinished': false, 'nextItem': testItem(index)};
    }
    if (path.endsWith('/result')) return testResult();
    if (path.endsWith('/review')) {
      return {
        'status': status,
        'items': [
          if (index > 0)
            {
              ...testItem(),
              'selectedOption': 'Hanoi',
              if (status == 'COMPLETED') ...{
                'correctOption': 'Hanoi',
                'isCorrect': true,
                'explanation': 'The passage mentions Hanoi.',
              },
            },
        ],
      };
    }
    return {};
  }
}
