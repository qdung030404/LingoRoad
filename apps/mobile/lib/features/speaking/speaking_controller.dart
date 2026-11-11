import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api/api_client.dart';
import 'speaking_recorder.dart';
import 'speaking_repository.dart';

class SpeakingController extends ChangeNotifier {
  SpeakingController({
    required this.repository,
    required this.recorder,
    required this.accountId,
    required this.isCurrent,
  });
  final SpeakingRepository repository;
  final SpeakingRecorder recorder;
  final String accountId;
  final bool Function() isCurrent;
  bool _disposed = false, initialized = false, busy = false, recording = false;
  bool checking = false, enabled = true;
  String? error, audioPath, _requestId, _submissionId;
  Json? prompt, submission;
  List<Json> prompts = [];
  int seconds = 0;
  String mode = 'READ_ALOUD';
  String? _topicId;
  List<Json> gameProgress = [];
  int get maxSeconds => mode == 'TOPIC' ? 60 : 30;
  bool get isTopic => mode == 'TOPIC';
  Future<void> chooseMode(String value) async {
    if (!active || busy || recording || processing) return;
    await discard();
    if (!active) return;
    _topicId = null;
    mode = value;
    prompt = null;
    prompts = [];
    error = null;
    busy = true;
    _changed();
    try {
      await loadPrompts();
    } catch (e) {
      if (active) error = _message(e);
    } finally {
      busy = false;
      _changed();
    }
  }

  Future<void> refreshGameProgress() async {
    final data = await repository.gameProgress();
    if (!active) return;
    gameProgress = speakingItems(data['items']);
    _changed();
  }

  Timer? _clock, _poll;
  final Stopwatch _elapsed = Stopwatch();
  bool get active => !_disposed && isCurrent();
  String get _draftKey => 'speaking.$accountId.pending';
  String get status => submission?['status']?.toString() ?? '';
  String? resultAudioPath(String? submissionId) =>
      active &&
          status == 'SUCCEEDED' &&
          submissionId != null &&
          submissionId == _submissionId
      ? audioPath
      : null;
  bool get processing => status == 'PROCESSING';
  bool get terminal => ['SUCCEEDED', 'FAILED', 'UNKNOWN'].contains(status);
  bool get serviceUnavailable =>
      speakingServiceUnavailable(submission?['errorCode']?.toString());
  Json? get result => submission?['result'] is Map
      ? Map<String, dynamic>.from(submission!['result'] as Map)
      : null;
  String get sentence => submission == null
      ? (prompt?['text']?.toString() ?? '')
      : speakingSentence(submission!);
  void _changed() {
    if (active) notifyListeners();
  }

  String _message(Object e) => e is ApiFailure
      ? e.message
      : 'Không thể xử lý bản thu. Vui lòng thử lại.';

  Future<void> initialize() async {
    if (initialized || busy) return;
    busy = true;
    _changed();
    try {
      await recorder.clear();
      final prefs = await SharedPreferences.getInstance();
      if (!active) return;
      final raw = prefs.getString(_draftKey);
      if (raw != null) {
        final pending = jsonDecode(raw) as Map;
        _requestId = pending['clientRequestId'] as String;
        _submissionId = pending['submissionId'] as String?;
        _topicId = pending['topicId'] as String?;
        mode = pending['mode']?.toString() ?? 'READ_ALOUD';
        prompt = {'id': pending['promptId']};
        await _lookupOrCreate(); // Metadata recovery only: never uploads audio.
      }
      if (!active) return;
      await loadPrompts();
      initialized = true;
    } catch (e) {
      if (active) error = _message(e);
    } finally {
      if (active) {
        busy = false;
        _changed();
      }
    }
  }

