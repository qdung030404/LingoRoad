import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';

enum SessionStage { loading, signedOut, onboarding, ready, error }

class SessionController extends ChangeNotifier {
  SessionController(this.api) {
    api.onUnauthorized = () {
      user = null;
      placement = {};
      stage = SessionStage.signedOut;
      notifyListeners();
    };
  }
  final ApiClient api;
  SessionStage stage = SessionStage.loading;
  Json? user;
  Json placement = {};
  String? error;
  Json get profile => (user?['profile'] as Map?)?.cast<String, dynamic>() ?? {};
  Future<void> initialize() async {
    stage = SessionStage.loading;
    error = null;
    notifyListeners();
    try {
      if (api.accessToken == null) {
        if (await api.store.read() == null) {
          stage = SessionStage.signedOut;
          notifyListeners();
          return;
        }
        await api.refresh();
      }
      await loadAccount();
    } on ApiFailure catch (e) {
      if (e.unauthorized) {
        await api.clearSession();
        stage = SessionStage.signedOut;
      } else {
        error = e.message;
        stage = SessionStage.error;
      }
      notifyListeners();
    } catch (_) {
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

  Future<void> loadAccount() async {
    user = await api.request('GET', '/auth/me');
    placement = await api.request('GET', '/placement/status');
    stage = profile['onboardingCompletedAt'] == null
        ? SessionStage.onboarding
        : SessionStage.ready;
    error = null;
    notifyListeners();
  }

  Future<void> saveProfile(Json updates) async {
    user = await api.request('PATCH', '/auth/me', data: updates);
    stage = profile['onboardingCompletedAt'] == null
        ? SessionStage.onboarding
        : SessionStage.ready;
    notifyListeners();
  }

  Future<void> refreshPlacement() async {
    placement = await api.request('GET', '/placement/status');
    notifyListeners();
  }

  Future<void> logout() async {
    try {
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
      await api.clearSession();
      user = null;
      placement = {};
      stage = SessionStage.signedOut;
      notifyListeners();
    }
  }
}
