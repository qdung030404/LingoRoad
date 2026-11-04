import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api/api_client.dart';
import 'activity_clock.dart';
import 'daily_learning.dart';

String activityRunId() {
  final bytes = List.generate(16, (_) => Random.secure().nextInt(256));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  final h = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${h.substring(0, 8)}-${h.substring(8, 12)}-${h.substring(12, 16)}-${h.substring(16, 20)}-${h.substring(20)}';
}

/// One account's durable receipts. ACK individual sequences, never a watermark.
class ActivityOutbox {
  ActivityOutbox({required this.owner, this.clock});
  final DailyLearningController owner;
  final ActivityClock? clock;
  List<Json> entries = [];
  Future<void> _writes = Future.value();
  Future<void>? _sending;
  Future<void>? _restoring;
  bool restored = false;
  String? error;
  String get key => 'learning.activity.v1.${owner.accountId}';
  int get pendingSeconds =>
      entries
          .where((e) => e['expired'] != true && e['rejected'] != true)
          .fold<int>(
            0,
            (n, e) =>
                n +
                ((e['endOffsetMs'] as num) - (e['startOffsetMs'] as num))
                    .toInt(),
          ) ~/
      1000;
  Future<void> restore() =>
      _restoring ??= _restore().whenComplete(() => _restoring = null);
  Future<void> _restore() async {
    if (restored) return;
    final p = await SharedPreferences.getInstance();
    final raw = p.getString(key);
    if (raw != null) {
      entries = (jsonDecode(raw) as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
    }
    restored = true;
  }

  Future<void> persist() {
    final raw = jsonEncode(entries);
    return _writes = _writes.catchError((_) {}).then((_) async {
      final prefs = await SharedPreferences.getInstance();
      if (!await prefs.setString(key, raw)) {
        throw StateError('Không lưu được thời gian trên thiết bị.');
      }
    });
  }

  Future<void> add(Json receipt) async {
    await restore();
    entries.add(receipt);
    await persist();
  }

  Future<void> flush() =>
      _sending ??= _flush().whenComplete(() => _sending = null);
  Future<void> _flush() async {
    if (!owner.active) return;
    try {
      await restore();
      await _writes;
      final sessions = entries
          .where((e) => e['expired'] != true && e['rejected'] != true)
          .map((e) => e['sessionId'] as String)
          .toSet();
      for (final id in sessions) {
        if (!owner.active) return;
        while (owner.active) {
          final rows = entries
              .where(
                (e) =>
                    e['sessionId'] == id &&
                    e['expired'] != true &&
                    e['rejected'] != true,
              )
              .take(100)
              .toList();
          if (rows.isEmpty) break;
          Json result;
          try {
            result = await owner.repository.sendSegments(
              id,
              rows
                  .map(
                    (e) => {
                      'seq': e['seq'],
                      'startOffsetMs': e['startOffsetMs'],
                      'endOffsetMs': e['endOffsetMs'],
                    },
                  )
                  .toList(),
            );
          } on ApiFailure catch (e) {
            if (e.code == 'LEARNING_ACTIVITY_UPLOAD_EXPIRED') {
              for (final row in rows) {
                row['expired'] = true;
              }
              await persist();
              break;
            }
            if (e.status == 409 || e.status == 400) {
              for (final row in rows) {
                if (!owner.active) return;
                try {
                  final single = await owner.repository.sendSegments(id, [
                    {
                      'seq': row['seq'],
                      'startOffsetMs': row['startOffsetMs'],
                      'endOffsetMs': row['endOffsetMs'],
                    },
                  ]);
                  if (!owner.active) return;
                  if ((single['acks'] as List).any(
                    (a) => (a as Map)['seq'] == row['seq'],
                  )) {
                    entries.remove(row);
                  }
                } on ApiFailure catch (individual) {
                  if (individual.status == 409 || individual.status == 400) {
                    row['rejected'] = true;
                  } else if (individual.code ==
                      'LEARNING_ACTIVITY_UPLOAD_EXPIRED') {
                    row['expired'] = true;
                  } else {
                    rethrow;
                  }
                }
                await persist();
              }
              continue;
            }
            rethrow;
          }
          if (!owner.active) return;
          final ack = (result['acks'] as List)
              .map((a) => (a as Map)['seq'])
              .toSet();
          entries.removeWhere(
            (e) => e['sessionId'] == id && ack.contains(e['seq']),
          );
          await persist();
          if (!ack.any((seq) => rows.any((row) => row['seq'] == seq))) break;
        }
      }
      error = entries.any((e) => e['rejected'] == true)
          ? 'Một số bản ghi thời gian bị từ chối do xung đột dữ liệu; được giữ riêng và không cộng vào thời gian đã xác nhận.'
          : entries.any((e) => e['expired'] == true)
          ? 'Một số bản ghi đã quá hạn đồng bộ 7 ngày và không được cộng vào thời gian đã xác nhận.'
          : null;
      if (owner.active) await owner.refresh();
    } catch (e) {
      error = e is ApiFailure
          ? e.message
          : 'Chưa đồng bộ thời gian. Bản ghi vẫn được giữ.';
    }
  }
}

class ActivityCollector extends ChangeNotifier {
  ActivityCollector({
    required this.outbox,
    required this.attemptId,
    required this.isEligible,
    ActivityClock? clock,
  }) : clock = clock ?? outbox.clock ?? NativeActivityClock();
  final ActivityOutbox outbox;
  final String attemptId;
  final bool Function() isEligible;
  final ActivityClock clock;
  String runId = activityRunId();
  Json? session;
  int _monoReference = 0,
      _offsetReference = 0,
      _last = 0,
      _interaction = 0,
      _seq = 0,
      _ticks = 0;
  int? _segmentStart;
  bool foreground = true, disposed = false, _sampling = false;
  int? _audioAt;
  Timer? timer;
  String? error;
  Future<void> start() async {
    try {
      error = null;
      await outbox.restore();
      if (!outbox.owner.active || disposed) return;
      final opened = await outbox.owner.repository.openActivity(
        attemptId,
        runId,
      );
      if (!outbox.owner.active || disposed) return;
      _monoReference = await clock.milliseconds();
      session = opened;
      _offsetReference = DateTime.parse(session!['serverNow'] as String)
          .difference(DateTime.parse(session!['anchorAt'] as String))
          .inMilliseconds;
      _last = _interaction = _monoReference;
      timer?.cancel();
      timer = Timer.periodic(const Duration(seconds: 1), (_) => sample());
      unawaited(outbox.flush());
    } catch (_) {
      error = 'Chưa bắt đầu ghi thời gian. Kết nối mạng rồi thử lại.';
      if (!disposed) notifyListeners();
    }
  }

