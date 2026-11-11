/// Identity lifecycle supplied by Firebase in the app, replaceable in tests.
abstract class AuthIdentity {
  Future<void> initialize();
  bool get signedIn;
  Stream<String?> get userChanges;
  Future<String?> idToken({bool forceRefresh = false});
  Future<void> authenticate({
    required String email,
    required String password,
    String? name,
  });
  Future<void> signInWithGoogle();
  Future<void> resetPassword(String email);
  Future<void> signOut();
}
