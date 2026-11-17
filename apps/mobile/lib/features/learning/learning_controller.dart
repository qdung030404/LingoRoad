import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/api/api_client.dart';
import '../vocabulary/vocabulary_controller.dart';
import 'learning_repository.dart';
import 'daily_learning.dart';
import 'activity_collector.dart';

/// Owns one learner's server state. Pending edits never become graded answers.
class LearningController extends ChangeNotifier {
  LearningController({
    required this.repository,
    required this.accountId,
    this.isAccountCurrent,
    this.daily,
    this.vocabulary,
  });
  final LearningRepository repository;
  final String accountId;
  final bool Function()? isAccountCurrent;
  final DailyLearningController? daily;
  final VocabularyController? vocabulary;
  ActivityOutbox? _activity;
  ActivityOutbox? get activity =>
      daily == null ? null : (_activity ??= ActivityOutbox(owner: daily!));
  List<LearningLesson> lessons = [];
  Json summary = {};
  bool loading = false;
  String? error;
  bool _disposed = false;
  int _epoch = 0;
  bool get active => !_disposed && (isAccountCurrent?.call() ?? true);
  @override
  void notifyListeners() {
    if (active) super.notifyListeners();
  }

  Future<void> refresh() async {
    final epoch = ++_epoch;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final result = await Future.wait([
        repository.catalogue(),
        repository.summary(),
      ]);
      if (!active || epoch != _epoch) return;
      lessons = learningItems(
        result[0]['items'],
      ).map(LearningLesson.new).toList();
      summary = result[1];
      await daily?.refresh();
    } catch (e) {
      if (active && epoch == _epoch) {
        error = e is ApiFailure
            ? e.message
            : 'Không tải được bài học. Hãy thử lại.';
      }
    } finally {
      if (active && epoch == _epoch) {
        loading = false;
        notifyListeners();
      }
    }
  }

  LearningLesson? get continueLesson {
    final id = daily?.plan?['continueLessonId'] ?? summary['continueLessonId'];
    if (daily?.plan != null && daily!.plan!['continueLessonId'] == null) {
      return null;
    }
    for (final lesson in lessons) {
      if (lesson.id == id) return lesson;
    }
    for (final lesson in lessons) {
      if (lesson.state != 'COMPLETED') return lesson;
    }
    return null;
  }

  @override
  void dispose() {
    _disposed = true;
    _epoch++;
    super.dispose();
  }
}

class LearningAttemptController extends ChangeNotifier {
  LearningAttemptController({required this.owner});
  final LearningController owner;
  LearningRepository get repository => owner.repository;
  LearningAttempt? attempt;
  bool loading = true, busy = false, syncing = false;
  String? error, notice;
  Json? _pending;
  bool _disposed = false;
  int _loadEpoch = 0;
  Timer? _timer;
  Future<void> _storage = Future.value();
  Future<bool>? _flush;
  Future<LearningAttempt> Function()? _failedAction;
  final Map<String, Json> _aiExplanations = {};
  final Set<String> _explainingQuestions = {};
  final Map<String, String> _explainErrors = {};
  bool get active => !_disposed && owner.active;
  bool get unsynced => _pending != null;
  Json? aiExplanation(String questionId) => _aiExplanations[questionId];
  bool isExplaining(String questionId) =>
      _explainingQuestions.contains(questionId);
  String? explainError(String questionId) => _explainErrors[questionId];
  String get _key => 'learning.pending.${owner.accountId}.${attempt!.id}';
  @override
  void notifyListeners() {
    if (active) super.notifyListeners();
  }

  String get phase => attempt!.phase;
  int get index => attempt!.index;
  String? selected(String questionId) {
    final answer = attempt!.answer(questionId);
    if (answer?['checked'] == true) return answer?['optionId'] as String?;
    if (_pending?['questionId'] == questionId) {
      return _pending?['optionId'] as String?;
    }
    return answer?['optionId'] as String?;
  }

