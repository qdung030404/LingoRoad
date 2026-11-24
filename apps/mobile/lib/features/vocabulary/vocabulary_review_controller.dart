import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import 'vocabulary_controller.dart';
import 'vocabulary_models.dart';

class VocabularyReviewController extends ChangeNotifier {
  VocabularyReviewController({required this.owner});
  final VocabularyController owner;
  VocabularyReviewAttempt? attempt;
  Json? pending;
  String draft = '', phase = 'FRONT';
  String? error, selectedRating, recoveredDraft;
  bool loading = false, busy = false, conflict = false;
  bool _disposed = false;
  int _epoch = 0;
  Timer? _draftTimer;
  Timer? _ratingHighlightTimer;
  final List<Json> _queuedResults = [];
  Json? _inFlightBatch;
  Completer<bool>? _syncCompleter;
  bool _isSyncing = false;
  bool _pendingFinalFlush = false;
  bool _rating = false;
  DateTime? _lastSyncTime;
  bool get active => !_disposed && owner.active;
  bool get isSyncing => _isSyncing;
  bool get hasPendingSingleCommand => pending != null;
  bool get hasUncommittedBatch =>
      _inFlightBatch != null || _queuedResults.isNotEmpty;
  bool get unsynced => hasPendingSingleCommand || hasUncommittedBatch;
  String get pendingKey => 'review.${attempt!.id}.pending';
  String get draftKey => 'review.${attempt!.id}.draft';
  String get journalKey => 'review.${attempt!.id}.journal';
  @override
  void notifyListeners() {
    if (active) super.notifyListeners();
  }

