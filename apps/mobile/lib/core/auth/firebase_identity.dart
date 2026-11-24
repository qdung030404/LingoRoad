import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../firebase_options.dart';
import '../api/api_client.dart';
import 'auth_identity.dart';

class FirebaseIdentity implements AuthIdentity {
  FirebaseAuth? _auth;
  Future<void>? _initializing;
  Future<void>? _googleSetup;
  static const _emulatorHost = String.fromEnvironment(
    'FIREBASE_AUTH_EMULATOR_HOST',
  );
  static const _projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const _serverId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');
  static const _clientId = String.fromEnvironment('GOOGLE_CLIENT_ID');

  Future<void> _ensureGoogleSetup() async {
    await (_googleSetup ??= GoogleSignIn.instance.initialize(
      serverClientId: _serverId.isEmpty ? null : _serverId,
      clientId: _clientId.isEmpty ? null : _clientId,
    ));
  }

  @override
  Future<void> initialize() async {
    if (_auth != null) return;
    final pending = _initializing ??= _initialize();
    try {
      await pending;
    } finally {
      _initializing = null;
    }
  }

  Future<void> _initialize() async {
    if (_emulatorHost.isNotEmpty &&
        (kReleaseMode ||
            const String.fromEnvironment('APP_ENV', defaultValue: 'dev') !=
                'dev')) {
      throw const ApiFailure(
        'Chỉ được dùng Firebase Auth Emulator trong môi trường dev.',
        code: 'AUTH_CONFIGURATION',
      );
    }
    try {
      final app = Firebase.apps.isNotEmpty
          ? Firebase.app()
          : await Firebase.initializeApp(
              options: _projectId.isEmpty
                  ? DefaultFirebaseOptions.currentPlatform
                  : const FirebaseOptions(
                      apiKey: String.fromEnvironment('FIREBASE_API_KEY'),
                      appId: String.fromEnvironment('FIREBASE_APP_ID'),
                      messagingSenderId: String.fromEnvironment(
                        'FIREBASE_MESSAGING_SENDER_ID',
                      ),
                      projectId: _projectId,
                      iosBundleId: String.fromEnvironment(
                        'FIREBASE_IOS_BUNDLE_ID',
                      ),
                    ),
            );
      final auth = FirebaseAuth.instanceFor(app: app);
      if (_emulatorHost.isNotEmpty) {
        final uri = Uri.tryParse('http://$_emulatorHost');
        if (uri == null || uri.host.isEmpty || uri.port == 0) {
          throw const FormatException('Invalid emulator address');
        }
        // Preserve the configured host, including adb reverse on MuMu.
        await auth.useAuthEmulator(
          uri.host,
          uri.port,
          automaticHostMapping: false,
        );
      }
      _auth = auth;
    } catch (_) {
      throw const ApiFailure(
        'Chưa cấu hình Firebase cho ứng dụng. Vui lòng cấu hình project trước khi đăng nhập.',
        code: 'AUTH_CONFIGURATION',
      );
    }
  }

  @override
  bool get signedIn => currentUid != null;

  String? get currentUid => _auth?.currentUser?.uid;
  String? get projectId => _auth?.app.options.projectId;
  @override
  Stream<String?> get userChanges async* {
    if (_auth == null) {
      try {
        await initialize();
      } catch (_) {
        yield null;
        return;
      }
    }
    if (_auth != null) {
      yield* _auth!.authStateChanges().map((user) => user?.uid);
    } else {
      yield null;
    }
  }

  Future<T> _run<T>(Future<T> Function(FirebaseAuth auth) action) async {
    await initialize();
    try {
      return await action(_auth!);
    } on FirebaseAuthException catch (e) {
      throw _failure(e);
    }
  }

  @override
  Future<String?> idToken({bool forceRefresh = false}) =>
      _run((auth) async => auth.currentUser?.getIdToken(forceRefresh));

  @override
  Future<void> authenticate({
    required String email,
    required String password,
    String? name,
  }) => _run((auth) async {
    if (name == null) {
      await auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
    } else {
      final credential = await auth.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      await credential.user!.updateDisplayName(name.trim());
      await credential.user!.getIdToken(true);
    }
  });