  Future<void> load({String? lessonId, String? attemptId}) async {
    final epoch = ++_loadEpoch;
    _timer?.cancel();
    loading = true;
    error = null;
    _aiExplanations.clear();
    _explainingQuestions.clear();
    _explainErrors.clear();
    notifyListeners();
    try {
      final result = attemptId != null
          ? await repository.attempt(attemptId)
          : await repository.start(lessonId!);
      if (!active || epoch != _loadEpoch) return;
      attempt = result;
      _pending = null;
      final prefs = await SharedPreferences.getInstance();
      if (!active || epoch != _loadEpoch) return;
      final raw = prefs.getString(_key);
      if (raw != null) {
        _pending = Map<String, dynamic>.from(jsonDecode(raw) as Map);
        await _reconcile();
      }
    } catch (e) {
      if (active && epoch == _loadEpoch) error = _message(e);
    } finally {
      if (active && epoch == _loadEpoch) {
        loading = false;
        notifyListeners();
        if (_pending != null) {
          _timer = Timer(const Duration(milliseconds: 500), () {
            flush();
          });
        }
      }
    }
  }

  String _message(Object e) =>
      e is ApiFailure ? e.message : 'Không lưu được tiến độ. Hãy thử lại.';
  Future<void> _persist() {
    final key = _key;
    final value = _pending == null ? null : jsonEncode(_pending);
    final next = _storage.catchError((_) {}).then((_) async {
      final prefs = await SharedPreferences.getInstance();
      final ok = value == null
          ? await prefs.remove(key)
          : await prefs.setString(key, value);
      if (!ok) throw StateError('Draft storage unavailable');
    });
    _storage = next;
    return next;
  }

  Future<void> _reconcile() async {
    final pending = _pending;
    if (pending == null) return;
    final answer = attempt!.answer(pending['questionId'] as String? ?? '');
    if (attempt!.completed ||
        answer?['checked'] == true ||
        pending['expectedVersion'] != attempt!.version) {
      // A newer server version can be a lost response or another device's edit.
      final same =
          attempt!.phase == pending['phase'] &&
          attempt!.index == pending['index'] &&
          (pending['questionId'] == null ||
              answer?['optionId'] == pending['optionId']);
      if (!same && !attempt!.completed) {
        notice =
            'Tiến độ đã thay đổi trên máy chủ. Đã tải bản mới; hãy chọn lại nếu cần.';
      }
      _pending = null;
      await _persist();
    }
  }

  Future<void> select(String questionId, String optionId) async {
    if (!active ||
        busy ||
        attempt == null ||
        attempt!.completed ||
        attempt!.answer(questionId)?['checked'] == true) {
      return;
    }
    _timer?.cancel();
    _pending = {
      'expectedVersion': attempt!.version,
      'phase': phase,
      'index': index,
      'questionId': questionId,
      'optionId': optionId,
    };
    error = null;
    notice = null;
    notifyListeners();
    try {
      await _persist();
    } catch (e) {
      if (active) {
        error = _message(e);
        notifyListeners();
      }
    }
  }

  Future<bool> flush() {
    _timer?.cancel();
    if (_flush != null) return _flush!;
    final future = _flushPending();
    _flush = future;
    return future.whenComplete(() {
      _flush = null;
    });
  }

  Future<bool> _flushPending() async {
    if (!active) return false;
    final pending = _pending;
    if (pending == null) return true;
    syncing = true;
    error = null;
    notifyListeners();
    try {
      // Retry local storage as well as the network after a previous write failed.
      await _persist();
      if (!active) return false;
      final result = await repository.progress(attempt!.id, pending);
      if (!active) return false;
      attempt = result;
      if (identical(_pending, pending)) {
        _pending = null;
        await _persist();
      }
      return true;
    } catch (e) {
      if (!active) return false;
      if (e is ApiFailure && e.status == 409) {
        try {
          attempt = await repository.attempt(attempt!.id);
          if (!active) return false;
          await _reconcile();
        } catch (reloadError) {
          if (active) error = _message(reloadError);
          return false;
        }
      } else {
        error = _message(e);
      }
      return false;
    } finally {
      if (active) {
        syncing = false;
        notifyListeners();
      }
    }
  }

