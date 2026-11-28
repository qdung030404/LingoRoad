import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/core/api/api_client.dart';
import 'package:mobile/core/config/app_config.dart';
import 'package:mobile/core/theme/app_theme.dart';
import 'package:mobile/features/notifications/in_app_notification_banner.dart';
import 'package:mobile/features/notifications/notification_controller.dart';
import 'package:mobile/features/notifications/notification_models.dart';
import 'package:mobile/features/notifications/notification_repository.dart';
import 'package:mobile/features/notifications/notifications_page.dart';
import 'test_helpers.dart';

part 'notifications_ui_widget_cases.dart';

class _FakeNotificationRepository implements NotificationRepository {
  _FakeNotificationRepository({
    this.onList,
    this.onMarkRead,
    this.onMarkAllRead,
  });

  Future<NotificationPageResult> Function(String? cursor, int limit)? onList;
  Future<({AppNotification item, int unreadCount})> Function(String id)?
  onMarkRead;
  Future<int> Function()? onMarkAllRead;

  final List<String?> listCursors = <String?>[];
  final List<String> markedReadIds = <String>[];
  int markAllReadCalls = 0;

  @override
  Future<NotificationPageResult> list({String? cursor, int limit = 20}) {
    listCursors.add(cursor);
    if (onList != null) return onList!(cursor, limit);
    return Future<NotificationPageResult>.value(
      const NotificationPageResult(items: <AppNotification>[], unreadCount: 0),
    );
  }

  @override
  Future<({AppNotification item, int unreadCount})> markRead(String id) {
    markedReadIds.add(id);
    if (onMarkRead != null) return onMarkRead!(id);
    return Future<({AppNotification item, int unreadCount})>.value((
      item: AppNotification(
        id: id,
        type: AppNotificationType.dailyPlanReady,
        title: 'Đã đọc',
        body: 'Nội dung',
        readAt: DateTime.now(),
        createdAt: DateTime.now(),
      ),
      unreadCount: 0,
    ));
  }

  @override
  Future<int> markAllRead() {
    markAllReadCalls++;
    if (onMarkAllRead != null) return onMarkAllRead!();
    return Future<int>.value(0);
  }
}

class _StubNotificationApi extends ApiClient {
  _StubNotificationApi()
    : super(config: AppConfig(), store: MemoryTokenStore('refresh')) {
    accessToken = 'access';
  }

  final List<(String method, String path)> calls = <(String, String)>[];
  Future<Json> Function(String method, String path)? handler;

  @override
  Future<Json> request(
    String method,
    String path, {
    Json? data,
    bool auth = true,
    Duration? receiveTimeout,
  }) async {
    calls.add((method, path));
    if (handler != null) {
      return handler!(method, path);
    }
    return <String, dynamic>{};
  }
}

AppNotification _sampleNotification({
  required String id,
  AppNotificationType type = AppNotificationType.dailyPlanReady,
  String title = 'Lộ trình hôm nay đã sẵn sàng',
  String body = 'Bạn có 3 bài học mới đang chờ hoàn thành.',
  AppNotificationTargetType targetType = AppNotificationTargetType.dailyPlan,
  Map<String, dynamic>? targetPayload,
  DateTime? readAt,
  DateTime? createdAt,
}) {
  return AppNotification(
    id: id,
    type: type,
    title: title,
    body: body,
    targetType: targetType,
    targetPayload: targetPayload,
    readAt: readAt,
    createdAt: createdAt ?? DateTime.now().subtract(const Duration(minutes: 5)),
  );
}

Widget _buildTestApp(
  Widget child, {
  bool disableAnimations = false,
}) {
  return MaterialApp(
    debugShowCheckedModeBanner: false,
    theme: AppTheme.lightTheme,
    builder: (context, widget) => MediaQuery(
      data: MediaQuery.of(context).copyWith(
        disableAnimations: disableAnimations,
      ),
      child: widget!,
    ),
    home: child,
  );
}