  @override
  Future<void> signInWithGoogle() => _run((auth) async {
    if (kIsWeb) {
      if (kDebugMode) {
        debugPrint(
          '[FirebaseIdentity] Đăng nhập Google trên Web (signInWithPopup)...',
        );
      }
      await auth.signInWithPopup(GoogleAuthProvider());
      return;
    }

    if (kDebugMode) {
      debugPrint('[FirebaseIdentity] === BẮT ĐẦU ĐĂNG KÝ/ĐĂNG NHẬP GOOGLE ===');
      debugPrint('[FirebaseIdentity] Cấu hình:');
      debugPrint(
        '  - Project ID: ${_projectId.isEmpty ? "<DefaultFirebaseOptions>" : _projectId}',
      );
      debugPrint(
        '  - Server Client ID: ${_serverId.isEmpty ? "<Trống>" : "<Configured>"}',
      );
      debugPrint(
        '  - Client ID: ${_clientId.isEmpty ? "<Trống>" : "<Configured>"}',
      );
    }

    try {
      if (kDebugMode) {
        debugPrint('[FirebaseIdentity] 1. Khởi tạo GoogleSignIn instance...');
      }
      await _ensureGoogleSetup();

      if (kDebugMode) {
        debugPrint(
          '[FirebaseIdentity] 2. Mở popup tài khoản Google (authenticate)...',
        );
      }
      final user = await GoogleSignIn.instance.authenticate();
      final idToken = user.authentication.idToken;

      if (kDebugMode) {
        debugPrint('[FirebaseIdentity] 3. Google Authenticate thành công:');
        debugPrint('  - Display Name: ${user.displayName}');
        debugPrint(
          '  - idToken tồn tại: ${idToken != null && idToken.isNotEmpty}',
        );
      }

      if (idToken == null || idToken.isEmpty) {
        throw const ApiFailure(
          'Không nhận được token xác thực từ Google. Vui lòng thử lại.',
          code: 'AUTH_GOOGLE_EMPTY_ID_TOKEN',
        );
      }

      if (kDebugMode) {
        debugPrint(
          '[FirebaseIdentity] 4. Đăng nhập Firebase Auth với Google Credential...',
        );
      }
      final credential = await auth.signInWithCredential(
        GoogleAuthProvider.credential(idToken: idToken),
      );
      if (kDebugMode) {
        debugPrint(
          '[FirebaseIdentity] 5. Firebase Auth thành công: UID=${credential.user?.uid}',
        );
        debugPrint(
          '[FirebaseIdentity] === HOÀN TẤT ĐĂNG KÝ/ĐĂNG NHẬP GOOGLE ===',
        );
      }
    } on GoogleSignInException catch (e, st) {
      _googleSetup = null;
      if (kDebugMode) {
        debugPrint(
          '[FirebaseIdentity] ❌ LỖI GoogleSignInException: code=${e.code}, chi tiết=$e',
        );
        debugPrint('[FirebaseIdentity] StackTrace:\n$st');
      }
      if (e.code == GoogleSignInExceptionCode.canceled) {
        throw const ApiFailure(
          'Đã hủy đăng nhập Google.',
          code: 'AUTH_CANCELLED',
        );
      }
      throw const ApiFailure(
        'Không thể hoàn tất đăng nhập Google. Vui lòng thử lại.',
        code: 'AUTH_GOOGLE',
      );
    } on FirebaseAuthException catch (e, st) {
      _googleSetup = null;
      if (kDebugMode) {
        debugPrint(
          '[FirebaseIdentity] ❌ LỖI FirebaseAuthException: code=${e.code}, message=${e.message}',
        );
        debugPrint('[FirebaseIdentity] StackTrace:\n$st');
      }
      throw _failure(e);
    } catch (e, st) {
      _googleSetup = null;
      if (kDebugMode) {
        debugPrint(
          '[FirebaseIdentity] ❌ LỖI không xác định (${e.runtimeType}): $e',
        );
        debugPrint('[FirebaseIdentity] StackTrace:\n$st');
      }
      if (e is ApiFailure) rethrow;
      throw const ApiFailure(
        'Đăng nhập Google thất bại. Vui lòng thử lại sau.',
        code: 'AUTH_GOOGLE_ERROR',
      );
    }
  });

  @override
  Future<void> resetPassword(String email) =>
      _run((auth) => auth.sendPasswordResetEmail(email: email.trim()));
  @override
  Future<void> signOut() async {
    await _auth?.signOut();
    if (!kIsWeb) {
      try {
        await _ensureGoogleSetup();
        await GoogleSignIn.instance.signOut();
      } catch (_) {
        // Firebase has already ended the session; allow offline logout.
      }
    }
  }

  ApiFailure _failure(FirebaseAuthException e) {
    final message = switch (e.code) {
      'invalid-email' => 'Địa chỉ email không hợp lệ.',
      'email-already-in-use' => 'Email đã được đăng ký.',
      'weak-password' => 'Mật khẩu chưa đủ mạnh. Hãy dùng ít nhất 8 ký tự.',
      'invalid-credential' ||
      'wrong-password' ||
      'user-not-found' => 'Email hoặc mật khẩu không chính xác.',
      'network-request-failed' =>
        'Không thể kết nối Firebase. Kiểm tra mạng và thử lại.',
      'too-many-requests' => 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.',
      'user-disabled' => 'Tài khoản đã bị vô hiệu hóa.',
      'operation-not-allowed' =>
        'Phương thức đăng nhập chưa được bật trong Firebase.',
      _ => 'Không hoàn tất được xác thực. Vui lòng thử lại.',
    };
    return ApiFailure(
      message,
      code: e.code,
      status:
          [
            'user-token-expired',
            'invalid-user-token',
            'user-disabled',
          ].contains(e.code)
          ? 401
          : null,
    );
  }
}
