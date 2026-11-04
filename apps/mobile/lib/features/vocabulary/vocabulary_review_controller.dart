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
  int? _feedbackUntilMs;
  bool get active => !_disposed && owner.active;
  bool get unsynced => pending != null;
  String get pendingKey => 'review.${attempt!.id}.pending';
  String get draftKey => 'review.${attempt!.id}.draft';
  @override
  void notifyListeners() {
    if (active) super.notifyListeners();
  }

  Future<void> load(String id) async {
    if (!active || busy) return;
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
      if (!active || epoch != _epoch) return;
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
    } catch (e) {
      if (active && epoch == _epoch) error = owner.message(e);
    } finally {
      if (active && epoch == _epoch) {
        loading = false;
        notifyListeners();
      }
    }
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
    if (!active ||
        attempt == null ||
        attempt!.finished ||
        attempt!.current == null) {
      return true;
    }
    if (unsynced) return retryPending();
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

  Future<bool> rate(String rating) =>
      command('RATE', payload: {'rating': rating}, feedback: rating);
  Future<bool> advance() => command('ADVANCE');
  Future<bool> skip() => command('SKIP');
  Future<bool> requeue() => command('REQUEUE');
  Future<bool> submit() => command('SUBMIT');
  Future<bool> abandon() => command('ABANDON');

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
    _feedbackUntilMs = feedback == null
        ? null
        : DateTime.now().millisecondsSinceEpoch + 1500;
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
    if (!active || busy || pending == null) return false;
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
      final resultFuture = owner.repository.request(
        'POST',
        '/vocabulary/reviews/${attempt!.id}/commands',
        body: vocabularyCopy(pending!),
      );
      final remaining =
          (_feedbackUntilMs ?? 0) - DateTime.now().millisecondsSinceEpoch;
      final feedbackReady = remaining <= 0
          ? Future<void>.value()
          : Future<void>.delayed(Duration(milliseconds: remaining));
      final result = await resultFuture;
      // Keep the old card until both ACK and minimum feedback duration.
      await feedbackReady;
      if (!active) return false;
      if ((result['receipt'] as Map?)?['commandId'] != pending!['commandId']) {
        throw const ApiFailure('Máy chủ chưa xác nhận đúng thao tác.');
      }
      final next = VocabularyReviewAttempt(vocabularyJson(result['attempt']));
      await owner.store.write(pendingKey, null);
      pending = null;
      conflict = false;
      selectedRating = null;
      _feedbackUntilMs = null;
      _apply(next);
      await saveDraft();
      await owner.refresh();
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
      await owner.store.write(pendingKey, null);
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
