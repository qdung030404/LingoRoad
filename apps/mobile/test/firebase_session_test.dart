import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/auth/auth_identity.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/learning/preview_model.dart';
import 'package:mobile/features/learning/word_library.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_client_test.dart' show StubAdapter, response;
import 'test_helpers.dart';

class FakeIdentity implements AuthIdentity {
  bool active = true;
  int refreshes = 0, logouts = 0, googleCalls = 0;
  String? resetEmail;
  ApiFailure? initializationFailure;
  Future<String?> Function()? refreshToken;
  final changes = StreamController<String?>.broadcast();
  @override
  Future<void> initialize() async {
    if (initializationFailure != null) throw initializationFailure!;
  }

  @override
  bool get signedIn => active;
  @override
  Stream<String?> get userChanges => changes.stream;
  @override
  Future<String?> idToken({bool forceRefresh = false}) async {
    if (forceRefresh) {
      refreshes++;
      return refreshToken == null ? 'new' : refreshToken!();
    }
    return active ? 'old' : null;
  }

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
    googleCalls++;
    active = true;
  }

  @override
  Future<void> resetPassword(String email) async {
    resetEmail = email;
  }

  @override
  Future<void> signOut() async {
    logouts++;
    active = false;
    changes.add(null);
  }
}

void main() {
  ApiClient client(
    FakeIdentity identity,
    Future<ResponseBody> Function(RequestOptions) respond,
  ) => ApiClient(
    config: AppConfig(),
    store: MemoryTokenStore(),
    identity: identity,
    dio: Dio()..httpClientAdapter = StubAdapter(respond),
  );
  FakeIdentity identity() {
    final result = FakeIdentity();
    addTearDown(result.changes.close);
    return result;
  }

  test(
    'Missing Firebase config and signed-out SDK never fall back to legacy credentials',
    () async {
      final auth = identity()
        ..initializationFailure = const ApiFailure(
          'Missing configuration',
          code: 'AUTH_CONFIGURATION',
        );
      var requests = 0;
      final api = client(auth, (_) async {
        requests++;
        return response({});
      });
      await api.store.write('old-legacy-refresh');
      final session = SessionController(api);
      addTearDown(session.dispose);
      await session.initialize();
      expect(session.stage, SessionStage.signedOut);
      expect(session.error, 'Missing configuration');
      auth.initializationFailure = null;
      auth.active = false;
      await session.initialize();
      expect(session.stage, SessionStage.signedOut);
      expect(requests, 0);
    },
  );

  test(
    'Firebase concurrent 401 refreshes once without using the Nest refresh API',
    () async {
      final auth = identity();
      auth.refreshToken = () async {
        await Future<void>.delayed(const Duration(milliseconds: 10));
        return 'new';
      };
      final paths = <String>[];
      final api = client(auth, (options) async {
        paths.add(options.path);
        return response({
          'ok': true,
        }, options.headers['Authorization'] == 'Bearer new' ? 200 : 401);
      });
      final results = await Future.wait([
        api.request('GET', '/one'),
        api.request('GET', '/two'),
      ]);
      expect(results.every((r) => r['ok'] == true), isTrue);
      expect(auth.refreshes, 1);
      expect(paths.any((p) => p.contains('/auth/refresh')), isFalse);
    },
  );

  test(
    'Revoked Firebase credentials sign out, while a network failure preserves identity',
    () async {
      final auth = identity();
      final api = client(auth, (_) async => response({}, 401));
      var expired = false;
      api.onUnauthorized = () => expired = true;
      await expectLater(
        api.request('GET', '/auth/me'),
        throwsA(isA<ApiFailure>()),
      );
      expect(auth.logouts, 1);
      expect(expired, isTrue);

      final offline = identity();
      final session = SessionController(
        client(offline, (o) async => throw DioException(requestOptions: o)),
      );
      addTearDown(session.dispose);
      await session.initialize();
      expect(session.stage, SessionStage.error);
      expect(offline.signedIn, isTrue);
      expect(offline.logouts, 0);
    },
  );

  test(
    'Logout during Firebase token refresh cannot retry or restore the old token',
    () async {
      final auth = identity();
      final pending = Completer<String?>();
      final started = Completer<void>();
      auth.refreshToken = () {
        started.complete();
        return pending.future;
      };
      var requests = 0;
      final api = client(auth, (_) async {
        requests++;
        return response({}, 401);
      });
      final request = api.request('GET', '/auth/me');
      final expectation = expectLater(
        request,
        throwsA(
          isA<ApiFailure>().having(
            (e) => e.code,
            'code',
            'AUTH_SESSION_CHANGED',
          ),
        ),
      );
      await started.future;
      await api.clearSession();
      pending.complete('stale');
      await expectation;
      expect(api.accessToken, isNull);
      expect(requests, 1);
    },
  );

  test(
    'SDK restore loads account, onboarding and placement result; Google uses the same route',
    () async {
      final auth = identity();
      final paths = <String>[];
      final api = client(auth, (o) async {
        paths.add(o.path);
        if (o.path.endsWith('/auth/me')) {
          return response({
            'id': 'uuid',
            'name': 'Hung',
            'profile': {
              'onboardingCompletedAt': 'today',
              'dailyGoalMinutes': 20,
            },
          });
        }
        if (o.path.endsWith('/placement/status')) {
          return response({
            'status': 'COMPLETED',
            'currentSessionId': 'session',
          });
        }
        return response(testResult());
      });
      final session = SessionController(api);
      addTearDown(session.dispose);
      await session.initialize();
      expect(session.stage, SessionStage.ready);
      expect(session.user!['name'], 'Hung');
      expect(session.placementResult!['estimatedCefr'], 'B1');
      await session.logout();
      expect(session.placementResult, isNull);
      await session.signInWithGoogle();
      expect(auth.googleCalls, 1);
      expect(session.stage, SessionStage.ready);
      await session.resetPassword('hung@example.com');
      expect(auth.resetEmail, 'hung@example.com');
      expect(
        paths.any(
          (p) => p.endsWith('/auth/login') || p.endsWith('/auth/register'),
        ),
        isFalse,
      );
    },
  );

  test('Logout ignores a late account response', () async {
    final auth = identity();
    final pending = Completer<ResponseBody>();
    final started = Completer<void>();
    final session = SessionController(
      client(auth, (_) {
        started.complete();
        return pending.future;
      }),
    );
    addTearDown(session.dispose);
    final restore = session.initialize();
    await started.future;
    await session.logout();
    pending.complete(response({'id': 'previous-user'}));
    await restore;
    expect(session.stage, SessionStage.signedOut);
    expect(session.user, isNull);
  });

  test(
    'Account local vocabulary and drafts are isolated from other accounts and guests',
    () async {
      SharedPreferences.setMockInitialValues({});
      final a = WordLibrary(accountId: 'a');
      final b = WordLibrary(accountId: 'b');
      final guest = WordLibrary();
      for (final library in [a, b, guest]) {
        addTearDown(library.dispose);
        await library.restore();
      }
      await a.rate(a.decks.first.words.first, 'hard');
      final restored = WordLibrary(accountId: 'a');
      addTearDown(restored.dispose);
      await restored.restore();
      expect(restored.ratings, a.ratings);
      expect(b.ratings, isEmpty);
      expect(guest.ratings, isEmpty);
      final model = PreviewModel(accountId: 'a', initialDailyMinutes: 20);
      final other = PreviewModel(accountId: 'b');
      addTearDown(model.dispose);
      addTearDown(other.dispose);
      await model.restore();
      expect(model.dailyMinutes, 20);
      await model.saveDraft(0, 'Private draft');
      await other.restore();
      expect(other.drafts[0], isEmpty);
    },
  );
}