  Future<void> loadPrompts() async {
    final topicId = _topicId;
    if (topicId != null) {
      try {
        final topic = await repository.conversationTopic(topicId);
        if (!active) return;
        final (items, available) = _topicPractice(topic, mode);
        prompts = items;
        enabled = available;
      } on ApiFailure {
        if (!active || submission == null) rethrow;
        prompts = [];
        enabled = false;
      }
      final id = prompt?['id'];
      final match = prompts.where((item) => item['id'] == id).firstOrNull;
      if (match != null) {
        prompt = match;
      } else if (id != null && submission?['promptSnapshot'] is Map) {
        final snapshot = Map<String, dynamic>.from(
          submission!['promptSnapshot'] as Map,
        );
        prompt = {...snapshot, 'id': id};
        prompts = [prompt!];
        enabled = false;
      }
      _changed();
      return;
    }
    final data = mode == 'READ_ALOUD'
        ? await repository.prompts()
        : await repository.promptsForMode(mode);
    if (mode == 'TONGUE_TWISTER') await refreshGameProgress();
    if (!active) return;
    prompts = speakingItems(data['items']);
    if (prompt != null) {
      for (final item in prompts) {
        if (item['id'] == prompt!['id']) {
          prompt = item;
          break;
        }
      }
    }
    enabled = data['enabled'] != false;
    _changed();
  }

  (List<Json>, bool) _topicPractice(Json topic, String mode) {
    final practice = topic['practice'] as Map?;
    final activity =
        practice?[mode == 'READ_ALOUD' ? 'readAloud' : 'topic'] as Map?;
    final items = mode == 'READ_ALOUD'
        ? speakingItems(activity?['items'])
        : activity?['prompt'] is Map
        ? [Map<String, dynamic>.from(activity!['prompt'] as Map)]
        : <Json>[];
    return (items, activity?['enabled'] == true);
  }

  Future<bool> openTopicPractice(Json topic, String activity) async {
    if (!active || busy || recording || processing) return false;
    final (items, available) = _topicPractice(topic, activity);
    if (!available || items.isEmpty) return false;
    busy = true;
    _changed();
    try {
      await discard();
      if (!active) return false;
      _topicId = topic['id'] as String;
      mode = activity;
      prompts = items;
      prompt = items.first;
      enabled = true;
      return true;
    } finally {
      busy = false;
      _changed();
    }
  }

  /// An explicit practice entry starts over after a successful submission.
  /// Uncertain/in-flight submissions remain recoverable without resubmitting.
  Future<void> beginPractice() async {
    await initialize();
    if (!active ||
        busy ||
        recording ||
        !enabled ||
        prompts.isEmpty ||
        error != null) {
      return;
    }
    if (prompt == null || status == 'SUCCEEDED') await select(prompts.first);
  }

  Future<void> finishPractice() async {
    if (!active || busy || recording || status != 'SUCCEEDED') {
      return;
    }
    if (prompts.isNotEmpty) await select(prompts.first);
  }

  Future<void> select(Json value) async {
    if (busy || recording) return;
    await discard();
    if (!active) return;
    prompt = value;
    _changed();
  }

  Future<void> start() async {
    if (!active || busy || recording || prompt == null || !enabled) {
      return;
    }
    busy = true;
    error = null;
    _changed();
    try {
      if (!await recorder.hasPermission()) {
        throw const ApiFailure(
          'Chưa có quyền micro. Cho phép micro trong cài đặt ứng dụng rồi thử lại.',
        );
      }
      if (!active) return;
      await _clearPending();
      if (recorder is DeviceSpeakingRecorder) {
        (recorder as DeviceSpeakingRecorder).maxSeconds = maxSeconds;
      }
      await recorder.start();
      if (!active) {
        await recorder.clear();
        return;
      }
      audioPath = null;
      submission = null;
      seconds = 0;
      recording = true;
      _elapsed
        ..reset()
        ..start();
      _clock = Timer.periodic(const Duration(milliseconds: 100), (_) {
        if (!active) {
          unawaited(stop());
          return;
        }
        seconds = _elapsed.elapsed.inSeconds.clamp(0, maxSeconds);
        _changed();
        if (_elapsed.elapsed >= Duration(seconds: maxSeconds)) {
          unawaited(stop());
        }
      });
    } catch (e) {
      if (active) error = _message(e);
    } finally {
      if (active) {
        busy = false;
        _changed();
      }
    }
  }