  Future<void> load(String id) async {
    if (!active || busy || _isSyncing) return;
    final epoch = ++_epoch;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final result = await owner.repository.request(
        'GET',
        '/vocabulary/reviews/$id',
      );
      if (!active || epoch != _epoch) return;
      _apply(VocabularyReviewAttempt(vocabularyJson(result['attempt'])));
      pending = await owner.store.read(pendingKey);
      final local = await owner.store.read(draftKey);
      final journal = await owner.store.read(journalKey);
      if (!active || epoch != _epoch) return;
      _restoreJournal(journal);
      for (final res in _allUncommittedResults()) {
        _advanceLocal(res['itemId'] as String, res['rating'] as String);
      }
      if (local != null &&
          local['itemId'] == attempt!.current?.id &&
          !attempt!.current!.checked) {
        if (local['baseVersion'] == attempt!.version) {
          draft = local['draft'] as String? ?? '';
          phase = local['phase'] as String? ?? phase;
        } else if ((local['draft'] as String? ?? '').isNotEmpty) {
          recoveredDraft = local['draft'] as String;
        }
      }
      if (pending != null) await retryPending();
      if (hasUncommittedBatch) {
        unawaited(
          _flushUncommitted(
            isFinal: attempt?.queue.isEmpty == true,
            force: true,
          ),
        );
      }
    } catch (e) {
      if (active && epoch == _epoch) error = owner.message(e);
    } finally {
      if (active && epoch == _epoch) {
        loading = false;
        notifyListeners();
      }
    }
  }

  List<Json> _filterPendingResults(List<dynamic> rawList) {
    final kept = <Json>[];
    final seen = <String>{};
    for (final r in rawList) {
      if (r is! Map) continue;
      final map = Map<String, dynamic>.from(r);
      final itemId = map['itemId'] as String?;
      if (itemId == null || seen.contains(itemId)) continue;
      final item = attempt!.itemMap[itemId];
      if (item != null && item.state == 'PENDING') {
        seen.add(itemId);
        kept.add(map);
      }
    }
    return kept;
  }

  void _restoreJournal(Json? journal) {
    _inFlightBatch = null;
    _queuedResults.clear();
    if (journal == null) return;

    final seenInFlight = <String>{};
    final rawInFlight = journal['inFlight'];
    if (rawInFlight is Map) {
      final rawResults = rawInFlight['results'];
      final cmdId = rawInFlight['commandId'] as String?;
      if (rawResults is List && cmdId != null && cmdId.isNotEmpty) {
        final kept = _filterPendingResults(rawResults);
        if (kept.length == rawResults.length && kept.isNotEmpty) {
          _inFlightBatch = {
            'commandId': cmdId,
            'results': kept,
            'isFinal': rawInFlight['isFinal'] == true,
          };
          for (final r in kept) {
            seenInFlight.add(r['itemId'] as String);
          }
        } else if (kept.isNotEmpty) {
          for (final r in kept) {
            seenInFlight.add(r['itemId'] as String);
            _queuedResults.add(r);
          }
        }
      }
    }

    final rawQueued = journal['queued'] ?? journal['results'];
    if (rawQueued is List) {
      for (final r in _filterPendingResults(rawQueued)) {
        final itemId = r['itemId'] as String;
        if (!seenInFlight.contains(itemId)) {
          _queuedResults.add(r);
        }
      }
      if (journal['inFlight'] == null &&
          journal['commandId'] is String &&
          _queuedResults.length == rawQueued.length &&
          _queuedResults.isNotEmpty) {
        _inFlightBatch = {
          'commandId': journal['commandId'] as String,
          'results': List<Json>.from(_queuedResults),
          'isFinal': false,
        };
        _queuedResults.clear();
      }
    }
  }

  List<Json> _allUncommittedResults() {
    final list = <Json>[];
    final inFlightResults = _inFlightBatch?['results'];
    if (inFlightResults is List) {
      for (final r in inFlightResults) {
        if (r is Map) list.add(Map<String, dynamic>.from(r));
      }
    }
    list.addAll(_queuedResults);
    return list;
  }

  void _apply(VocabularyReviewAttempt value) {
    if (!active ||
        (attempt != null &&
            value.id == attempt!.id &&
            value.version < attempt!.version)) {
      return;
    }
    attempt = value;
    phase = value.phase;
    draft = value.current?.draft ?? '';
  }

  void changeDraft(String value) {
    if (!active || busy || unsynced || attempt?.current?.checked == true) {
      return;
    }
    draft = value;
    _draftTimer?.cancel();
    _draftTimer = Timer(const Duration(milliseconds: 300), () async {
      try {
        await saveDraft();
      } catch (e) {
        if (active) {
          error = owner.message(e);
          notifyListeners();
        }
      }
    });
  }

  Future<void> saveDraft() async {
    _draftTimer?.cancel();
    if (attempt == null || attempt!.current == null) return;
    await owner.store.write(draftKey, {
      'itemId': attempt!.current!.id,
      'baseVersion': attempt!.version,
      'draft': draft,
      'phase': phase,
    });
  }

  Future<void> setPhase(String value) async {
    if (!active || busy || unsynced || attempt?.current == null) return;
    if (!['FRONT', 'MEANING', 'RECALL'].contains(value)) return;
    final previous = phase;
    phase = value;
    try {
      await saveDraft();
    } catch (e) {
      phase = previous;
      if (active) error = owner.message(e);
    }
    notifyListeners();
  }

  Future<bool> checkpoint() async {
    try {
      await saveDraft();
    } catch (e) {
      if (active) {
        error = owner.message(e);
        notifyListeners();
      }
      return false;
    }
    if (hasUncommittedBatch) {
      final flushed = await _flushUncommitted(
        isFinal: attempt?.queue.isEmpty == true,
        force: true,
      );
      if (!flushed) return false;
    }
    if (!active ||
        attempt == null ||
        attempt!.finished ||
        attempt!.current == null) {
      return true;
    }
    if (hasPendingSingleCommand) return retryPending();
    if (attempt!.current!.checked) return true;
    return command('SAVE_PROGRESS', payload: {'phase': phase, 'draft': draft});
  }

  Future<bool> check() async {
    if (draft.trim().isEmpty) {
      error = 'Nhập từ tiếng Anh trước khi kiểm tra.';
      notifyListeners();
      return false;
    }
    if (attempt?.current?.checked == true) return true;
    if (!await checkpoint()) return false;
    return command('CHECK_RECALL', payload: {'answer': draft});
  }

  Future<bool> rate(String rating) async {
    if (!active ||
        busy ||
        _rating ||
        hasPendingSingleCommand ||
        conflict ||
        attempt == null ||
        attempt!.finished) {
      return false;
    }
    final current = attempt!.current;
    if (current == null) return false;
    final inFlightContains =
        (_inFlightBatch?['results'] as List?)?.any(
          (e) => e is Map && e['itemId'] == current.id,
        ) ??
        false;
    if (_queuedResults.any((e) => e['itemId'] == current.id) ||
        inFlightContains) {
      return false;
    }
    if (current.checked && current.isCorrect == false && rating != 'HARD') {
      error = 'Câu trả lời sai cần ôn lại.';
      notifyListeners();
      return false;
    }

    _rating = true;
    final nowIso = DateTime.now().toUtc().toIso8601String();
    final resultItem = <String, dynamic>{
      'itemId': current.id,
      'rating': rating,
      'finalizedAt': nowIso,
    };
    _queuedResults.add(resultItem);
    try {
      await _saveJournal();
    } catch (e) {
      _queuedResults.remove(resultItem);
      if (active) {
        error = owner.message(e);
        notifyListeners();
      }
      return false;
    } finally {
      _rating = false;
    }
    if (!active) return false;

    error = null;
    selectedRating = rating;
    _advanceLocal(current.id, rating);

    _ratingHighlightTimer?.cancel();
    _ratingHighlightTimer = Timer(const Duration(milliseconds: 150), () {
      if (active && selectedRating == rating) {
        selectedRating = null;
        notifyListeners();
      }
    });

    notifyListeners();

    if (attempt!.queue.isEmpty) {
      unawaited(_flushUncommitted(isFinal: true, force: true));
    } else if (_queuedResults.length >= 15) {
      unawaited(_flushUncommitted(isFinal: false, force: false));
    }
    return true;
  }

  void _advanceLocal(String itemId, String rating) {
    if (attempt == null) return;
    final item = attempt!.itemMap[itemId];
    if (item != null) {
      item.json['state'] = 'REVIEWED';
      item.json['rating'] = rating;
    }
    final q = List<String>.from(attempt!.queue)..remove(itemId);
    attempt!.json['queue'] = q;
    final nextId = q.isNotEmpty ? q.first : null;
    attempt!.json['currentItem'] =
        nextId != null ? attempt!.itemMap[nextId]?.json : null;
    final counts =
        Map<String, dynamic>.from(attempt!.json['counts'] as Map? ?? {});
    counts['reviewedCount'] = (counts['reviewedCount'] as num? ?? 0) + 1;
    attempt!.json['counts'] = counts;
    phase = 'FRONT';
    draft = attempt!.current?.draft ?? '';
  }

  Future<void> _saveJournal() async {
    if (attempt == null) return;
    await owner.store.write(
      journalKey,
      !hasUncommittedBatch
          ? null
          : {
              'inFlight': _inFlightBatch,
              'queued': _queuedResults,
            },
    );
  }

  Future<bool> _flushUncommitted({
    bool isFinal = false,
    bool force = false,
  }) async {
    if (!active || attempt == null || !hasUncommittedBatch) {
      return true;
    }

    while (_isSyncing) {
      if (isFinal) _pendingFinalFlush = true;
      if (!force && !isFinal) return true;
      final prevOk = await (_syncCompleter?.future ?? Future.value(true));
      if (!active || !prevOk) return false;
      if (!hasUncommittedBatch) return true;
    }

    if (!isFinal && !force && _lastSyncTime != null) {
      final elapsed = DateTime.now().difference(_lastSyncTime!);
      if (elapsed.inSeconds < 10) return true;
    }

    _isSyncing = true;
    final completer = Completer<bool>();
    _syncCompleter = completer;
    var succeeded = false;

    try {
      if (_inFlightBatch == null) {
        final batchItems =
            _queuedResults.map((e) => Map<String, dynamic>.from(e)).toList();
        _queuedResults.clear();
        _inFlightBatch = {
          'commandId': vocabularyCommandId(),
          'results': batchItems,
          'isFinal': isFinal && attempt!.queue.isEmpty,
        };
        await _saveJournal();
      }

      final commandId = _inFlightBatch!['commandId'] as String;
      final payloadToSync = (_inFlightBatch!['results'] as List)
          .map((e) => Map<String, dynamic>.from(e as Map))
          .toList();
      final batchIsFinal = _inFlightBatch!['isFinal'] == true;
      final expectedVersion = attempt!.version;

      final result = await owner.repository.request(
        'POST',
        '/vocabulary/reviews/${attempt!.id}/batch-submit',
        body: {
          'commandId': commandId,
          'expectedVersion': expectedVersion,
          'isFinal': batchIsFinal,
          'results': payloadToSync,
        },
      );

      if ((result['receipt'] as Map?)?['commandId'] != commandId) {
        throw const ApiFailure('Máy chủ chưa xác nhận đúng thao tác.');
      }

      _inFlightBatch = null;
      await _saveJournal();

      if (!active) {
        if (!completer.isCompleted) completer.complete(false);
        return false;
      }

      _lastSyncTime = DateTime.now();
      error = null;
      conflict = false;
      final next = VocabularyReviewAttempt(vocabularyJson(result['attempt']));
      _apply(next);

      for (final res in _queuedResults) {
        _advanceLocal(res['itemId'] as String, res['rating'] as String);
      }

      unawaited(owner.refresh());
      notifyListeners();
      succeeded = true;
      if (!completer.isCompleted) completer.complete(true);
      return true;
    } catch (e) {
      if (active) {
        error = owner.message(e);
        if (e is ApiFailure &&
            (e.status == 409 || e.status == 400 || e.status == 404)) {
          conflict = true;
        }
        notifyListeners();
      }
      if (!completer.isCompleted) completer.complete(false);
      return false;
    } finally {
      _isSyncing = false;
      if (!completer.isCompleted) completer.complete(succeeded);
      if (active && succeeded && (_queuedResults.isNotEmpty || _pendingFinalFlush)) {
        final needFinal = _pendingFinalFlush || attempt?.queue.isEmpty == true;
        _pendingFinalFlush = false;
        if (_queuedResults.isNotEmpty) {
          unawaited(
            _flushUncommitted(isFinal: needFinal, force: force || needFinal),
          );
        } else if (needFinal &&
            attempt != null &&
            !attempt!.finished &&
            attempt!.queue.isEmpty &&
            pending == null) {
          unawaited(command('SUBMIT'));
        }
      } else if (!succeeded) {
        _pendingFinalFlush = false;
      }
    }
  }

  Future<bool> advance() => command('ADVANCE');
  Future<bool> skip() async {
    if (hasUncommittedBatch) {
      final ok = await _flushUncommitted(isFinal: false, force: true);
      if (!ok) return false;
    }
    return command('SKIP');
  }

  Future<bool> requeue() async {
    if (hasUncommittedBatch) {
      final ok = await _flushUncommitted(isFinal: false, force: true);
      if (!ok) return false;
    }
    return command('REQUEUE');
  }

  Future<bool> submit() async {
    if (hasUncommittedBatch) {
      final ok = await _flushUncommitted(isFinal: true, force: true);
      if (!ok) return false;
      if (attempt?.finished == true) return true;
    }
    return await command('SUBMIT');
  }

  Future<bool> abandon() async {
    if (hasUncommittedBatch) {
      final ok = await _flushUncommitted(isFinal: false, force: true);
      if (!ok) return false;
    }
    return await command('ABANDON');
  }

  Future<bool> command(
    String action, {
    Json payload = const {},
    String? feedback,
  }) async {
    if (!active || busy || attempt == null || attempt!.finished) return false;
    if (pending != null) {
      error = 'Có thao tác chưa xác nhận. Hãy thử lại trước.';
      notifyListeners();
      return false;
    }
    busy = true;
    error = null;
    selectedRating = feedback;
    notifyListeners();
    try {
      await saveDraft();
      pending = {
        'commandId': vocabularyCommandId(),
        'expectedVersion': attempt!.version,
        if (!['SUBMIT', 'ABANDON'].contains(action))
          'itemId': attempt!.current?.id,
        'action': action,
        ...vocabularyCopy(payload),
      };
      return await _sendPending();
    } catch (e) {
      if (active) error = owner.message(e);
      return false;
    } finally {
      if (active) {
        busy = false;
        notifyListeners();
      }
    }
  }

  Future<bool> retryPending() async {
    if (!active || busy) return false;
    if (hasUncommittedBatch) {
      final needFinal = attempt?.queue.isEmpty == true;
      return await _flushUncommitted(isFinal: needFinal, force: true);
    }
    if (pending == null) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      return await _sendPending();
    } finally {
      if (active) {
        busy = false;
        notifyListeners();
      }
    }
  }

  Future<bool> _sendPending() async {
    try {
      await owner.store.write(pendingKey, pending);
      if (!active) return false;
      final result = await owner.repository.request(
        'POST',
        '/vocabulary/reviews/${attempt!.id}/commands',
        body: vocabularyCopy(pending!),
      );
      if (!active) return false;
      if ((result['receipt'] as Map?)?['commandId'] != pending!['commandId']) {
        throw const ApiFailure('Máy chủ chưa xác nhận đúng thao tác.');
      }
      final next = VocabularyReviewAttempt(vocabularyJson(result['attempt']));
      await owner.store.write(pendingKey, null);
      pending = null;
      conflict = false;
      selectedRating = null;
      _apply(next);
      await saveDraft();
      unawaited(owner.refresh());
      return true;
    } catch (e) {
      if (active) {
        error = owner.message(e);
        conflict =
            e is ApiFailure &&
            (e.status == 409 || e.status == 400 || e.status == 404);
      }
      return false;
    }
  }

  /// Discard only after an explicit user choice, retaining the rejected text.
  Future<void> resolveConflict() async {
    if (!active || busy || !conflict || attempt == null) return;
    busy = true;
    notifyListeners();
    try {
      recoveredDraft = draft;
      await owner.store.write('review.${attempt!.id}.rejected', pending);
      if (hasUncommittedBatch) {
        await owner.store.write('review.${attempt!.id}.rejectedJournal', {
          'inFlight': _inFlightBatch,
          'queued': List<Json>.from(_queuedResults),
        });
      }
      await owner.store.write(pendingKey, null);
      await owner.store.write(journalKey, null);
      _queuedResults.clear();
      _inFlightBatch = null;
      if (!active) return;
      pending = null;
      selectedRating = null;
      conflict = false;
    } catch (e) {
      if (active) error = owner.message(e);
      return;
    } finally {
      if (active) {
        busy = false;
        notifyListeners();
      }
    }
    if (active) await load(attempt!.id);
  }

  @override
  void dispose() {
    _draftTimer?.cancel();
    _ratingHighlightTimer?.cancel();
    if (attempt != null) {
      unawaited(
        saveDraft().catchError((Object e) {
          debugPrint(
            'Vocabulary draft persistence failed during disposal (${e.runtimeType}).',
          );
        }),
      );
    }
    _disposed = true;
    _epoch++;
    super.dispose();
  }
}
