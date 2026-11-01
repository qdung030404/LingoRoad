import 'package:flutter/foundation.dart';
import 'dart:async';
import '../../core/api/api_client.dart';

enum SessionStage { loading, signedOut, onboarding, ready, error }

class SessionController extends ChangeNotifier {
  SessionController(this.api) {
    api.onUnauthorized = () {
      _epoch++;
      user = null;
      placement = {};
      placementResult = null;
      stage = SessionStage.signedOut;
      notifyListeners();
    };
  }
  final ApiClient api;
  SessionStage stage = SessionStage.loading;
  Json? user;
  Json placement = {};
  Json? placementResult;
  bool _disposed = false;
  int _epoch = 0;
  StreamSubscription<String?>? _authChanges;
  String? error;
  Json get profile => (user?['profile'] as Map?)?.cast<String, dynamic>() ?? {};
  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _epoch++;
    _authChanges?.cancel();
    super.dispose();
  }

  Future<void> initialize() async {
    final epoch = ++_epoch;
    stage = SessionStage.loading;
    error = null;
    notifyListeners();
    try {
      if (api.identity != null) {
        await api.identity!.initialize();
        if (_disposed || epoch != _epoch) return;
        _authChanges ??= api.identity!.userChanges.listen((uid) {
          if (uid == null && user != null) {
            _epoch++;
            user = null;
            placement = {};
            placementResult = null;
            stage = SessionStage.signedOut;
            notifyListeners();
          }
        });
        if (!api.identity!.signedIn) {
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
      if (e.unauthorized) {
        await api.clearSession();
        stage = SessionStage.signedOut;
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
      throw const ApiFailure('Google yêu cầu cấu hình Firebase.');
    }
    await api.identity!.signInWithGoogle();
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
    final account = await api.request('GET', '/auth/me');
    final assessment = await api.request('GET', '/placement/status');
    final result = assessment['status'] == 'COMPLETED'
        ? await api.request(
            'GET',
            '/placement/${assessment['currentSessionId']}/result',
          )
        : null;
    if (_disposed || expected != _epoch) return;
    user = account;
    placement = assessment;
    placementResult = result;
    stage = profile['onboardingCompletedAt'] == null
        ? SessionStage.onboarding
        : SessionStage.ready;
    error = null;
    notifyListeners();
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
  }

  Future<void> refreshPlacement() async {
    final epoch = _epoch;
    final assessment = await api.request('GET', '/placement/status');
    final result = assessment['status'] == 'COMPLETED'
        ? await api.request(
            'GET',
            '/placement/${assessment['currentSessionId']}/result',
          )
        : null;
    if (_disposed || epoch != _epoch) return;
    placement = assessment;
    placementResult = result;
    notifyListeners();
  }

  Future<void> logout() async {
    _epoch++;
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
