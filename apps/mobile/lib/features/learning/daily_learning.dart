import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';

abstract class DailyRepository {
  Future<Json> ensurePlan();
  Future<Json> preferences();
  Future<Json> savePreferences(Json body);
  Future<Json> progress();
  Future<Json> openActivity(String attemptId, String runId);
  Future<Json> sendSegments(String sessionId, List<Json> segments);
}

class ApiDailyRepository implements DailyRepository {
  ApiDailyRepository(this.api);
  final ApiClient api;
  @override
  Future<Json> ensurePlan() =>
      api.request('POST', '/learning/plan/today', data: {});
  @override
  Future<Json> preferences() => api.request('GET', '/learning/preferences');
  @override
  Future<Json> savePreferences(Json body) =>
      api.request('PATCH', '/learning/preferences', data: body);
  @override
  Future<Json> progress() => api.request('GET', '/learning/progress');
  @override
  Future<Json> openActivity(String attemptId, String runId) => api.request(
    'POST',
    '/learning/attempts/$attemptId/activity-sessions',
    data: {'clientRunId': runId},
  );
  @override
  Future<Json> sendSegments(String sessionId, List<Json> segments) =>
      api.request(
        'POST',
        '/learning/activity-sessions/$sessionId/segments',
        data: {'segments': segments},
      );
}

class DailyLearningController extends ChangeNotifier {
  DailyLearningController({
    required this.repository,
    required this.accountId,
    required this.isCurrent,
    this.onPreferences,
    this.onHomeChanged,
  });
  final DailyRepository repository;
  final String accountId;
  final bool Function() isCurrent;
  final void Function(Json preferences)? onPreferences;
  final Future<void> Function()? onHomeChanged;
  Future<void>? _details;
  DateTime? _detailsAt;
  int _detailsEpoch = 0;
  Json? plan, preferences, progress;
  String? error;
  bool loading = false, _disposed = false;
  int _epoch = 0;
  bool get active => !_disposed && isCurrent();
  Json get today => Map<String, dynamic>.from(progress?['today'] as Map? ?? {});
  @override
  void notifyListeners() {
    if (active) super.notifyListeners();
  }

  void applyHome(Json home) {
    if (!active) return;
    plan = (home['plan'] as Map?)?.cast<String, dynamic>();
    preferences = (home['preferences'] as Map).cast<String, dynamic>();
    onPreferences?.call(preferences!);
    progress = {
      ...?progress,
      'today': home['today'],
      'days': home['days'],
      'totals': {...?(progress?['totals'] as Map?), ...(home['totals'] as Map)},
      'milestones': home['milestones'] ?? progress?['milestones'],
      'placementCefr': home['placementCefr'] ?? progress?['placementCefr'],
    };
    error = null;
    notifyListeners();
  }

  void invalidateDetails() {
    _detailsEpoch++;
    loading = false;
    _detailsAt = null;
    _details = null;
  }

  Future<void> loadDetails() {
    if (!active) return Future.value();
    final at = _detailsAt;
    if (at != null &&
        DateTime.now().difference(at) < const Duration(seconds: 60)) {
      return Future.value();
    }
    return _details ??= _loadDetails(_detailsEpoch);
  }

  Future<void> _loadDetails(int epoch) async {
    await Future<void>.value();
    if (!active || epoch != _detailsEpoch) return;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final value = await repository.progress();
      if (!active || epoch != _detailsEpoch) return;
      progress = value;
      _detailsAt = DateTime.now();
    } catch (e) {
      if (active && epoch == _detailsEpoch) {
        error = e is ApiFailure
            ? e.message
            : 'Không tải được tiến độ. Hãy thử lại.';
      }
    } finally {
      if (active && epoch == _detailsEpoch) {
        loading = false;
        _details = null;
        notifyListeners();
      }
    }
  }

  Future<void> refresh() => onHomeChanged?.call() ?? refreshLegacy();

  Future<void> refreshLegacy() async {
    if (!active) return;
    final epoch = ++_epoch;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final response = await repository.ensurePlan();
      final results = await Future.wait([
        repository.preferences(),
        repository.progress(),
      ]);
      if (!active || epoch != _epoch) return;
      if (results[0]['dailyGoalMinutes'] is! num ||
          results[0]['version'] is! num ||
          results[0]['preferredKinds'] is! List ||
          results[1]['today'] is! Map ||
          results[1]['totals'] is! Map ||
          results[1]['days'] is! List) {
        throw const ApiFailure(
          'Phản hồi kế hoạch chưa đầy đủ. Hãy thử lại.',
          code: 'LEARNING_RESPONSE_INVALID',
        );
      }
      plan = (response['plan'] as Map?)?.cast<String, dynamic>();
      preferences = results[0];
      onPreferences?.call(preferences!);
      progress = results[1];
      _detailsAt = DateTime.now();
    } catch (e) {
      if (active && epoch == _epoch) {
        error = e is ApiFailure
            ? e.message
            : 'Không tải được kế hoạch. Hãy thử lại.';
      }
    } finally {
      if (active && epoch == _epoch) {
        loading = false;
        notifyListeners();
      }
    }
  }

  Future<void> save(int minutes, List<String> kinds) async {
    await repository.savePreferences({
      'dailyGoalMinutes': minutes,
      'preferredKinds': kinds,
      'expectedVersion': preferences!['version'],
    });
    if (active) await refresh();
  }

  @override
  void dispose() {
    _disposed = true;
    _epoch++;
    super.dispose();
  }
}
