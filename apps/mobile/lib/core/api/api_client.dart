import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';
import '../auth/auth_identity.dart';

typedef Json = Map<String, dynamic>;

class ApiFailure implements Exception {
  const ApiFailure(this.message, {this.code = 'NETWORK', this.status});
  final String message;
  final String code;
  final int? status;
  bool get unauthorized => status == 401;
  @override
  String toString() => message;
}

abstract class TokenStore {
  Future<String?> read();
  Future<void> write(String token);
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  static const _key = 'lingoroad.refreshToken';
  @override
  Future<String?> read() => _storage.read(key: _key);
  @override
  Future<void> write(String token) => _storage.write(key: _key, value: token);
  @override
  Future<void> clear() => _storage.delete(key: _key);
}

class ApiClient {
  ApiClient({
    required this.config,
    required this.store,
    Dio? dio,
    this.identity,
  }) : dio =
           dio ??
           Dio(
             BaseOptions(
               connectTimeout: const Duration(seconds: 15),
               receiveTimeout: const Duration(seconds: 20),
             ),
           );
  final AppConfig config;
  final TokenStore store;
  final Dio dio;
  final AuthIdentity? identity;
  String? accessToken;
  Future<void>? _refreshing;
  int _sessionEpoch = 0;
  void Function()? onUnauthorized;

  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Duration? receiveTimeout,
  }) => _request(
    method,
    path,
    data: data,
    auth: auth,
    receiveTimeout: receiveTimeout,
  );

  Future<Json> multipartRequest(
    String method,
    String path, {
    required Future<FormData> Function() factory,
  }) => _request(method, path, multipart: factory);

  Future<Json> _request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Future<FormData> Function()? multipart,
    Duration? receiveTimeout,
  }) async {
    final epoch = _sessionEpoch;
    String? sentToken;
    try {
      if (auth && identity != null) {
        final token = await identity!.idToken();
        _checkSession(epoch);
        accessToken = token;
      }
      sentToken = accessToken;
      _checkSession(epoch);
      final result = await _send(
        method,
        path,
        data,
        auth ? sentToken : null,
        multipart: multipart,
        epoch: epoch,
        receiveTimeout: receiveTimeout,
      );
      _checkSession(epoch);
      return result;
    } on ApiFailure catch (e) {
      if (!auth || !e.unauthorized) rethrow;
      if (epoch != _sessionEpoch) rethrow;
      try {
        if (accessToken == sentToken) await refresh();
        _checkSession(epoch);
        final result = await _send(
          method,
          path,
          data,
          accessToken,
          multipart: multipart,
          epoch: epoch,
          receiveTimeout: receiveTimeout,
        );
        _checkSession(epoch);
        return result;
      } on ApiFailure catch (retryError) {
        if (retryError.unauthorized && epoch == _sessionEpoch) {
          await clearSession();
          onUnauthorized?.call();
        }
        rethrow;
      }
    }
  }

  Future<Json> _send(
    String method,
    String path,
    Json? data,
    String? token, {
    Future<FormData> Function()? multipart,
    required int epoch,
    Duration? receiveTimeout,
  }) async {
    try {
      final bodyData = multipart == null ? data : await multipart();
      _checkSession(epoch);
      final response = await dio.request<dynamic>(
        config.resolve(path).toString(),
        data: bodyData,
        options: Options(
          method: method,
          receiveTimeout:
              receiveTimeout ??
              (multipart == null
                  ? null
                  : Duration(
                      seconds: path.startsWith('/speaking/') ? 135 : 65,
                    )),
          headers: token == null ? null : {'Authorization': 'Bearer $token'},
        ),
      );
      final body = response.data;
      if (body is! Map || body['success'] != true) {
        throw _failure(body, response.statusCode);
      }
      return body['data'] is Map
          ? Map<String, dynamic>.from(body['data'] as Map)
          : <String, dynamic>{};
    } on DioException catch (e) {
      if (e.response != null) {
        throw _failure(e.response!.data, e.response!.statusCode);
      }
      if (e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout ||
          e.type == DioExceptionType.connectionTimeout) {
        throw const ApiFailure(
          'Hệ thống AI xử lý phản hồi quá thời gian chờ (timeout). Vui lòng thử lại.',
          code: 'TIMEOUT',
        );
      }
      throw const ApiFailure(
        'Không thể kết nối máy chủ. Kiểm tra mạng và thử lại.',
      );
    }
  }

  ApiFailure _failure(dynamic body, int? status) {
    final error = body is Map ? body['error'] : null;
    final raw = error is Map ? error['message'] : null;
    final message = raw is List ? raw.join('\n') : raw?.toString();
    return ApiFailure(
      message ?? 'Không thể xử lý yêu cầu. Vui lòng thử lại.',
      status: status,
      code: error is Map
          ? error['code']?.toString() ?? 'API_ERROR'
          : 'API_ERROR',
    );
  }

  Future<void> acceptTokens(Json tokens) async {
    await store.write(tokens['refreshToken'] as String);
    accessToken = tokens['accessToken'] as String;
  }

  Future<void> refresh() {
    if (_refreshing != null) return _refreshing!;
    final pending = _refresh(_sessionEpoch);
    _refreshing = pending;
    return pending.whenComplete(() {
      if (identical(_refreshing, pending)) _refreshing = null;
    });
  }

  void _checkSession(int epoch) {
    if (epoch != _sessionEpoch) {
      throw const ApiFailure(
        'Phiên đăng nhập đã thay đổi.',
        code: 'AUTH_SESSION_CHANGED',
      );
    }
  }

  Future<void> _refresh(int epoch) async {
    if (identity != null) {
      final token = await identity!.idToken(forceRefresh: true);
      _checkSession(epoch);
      accessToken = token;
      if (accessToken == null) {
        throw const ApiFailure('Vui lòng đăng nhập lại.', status: 401);
      }
      return;
    }
    final token = await store.read();
    if (token == null) {
      throw const ApiFailure('Vui lòng đăng nhập lại.', status: 401);
    }
    final tokens = await request(
      'POST',
      '/auth/refresh',
      data: {'refreshToken': token},
      auth: false,
    );
    _checkSession(epoch);
    await acceptTokens(tokens);
  }

  Future<void> clearSession() async {
    _sessionEpoch++;
    accessToken = null;
    _refreshing = null;
    try {
      await identity?.signOut();
    } finally {
      await store.clear();
    }
  }
}