  Future<void> touch() async {
    if (session == null || disposed) return;
    _interaction = await clock.milliseconds();
  }

  Future<void> audioAdvanced() async {
    if (session == null || disposed) return;
    _audioAt = await clock.milliseconds();
  }

  void audioStopped() {
    _audioAt = null;
  }

  Future<void> sample() async {
    if (_sampling || disposed || session == null || !outbox.owner.active) {
      return;
    }
    _sampling = true;
    try {
      final now = await clock.milliseconds();
      final offset = _offsetReference + now - _monoReference;
      final valid =
          foreground &&
          isEligible() &&
          (now - _interaction <= 60000 ||
              (_audioAt != null && now - _audioAt! <= 2000));
      if (offset >= const Duration(hours: 24).inMilliseconds) {
        await closeSegment(_last);
        timer?.cancel();
        session = null;
        runId = activityRunId();
        _seq = 0;
        await start();
        return;
      }
      if (!valid || now - _last > 5000 || now < _last) {
        await closeSegment(_last);
      } else {
        _segmentStart ??= _last;
        if (now - _segmentStart! >= 5000) await closeSegment(now);
      }
      _last = now;
      if (++_ticks % 15 == 0) unawaited(outbox.flush());
      if (!disposed) notifyListeners();
    } catch (_) {
      error = 'Không ghi được thời gian. Hãy thử lại.';
      if (!disposed) notifyListeners();
    } finally {
      _sampling = false;
    }
  }

  Future<void> closeSegment(int end) async {
    final start = _segmentStart;
    _segmentStart = null;
    if (session == null || start == null || end <= start) return;
    for (var s = start; s < end; s += 15000) {
      await outbox.add({
        'sessionId': session!['sessionId'],
        'seq': _seq++,
        'startOffsetMs': _offsetReference + s - _monoReference,
        'endOffsetMs': _offsetReference + min(s + 15000, end) - _monoReference,
      });
    }
  }

  Future<void> pause() async {
    foreground = false;
    audioStopped();
    await closeSegment(_last);
    await outbox.flush();
  }

  Future<void> resume() async {
    foreground = true;
    if (session == null) {
      await start();
      return;
    }
    _last = _interaction = await clock.milliseconds();
    unawaited(outbox.flush());
  }

  Future<void> checkpoint() async {
    await sample();
    await closeSegment(_last);
    await outbox.flush();
  }

  Future<void> finish() async {
    foreground = false;
    timer?.cancel();
    await closeSegment(_last);
    unawaited(outbox.flush());
  }

  @override
  void dispose() {
    disposed = true;
    foreground = false;
    timer?.cancel();
    unawaited(closeSegment(_last));
    super.dispose();
  }
}
