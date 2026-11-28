import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/auth/auth_identity.dart';

class FakeAuthIdentity implements AuthIdentity {
  FakeAuthIdentity({this.onGoogle});
  final Future<void> Function()? onGoogle;
  bool active = false;
  @override
  bool get signedIn => active;
  @override
  Stream<String?> get userChanges => const Stream.empty();
  @override
  Future<void> initialize() async {}
  @override
  Future<String?> idToken({bool forceRefresh = false}) async =>
      active ? 'firebase-id-token' : null;
  @override
  Future<void> authenticate({
    required String email,
    required String password,
    String? name,
  }) async {
    active = true;
  }

  @override
  Future<void> signInWithGoogle() async {
    await onGoogle?.call();
    active = true;
  }

  @override
  Future<void> resetPassword(String email) async {}
  @override
  Future<void> signOut() async {
    active = false;
  }
}

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
    this.provider = 'LOCAL',
    String displayName = 'Anna',
    this.avatarUrl,
    String? learningPurpose,
    String targetCefr = 'B1',
    int dailyGoalMinutes = 10,
    List<String> preferredKinds = const [
      'GRAMMAR',
      'VOCABULARY',
      'READING',
      'LISTENING',
    ],
    int preferencesVersion = 0,
    bool reminderEnabled = true,
    String reminderTime = '19:30',
    int reminderVersion = 0,
    this.readingLevel,
    super.identity,
  }) : name = displayName,
       super(
         config: AppConfig(),
         store: MemoryTokenStore(signedIn ? 'refresh' : null),
       ) {
    if (signedIn) accessToken = 'access';
    profile = {
      'dailyGoalMinutes': dailyGoalMinutes,
      'learningPurpose': onboarding ? null : (learningPurpose ?? 'EXAM'),
      'targetCefr': targetCefr,
      'preferredKinds': List<String>.from(preferredKinds),
      'preferencesVersion': preferencesVersion,
      'selfAssessedCefr': null,
      'onboardingCompletedAt': onboarding ? null : '2026-10-19T00:00:00Z',
      'reminderEnabled': reminderEnabled,
      'reminderTime': reminderTime,
      'reminderVersion': reminderVersion,
    };
    status = completed ? 'COMPLETED' : null;
    hasCompleted = completed;
  }

  late Json profile;
  String name;
  String? avatarUrl;
  String provider;
  Json? readingLevel;
  String? status;
  late bool hasCompleted;
  int index = 0;
  bool failAnswer = false;
  final List<Json> submitted = [];
  final List<String> requestedPaths = [];

  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Duration? receiveTimeout,
  }) async {
    requestedPaths.add(path);
    if (path == '/auth/login' ||
        path == '/auth/register' ||
        path == '/auth/google') {
      return {'accessToken': 'access', 'refreshToken': 'refresh'};
    }
    if (path == '/auth/me') {
      if (method == 'PATCH' && data != null) {
        final touchesGoals =
            data.containsKey('learningPurpose') ||
            data.containsKey('targetCefr') ||
            data.containsKey('dailyGoalMinutes') ||
            data.containsKey('preferredKinds') ||
            data.containsKey('selfAssessedCefr');
        final completedBefore = profile['onboardingCompletedAt'] != null;
        if (touchesGoals && completedBefore) {
          final exp = data['expectedVersion'];
          if (exp == null) {
            throw const ApiFailure(
              'Cần phiên bản mục tiêu hiện tại.',
              code: 'LEARNING_PREFERENCES_VERSION_REQUIRED',
              status: 400,
            );
          }
          if (exp != profile['preferencesVersion']) {
            throw const ApiFailure(
              'Thiết lập đã thay đổi.',
              code: 'LEARNING_PREFERENCES_CONFLICT',
              status: 409,
            );
          }
        }
        final touchesReminder =
            data.containsKey('reminderEnabled') ||
            data.containsKey('reminderTime');
        if (touchesReminder) {
          final expRem = data['expectedReminderVersion'];
          if (expRem == null) {
            throw const ApiFailure(
              'Cần phiên bản nhắc học.',
              code: 'REMINDER_VERSION_REQUIRED',
              status: 400,
            );
          }
          if (expRem != profile['reminderVersion']) {
            throw const ApiFailure(
              'Cài đặt nhắc học đã được cập nhật bởi thao tác mới hơn.',
              code: 'REMINDER_VERSION_CONFLICT',
              status: 409,
            );
          }
        }
        if (data.containsKey('name')) {
          name = data['name'] as String;
        }
        if (data.containsKey('avatarUrl')) {
          avatarUrl = data['avatarUrl'] as String?;
        }
        final clean = Map<String, dynamic>.from(data)
          ..remove('name')
          ..remove('avatarUrl')
          ..remove('expectedVersion')
          ..remove('expectedReminderVersion');
        if (touchesGoals) {
          profile['preferencesVersion'] =
              (profile['preferencesVersion'] as int? ?? 0) + 1;
        }
        if (touchesReminder) {
          profile['reminderVersion'] =
              (profile['reminderVersion'] as int? ?? 0) + 1;
        }
        profile.addAll(clean);
        profile['onboardingCompletedAt'] ??= '2026-10-19T00:00:00Z';
      }
      return {
        'id': 'user',
        'name': name,
        'avatarUrl': avatarUrl,
        'email': 'anna@example.com',
        'provider': provider,
        'profile': Map<String, dynamic>.from(profile),
      };
    }
    if (path == '/learning/preferences') {
      if (method == 'PATCH' && data != null) {
        if (data['expectedVersion'] != profile['preferencesVersion']) {
          throw const ApiFailure(
            'Thiết lập đã thay đổi. Hãy tải lại trước khi lưu.',
            code: 'LEARNING_PREFERENCES_CONFLICT',
            status: 409,
          );
        }
        if (data.containsKey('learningPurpose')) {
          profile['learningPurpose'] = data['learningPurpose'];
        }
        if (data.containsKey('targetCefr')) {
          profile['targetCefr'] = data['targetCefr'];
        }
        profile['dailyGoalMinutes'] = data['dailyGoalMinutes'];
        profile['preferredKinds'] = List<String>.from(
          data['preferredKinds'] as List,
        );
        profile['preferencesVersion'] =
            (profile['preferencesVersion'] as int? ?? 0) + 1;
      }
      return {
        'learningPurpose': profile['learningPurpose'],
        'targetCefr': profile['targetCefr'],
        'dailyGoalMinutes': profile['dailyGoalMinutes'],
        'preferredKinds': List<String>.from(
          profile['preferredKinds'] as List? ?? const [],
        ),
        'version': profile['preferencesVersion'],
        if (method == 'GET')
          'readingLevel':
              readingLevel ??
              {
                'cefrLevel': status == 'COMPLETED' ? 'B1' : 'A1',
                'source': status == 'COMPLETED' ? 'PLACEMENT' : 'DEFAULT',
              },
      };
    }
    if (path == '/placement/status') {
      final isRetaking = hasCompleted && status != 'COMPLETED';
      return {
        'hasCompleted': hasCompleted,
        'status': status,
        'currentIndex': index,
        'currentSessionId': isRetaking ? 'retake-session' : 'session',
        if (hasCompleted) 'completedSessionId': 'session',
        'totalItems': 10,
        if (isRetaking) ...{
          'estimatedCefr': 'B1',
          'skillResults': testResult()['skills'],
        },
      };
    }
    if (path == '/placement/start') {
      if (status != 'IN_PROGRESS') index = 0;
      status = 'IN_PROGRESS';
      return {
        'sessionId': hasCompleted ? 'retake-session' : 'session',
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
        hasCompleted = true;
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
