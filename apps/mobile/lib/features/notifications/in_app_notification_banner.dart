import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
import '../../shared/figma_widgets.dart';
import 'notification_controller.dart';
import 'notification_models.dart';

class NotificationTypeIcon extends StatelessWidget {
  const NotificationTypeIcon({
    super.key,
    required this.type,
    this.size = 40,
  });

  final AppNotificationType type;
  final double size;

  ({IconData icon, Color background, Color foreground}) get _style =>
      switch (type) {
        AppNotificationType.dailyPlanReady => (
          icon: Icons.calendar_today_rounded,
          background: AppColors.primary25,
          foreground: AppColors.primary700,
        ),
        AppNotificationType.dailyGoalMet => (
          icon: Icons.emoji_events_rounded,
          background: AppColors.warning0,
          foreground: AppColors.warning300,
        ),
        AppNotificationType.skillLevelChanged => (
          icon: Icons.trending_up_rounded,
          background: const Color(0xFFEEF2FF),
          foreground: const Color(0xFF4338CA),
        ),
        AppNotificationType.placementCompleted => (
          icon: Icons.workspace_premium_rounded,
          background: const Color(0xFFF3E8FF),
          foreground: const Color(0xFF7E22CE),
        ),
        AppNotificationType.vocabularyReviewDue => (
          icon: Icons.style_rounded,
          background: const Color(0xFFE0F2FE),
          foreground: const Color(0xFF0369A1),
        ),
        AppNotificationType.speakingResultReady => (
          icon: Icons.mic_rounded,
          background: const Color(0xFFFCE7F3),
          foreground: const Color(0xFFBE185D),
        ),
        AppNotificationType.unknown => (
          icon: Icons.notifications_rounded,
          background: AppColors.grey50,
          foreground: AppColors.grey800,
        ),
      };

  @override
  Widget build(BuildContext context) {
    final style = _style;
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: style.background,
          shape: BoxShape.circle,
        ),
        child: Icon(style.icon, size: size * 0.5, color: style.foreground),
      ),
    );
  }
}

class InAppNotificationBannerHost extends StatefulWidget {
  const InAppNotificationBannerHost({
    super.key,
    required this.controller,
    required this.child,
    this.onTapBanner,
    this.autoDismissDuration = const Duration(milliseconds: 3500),
  });

  final NotificationController controller;
  final Widget child;
  final FutureOr<void> Function(InAppBannerMessage banner)? onTapBanner;
  final Duration autoDismissDuration;

  @override
  State<InAppNotificationBannerHost> createState() =>
      _InAppNotificationBannerHostState();
}

