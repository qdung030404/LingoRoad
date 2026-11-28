import 'package:flutter/foundation.dart';
import '../../core/api/api_client.dart';
import 'notification_models.dart';
import 'notification_repository.dart';

class NotificationController extends ChangeNotifier {
  NotificationController({
    required this.repository,
    required this.accountId,
    this.isAccountCurrent,
  });

  final NotificationRepository repository;
  final String accountId;
  final bool Function()? isAccountCurrent;

  List<AppNotification> _items = const <AppNotification>[];
  int _unreadCount = 0;
  bool _loading = false;
  bool _loadingMore = false;
  bool _markingAll = false;
  String? _error;
  String? _nextCursor;
  InAppBannerMessage? _currentBanner;

  final Set<String> _shownBannerKeys = <String>{};
  final Set<String> _markingIds = <String>{};

  bool _disposed = false;
  int _epoch = 0;

  List<AppNotification> get items => _items;
  int get unreadCount => _unreadCount;
  bool get loading => _loading;
  bool get loadingMore => _loadingMore;
  bool get markingAll => _markingAll;
  String? get error => _error;
  String? get nextCursor => _nextCursor;
  bool get hasMore => _nextCursor != null;
  InAppBannerMessage? get currentBanner => _currentBanner;
  bool get active => !_disposed && (isAccountCurrent?.call() ?? true);

  @override
  void notifyListeners() {
    if (active) {
      super.notifyListeners();
    }
  }

  void syncUnreadCount(int count) {
    if (!active) return;
    final normalized = count < 0 ? 0 : count;
    if (_unreadCount == normalized) return;
    _unreadCount = normalized;
    notifyListeners();
  }

  Future<void> refresh() async {
    if (!active) return;
    final epoch = ++_epoch;
    _loading = true;
    _loadingMore = false;
    _error = null;
    notifyListeners();

    try {
      final page = await repository.list();
      if (!active || epoch != _epoch) return;
      _items = List<AppNotification>.unmodifiable(page.items);
      _nextCursor = page.nextCursor;
      _unreadCount = page.unreadCount < 0 ? 0 : page.unreadCount;
      _error = null;
    } on ApiFailure catch (e) {
      if (!active || epoch != _epoch) return;
      if (e.status == 404) {
        _items = const <AppNotification>[];
        _nextCursor = null;
        _unreadCount = 0;
        _error = null;
      } else {
        _error = e.message;
      }
    } catch (_) {
      if (!active || epoch != _epoch) return;
      _error = 'Không tải được thông báo. Vui lòng thử lại.';
    } finally {
      if (active && epoch == _epoch) {
        _loading = false;
        notifyListeners();
      }
    }
  }

  Future<void> loadMore() async {
    if (!active || _loading || _loadingMore) return;
    final cursor = _nextCursor;
    if (cursor == null || cursor.isEmpty) return;

    final epoch = _epoch;
    _loadingMore = true;
    _error = null;
    notifyListeners();

    try {
      final page = await repository.list(cursor: cursor);
      if (!active || epoch != _epoch) return;
      final seenIds = <String>{for (final item in _items) item.id};
      final merged = List<AppNotification>.from(_items);
      for (final item in page.items) {
        if (seenIds.add(item.id)) {
          merged.add(item);
        }
      }
      _items = List<AppNotification>.unmodifiable(merged);
      _nextCursor = page.nextCursor;
      _unreadCount = page.unreadCount < 0 ? 0 : page.unreadCount;
      _error = null;
    } on ApiFailure catch (e) {
      if (!active || epoch != _epoch) return;
      if (e.status == 404) {
        _nextCursor = null;
        _error = null;
      } else {
        _error = e.message;
      }
    } catch (_) {
      if (!active || epoch != _epoch) return;
      _error = 'Không tải thêm được thông báo. Vui lòng thử lại.';
    } finally {
      if (active && epoch == _epoch) {
        _loadingMore = false;
        notifyListeners();
      }
    }
  }

