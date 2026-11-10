import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/features/speaking/speaking_controller.dart';
import 'package:mobile/features/speaking/speaking_recorder.dart';
import 'package:mobile/features/speaking/speaking_repository.dart';
import 'test_helpers.dart';

class FakeSpeakingRepository extends SpeakingRepository {
  Json value = {
    'id': 'submission',
    'status': 'CREATED',
    'promptSnapshot': {'text': 'Hello'},
  };
  int creates = 0, uploads = 0, lookups = 0;
  bool lostCreateAck = false, lostUploadAck = false;
  Completer<Json>? pendingUpload;
  @override
  Future<Json> prompts() async => {
    'items': [
      {'id': 'prompt', 'text': 'Hello'},
    ],
  };
  @override
  Future<Json> create(String promptId, String requestId) async {
    creates++;
    if (lostCreateAck) {
      lostCreateAck = false;
      throw const ApiFailure('offline');
    }
    return Map.of(value);
  }

  @override
  Future<Json> submission(String id) async {
    lookups++;
    return Map.of(value);
  }

  @override
  Future<Json> upload(String id, String path) async {
    uploads++;
    if (pendingUpload != null) return pendingUpload!.future;
    value = {
      ...value,
      'status': 'SUCCEEDED',
      'result': {'accuracy': 95},
    };
    if (lostUploadAck) throw const ApiFailure('offline');
    return Map.of(value);
  }

  @override
  Future<Json> history({String? cursor}) async => {
    'items': [value],
    'nextCursor': null,
  };
}

class FakeRecorder implements SpeakingRecorder {
  @override
  Stream<double> get amplitudes => const Stream.empty();
  FakeRecorder(this.path);
  final String path;
  bool permission = true;
  int starts = 0, stops = 0, clears = 0;
  @override
  Future<bool> hasPermission() async => permission;
  @override
  Future<void> start() async {
    starts++;
  }

  @override
  Future<String?> stop() async {
    stops++;
    return path;
  }

  @override
  Future<void> clear() async {
    clears++;
  }

  @override
  Future<void> dispose() async {}
}

class SpeakingAdapter implements HttpClientAdapter {
  SpeakingAdapter(this.respond);
  final Future<ResponseBody> Function(RequestOptions) respond;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) => respond(options);
  @override
  void close({bool force = false}) {}
}

ResponseBody reply(Json value, [int status = 200]) => ResponseBody.fromString(
  jsonEncode(
    status == 200
        ? {'success': true, 'data': value}
        : {
            'success': false,
            'error': {'code': 'UNAUTHORIZED'},
          },
  ),
  status,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  },
);

