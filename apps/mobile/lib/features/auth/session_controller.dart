import 'package:flutter/foundation.dart';
import 'dart:async';
import '../../core/api/api_client.dart';
import '../../core/auth/firebase_identity.dart';
import '../learning/home_cache.dart';

enum SessionStage { loading, signedOut, onboarding, ready, error }

class SessionController extends ChangeNotifier {
  SessionController(this.api) {
    api.onUnauthorized = () {
      _resetAccount(null);
      stage = SessionStage.signedOut;
      notifyListeners();
    };
  }

  final ApiClient api;
  SessionStage stage = SessionStage.loading;
  bool isAuthenticatingGoogle = false;
  Json? user;
  Json placement = {};
  Json? placementResult;
  bool _disposed = false;
  int _epoch = 0;
  String? _currentUid;
  StreamSubscription<String?>? _authChanges;
  String? error;
  HomeCache? _homeCache;
  Json? cachedHome;
  Future<void>? _bootstrapping;
  Future<void> _cacheOperations = Future.value();
  Future<void> Function(String accountId)? onAccountCleared;
  Future<void> Function(String accountId, Json profile)? onAccountReady;

  void _notifyAccountReady() {
    if (stage != SessionStage.ready) return;
    final callback = onAccountReady;
    final accountId = user?['id'];
    if (callback == null || accountId is! String || accountId.isEmpty) return;
    unawaited(
      Future<void>.sync(
        () => callback(accountId, profile),
      ).catchError((Object _) {}),
    );
  }

  bool get hasCompletedPlacement =>
      placement['hasCompleted'] == true || placement['status'] == 'COMPLETED';

  String? get placementCefr =>
      (placement['estimatedCefr'] ?? placementResult?['estimatedCefr'])
          as String?;

  void _cacheOperation(Future<void> Function() operation) {
    _cacheOperations = _cacheOperations
        .then((_) => operation())
        .catchError((Object _) {});
  }

  void clearHome() {
    cachedHome = null;
    final store = _homeCache;
    if (store != null) _cacheOperation(store.clear);
  }

  void rejectHomeSession() {
    if (_disposed || stage == SessionStage.signedOut) return;
    _resetAccount(null);
    stage = SessionStage.signedOut;
    notifyListeners();
    unawaited(api.clearSession().catchError((Object _) {}));
  }

  void rememberHome(Json snapshot) {
    if (_disposed ||
        stage != SessionStage.ready ||
        !validHomeSnapshot(snapshot)) {
      return;
    }
    cachedHome = snapshot;
    final store = _homeCache;
    if (store != null) _cacheOperation(() => store.write(snapshot));
  }

  void _resetAccount(String? uid) {
    final previousAccountId = (user?['id'] as String?) ?? _currentUid;
    if (previousAccountId != null && onAccountCleared != null) {
      unawaited(
        onAccountCleared!(previousAccountId).catchError((Object _) {}),
      );
    }
    clearHome();
    _homeCache = null;
    _currentUid = uid;
    _epoch++;
    _bootstrapping = null;
    api.invalidateSessionRequests();
    user = null;
    placement = {};
    placementResult = null;
  }

  Future<void> _restoreHome(FirebaseIdentity identity, int epoch) async {
    final uid = _currentUid;
    final project = identity.projectId;
    if (uid == null || project == null) return;
    final store = _homeCache ??= HomeCache(
      server: api.config.apiBaseUrl,
      project: project,
      uid: uid,
    );
    await _cacheOperations;
    final saved = await store.read();
    if (_disposed ||
        epoch != _epoch ||
        !identical(_homeCache, store) ||
        stage == SessionStage.signedOut ||
        stage == SessionStage.onboarding) {
      return;
    }
    if (cachedHome == null && saved != null) {
      cachedHome = saved;
      notifyListeners();
    }
  }