void main() {
  group('Notification models & repositories', () {
    test('parses backend enum strings and handles unknown values safely', () {
      expect(
        AppNotificationType.fromApi('DAILY_PLAN_READY'),
        AppNotificationType.dailyPlanReady,
      );
      expect(
        AppNotificationType.fromApi('DAILY_GOAL_MET'),
        AppNotificationType.dailyGoalMet,
      );
      expect(
        AppNotificationType.fromApi('SKILL_LEVEL_CHANGED'),
        AppNotificationType.skillLevelChanged,
      );
      expect(
        AppNotificationType.fromApi('PLACEMENT_COMPLETED'),
        AppNotificationType.placementCompleted,
      );
      expect(
        AppNotificationType.fromApi('VOCABULARY_REVIEW_DUE'),
        AppNotificationType.vocabularyReviewDue,
      );
      expect(
        AppNotificationType.fromApi('SPEAKING_RESULT_READY'),
        AppNotificationType.speakingResultReady,
      );
      expect(
        AppNotificationType.fromApi('FUTURE_EVENT'),
        AppNotificationType.unknown,
      );

      expect(
        AppNotificationTargetType.fromApi('DAILY_PLAN'),
        AppNotificationTargetType.dailyPlan,
      );
      expect(
        AppNotificationTargetType.fromApi('LESSON'),
        AppNotificationTargetType.lesson,
      );
      expect(
        AppNotificationTargetType.fromApi('VOCABULARY_REVIEW'),
        AppNotificationTargetType.vocabularyReview,
      );
      expect(
        AppNotificationTargetType.fromApi('PROFILE'),
        AppNotificationTargetType.profile,
      );
      expect(
        AppNotificationTargetType.fromApi('SPEAKING'),
        AppNotificationTargetType.speaking,
      );
      expect(
        AppNotificationTargetType.fromApi('NONE'),
        AppNotificationTargetType.none,
      );
      expect(
        AppNotificationTargetType.fromApi(null),
        AppNotificationTargetType.none,
      );
    });

    test('ApiNotificationRepository calls expected endpoints and parses data', () async {
      final api = _StubNotificationApi()
        ..handler = (method, path) async {
          if (method == 'GET' && path.startsWith('/notifications')) {
            return {
              'items': [
                {
                  'id': 'n-1',
                  'type': 'SPEAKING_RESULT_READY',
                  'title': 'Kết quả luyện nói đã sẵn sàng',
                  'body': 'Xem nhận xét chi tiết cho bài nói của bạn.',
                  'targetType': 'SPEAKING',
                  'targetPayload': {'submissionId': 'sub-1'},
                  'readAt': null,
                  'createdAt': '2026-11-28T00:10:00.000Z',
                },
              ],
              'nextCursor': 'cur-2',
              'unreadCount': 1,
            };
          }
          if (method == 'PATCH' && path == '/notifications/n-1/read') {
            return {
              'item': {
                'id': 'n-1',
                'type': 'SPEAKING_RESULT_READY',
                'title': 'Kết quả luyện nói đã sẵn sàng',
                'body': 'Xem nhận xét chi tiết cho bài nói của bạn.',
                'targetType': 'SPEAKING',
                'targetPayload': {'submissionId': 'sub-1'},
                'readAt': '2026-11-28T00:15:00.000Z',
                'createdAt': '2026-11-28T00:10:00.000Z',
              },
              'unreadCount': 0,
            };
          }
          if (method == 'POST' && path == '/notifications/read-all') {
            return {'markedCount': 1, 'unreadCount': 0};
          }
          return {};
        };

      final repo = ApiNotificationRepository(api);
      final page = await repo.list(cursor: 'cur-1', limit: 15);
      expect(page.items, hasLength(1));
      expect(page.items.first.type, AppNotificationType.speakingResultReady);
      expect(page.items.first.targetType, AppNotificationTargetType.speaking);
      expect(page.items.first.targetPayload?['submissionId'], 'sub-1');
      expect(page.items.first.isUnread, isTrue);
      expect(page.nextCursor, 'cur-2');
      expect(page.unreadCount, 1);

      final marked = await repo.markRead('n-1');
      expect(marked.item.isUnread, isFalse);
      expect(marked.unreadCount, 0);

      final unreadAfterAll = await repo.markAllRead();
      expect(unreadAfterAll, 0);

      expect(api.calls, [
        ('GET', '/notifications?limit=15&cursor=cur-1'),
        ('PATCH', '/notifications/n-1/read'),
        ('POST', '/notifications/read-all'),
      ]);
    });

    test('PreviewNotificationRepository supports list, markRead and markAllRead', () async {
      final repo = PreviewNotificationRepository();
      final page = await repo.list();
      expect(page.items.length, inInclusiveRange(2, 3));
      expect(page.unreadCount, greaterThan(0));

      final firstUnread = page.items.firstWhere((item) => item.isUnread);
      final readResult = await repo.markRead(firstUnread.id);
      expect(readResult.item.isUnread, isFalse);
      expect(readResult.unreadCount, page.unreadCount - 1);

      final remaining = await repo.markAllRead();
      expect(remaining, 0);

      final afterAll = await repo.list();
      expect(afterAll.unreadCount, 0);
      expect(afterAll.items.every((item) => !item.isUnread), isTrue);
    });

    test('formatRelativeNotificationTime produces Vietnamese labels', () {
      final now = DateTime(2026, 11, 28, 15, 30);
      expect(
        formatRelativeNotificationTime(
          now.subtract(const Duration(seconds: 25)),
          now: now,
        ),
        'Vừa xong',
      );
      expect(
        formatRelativeNotificationTime(
          now.subtract(const Duration(minutes: 5)),
          now: now,
        ),
        '5 phút trước',
      );
      expect(
        formatRelativeNotificationTime(
          now.subtract(const Duration(hours: 2)),
          now: now,
        ),
        '2 giờ trước',
      );
      expect(
        formatRelativeNotificationTime(
          now.subtract(const Duration(hours: 26)),
          now: now,
        ),
        'Hôm qua',
      );
      expect(
        formatRelativeNotificationTime(DateTime(2026, 11, 20, 9, 0), now: now),
        '20/11',
      );
    });
  });

  group('NotificationController', () {
    test('refresh loads items, handles 404 fallback, and prevents stale race', () async {
      final firstCompleter = Completer<NotificationPageResult>();
      var callCount = 0;

      final repo = _FakeNotificationRepository(
        onList: (cursor, limit) {
          callCount++;
          if (callCount == 1) return firstCompleter.future;
          return Future<NotificationPageResult>.value(
            NotificationPageResult(
              items: [_sampleNotification(id: 'new-1', title: 'Mới nhất')],
              unreadCount: 1,
            ),
          );
        },
      );

      final controller = NotificationController(
        repository: repo,
        accountId: 'acc-1',
      );
      addTearDown(controller.dispose);

      final firstRefresh = controller.refresh();
      final secondRefresh = controller.refresh();
      await secondRefresh;

      firstCompleter.complete(
        NotificationPageResult(
          items: [_sampleNotification(id: 'old-1', title: 'Cũ hơn')],
          unreadCount: 5,
        ),
      );
      await firstRefresh;

      expect(controller.items.map((e) => e.id).toList(), ['new-1']);
      expect(controller.unreadCount, 1);
      expect(controller.loading, isFalse);

      // Legacy 404 fallback
      repo.onList = (_, _) async =>
          throw const ApiFailure('Not found', status: 404);
      await controller.refresh();
      expect(controller.items, isEmpty);
      expect(controller.unreadCount, 0);
      expect(controller.error, isNull);
    });

    test('loadMore appends next page and deduplicates overlapping IDs', () async {
      final repo = _FakeNotificationRepository(
        onList: (cursor, limit) async {
          if (cursor == null) {
            return NotificationPageResult(
              items: [
                _sampleNotification(id: 'n-1'),
                _sampleNotification(id: 'n-2'),
              ],
              nextCursor: 'cursor-2',
              unreadCount: 3,
            );
          }
          return NotificationPageResult(
            items: [
              _sampleNotification(id: 'n-2'), // duplicate
              _sampleNotification(id: 'n-3'),
            ],
            nextCursor: null,
            unreadCount: 3,
          );
        },
      );

      final controller = NotificationController(
        repository: repo,
        accountId: 'acc-1',
      );
      addTearDown(controller.dispose);

      await controller.refresh();
      expect(controller.items.map((e) => e.id).toList(), ['n-1', 'n-2']);
      expect(controller.hasMore, isTrue);

      await controller.loadMore();
      expect(controller.items.map((e) => e.id).toList(), ['n-1', 'n-2', 'n-3']);
      expect(controller.hasMore, isFalse);
      expect(repo.listCursors, [null, 'cursor-2']);
    });

    test('markRead performs optimistic update, reconciles server response, and rolls back on failure', () async {
      final markCompleter =
          Completer<({AppNotification item, int unreadCount})>();
      final item1 = _sampleNotification(id: 'n-1');
      final item2 = _sampleNotification(id: 'n-2');

      final repo = _FakeNotificationRepository(
        onList: (_, _) async => NotificationPageResult(
          items: [item1, item2],
          unreadCount: 2,
        ),
        onMarkRead: (id) {
          if (id == 'n-1') return markCompleter.future;
          return Future.error(const ApiFailure('Mất kết nối', status: 500));
        },
      );

      final controller = NotificationController(
        repository: repo,
        accountId: 'acc-1',
      );
      addTearDown(controller.dispose);

      await controller.refresh();
      expect(controller.unreadCount, 2);

      // Optimistic update before API resolves
      final markFuture = controller.markRead('n-1');
      expect(controller.items.first.isUnread, isFalse);
      expect(controller.unreadCount, 1);

      markCompleter.complete((
        item: item1.copyWith(readAt: DateTime(2026, 11, 28, 10, 0)),
        unreadCount: 1,
      ));
      await markFuture;
      expect(controller.items.first.isUnread, isFalse);
      expect(controller.unreadCount, 1);

      // Failure reverts optimistic markRead cleanly without throwing
      await controller.markRead('n-2');
      expect(controller.items[1].isUnread, isTrue);
      expect(controller.unreadCount, 1);
      expect(controller.error, isNull);
    });

    test('markAllRead marks all notifications read and clears unread count', () async {
      final repo = _FakeNotificationRepository(
        onList: (_, _) async => NotificationPageResult(
          items: [
            _sampleNotification(id: 'n-1'),
            _sampleNotification(id: 'n-2'),
          ],
          unreadCount: 2,
        ),
        onMarkAllRead: () async => 0,
      );

      final controller = NotificationController(
        repository: repo,
        accountId: 'acc-1',
      );
      addTearDown(controller.dispose);

      await controller.refresh();
      await controller.markAllRead();

      expect(controller.unreadCount, 0);
      expect(controller.items.every((item) => !item.isUnread), isTrue);
      expect(repo.markAllReadCalls, 1);
    });

    test('syncUnreadCount and banner deduplication work per session', () {
      var notifyCount = 0;
      final controller = NotificationController(
        repository: _FakeNotificationRepository(),
        accountId: 'acc-1',
      )..addListener(() => notifyCount++);
      addTearDown(controller.dispose);

      controller.syncUnreadCount(4);
      expect(controller.unreadCount, 4);
      expect(notifyCount, 1);

      controller.syncUnreadCount(4);
      expect(notifyCount, 1);

      const banner1 = InAppBannerMessage(
        dedupeKey: 'goal-2026-11-28',
        type: AppNotificationType.dailyGoalMet,
        title: 'Hoàn thành mục tiêu ngày!',
        body: 'Bạn đã hoàn thành 15 phút học hôm nay.',
        targetType: AppNotificationTargetType.dailyPlan,
      );
      controller.showBanner(banner1);
      expect(controller.currentBanner?.dedupeKey, 'goal-2026-11-28');

      controller.dismissBanner();
      expect(controller.currentBanner, isNull);

      // Same dedupeKey in the same session should NOT show again
      controller.showBanner(banner1);
      expect(controller.currentBanner, isNull);

      // Different dedupeKey shows normally
      const banner2 = InAppBannerMessage(
        dedupeKey: 'level-up-1',
        type: AppNotificationType.skillLevelChanged,
        title: 'Nâng trình độ Đọc lên B1',
        body: 'Chúc mừng bạn đã thăng hạng kỹ năng Đọc.',
        targetType: AppNotificationTargetType.profile,
      );
      controller.showBanner(banner2);
      expect(controller.currentBanner?.dedupeKey, 'level-up-1');
    });

    test('ignores updates when isAccountCurrent returns false', () async {
      var current = true;
      final completer = Completer<NotificationPageResult>();
      final controller = NotificationController(
        repository: _FakeNotificationRepository(onList: (_, _) => completer.future),
        accountId: 'acc-1',
        isAccountCurrent: () => current,
      );
      addTearDown(controller.dispose);

      final pending = controller.refresh();
      current = false;
      completer.complete(
        NotificationPageResult(
          items: [_sampleNotification(id: 'n-1')],
          unreadCount: 1,
        ),
      );
      await pending;

      expect(controller.active, isFalse);
      expect(controller.items, isEmpty);
    });
  });

  _registerNotificationWidgetTests();
}
