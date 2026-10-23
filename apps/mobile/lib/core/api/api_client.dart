import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

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
  ApiClient({required this.config, required this.store, Dio? dio})
    : dio =
          dio ??
          Dio(
            BaseOptions(
              connectTimeout: const Duration(seconds: 10),
              receiveTimeout: const Duration(seconds: 20),
            ),
          );
  final AppConfig config;
  final TokenStore store;
  final Dio dio;
  String? accessToken;
  Future<void>? _refreshing;
  void Function()? onUnauthorized;

  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
  }) async {
    final sentToken = accessToken;
    try {
      return await _send(method, path, data, auth ? sentToken : null);
    } on ApiFailure catch (e) {
      if (!auth || !e.unauthorized) rethrow;
      try {
        if (accessToken == sentToken) await refresh();
        return await _send(method, path, data, accessToken);
      } on ApiFailure catch (retryError) {
        if (retryError.unauthorized) {
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
    String? token,
  ) async {
    try {
      final response = await dio.request<dynamic>(
        config.resolve(path).toString(),
        data: data,
        options: Options(
          method: method,
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
    final pending = _refresh();
    _refreshing = pending;
    return pending.whenComplete(() => _refreshing = null);
  }

  Future<void> _refresh() async {
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
    await acceptTokens(tokens);
  }

  Future<void> clearSession() async {
    accessToken = null;
    await store.clear();
  }
}