  Future<void> _action(
    Future<LearningAttempt> Function() action, {
    bool flushPending = true,
  }) async {
    if (!active || busy) return;
    busy = true;
    _failedAction = null;
    error = null;
    notice = null;
    notifyListeners();
    try {
      if (flushPending && (!await flush() || !active)) return;
      final result = await action();
      if (!active) return;
      attempt = result;
    } catch (e) {
      if (!active) return;
      if (e is ApiFailure && e.status == 409) {
        try {
          attempt = await repository.attempt(attempt!.id);
          if (!active) return;
          await _reconcile();
          notice = 'Tiến độ đã thay đổi. Đã tải dữ liệu mới nhất.';
        } catch (reloadError) {
          if (active) {
            error = _message(reloadError);
            _failedAction = () => repository.attempt(attempt!.id);
          }
        }
      } else {
        error = _message(e);
        _failedAction = action;
      }
    } finally {
      if (active) {
        busy = false;
        notifyListeners();
      }
    }
  }

  Future<void> retry() async {
    if (!active || busy || syncing) return;
    if (_failedAction != null) {
      await _action(_failedAction!, flushPending: false);
    } else if (_pending != null) {
      await flush();
    }
  }

  Future<void> move(String phase, int index) => _action(() async {
    _pending = {
      'expectedVersion': attempt!.version,
      'phase': phase,
      'index': index,
    };
    await _persist();
    final result = await repository.progress(attempt!.id, _pending!);
    if (active) {
      _pending = null;
      await _persist();
    }
    return result;
  }, flushPending: false);

  Future<void> check(String questionId) => _action(() async {
    final option = selected(questionId);
    if (option == null) {
      throw const ApiFailure('Chọn một đáp án trước khi kiểm tra.');
    }
    final result = await repository.check(attempt!.id, questionId, {
      'expectedVersion': attempt!.version,
      'optionId': option,
    });
    if (active && _pending?['questionId'] == questionId) {
      _pending = null;
      await _persist();
    }
    return result;
  }, flushPending: _pending != null && _pending?['questionId'] != questionId);
  Future<void> submit() =>
      _action(() => repository.submit(attempt!.id, attempt!.version));

  Future<bool> cancel() async {
    final current = attempt;
    if (!active || current == null || current.completed) return true;
    if (busy) return false;
    _timer?.cancel();
    busy = true;
    error = null;
    notice = null;
    notifyListeners();
    try {
      await _flush?.catchError((_) => false);
      if (!active) return false;
      _pending = null;
      await _persist().catchError((_) {});
      if (!active) return false;
      await repository.cancel(current.id);
      return true;
    } on ApiFailure catch (e) {
      if (e.status == 404) return true;
      if (active) error = e.message;
      return false;
    } catch (_) {
      if (active) error = 'Không hủy được bài học. Hãy thử lại.';
      return false;
    } finally {
      if (active) {
        busy = false;
        notifyListeners();
      }
    }
  }

  Future<void> explainQuestion(String questionId) async {
    final current = attempt;
    final previous = _aiExplanations[questionId];
    if (!active ||
        current == null ||
        current.lesson.kind != 'READING' ||
        current.answer(questionId)?['checked'] != true ||
        previous?['source'] == 'AI' ||
        previous?['retryable'] == false ||
        _explainingQuestions.contains(questionId)) {
      return;
    }
    final targetAttemptId = current.id;
    _explainingQuestions.add(questionId);
    _explainErrors.remove(questionId);
    notifyListeners();
    try {
      final result = await repository.explainReadingAnswer(
        targetAttemptId,
        questionId,
      );
      if (!active || attempt?.id != targetAttemptId) return;
      _aiExplanations[questionId] = result;
    } catch (e) {
      if (!active || attempt?.id != targetAttemptId) return;
      _explainErrors[questionId] = e is ApiFailure
          ? e.message
          : 'Không tải được giải thích AI. Hãy thử lại.';
    } finally {
      _explainingQuestions.remove(questionId);
      if (active) notifyListeners();
    }
  }
  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    super.dispose();
  }
}
