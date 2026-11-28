import '../../core/api/api_client.dart';
import 'notification_models.dart';

abstract class NotificationRepository {
  Future<NotificationPageResult> list({String? cursor, int limit = 20});

  Future<({AppNotification item, int unreadCount})> markRead(String id);

  Future<int> markAllRead();
}

class ApiNotificationRepository implements NotificationRepository {
  ApiNotificationRepository(this.api);

  final ApiClient api;

  @override
  Future<NotificationPageResult> list({String? cursor, int limit = 20}) async {
    final safeLimit = limit.clamp(1, 50);
    final queryParams = <String, String>{'limit': '$safeLimit'};
    final trimmedCursor = cursor?.trim();
    if (trimmedCursor != null && trimmedCursor.isNotEmpty) {
      queryParams['cursor'] = trimmedCursor;
    }
    final query = Uri(queryParameters: queryParams).query;
    final res = await api.request('GET', '/notifications?$query');
    return NotificationPageResult.fromJson(res);
  }

  @override
  Future<({AppNotification item, int unreadCount})> markRead(String id) async {
    final encodedId = Uri.encodeComponent(id);
    final res = await api.request('PATCH', '/notifications/$encodedId/read');
    final rawItem = res['item'];
    if (rawItem is! Map) {
      throw const ApiFailure(
        'Phản hồi thông báo không hợp lệ.',
        code: 'NOTIFICATION_RESPONSE_INVALID',
      );
    }
    final item = AppNotification.fromJson(Map<String, dynamic>.from(rawItem));
    final unreadCount = (res['unreadCount'] as num?)?.toInt() ?? 0;
    return (item: item, unreadCount: unreadCount < 0 ? 0 : unreadCount);
  }

  @override
  Future<int> markAllRead() async {
    final res = await api.request('POST', '/notifications/read-all');
    final unreadCount = (res['unreadCount'] as num?)?.toInt() ?? 0;
    return unreadCount < 0 ? 0 : unreadCount;
  }
}

class PreviewNotificationRepository implements NotificationRepository {
  PreviewNotificationRepository({
    List<AppNotification>? initialItems,
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now {
    final now = _clock();
    _items = List<AppNotification>.from(
      initialItems ?? _defaultPreviewItems(now),
    );
  }

  final DateTime Function() _clock;
  late final List<AppNotification> _items;

  static List<AppNotification> _defaultPreviewItems(DateTime now) => [
    AppNotification(
      id: 'preview-daily-plan',
      type: AppNotificationType.dailyPlanReady,
      title: 'Lộ trình mẫu hôm nay đã sẵn sàng',
      body:
          'Đây là thông báo xem thử. Mở lộ trình mẫu để xem các bài học gợi ý theo ngày.',
      targetType: AppNotificationTargetType.dailyPlan,
      targetPayload: const {'preview': true},
      createdAt: now.subtract(const Duration(minutes: 15)),
    ),
    AppNotification(
      id: 'preview-vocab-due',
      type: AppNotificationType.vocabularyReviewDue,
      title: 'Từ vựng mẫu đến hạn ôn tập',
      body:
          'Bản xem thử có 5 thẻ từ mẫu giúp bạn trải nghiệm tính năng ôn tập ngắt quãng.',
      targetType: AppNotificationTargetType.vocabularyReview,
      targetPayload: const {'preview': true, 'needsReviewCount': 5},
      createdAt: now.subtract(const Duration(hours: 2)),
    ),
    AppNotification(
      id: 'preview-daily-goal',
      type: AppNotificationType.dailyGoalMet,
      title: 'Ví dụ thông báo đạt mục tiêu ngày',
      body:
          'Khi đăng nhập và hoàn thành thời lượng học mỗi ngày, LingoRoad sẽ ghi nhận thành tích tại đây.',
      targetType: AppNotificationTargetType.dailyPlan,
      targetPayload: const {'preview': true},
      readAt: now.subtract(const Duration(hours: 20)),
      createdAt: now.subtract(const Duration(days: 1)),
    ),
  ];

  int get _unreadCount => _items.where((item) => item.isUnread).length;

  @override
  Future<NotificationPageResult> list({String? cursor, int limit = 20}) async {
    final safeLimit = limit.clamp(1, 50);
    var startIndex = 0;
    if (cursor != null && cursor.isNotEmpty) {
      final parsed = int.tryParse(cursor);
      if (parsed != null && parsed >= 0) {
        startIndex = parsed;
      }
    }
    if (startIndex >= _items.length) {
      return NotificationPageResult(
        items: const <AppNotification>[],
        nextCursor: null,
        unreadCount: _unreadCount,
      );
    }
    final endIndex = (startIndex + safeLimit).clamp(0, _items.length);
    final slice = _items.sublist(startIndex, endIndex);
    final nextCursor = endIndex < _items.length ? '$endIndex' : null;
    return NotificationPageResult(
      items: List<AppNotification>.unmodifiable(slice),
      nextCursor: nextCursor,
      unreadCount: _unreadCount,
    );
  }

  @override
  Future<({AppNotification item, int unreadCount})> markRead(String id) async {
    final index = _items.indexWhere((item) => item.id == id);
    if (index == -1) {
      throw const ApiFailure(
        'Không tìm thấy thông báo.',
        code: 'NOTIFICATION_NOT_FOUND',
        status: 404,
      );
    }
    final current = _items[index];
    final updated = current.isUnread
        ? current.copyWith(readAt: _clock())
        : current;
    _items[index] = updated;
    return (item: updated, unreadCount: _unreadCount);
  }

  @override
  Future<int> markAllRead() async {
    final now = _clock();
    for (var i = 0; i < _items.length; i++) {
      if (_items[i].isUnread) {
        _items[i] = _items[i].copyWith(readAt: now);
      }
    }
    return 0;
  }
}
