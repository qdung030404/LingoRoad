import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/features/auth/session_controller.dart';
import 'package:mobile/features/placement/placement_controller.dart';
import 'test_helpers.dart';

class StubAdapter implements HttpClientAdapter {
  StubAdapter(this.respond);
  final Future<ResponseBody> Function(RequestOptions) respond;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) => respond(options);
  @override
  void close({bool force = false}) {}
}

ResponseBody response(Json data, [int status = 200]) => ResponseBody.fromString(
  jsonEncode(
    status == 200
        ? {'success': true, 'data': data}
        : {
            'success': false,
            'error': {'message': 'Phiên hết hạn', 'code': 'UNAUTHORIZED'},
          },
  ),
  status,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  },
);

void main() {
  test(
    'Concurrent 401 responses share one refresh and retry with new token',
    () async {
      final store = MemoryTokenStore('old-refresh');
      final dio = Dio();
      var refreshes = 0;
      var requests = 0;
      dio.httpClientAdapter = StubAdapter((options) async {
        if (options.path.endsWith('/auth/refresh')) {
          refreshes++;
          await Future<void>.delayed(const Duration(milliseconds: 20));
          return response({
            'accessToken': 'new-access',
            'refreshToken': 'new-refresh',
          });
        }
        requests++;
        return options.headers['Authorization'] == 'Bearer new-access'
            ? response({'ok': true})
            : response({}, 401);
      });
      final api = ApiClient(config: AppConfig(), store: store, dio: dio)
        ..accessToken = 'old-access';
      final results = await Future.wait([
        api.request('GET', '/one'),
        api.request('GET', '/two'),
      ]);
      expect(results.every((result) => result['ok'] == true), true);
      expect(refreshes, 1);
      expect(requests, 4);
      expect(store.token, 'new-refresh');
    },
  );
  test('Unauthorized retry occurs once and clears revoked session', () async {
    final store = MemoryTokenStore('refresh');
    var requests = 0;
    final dio = Dio()
      ..httpClientAdapter = StubAdapter((options) async {
        if (options.path.endsWith('/auth/refresh')) {
          return response({'accessToken': 'new', 'refreshToken': 'rotated'});
        }
        requests++;
        return response({}, 401);
      });
    final api = ApiClient(config: AppConfig(), store: store, dio: dio)
      ..accessToken = 'old';
    var expired = false;
    api.onUnauthorized = () => expired = true;
    await expectLater(
      api.request('GET', '/auth/me'),
      throwsA(isA<ApiFailure>()),
    );
    expect(requests, 2);
    expect(expired, true);
    expect(store.token, null);
  });
  test(
    'Offline refresh preserves credentials and shows retry startup',
    () async {
      final store = MemoryTokenStore('refresh');
      final dio = Dio()
        ..httpClientAdapter = StubAdapter(
          (options) async => throw DioException(
            requestOptions: options,
            type: DioExceptionType.connectionError,
          ),
        );
      final session = SessionController(
        ApiClient(config: AppConfig(), store: store, dio: dio),
      );
      await session.initialize();
      expect(session.stage, SessionStage.error);
      expect(store.token, 'refresh');
    },
  );
  test(
    'Submission failure preserves item and selection; retry uses option string',
    () async {
      final api = FakeApi()..failAnswer = true;
      final controller = PlacementController(api);
      await controller.start();
      controller.select(0);
      await controller.submit();
      expect(controller.item!['id'], 'item-0');
      expect(controller.selected, 0);
      expect(controller.error, isNotNull);
      api.failAnswer = false;
      await controller.submit();
      expect(api.submitted.single['selectedOption'], 'Hanoi');
      expect(controller.item!['id'], 'item-1');
      expect(controller.selected, null);
    },
  );
  test(
    'Disposing a controller while starting does not notify disposed listeners',
    () async {
      final controller = PlacementController(FakeApi());
      final pending = controller.start();
      controller.dispose();
      await pending;
    },
  );
  test(
    'Production requires HTTPS and emulator default is backend port 3000',
    () {
      expect(AppConfig().apiBaseUrl, 'http://10.0.2.2:3000');
      expect(
        () => AppConfig(environment: 'prod', apiBaseUrl: 'http://example.com'),
        throwsArgumentError,
      );
    },
  );
}