  Future<void> stop() async {
    if (!recording) return;
    recording = false;
    _clock?.cancel();
    _elapsed.stop();
    busy = true;
    _changed();
    try {
      final path = await recorder.stop();
      if (!active) {
        await recorder.clear();
        return;
      }
      if (path == null || !await File(path).exists()) {
        throw const ApiFailure('Không tạo được bản thu. Vui lòng ghi lại.');
      }
      final length = await File(path).length();
      if (length <= 44 || length > 2 * 1024 * 1024) {
        throw ApiFailure(
          'Bản thu rỗng hoặc quá lớn. Vui lòng ghi lại tối đa $maxSeconds giây.',
        );
      }
      if (active) audioPath = path;
    } catch (e) {
      if (active) error = _message(e);
    } finally {
      if (active) {
        busy = false;
        _changed();
      }
    }
  }

  Future<void> _savePending() async {
    final prefs = await SharedPreferences.getInstance();
    if (!active) return;
    await prefs.setString(
      _draftKey,
      jsonEncode({
        'clientRequestId': _requestId,
        'submissionId': _submissionId,
        'promptId': prompt!['id'],
        'mode': mode,
        if (_topicId != null) 'topicId': _topicId,
      }),
    );
  }

  Future<void> _clearPending() async {
    _poll?.cancel();
    _requestId = null;
    _submissionId = null;
    submission = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_draftKey);
  }

  Future<void> _lookupOrCreate() async {
    final id = _submissionId;
    final value = id == null
        ? await repository.create(prompt!['id'] as String, _requestId!)
        : await repository.submission(id);
    if (!active) return;
    _submissionId = value['id'] as String;
    submission = value;
    await _savePending();
    await _accept();
  }

  Future<void> send({bool newAttempt = false}) async {
    if (!active ||
        busy ||
        recording ||
        audioPath == null ||
        prompt == null ||
        !enabled ||
        serviceUnavailable) {
      return;
    }
    busy = true;
    error = null;
    _changed();
    try {
      if (newAttempt) await _clearPending();
      if (!active) return;
      _requestId ??= speakingRequestId();
      await _savePending(); // Save before POST, including when its ACK is lost.
      if (!active) return;
      await _lookupOrCreate();
      if (!active || status != 'CREATED') return;
      final path = audioPath;
      if (path == null) return;
      final value = await repository.upload(_submissionId!, path);
      if (!active) return;
      submission = value;
      await _accept();
    } catch (e) {
      if (active) error = _message(e);
      // A network error never causes an automatic upload retry.
      if (active && _submissionId != null) {
        try {
          await check();
        } catch (_) {
          /* Explicit check remains available. */
        }
      }
    } finally {
      if (active) {
        busy = false;
        _changed();
      }
    }
  }

  Future<void> _accept() async {
    if (!active) return;
    if (processing) {
      _poll?.cancel();
      _poll = Timer.periodic(
        const Duration(seconds: 2),
        (_) => unawaited(check()),
      );
    } else {
      _poll?.cancel();
    }
    _changed();
  }

  Future<void> check() async {
    if (!active || checking || _submissionId == null) return;
    final requestedId = _submissionId;
    checking = true;
    try {
      final value = await repository.submission(requestedId!);
      if (!active || _submissionId != requestedId) return;
      submission = value;
      error = null;
      await _accept();
    } catch (e) {
      if (active && _submissionId == requestedId) {
        error = _message(e);
        _poll?.cancel();
      }
    } finally {
      checking = false;
      _changed();
    }
  }

  Future<void> discard() async {
    _clock?.cancel();
    _elapsed.stop();
    recording = false;
    await recorder.clear();
    audioPath = null;
    seconds = 0;
    error = null;
    await _clearPending();
    _changed();
  }

  Future<void> endSession() async {
    _clock?.cancel();
    _poll?.cancel();
    recording = false;
    await recorder.clear();
    audioPath = null;
  }

  @override
  void dispose() {
    _disposed = true;
    _clock?.cancel();
    _poll?.cancel();
    unawaited(recorder.dispose());
    super.dispose();
  }
}
