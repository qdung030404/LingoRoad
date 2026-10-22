import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';

class PlacementController extends ChangeNotifier {
  PlacementController(this.api);
  final ApiClient api;
  String? sessionId;
  Json? item;
  Json? result;
  int totalItems = 10;
  int? selected;
  bool busy = false;
  String? error;
  bool _disposed = false;
  @override
  void notifyListeners() {
    if (!_disposed) super.notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }

  DateTime _shownAt = DateTime.now();
  Future<void> start() async {
    busy = true;
    error = null;
    notifyListeners();
    try {
      final data = await api.request('POST', '/placement/start');
      sessionId = data['sessionId'] as String;
      totalItems = data['totalItems'] as int;
      _setItem(data['firstItem'] as Map?);
    } catch (e) {
      error = e.toString();
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  void select(int value) {
    if (!busy) {
      selected = value;
      notifyListeners();
    }
  }

  void _setItem(Map? next) {
    item = next?.cast<String, dynamic>();
    selected = null;
    _shownAt = DateTime.now();
  }

  Future<void> submit() async {
    if (busy || selected == null || item == null) return;
    busy = true;
    error = null;
    notifyListeners();
    try {
      final data = await api.request(
        'POST',
        '/placement/$sessionId/answer',
        data: {
          'itemId': item!['id'],
          'itemIndex': item!['index'],
          'selectedOption': (item!['options'] as List)[selected!],
          'responseTimeMs': DateTime.now().difference(_shownAt).inMilliseconds,
        },
      );
      if (data['isFinished'] == true) {
        result = (data['result'] as Map).cast<String, dynamic>();
        item = null;
      } else {
        final next = data['nextItem'] as Map?;
        if (next == null) {
          throw const ApiFailure(
            'Không tải được câu tiếp theo. Vui lòng thử lại.',
          );
        }
        _setItem(next);
      }
    } catch (e) {
      error = e.toString();
    } finally {
      busy = false;
      notifyListeners();
    }
  }
}
