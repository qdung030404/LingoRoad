part of 'notifications_ui_test.dart';

void _registerNotificationWidgetTests() {
  group('NotificationsPage widget tests', () {
    testWidgets('renders list, marks single item read with deep-link callback, and marks all read', (
      tester,
    ) async {
      final items = <AppNotification>[
        _sampleNotification(
          id: 'n-1',
          type: AppNotificationType.dailyPlanReady,
          title: 'Lộ trình hôm nay đã sẵn sàng',
          body: 'Hoàn thành 2 bài đọc để giữ chuỗi học.',
          targetType: AppNotificationTargetType.dailyPlan,
          targetPayload: const {'date': '2026-11-28'},
        ),
        _sampleNotification(
          id: 'n-2',
          type: AppNotificationType.vocabularyReviewDue,
          title: 'Có 6 từ vựng cần ôn tập',
          body: 'Ôn nhanh 3 phút để nhớ lâu hơn.',
          targetType: AppNotificationTargetType.vocabularyReview,
        ),
      ];

      final repo = _FakeNotificationRepository(
        onList: (_, _) async => NotificationPageResult(
          items: List<AppNotification>.from(items),
          unreadCount: items.where((e) => e.isUnread).length,
        ),
        onMarkRead: (id) async {
          final idx = items.indexWhere((e) => e.id == id);
          items[idx] = items[idx].copyWith(readAt: DateTime.now());
          return (
            item: items[idx],
            unreadCount: items.where((e) => e.isUnread).length,
          );
        },
        onMarkAllRead: () async {
          for (var i = 0; i < items.length; i++) {
            items[i] = items[i].copyWith(readAt: DateTime.now());
          }
          return 0;
        },
      );

      final controller = NotificationController(
        repository: repo,
        accountId: 'acc-1',
      );
      addTearDown(controller.dispose);

      AppNotification? openedNotification;

      await tester.pumpWidget(
        _buildTestApp(
          NotificationsPage(
            controller: controller,
            onOpenNotification: (n) => openedNotification = n,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Thông báo'), findsOneWidget);
      expect(find.byKey(const Key('notificationsMarkAllRead')), findsOneWidget);
      expect(find.byKey(const Key('notificationItem_n-1')), findsOneWidget);
      expect(find.byKey(const Key('notificationUnreadDot_n-1')), findsOneWidget);
      expect(find.byKey(const Key('notificationUnreadDot_n-2')), findsOneWidget);

      // Tap first item -> marks read + invokes deep-link callback
      await tester.tap(find.byKey(const Key('notificationItem_n-1')));
      await tester.pumpAndSettle();

      expect(openedNotification?.id, 'n-1');
      expect(openedNotification?.targetType, AppNotificationTargetType.dailyPlan);
      expect(find.byKey(const Key('notificationUnreadDot_n-1')), findsNothing);
      expect(find.byKey(const Key('notificationUnreadDot_n-2')), findsOneWidget);

      // Tap "Đọc tất cả" -> marks remaining read and hides button
      await tester.tap(find.byKey(const Key('notificationsMarkAllRead')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('notificationUnreadDot_n-2')), findsNothing);
      expect(find.byKey(const Key('notificationsMarkAllRead')), findsNothing);
    });

    testWidgets('shows empty state when there are no notifications', (
      tester,
    ) async {
      final controller = NotificationController(
        repository: _FakeNotificationRepository(),
        accountId: 'acc-1',
      );
      addTearDown(controller.dispose);

      await tester.pumpWidget(
        _buildTestApp(NotificationsPage(controller: controller)),
      );
      await tester.pumpAndSettle();

      expect(find.text('Chưa có thông báo nào'), findsOneWidget);
      expect(find.byIcon(Icons.notifications_none_rounded), findsOneWidget);
      expect(find.byKey(const Key('notificationsMarkAllRead')), findsNothing);
    });

    testWidgets('shows error state and recovers when tapping retry', (
      tester,
    ) async {
      var shouldFail = true;
      final repo = _FakeNotificationRepository(
        onList: (_, _) async {
          if (shouldFail) {
            throw const ApiFailure('Không thể kết nối máy chủ.');
          }
          return NotificationPageResult(
            items: [
              _sampleNotification(
                id: 'n-ok',
                title: 'Đã khôi phục thông báo',
              ),
            ],
            unreadCount: 1,
          );
        },
      );

      final controller = NotificationController(
        repository: repo,
        accountId: 'acc-1',
      );
      addTearDown(controller.dispose);

      await tester.pumpWidget(
        _buildTestApp(NotificationsPage(controller: controller)),
      );
      await tester.pumpAndSettle();

      expect(find.text('Không tải được thông báo'), findsOneWidget);
      expect(find.text('Không thể kết nối máy chủ.'), findsOneWidget);
      expect(find.text('Thử lại'), findsOneWidget);

      shouldFail = false;
      await tester.tap(find.text('Thử lại'));
      await tester.pumpAndSettle();

      expect(find.text('Đã khôi phục thông báo'), findsOneWidget);
      expect(find.text('Không tải được thông báo'), findsNothing);
    });

    testWidgets('renders cleanly without overflow at narrow 320x640 viewport with preview badge and load more', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final repo = _FakeNotificationRepository(
        onList: (cursor, limit) async {
          if (cursor == null) {
            return NotificationPageResult(
              items: [
                _sampleNotification(
                  id: 'long-1',
                  type: AppNotificationType.placementCompleted,
                  title:
                      'Hoàn tất kiểm tra trình độ đầu vào và sẵn sàng lộ trình cá nhân hóa',
                  body:
                      'LingoRoad đã xây dựng lộ trình học chi tiết dựa trên kết quả kiểm tra trình độ của bạn.',
                ),
                _sampleNotification(
                  id: 'long-2',
                  type: AppNotificationType.speakingResultReady,
                  title: 'Nhận xét chi tiết bài luyện nói chủ đề giao tiếp hằng ngày',
                  body: 'Xem điểm phát âm, độ trôi chảy và gợi ý cải thiện.',
                  targetType: AppNotificationTargetType.speaking,
                ),
              ],
              nextCursor: 'page-2',
              unreadCount: 2,
            );
          }
          return NotificationPageResult(
            items: [
              _sampleNotification(
                id: 'long-3',
                type: AppNotificationType.skillLevelChanged,
                title: 'Nâng cấp trình độ kỹ năng Đọc lên B1',
                body: 'Bạn đã đạt kết quả tốt liên tiếp trong các bài đọc gần đây.',
                targetType: AppNotificationTargetType.profile,
              ),
            ],
            nextCursor: null,
            unreadCount: 3,
          );
        },
      );

      final controller = NotificationController(
        repository: repo,
        accountId: 'preview',
      );
      addTearDown(controller.dispose);

      await tester.pumpWidget(
        _buildTestApp(
          NotificationsPage(controller: controller, isPreview: true),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.textContaining('Chế độ xem trước'), findsOneWidget);
      expect(find.byKey(const Key('notificationsMarkAllRead')), findsOneWidget);

      // Verify minimum 48px touch targets on header controls and cards
      final backSize = tester.getSize(
        find.byKey(const Key('notificationsBackButton')),
      );
      expect(backSize.width, greaterThanOrEqualTo(48));
      expect(backSize.height, greaterThanOrEqualTo(48));

      final markAllSize = tester.getSize(
        find.byKey(const Key('notificationsMarkAllRead')),
      );
      expect(markAllSize.height, greaterThanOrEqualTo(48));

      // Scroll to and tap "Tải thêm"
      await tester.scrollUntilVisible(
        find.byKey(const Key('notificationsLoadMore')),
        200,
      );
      await tester.tap(find.byKey(const Key('notificationsLoadMore')));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byKey(const Key('notificationItem_long-3')), findsOneWidget);
      expect(find.byKey(const Key('notificationsLoadMore')), findsNothing);
    });
  });

  group('InAppNotificationBannerHost widget tests', () {
    testWidgets('shows banner, auto-dismisses after duration, and taps to open target', (
      tester,
    ) async {
      final controller = NotificationController(
        repository: _FakeNotificationRepository(),
        accountId: 'acc-1',
      );
      addTearDown(controller.dispose);

      InAppBannerMessage? tappedBanner;

      await tester.pumpWidget(
        _buildTestApp(
          InAppNotificationBannerHost(
            controller: controller,
            autoDismissDuration: const Duration(milliseconds: 500),
            onTapBanner: (banner) => tappedBanner = banner,
            child: const Scaffold(body: Center(child: Text('Nội dung chính'))),
          ),
        ),
      );

      // Show first banner and verify auto-dismiss
      controller.showBanner(
        const InAppBannerMessage(
          dedupeKey: 'auto-1',
          type: AppNotificationType.dailyGoalMet,
          title: 'Đạt mục tiêu hôm nay!',
          body: 'Bạn đã hoàn thành 15 phút học.',
          targetType: AppNotificationTargetType.dailyPlan,
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      expect(find.text('Đạt mục tiêu hôm nay!'), findsOneWidget);
      expect(
        find.byKey(const Key('inAppNotificationBannerSlide')),
        findsOneWidget,
      );

      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();

      expect(controller.currentBanner, isNull);
      expect(find.text('Đạt mục tiêu hôm nay!'), findsNothing);

      // Show second banner and tap to trigger callback + dismiss
      controller.showBanner(
        const InAppBannerMessage(
          dedupeKey: 'tap-1',
          type: AppNotificationType.speakingResultReady,
          title: 'Kết quả luyện nói đã có',
          body: 'Chạm để xem chi tiết nhận xét.',
          targetType: AppNotificationTargetType.speaking,
          targetPayload: {'submissionId': 'sub-9'},
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      await tester.tap(find.byKey(const Key('inAppNotificationBannerCard')));
      await tester.pumpAndSettle();

      expect(tappedBanner?.dedupeKey, 'tap-1');
      expect(tappedBanner?.targetPayload?['submissionId'], 'sub-9');
      expect(controller.currentBanner, isNull);
      expect(find.text('Kết quả luyện nói đã có'), findsNothing);
    });

    testWidgets('dismisses banner via close button and swipe up', (
      tester,
    ) async {
      final controller = NotificationController(
        repository: _FakeNotificationRepository(),
        accountId: 'acc-1',
      );
      addTearDown(controller.dispose);

      await tester.pumpWidget(
        _buildTestApp(
          InAppNotificationBannerHost(
            controller: controller,
            autoDismissDuration: const Duration(seconds: 10),
            child: const Scaffold(body: Center(child: Text('Màn hình chính'))),
          ),
        ),
      );

      // Dismiss via X button
      controller.showBanner(
        const InAppBannerMessage(
          dedupeKey: 'close-btn-1',
          type: AppNotificationType.dailyPlanReady,
          title: 'Lộ trình ngày mới',
          body: 'Bắt đầu bài học đầu tiên hôm nay.',
          targetType: AppNotificationTargetType.dailyPlan,
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      expect(find.text('Lộ trình ngày mới'), findsOneWidget);
      await tester.tap(find.byKey(const Key('inAppNotificationBannerClose')));
      await tester.pumpAndSettle();

      expect(controller.currentBanner, isNull);
      expect(find.text('Lộ trình ngày mới'), findsNothing);

      // Dismiss via upward swipe
      controller.showBanner(
        const InAppBannerMessage(
          dedupeKey: 'swipe-up-1',
          type: AppNotificationType.vocabularyReviewDue,
          title: 'Nhắc ôn từ vựng',
          body: 'Vuốt lên để ẩn thông báo này.',
          targetType: AppNotificationTargetType.vocabularyReview,
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));

      expect(find.text('Nhắc ôn từ vựng'), findsOneWidget);
      await tester.fling(
        find.byKey(const Key('inAppNotificationBannerCard')),
        const Offset(0, -300),
        1000,
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(controller.currentBanner, isNull);
      expect(find.text('Nhắc ôn từ vựng'), findsNothing);
    });

    testWidgets('respects disableAnimations: true without SlideTransition', (
      tester,
    ) async {
      final controller = NotificationController(
        repository: _FakeNotificationRepository(),
        accountId: 'acc-1',
      );
      addTearDown(controller.dispose);

      await tester.pumpWidget(
        _buildTestApp(
          InAppNotificationBannerHost(
            controller: controller,
            autoDismissDuration: const Duration(milliseconds: 300),
            child: const Scaffold(body: Center(child: Text('Giảm chuyển động'))),
          ),
          disableAnimations: true,
        ),
      );

      controller.showBanner(
        const InAppBannerMessage(
          dedupeKey: 'reduced-motion-1',
          type: AppNotificationType.skillLevelChanged,
          title: 'Thăng hạng kỹ năng Đọc',
          body: 'Trình độ của bạn đã tăng lên B1.',
          targetType: AppNotificationTargetType.profile,
        ),
      );
      await tester.pump();

      expect(find.text('Thăng hạng kỹ năng Đọc'), findsOneWidget);
      expect(
        find.byKey(const Key('inAppNotificationBannerSlide')),
        findsNothing,
      );

      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump();

      expect(controller.currentBanner, isNull);
      expect(find.text('Thăng hạng kỹ năng Đọc'), findsNothing);
    });
  });
}
