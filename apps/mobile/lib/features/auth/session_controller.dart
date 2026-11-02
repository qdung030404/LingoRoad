import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';

enum SessionStage { loading, signedOut, onboarding, ready, error }

typedef GoogleTokenProvider = Future<String?> Function();
typedef SocialSignOut = Future<void> Function();

class SessionController extends ChangeNotifier {
  SessionController(
    this.api, {
    GoogleTokenProvider? googleTokenProvider,
    SocialSignOut? socialSignOut,
  })  : _googleTokenProvider =
            googleTokenProvider ?? _defaultGoogleTokenProvider,
        _socialSignOut = socialSignOut ?? _defaultSocialSignOut {
    api.onUnauthorized = () {
      user = null;
      placement = {};
      stage = SessionStage.signedOut;
      notifyListeners();
    };
  }

  static Future<String?> _defaultGoogleTokenProvider() async {
    final GoogleSignInAccount googleUser =
        await GoogleSignIn.instance.authenticate();
    final GoogleSignInAuthentication googleAuth = googleUser.authentication;
    final String? idToken = googleAuth.idToken;
    if (idToken == null || idToken.isEmpty) {
      throw const ApiFailure(
        'Không nhận được Google ID Token từ thiết bị. Vui lòng thử lại.',
      );
    }
    final AuthCredential credential = GoogleAuthProvider.credential(
      idToken: idToken,
    );
    final UserCredential userCredential =
        await FirebaseAuth.instance.signInWithCredential(credential);
    return userCredential.user?.getIdToken();
  }

  static Future<void> _defaultSocialSignOut() async {
    await Future.wait([
      FirebaseAuth.instance.signOut(),
      GoogleSignIn.instance.signOut(),
    ]);
  }

  final ApiClient api;
  final GoogleTokenProvider _googleTokenProvider;
  final SocialSignOut _socialSignOut;
  SessionStage stage = SessionStage.loading;
  bool isAuthenticatingGoogle = false;
  Json? user;
  Json placement = {};
  String? error;
  Json get profile => (user?['profile'] as Map?)?.cast<String, dynamic>() ?? {};
  Future<void> authenticateWithGoogle() async {
    if (isAuthenticatingGoogle || stage == SessionStage.loading) return;
    isAuthenticatingGoogle = true;
    error = null;
    notifyListeners();

    try {
      // 1. Lấy Firebase ID Token từ Google Auth Provider
      final String? idToken = await _googleTokenProvider();

      if (idToken == null) {
        throw const ApiFailure('Không thể lấy Firebase ID Token');
      }

      // 2. Gửi Firebase ID Token lên Backend NestJS của LingoRoad
      final tokens = await api.request(
        'POST',
        '/auth/google',
        data: {'idToken': idToken},
        auth: false,
      );

      // 3. Lưu phiên đăng nhập nội bộ của LingoRoad và tải thông tin tài khoản
      await api.acceptTokens(tokens);
      isAuthenticatingGoogle = false;
      await initialize();
    } on GoogleSignInException catch (e) {
      isAuthenticatingGoogle = false;
      if (e.code == GoogleSignInExceptionCode.canceled) {
        notifyListeners();
        return;
      }
      error = e.description ?? 'Đăng nhập Google thất bại';
      notifyListeners();
    } on FirebaseAuthException catch (e) {
      isAuthenticatingGoogle = false;
      error = e.message ?? 'Đăng nhập Firebase thất bại';
      notifyListeners();
    } on ApiFailure catch (e) {
      isAuthenticatingGoogle = false;
      error = e.message;
      notifyListeners();
    } catch (e) {
      isAuthenticatingGoogle = false;
      error = 'Đăng nhập Google thất bại. Vui lòng thử lại.';
      notifyListeners();
    }
  }
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
      try {
        await _socialSignOut();
      } catch (_) {
        // Firebase/Google logout failures shouldn't prevent local logout.
      }
      await api.clearSession();
      user = null;
      placement = {};
      stage = SessionStage.signedOut;
      notifyListeners();
    }
  }
}