  Json get profile => (user?['profile'] as Map?)?.cast<String, dynamic>() ?? {};
  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _epoch++;
    api.onUnauthorized = null;
    _authChanges?.cancel();
    super.dispose();
  }

  Future<void> authenticateWithGoogle() async {
    if (_disposed || isAuthenticatingGoogle || stage == SessionStage.loading) {
      return;
    }
    isAuthenticatingGoogle = true;
    error = null;
    notifyListeners();

    try {
      if (kDebugMode) {
        debugPrint('[SessionController] Bắt đầu authenticateWithGoogle...');
      }
      await signInWithGoogle();
      if (kDebugMode) {
        debugPrint('[SessionController] authenticateWithGoogle thành công!');
      }
    } on ApiFailure catch (e, st) {
      if (kDebugMode) {
        debugPrint(
          '[SessionController] ❌ ApiFailure: code=${e.code}, message=${e.message}, status=${e.status}',
        );
        debugPrint('[SessionController] StackTrace:\n$st');
      }
      if (!_disposed && e.code != 'AUTH_CANCELLED') error = e.message;
    } catch (e, st) {
      if (kDebugMode) {
        debugPrint('[SessionController] ❌ Exception: $e (${e.runtimeType})');
        debugPrint('[SessionController] StackTrace:\n$st');
      }
      if (_disposed) return;
      error = 'Đăng nhập Google thất bại. Vui lòng thử lại.';
    } finally {
      isAuthenticatingGoogle = false;
      notifyListeners();
    }
  }

  Future<void> initialize() {
    if (_disposed) return Future.value();
    return _bootstrapping ??= _initializeOnce(++_epoch);
  }

  Future<void> _initializeOnce(int epoch) async {
    // Yield so the shared future is installed before observers can re-enter.
    await Future<void>.value();
    if (_disposed || epoch != _epoch) return;
    stage = SessionStage.loading;
    error = null;
    notifyListeners();
    try {
      if (api.identity != null) {
        final identity = api.identity!;
        await identity.initialize();
        if (_disposed || epoch != _epoch) return;
        if (identity is FirebaseIdentity) {
          final uid = identity.currentUid;
          if (_currentUid != null && uid != _currentUid) {
            _resetAccount(uid);
            if (uid != null) {
              await initialize();
            } else {
              stage = SessionStage.signedOut;
              notifyListeners();
            }
            return;
          }
          _currentUid = uid;
          unawaited(_restoreHome(identity, epoch));
        }
        _authChanges ??= identity.userChanges.listen((uid) {
          if (uid == _currentUid || _disposed) return;
          _resetAccount(uid);
          if (uid == null) {
            stage = SessionStage.signedOut;
            notifyListeners();
          } else {
            unawaited(initialize());
          }
        });
        if (!identity.signedIn) {
          stage = SessionStage.signedOut;
          notifyListeners();
          return;
        }
      } else if (api.accessToken == null) {
        if (await api.store.read() == null) {
          stage = SessionStage.signedOut;
          notifyListeners();
          return;
        }
        await api.refresh();
      }
      if (_disposed || epoch != _epoch) return;
      await loadAccount(epoch: epoch);
    } on ApiFailure catch (e) {
      if (_disposed || epoch != _epoch) return;
      final shouldSignOut =
          e.unauthorized ||
          e.status == 403 ||
          e.status == 409 ||
          e.code == 'AUTH_ACCOUNT_LINK_REQUIRED';
      if (shouldSignOut) {
        _resetAccount(null);
        final rejectedEpoch = _epoch;
        if (!e.unauthorized) error = e.message;
        stage = SessionStage.signedOut;
        notifyListeners();
        await api.clearSession();
        if (_disposed || rejectedEpoch != _epoch) return;
      } else {
        error = e.message;
        stage = e.code == 'AUTH_CONFIGURATION'
            ? SessionStage.signedOut
            : SessionStage.error;
      }
      notifyListeners();
    } catch (_) {
      if (_disposed || epoch != _epoch) return;
      error = 'Không đọc được phiên đăng nhập. Vui lòng thử lại.';
      stage = SessionStage.error;
      notifyListeners();
    } finally {
      if (epoch == _epoch) _bootstrapping = null;
    }
  }

  Future<void> authenticate({
    required String email,
    required String password,
    String? name,
  }) async {
    if (api.identity != null) {
      await api.identity!.authenticate(
        email: email,
        password: password,
        name: name,
      );
      await initialize();
      return;
    }
    final tokens = await api.request(
      'POST',
      name == null ? '/auth/login' : '/auth/register',
      data: {
        'email': email.trim(),
        'password': password,
        if (name != null) 'name': name.trim(),
      },
      auth: false,
    );
    await api.acceptTokens(tokens);
    await initialize();
  }

  Future<void> signInWithGoogle() async {
    if (api.identity == null) {
      if (kDebugMode) {
        debugPrint(
          '[SessionController] ❌ signInWithGoogle: api.identity == null (chưa khởi tạo Firebase)',
        );
      }
      throw const ApiFailure('Google yêu cầu cấu hình Firebase.');
    }
    if (kDebugMode) {
      debugPrint('[SessionController] Gọi api.identity.signInWithGoogle()...');
    }
    await api.identity!.signInWithGoogle();
    if (kDebugMode) {
      debugPrint(
        '[SessionController] api.identity.signInWithGoogle() xong, gọi initialize()...',
      );
    }
    await initialize();
  }

  Future<void> resetPassword(String email) async {
    if (api.identity == null) {
      throw const ApiFailure('Khôi phục mật khẩu yêu cầu cấu hình Firebase.');
    }
    await api.identity!.resetPassword(email);
  }

  Future<void> loadAccount({int? epoch}) async {
    final expected = epoch ?? _epoch;
    if (kDebugMode) {
      debugPrint(
        '[SessionController] loadAccount: Gọi song song GET /auth/me và GET /placement/status...',
      );
    }
    final results = await Future.wait([
      api.request('GET', '/auth/me'),
      api.request('GET', '/placement/status'),
    ]);
    final account = results[0];
    final assessment = results[1];
    if (kDebugMode) {
      debugPrint(
        '[SessionController] GET /auth/me thành công: ID=${account['id'] ?? account['sub']}',
      );
    }
    // Older servers returned only the session ID.
    final completedSessionId =
        (assessment['completedSessionId'] ??
                (assessment['status'] == 'COMPLETED'
                    ? assessment['currentSessionId']
                    : null))
            as String?;
    final result =
        completedSessionId != null &&
            !assessment.containsKey('estimatedCefr')
        ? await api.request(
            'GET',
            '/placement/$completedSessionId/result',
          )
        : null;
    if (_disposed || expected != _epoch) return;
    user = account;
    placement = assessment;
    placementResult = result;
    stage = profile['onboardingCompletedAt'] == null
        ? SessionStage.onboarding
        : SessionStage.ready;
    final completedPlacement =
        assessment['hasCompleted'] == true ||
        assessment['status'] == 'COMPLETED';
    if (stage != SessionStage.ready || !completedPlacement) {
      clearHome();
    }
    error = null;
    notifyListeners();
    _notifyAccountReady();
  }

  Future<void> saveProfile(Json updates) async {
    final epoch = _epoch;
    final account = await api.request('PATCH', '/auth/me', data: updates);
    if (_disposed || epoch != _epoch) return;
    user = account;
    stage = profile['onboardingCompletedAt'] == null
        ? SessionStage.onboarding
        : SessionStage.ready;
    notifyListeners();
    _notifyAccountReady();
  }

  Future<Json> saveLearningGoals({
    required int expectedVersion,
    required String learningPurpose,
    required String targetCefr,
    required int dailyGoalMinutes,
    required List<String> preferredKinds,
  }) async {
    final epoch = _epoch;
    final saved = await api.request(
      'PATCH',
      '/learning/preferences',
      data: {
        'expectedVersion': expectedVersion,
        'learningPurpose': learningPurpose,
        'targetCefr': targetCefr,
        'dailyGoalMinutes': dailyGoalMinutes,
        'preferredKinds': preferredKinds,
      },
    );
    if (!_disposed && epoch == _epoch) {
      applyGoalSnapshot(saved);
    }
    return saved;
  }

  void applyGoalSnapshot(Json snapshot) {
    if (_disposed) return;
    final currentUser = user;
    if (currentUser != null) {
      final updatedProfile = {
        ...profile,
        if (snapshot.containsKey('learningPurpose'))
          'learningPurpose': snapshot['learningPurpose'],
        if (snapshot.containsKey('targetCefr'))
          'targetCefr': snapshot['targetCefr'],
        if (snapshot.containsKey('dailyGoalMinutes'))
          'dailyGoalMinutes': snapshot['dailyGoalMinutes'],
        if (snapshot.containsKey('preferredKinds'))
          'preferredKinds': snapshot['preferredKinds'],
        if (snapshot['version'] is int)
          'preferencesVersion': snapshot['version'],
      };
      user = {...currentUser, 'profile': updatedProfile};
    }
    clearHome();
    notifyListeners();
  }

  void acceptPlacementResult(String sessionId, Json result) {
    if (_disposed) return;
    placementResult = result;
    placement = {
      ...placement,
      'hasCompleted': true,
      'status': 'COMPLETED',
      'currentSessionId': sessionId,
      'completedSessionId': sessionId,
      if (result['estimatedCefr'] != null)
        'estimatedCefr': result['estimatedCefr'],
      if (result['skills'] != null) 'skillResults': result['skills'],
    };
    clearHome();
    notifyListeners();
  }

  Future<void> refreshPlacement() async {
    final epoch = _epoch;
    final assessment = await api.request('GET', '/placement/status');
    if (_disposed || epoch != _epoch) return;
    final oldCompletedId =
        placement['completedSessionId'] ??
        (placement['status'] == 'COMPLETED'
            ? placement['currentSessionId']
            : null);
    final newCompletedId =
        assessment['completedSessionId'] ??
        (assessment['status'] == 'COMPLETED'
            ? assessment['currentSessionId']
            : null);
    if (oldCompletedId != newCompletedId ||
        placement['estimatedCefr'] != assessment['estimatedCefr']) {
      clearHome();
      placementResult = null;
    }
    placement = assessment;
    notifyListeners();
  }

  Future<void> logout() async {
    _resetAccount(null);
    stage = SessionStage.signedOut;
    notifyListeners();
    try {
      if (api.identity != null) return;
      final token = await api.store.read();
      if (token != null) {
        await api.request(
          'POST',
          '/auth/logout',
          data: {'refreshToken': token},
        );
      }
    } catch (_) {
      // Local logout remains available without a network connection.
    } finally {
      try {
        await api.clearSession();
      } finally {
        user = null;
        placement = {};
        placementResult = null;
        stage = SessionStage.signedOut;
        notifyListeners();
      }
    }
  }
}
