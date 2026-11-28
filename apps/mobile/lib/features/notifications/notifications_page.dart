import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'in_app_notification_banner.dart';
import 'notification_controller.dart';
import 'notification_models.dart';

String formatRelativeNotificationTime(DateTime createdAt, {DateTime? now}) {
  final current = (now ?? DateTime.now()).toLocal();
  final localCreated = createdAt.toLocal();
  final diff = current.difference(localCreated);

  if (diff.isNegative || diff.inSeconds < 60) {
    return 'Vừa xong';
  }
  if (diff.inMinutes < 60) {
    return '${diff.inMinutes} phút trước';
  }
  if (diff.inHours < 24) {
    return '${diff.inHours} giờ trước';
  }

  final todayStart = DateTime(current.year, current.month, current.day);
  final createdDay = DateTime(
    localCreated.year,
    localCreated.month,
    localCreated.day,
  );
  final dayDiff = todayStart.difference(createdDay).inDays;
  if (dayDiff <= 1) {
    return 'Hôm qua';
  }

  final day = localCreated.day.toString().padLeft(2, '0');
  final month = localCreated.month.toString().padLeft(2, '0');
  return '$day/$month';
}

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({
    super.key,
    required this.controller,
    this.onOpenNotification,
    this.isPreview = false,
  });

  final NotificationController controller;
  final FutureOr<void> Function(AppNotification notification)?
  onOpenNotification;
  final bool isPreview;

  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  @override
  void initState() {
    super.initState();
    if (!widget.controller.loading) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && widget.controller.active) {
          unawaited(widget.controller.refresh());
        }
      });
    }
  }

  Future<void> _handleTapNotification(AppNotification notification) async {
    unawaited(widget.controller.markRead(notification.id));
    await widget.onOpenNotification?.call(notification);
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: AppColors.grey25,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: AppColors.grey25,
        body: SafeArea(
          child: ListenableBuilder(
            listenable: widget.controller,
            builder: (context, _) {
              final ctrl = widget.controller;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildHeader(context, ctrl),
                  if (widget.isPreview) _buildPreviewNotice(),
                  Expanded(child: _buildBody(context, ctrl)),
                ],
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, NotificationController ctrl) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 12, 8),
      child: Row(
        children: [
          IconButton(
            key: const Key('notificationsBackButton'),
            tooltip: 'Quay lại',
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            onPressed: () => Navigator.of(context).maybePop(),
            icon: const Icon(
              Icons.arrow_back_rounded,
              color: AppColors.grey900,
            ),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              'Thông báo',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: designHeading(20, color: AppColors.grey900, height: 1.25),
            ),
          ),
          if (ctrl.unreadCount > 0)
            TextButton(
              key: const Key('notificationsMarkAllRead'),
              onPressed: ctrl.markingAll ? null : ctrl.markAllRead,
              style: TextButton.styleFrom(
                foregroundColor: AppColors.primary700,
                disabledForegroundColor: AppColors.grey500,
                minimumSize: const Size(48, 48),
                padding: const EdgeInsets.symmetric(horizontal: 10),
                tapTargetSize: MaterialTapTargetSize.padded,
              ),
              child: Text(
                'Đọc tất cả',
                maxLines: 1,
                softWrap: false,
                style: designText(
                  14,
                  weight: FontWeight.w600,
                  color: ctrl.markingAll
                      ? AppColors.grey500
                      : AppColors.primary700,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildPreviewNotice() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.primary25,
          borderRadius: AppRadius.cardSm,
          border: Border.all(color: AppColors.primary100),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.info_outline_rounded,
              size: 16,
              color: AppColors.primary700,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Chế độ xem trước · Thông báo minh họa dữ liệu mẫu',
                style: designText(
                  12,
                  weight: FontWeight.w500,
                  color: AppColors.primary800,
                  height: 1.35,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context, NotificationController ctrl) {
    if (ctrl.loading && ctrl.items.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(color: AppColors.primary500),
            const SizedBox(height: 12),
            Text(
              'Đang tải thông báo...',
              style: designText(14, color: AppColors.grey800),
            ),
          ],
        ),
      );
    }

    if (ctrl.error != null && ctrl.items.isEmpty) {
      return RefreshIndicator(
        color: AppColors.primary500,
        onRefresh: ctrl.refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 32, 16, 24),
          children: [_buildErrorState(ctrl)],
        ),
      );
    }

    if (ctrl.items.isEmpty) {
      return RefreshIndicator(
        color: AppColors.primary500,
        onRefresh: ctrl.refresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 48, 16, 24),
          children: [_buildEmptyState()],
        ),
      );
    }

    return RefreshIndicator(
      color: AppColors.primary500,
      onRefresh: ctrl.refresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        children: [
          if (ctrl.error != null) ...[
            _buildInlineError(ctrl),
            const SizedBox(height: 12),
          ],
          for (var i = 0; i < ctrl.items.length; i++) ...[
            if (i > 0) const SizedBox(height: 10),
            _buildNotificationCard(ctrl.items[i]),
          ],
          if (ctrl.hasMore) ...[
            const SizedBox(height: 16),
            CustomAppButton(
              key: const Key('notificationsLoadMore'),
              text: 'Tải thêm',
              isSecondary: true,
              isLoading: ctrl.loadingMore,
              onPressed: ctrl.loadingMore ? null : ctrl.loadMore,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildErrorState(NotificationController ctrl) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.grey0,
        borderRadius: AppRadius.cardRadius,
        border: Border.all(color: AppColors.grey100),
        boxShadow: AppShadows.level1,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: AppColors.error0,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.error_outline_rounded,
              size: 28,
              color: AppColors.error200,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Không tải được thông báo',
            textAlign: TextAlign.center,
            style: designHeading(18, color: AppColors.grey900),
          ),
          const SizedBox(height: 8),
          Semantics(
            liveRegion: true,
            child: Text(
              ctrl.error ?? 'Vui lòng kiểm tra kết nối mạng và thử lại.',
              textAlign: TextAlign.center,
              style: designText(14, color: AppColors.grey800, height: 1.45),
            ),
          ),
          const SizedBox(height: 20),
          CustomAppButton(
            key: const Key('notificationsRetryButton'),
            text: 'Thử lại',
            onPressed: ctrl.refresh,
          ),
        ],
      ),
    );
  }

  Widget _buildInlineError(NotificationController ctrl) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.error0,
        borderRadius: AppRadius.cardSm,
        border: Border.all(color: AppColors.error25),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.error_outline_rounded,
            size: 18,
            color: AppColors.error200,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              ctrl.error ?? 'Có lỗi xảy ra. Vui lòng thử lại.',
              style: designText(13, color: AppColors.error300, height: 1.35),
            ),
          ),
          TextButton(
            onPressed: ctrl.refresh,
            style: TextButton.styleFrom(
              foregroundColor: AppColors.error200,
              minimumSize: const Size(48, 48),
              padding: const EdgeInsets.symmetric(horizontal: 8),
            ),
            child: const Text('Thử lại'),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      decoration: BoxDecoration(
        color: AppColors.grey0,
        borderRadius: AppRadius.cardRadius,
        border: Border.all(color: AppColors.grey100),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64,
            height: 64,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: AppColors.primary25,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.notifications_none_rounded,
              size: 32,
              color: AppColors.primary600,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Chưa có thông báo nào',
            textAlign: TextAlign.center,
            style: designHeading(18, color: AppColors.grey900),
          ),
          const SizedBox(height: 8),
          Text(
            'Lộ trình học mỗi ngày, nhắc ôn từ vựng và kết quả bài luyện sẽ hiện tại đây.',
            textAlign: TextAlign.center,
            style: designText(14, color: AppColors.grey800, height: 1.45),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationCard(AppNotification item) {
    final unread = item.isUnread;
    final relativeTime = formatRelativeNotificationTime(item.createdAt);

    return Semantics(
      button: true,
      label:
          '${item.title}. ${item.body}. $relativeTime.${unread ? ' Chưa đọc.' : ''}',
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: unread ? AppColors.grey0 : AppColors.grey5,
          borderRadius: AppRadius.cardRadius,
          border: Border.all(
            color: unread ? AppColors.primary100 : AppColors.grey100,
          ),
          boxShadow: unread ? AppShadows.level1 : null,
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: AppRadius.cardRadius,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            key: Key('notificationItem_${item.id}'),
            borderRadius: AppRadius.cardRadius,
            onTap: () => _handleTapNotification(item),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 48),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    NotificationTypeIcon(type: item.type, size: 42),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  item.title,
                                  style: designText(
                                    15,
                                    weight: unread
                                        ? FontWeight.w600
                                        : FontWeight.w500,
                                    color: AppColors.grey900,
                                    height: 1.3,
                                  ),
                                ),
                              ),
                              if (unread) ...[
                                const SizedBox(width: 8),
                                Container(
                                  key: Key('notificationUnreadDot_${item.id}'),
                                  width: 8,
                                  height: 8,
                                  margin: const EdgeInsets.only(top: 6),
                                  decoration: const BoxDecoration(
                                    color: AppColors.primary500,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item.body,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                            style: designText(
                              14,
                              color: AppColors.grey800,
                              height: 1.45,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  relativeTime,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: designText(
                                    12,
                                    color: AppColors.grey500,
                                    height: 1.3,
                                  ),
                                ),
                              ),
                              if (item.targetType !=
                                  AppNotificationTargetType.none)
                                const Icon(
                                  Icons.chevron_right_rounded,
                                  size: 18,
                                  color: AppColors.grey500,
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