  Future<void> markRead(String id) async {
    if (!active || _markingIds.contains(id)) return;

    final index = _items.indexWhere((item) => item.id == id);
    final previousItem = index != -1 ? _items[index] : null;
    if (previousItem != null && !previousItem.isUnread) return;

    _markingIds.add(id);
    final epoch = _epoch;
    final optimisticReadAt = DateTime.now();
    final wasUnread = previousItem?.isUnread ?? false;

    if (index != -1 && previousItem != null) {
      final updated = List<AppNotification>.from(_items);
      updated[index] = previousItem.copyWith(readAt: optimisticReadAt);
      _items = List<AppNotification>.unmodifiable(updated);
      if (wasUnread && _unreadCount > 0) {
        _unreadCount--;
      }
      notifyListeners();
    }

    try {
      final result = await repository.markRead(id);
      if (!active || epoch != _epoch) return;
      final currentIndex = _items.indexWhere((item) => item.id == id);
      if (currentIndex != -1) {
        final updated = List<AppNotification>.from(_items);
        updated[currentIndex] = result.item;
        _items = List<AppNotification>.unmodifiable(updated);
      }
      _unreadCount = result.unreadCount < 0 ? 0 : result.unreadCount;
      notifyListeners();
    } on ApiFailure catch (e) {
      if (!active || epoch != _epoch) return;
      if (e.status != 404 && previousItem != null) {
        _revertOptimisticMarkRead(
          previousItem: previousItem,
          optimisticReadAt: optimisticReadAt,
          wasUnread: wasUnread,
        );
      }
    } catch (_) {
      if (!active || epoch != _epoch) return;
      if (previousItem != null) {
        _revertOptimisticMarkRead(
          previousItem: previousItem,
          optimisticReadAt: optimisticReadAt,
          wasUnread: wasUnread,
        );
      }
    } finally {
      _markingIds.remove(id);
    }
  }

  void _revertOptimisticMarkRead({
    required AppNotification previousItem,
    required DateTime optimisticReadAt,
    required bool wasUnread,
  }) {
    final currentIndex = _items.indexWhere(
      (item) => item.id == previousItem.id,
    );
    if (currentIndex == -1) return;
    if (_items[currentIndex].readAt != optimisticReadAt) return;
    final restored = List<AppNotification>.from(_items);
    restored[currentIndex] = previousItem;
    _items = List<AppNotification>.unmodifiable(restored);
    if (wasUnread) {
      _unreadCount++;
    }
    notifyListeners();
  }

  Future<void> markAllRead() async {
    if (!active || _markingAll) return;
    if (_unreadCount == 0 && _items.every((item) => !item.isUnread)) return;

    final epoch = ++_epoch;
    final previousItems = _items;
    final previousUnread = _unreadCount;
    final now = DateTime.now();

    _markingAll = true;
    _error = null;
    _items = List<AppNotification>.unmodifiable([
      for (final item in _items)
        item.isUnread ? item.copyWith(readAt: now) : item,
    ]);
    _unreadCount = 0;
    notifyListeners();

    try {
      final updatedUnread = await repository.markAllRead();
      if (!active || epoch != _epoch) return;
      _unreadCount = updatedUnread < 0 ? 0 : updatedUnread;
    } on ApiFailure catch (e) {
      if (!active || epoch != _epoch) return;
      if (e.status == 404) {
        _unreadCount = 0;
      } else {
        _items = previousItems;
        _unreadCount = previousUnread;
        _error = e.message;
      }
    } catch (_) {
      if (!active || epoch != _epoch) return;
      _items = previousItems;
      _unreadCount = previousUnread;
      _error = 'Chưa đánh dấu đã đọc tất cả được. Vui lòng thử lại.';
    } finally {
      if (active && epoch == _epoch) {
        _markingAll = false;
        notifyListeners();
      }
    }
  }

  void showBanner(InAppBannerMessage banner) {
    if (!active) return;
    if (!_shownBannerKeys.add(banner.dedupeKey)) return;
    _currentBanner = banner;
    notifyListeners();
  }

  void dismissBanner() {
    if (!active || _currentBanner == null) return;
    _currentBanner = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    _epoch++;
    super.dispose();
  }
}