class _InAppNotificationBannerHostState
    extends State<InAppNotificationBannerHost>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animController;
  late final Animation<Offset> _slideAnimation;
  late final Animation<double> _fadeAnimation;

  Timer? _autoDismissTimer;
  InAppBannerMessage? _displayedBanner;
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
      reverseDuration: const Duration(milliseconds: 180),
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, -1),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(
        parent: _animController,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInCubic,
      ),
    );
    _fadeAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.easeOut,
      reverseCurve: Curves.easeIn,
    );
    widget.controller.addListener(_onControllerChanged);
    final initial = widget.controller.currentBanner;
    if (initial != null) {
      _displayedBanner = initial;
      _scheduleAutoDismiss(initial);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_initialized) {
      _initialized = true;
      if (_displayedBanner != null) {
        if (MediaQuery.disableAnimationsOf(context)) {
          _animController.value = 1.0;
        } else {
          _animController.forward(from: 0.0);
        }
      }
    }
  }

  @override
  void didUpdateWidget(covariant InAppNotificationBannerHost oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_onControllerChanged);
      widget.controller.addListener(_onControllerChanged);
      _onControllerChanged();
    } else if (oldWidget.autoDismissDuration != widget.autoDismissDuration &&
        _displayedBanner != null) {
      _scheduleAutoDismiss(_displayedBanner!);
    }
  }

  @override
  void dispose() {
    _cancelTimer();
    widget.controller.removeListener(_onControllerChanged);
    _animController.dispose();
    super.dispose();
  }

  void _cancelTimer() {
    _autoDismissTimer?.cancel();
    _autoDismissTimer = null;
  }

  void _scheduleAutoDismiss(InAppBannerMessage banner) {
    _cancelTimer();
    final key = banner.dedupeKey;
    _autoDismissTimer = Timer(widget.autoDismissDuration, () {
      if (!mounted) return;
      if (widget.controller.currentBanner?.dedupeKey == key) {
        widget.controller.dismissBanner();
      }
    });
  }

  void _onControllerChanged() {
    if (!mounted) return;
    final next = widget.controller.currentBanner;
    final disableAnimations = MediaQuery.disableAnimationsOf(context);

    if (next == null) {
      _cancelTimer();
      if (_displayedBanner == null) return;
      if (disableAnimations) {
        _animController.value = 0.0;
        setState(() => _displayedBanner = null);
      } else {
        _animController.reverse().then((_) {
          if (mounted && widget.controller.currentBanner == null) {
            setState(() => _displayedBanner = null);
          }
        });
      }
      return;
    }

    final isSameBanner =
        _displayedBanner != null &&
        _displayedBanner!.dedupeKey == next.dedupeKey &&
        _displayedBanner!.title == next.title &&
        _displayedBanner!.body == next.body;
    if (isSameBanner && _animController.status != AnimationStatus.reverse) {
      return;
    }

    _scheduleAutoDismiss(next);
    setState(() => _displayedBanner = next);
    if (disableAnimations) {
      _animController.value = 1.0;
    } else {
      _animController.forward(from: 0.0);
    }
  }

  void _handleSwipeDismiss() {
    _cancelTimer();
    _animController.value = 0.0;
    setState(() => _displayedBanner = null);
    widget.controller.dismissBanner();
  }

  void _handleTapBanner(InAppBannerMessage banner) {
    widget.controller.dismissBanner();
    final result = widget.onTapBanner?.call(banner);
    if (result is Future<void>) {
      unawaited(result);
    }
  }

  Widget _buildDismissibleBanner(InAppBannerMessage banner) {
    return Dismissible(
      key: ValueKey('inAppBanner_${banner.dedupeKey}'),
      direction: DismissDirection.up,
      onDismissed: (_) => _handleSwipeDismiss(),
      child: Semantics(
        liveRegion: true,
        container: true,
        label: '${banner.title}. ${banner.body}',
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: AppColors.grey0,
            borderRadius: AppRadius.cardRadius,
            border: Border.all(color: AppColors.grey200),
            boxShadow: AppShadows.level2,
          ),
          child: Material(
            color: Colors.transparent,
            borderRadius: AppRadius.cardRadius,
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              key: const Key('inAppNotificationBannerCard'),
              onTap: () => _handleTapBanner(banner),
              borderRadius: AppRadius.cardRadius,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
                child: Row(
                  children: [
                    NotificationTypeIcon(type: banner.type, size: 40),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            banner.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: designText(
                              14,
                              weight: FontWeight.w600,
                              color: AppColors.grey900,
                              height: 1.3,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            banner.body,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: designText(
                              13,
                              color: AppColors.grey800,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      key: const Key('inAppNotificationBannerClose'),
                      tooltip: 'Đóng thông báo',
                      constraints: const BoxConstraints(
                        minWidth: 48,
                        minHeight: 48,
                      ),
                      onPressed: widget.controller.dismissBanner,
                      icon: const Icon(
                        Icons.close_rounded,
                        size: 20,
                        color: AppColors.grey600,
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

  @override
  Widget build(BuildContext context) {
    final disableAnimations = MediaQuery.disableAnimationsOf(context);
    final banner = _displayedBanner;

    return Stack(
      children: [
        widget.child,
        if (banner != null)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: disableAnimations
                    ? _buildDismissibleBanner(banner)
                    : SlideTransition(
                        key: const Key('inAppNotificationBannerSlide'),
                        position: _slideAnimation,
                        child: FadeTransition(
                          opacity: _fadeAnimation,
                          child: _buildDismissibleBanner(banner),
                        ),
                      ),
              ),
            ),
          ),
      ],
    );
  }
}