Uint8List wav(int frames) {
  final bytes = Uint8List(44 + frames * 2);
  final data = ByteData.sublistView(bytes);
  bytes.setRange(0, 4, 'RIFF'.codeUnits);
  data.setUint32(4, bytes.length - 8, Endian.little);
  bytes.setRange(8, 16, 'WAVEfmt '.codeUnits);
  data.setUint32(16, 16, Endian.little);
  data.setUint16(20, 1, Endian.little);
  data.setUint16(22, 1, Endian.little);
  data.setUint32(24, 16000, Endian.little);
  data.setUint32(28, 32000, Endian.little);
  data.setUint16(32, 2, Endian.little);
  data.setUint16(34, 16, Endian.little);
  bytes.setRange(36, 40, 'data'.codeUnits);
  data.setUint32(40, frames * 2, Endian.little);
  return bytes;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late Directory temp;
  late FakeRecorder recorder;
  late FakeSpeakingRepository repository;
  late SpeakingController c;
  var current = true;
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    temp = await Directory.systemTemp.createTemp('speaking-test-');
    final path = '${temp.path}/sample.wav';
    await File(path).writeAsBytes(wav(1600));
    recorder = FakeRecorder(path);
    repository = FakeSpeakingRepository();
    current = true;
    c = SpeakingController(
      repository: repository,
      recorder: recorder,
      accountId: 'A',
      isCurrent: () => current,
    );
  });
  tearDown(() async {
    c.dispose();
    await temp.delete(recursive: true);
  });
  Future<void> record() async {
    await c.initialize();
    await c.select(c.prompts.first);
    await c.start();
    await c.stop();
  }

  test('Permission denial never starts recording or uploads', () async {
    await c.initialize();
    await c.select(c.prompts.first);
    recorder.permission = false;
    await c.start();
    expect(c.error, contains('quyền micro'));
    expect(recorder.starts, 0);
    expect(repository.uploads, 0);
  });
  test(
    'Lost upload ACK retains session audio without uploading twice',
    () async {
      await record();
      repository.lostUploadAck = true;
      await c.send();
      expect(repository.uploads, 1);
      expect(repository.lookups, 1);
      expect(c.status, 'SUCCEEDED');
      expect(c.audioPath, recorder.path);
      expect(c.resultAudioPath('submission'), recorder.path);
      expect(c.resultAudioPath('other-submission'), isNull);
      await c.send();
      expect(repository.uploads, 1);
      await c.endSession();
      expect(c.audioPath, isNull);
    },
  );
  test(
    'Lost create ACK retains request id and recovers metadata after restart without upload',
    () async {
      await record();
      repository.lostCreateAck = true;
      await c.send();
      final prefs = await SharedPreferences.getInstance();
      final pending = prefs.getString('speaking.A.pending');
      expect(pending, isNotNull);
      c.dispose();
      c = SpeakingController(
        repository: repository,
        recorder: recorder,
        accountId: 'A',
        isCurrent: () => current,
      );
      await c.initialize();
      expect(c.status, 'CREATED');
      expect(repository.uploads, 0);
      expect(
        jsonDecode(prefs.getString('speaking.A.pending')!)['clientRequestId'],
        jsonDecode(pending!)['clientRequestId'],
      );
    },
  );
  test('Restored PROCESSING submission is read, never resubmitted', () async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      'speaking.A.pending',
      jsonEncode({
        'clientRequestId': 'request',
        'promptId': 'prompt',
        'submissionId': 'submission',
      }),
    );
    repository.value['status'] = 'PROCESSING';
    await c.initialize();
    expect(repository.lookups, 1);
    expect(repository.uploads, 0);
    expect(c.processing, true);
  });
  test('UNKNOWN is checked before an explicit new attempt', () async {
    await record();
    repository.value['status'] = 'UNKNOWN';
    await c.send();
    expect(repository.uploads, 0);
    expect(c.status, 'UNKNOWN');
    await c.check();
    expect(repository.uploads, 0);
  });
  test('Late upload after account changes cannot expose result', () async {
    await record();
    repository.pendingUpload = Completer<Json>();
    final sending = c.send();
    while (repository.uploads == 0) {
      await Future<void>.delayed(Duration.zero);
    }
    current = false;
    await c.endSession();
    repository.pendingUpload!.complete({
      ...repository.value,
      'status': 'SUCCEEDED',
      'result': {'accuracy': 100},
    });
    await sending;
    expect(c.result, null);
    expect(c.audioPath, null);
  });
  test('Re-record creates no submission and clears old audio state', () async {
    await record();
    await c.start();
    expect(c.audioPath, null);
    expect(repository.creates, 0);
    await c.stop();
  });
  test('Actual WAV is capped at exactly30sec with corrected RIFF lengths', () {
    final result = limitSpeakingWav(wav(16000 * 31));
    expect(result.length, 960044);
    expect(ByteData.sublistView(result).getUint32(40, Endian.little), 960000);
    final invalid = wav(1600);
    ByteData.sublistView(invalid).setUint32(24, 44100, Endian.little);
    expect(() => limitSpeakingWav(invalid), throwsFormatException);
  });

  test(
    'WAV normalization preserves every PCM sample in a supported recording',
    () {
      final original = wav(1600);
      final normalized = limitSpeakingWav(original);
      expect(normalized.sublist(44), original.sublist(44));
    },
  );
  test(
    'Startup cleans all stale account WAV files only inside owned subtree',
    () async {
      final a = await Directory(
        '${temp.path}/lingoroad-speaking/A',
      ).create(recursive: true);
      final b = await Directory(
        '${temp.path}/lingoroad-speaking/B',
      ).create(recursive: true);
      final oldA = await File('${a.path}/old.wav').writeAsBytes(wav(10));
      final oldB = await File('${b.path}/old.wav').writeAsBytes(wav(10));
      final keep = await File('${a.path}/metadata.json').writeAsString('{}');
      await cleanStaleSpeakingAudio(temporaryDirectory: temp);
      expect(await oldA.exists(), false);
      expect(await oldB.exists(), false);
      expect(await keep.exists(), true);
      expect(await File(recorder.path).exists(), true);
    },
  );
  test(
    'Multipart refresh401 constructs new form and uses135s timeout for Speaking',
    () async {
      final forms = <FormData>[];
      final timeouts = <Duration?>[];
      var attempts = 0;
      final dio = Dio()
        ..httpClientAdapter = SpeakingAdapter((options) async {
          if (options.path.endsWith('/auth/refresh')) {
            return reply({'accessToken': 'new', 'refreshToken': 'rotated'});
          }
          attempts++;
          timeouts.add(options.receiveTimeout);
          return attempts == 1 ? reply({}, 401) : reply({'id': 'submission'});
        });
      final api = ApiClient(
        config: AppConfig(),
        store: MemoryTokenStore('refresh'),
        dio: dio,
      )..accessToken = 'old';
      final result = await api.multipartRequest(
        'PUT',
        '/speaking/submissions/id/audio',
        factory: () async {
          final form = FormData.fromMap({
            'file': MultipartFile.fromBytes([1, 2], filename: 'recording.wav'),
          });
          forms.add(form);
          return form;
        },
      );
      expect(result['id'], 'submission');
      expect(forms.length, 2);
      expect(identical(forms[0], forms[1]), false);
      expect(timeouts, everyElement(const Duration(seconds: 135)));
    },
  );
  test(
    'Logout while building multipart prevents sending old account audio',
    () async {
      var requests = 0;
      final pending = Completer<FormData>();
      final dio = Dio()
        ..httpClientAdapter = SpeakingAdapter((options) async {
          requests++;
          return reply({});
        });
      final api = ApiClient(
        config: AppConfig(),
        store: MemoryTokenStore('refresh'),
        dio: dio,
      );
      final future = api.multipartRequest(
        'PUT',
        '/speaking/submissions/id/audio',
        factory: () => pending.future,
      );
      final result = expectLater(future, throwsA(isA<ApiFailure>()));
      await api.clearSession();
      pending.complete(FormData());
      await result;
      expect(requests, 0);
    },
  );
}
