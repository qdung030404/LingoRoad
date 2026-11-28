import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/app_startup_timing.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../auth/session_controller.dart';
import '../grammar/grammar_catalogue_view.dart';
import '../grammar/grammar_controller.dart';
import '../grammar/grammar_repository.dart';
import '../notifications/in_app_notification_banner.dart';
import '../notifications/notification_banners.dart';
import '../notifications/notification_controller.dart';
import '../notifications/notification_models.dart';
import '../notifications/notification_repository.dart';
import '../notifications/notifications_page.dart';
import '../profile/profile_page.dart';
import '../profile/reminder_coordinator.dart';
import '../speaking/speaking_controller.dart';
import '../speaking/speaking_recorder.dart';
import '../speaking/speaking_repository.dart';
import '../speaking/speaking_topic_catalogue.dart';
import '../vocabulary/curated_topics_widgets.dart';
import '../vocabulary/vocabulary_controller.dart';
import '../vocabulary/vocabulary_pages.dart';
import '../vocabulary/vocabulary_repository.dart';
import 'daily_learning.dart';
import 'daily_pages.dart';
import 'home_cache.dart';
import 'home_dashboard.dart';
import 'learning_controller.dart';
import 'learning_pages.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';
import 'lesson_pages.dart';
import 'practice_pages.dart';
import 'preview_model.dart';
import 'preview_navigation_bar.dart';
import 'progress_dashboard.dart';
import 'srs_review_page.dart';
import 'weekly_plan_pages.dart';
import 'word_collection_pages.dart';
import 'word_library.dart';
import 'writing_evaluation_service.dart';

export 'weekly_plan_pages.dart';

class LearningPreview extends StatefulWidget {
  const LearningPreview({
    super.key,
    this.showPlan = false,
    this.model,
    this.onLogout,
    this.account,
    this.onSignIn,
    this.notificationController,
    this.reminderPlatform,
  });
  static const routeName = learningHomeRouteName;
  final bool showPlan;
  final PreviewModel? model;
  final Future<void> Function()? onLogout;
  final SessionController? account;
  final VoidCallback? onSignIn;
  final NotificationController? notificationController;
  final ReminderNotificationPlatform? reminderPlatform;
  @override
  State<LearningPreview> createState() => _LearningPreviewState();
}

class _LearningPreviewState extends State<LearningPreview>
    with WidgetsBindingObserver {
  late final String? _accountId = widget.account?.user?['id'] as String?;
  late final ReminderNotificationPlatform _reminderPlatform =
      widget.reminderPlatform ?? MethodChannelReminderPlatform();
  late final NotificationController notifications =
      widget.notificationController ??
      NotificationController(
        repository: widget.account != null && _accountId != null
            ? ApiNotificationRepository(widget.account!.api)
            : PreviewNotificationRepository(),
        accountId: _accountId ?? 'preview',
        isAccountCurrent: widget.account == null
            ? null
            : () => widget.account!.user?['id'] == _accountId,
      );
  String? _previousGoalMetDate;
  bool? _previousGoalMet;
  late final WritingEvaluationService? writing = widget.account == null
      ? null
      : WritingEvaluationService(client: widget.account!.api);
  late final SpeakingController? speaking =
      widget.account == null || _accountId == null
      ? null
      : SpeakingController(
          repository: ApiSpeakingRepository(widget.account!.api),
          recorder: DeviceSpeakingRecorder(_accountId),
          accountId: _accountId,
          isCurrent: () => widget.account!.user?['id'] == speaking?.accountId,
          onSubmissionSucceeded: _handleSpeakingSucceeded,
        );
  late final VocabularyController? vocabularyController =
      widget.account == null || _accountId == null
      ? null
      : VocabularyController(
          repository: ApiVocabularyRepository(widget.account!.api),
          accountId: _accountId,
          isCurrent: () =>
              widget.account!.user?['id'] == vocabularyController?.accountId,
        );
  late final GrammarController? grammarController = widget.account == null
      ? null
      : GrammarController(
          repository: ApiGrammarRepository(
            widget.account!.api,
            authenticated: _accountId != null,
          ),
        );
  late final DailyLearningController? daily =
      widget.account == null || _accountId == null
      ? null
      : DailyLearningController(
          repository: ApiDailyRepository(widget.account!.api),
          accountId: _accountId,
          isCurrent: () => widget.account!.user?['id'] == daily?.accountId,
          onHomeChanged: _refreshAfterChange,
          onPreferences: (prefs) {
            final profile = widget.account!.user?['profile'];
            if (profile is Map) {
              profile['dailyGoalMinutes'] = prefs['dailyGoalMinutes'];
            }
          },
        );
  late final model =
      widget.model ??
      PreviewModel(
        accountId: _accountId,
        initialDailyMinutes:
            widget.account?.profile['dailyGoalMinutes'] as int? ?? 10,
      );
  late final WordLibrary library = WordLibrary(accountId: _accountId);
  bool _hadInitialCachedHome = false;
  String? _initialLivePlanStatus;
  final selectedTab = ValueNotifier<int>(0);
  late final LearningController? learning =
      widget.account == null || _accountId == null
      ? null
      : LearningController(
          repository: ApiLearningRepository(widget.account!.api),
          accountId: _accountId,
          daily: daily,
          vocabulary: vocabularyController,
          fetchHome: ApiLearningRepository(widget.account!.api).home,
          onHome: (value) {
            final planStatus = value['planStatus']?.toString() ?? 'unknown';
            _initialLivePlanStatus ??= planStatus;
            widget.account!.rememberHome(value);
            AppStartupTiming.afterNextFrame(
              'home-first-content',
              metadata: {
                'source': 'network',
                'cache': _hadInitialCachedHome ? 'hit' : 'miss',
                'planStatus': planStatus,
              },
            );
            AppStartupTiming.afterNextFrame(
              'home-live',
              metadata: {
                'cache': _hadInitialCachedHome ? 'hit' : 'miss',
                'planStatus': planStatus,
              },
            );
            _handleHomeSnapshot(value);
          },
          onPlanReady: (value) {
            AppStartupTiming.afterNextFrame(
              'home-plan-ready',
              metadata: {
                'cache': _hadInitialCachedHome ? 'hit' : 'miss',
                'planStatus':
                    _initialLivePlanStatus ??
                    value['planStatus']?.toString() ??
                    'ready',
              },
            );
          },
          onHomeInvalidated: widget.account!.clearHome,
          onHomeForbidden: widget.account!.rejectHomeSession,
          onGoalJustMet: _handleGoalJustMet,
          onLevelChanged: _handleLevelChanged,
          isAccountCurrent: () =>
              widget.account!.user?['id'] == learning?.accountId,
        );
  final tabs = PageController();
  void switchTab(int index) {
    if (!tabs.hasClients) return;
    if (MediaQuery.disableAnimationsOf(context)) {
      tabs.jumpToPage(index);
    } else {
      tabs.animateToPage(
        index,
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
      );
    }
  }

  bool vocabulary = false;
  PracticeSkill skill = PracticeSkill.listening;
  String? restoreError;
  bool loggingOut = false;

  Future<void> logout() async {
    if (loggingOut) return;
    setState(() => loggingOut = true);
    try {
      await speaking?.endSession();
      await widget.onLogout?.call();
      if (mounted) Navigator.of(context).maybePop();
    } catch (_) {
      if (mounted) {
        previewMessage(context, 'Không thể đăng xuất. Vui lòng thử lại.');
      }
    } finally {
      if (mounted) setState(() => loggingOut = false);
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _accountId;
    widget.account?.addListener(_speakingSessionChanged);
    final cached = widget.account?.cachedHome;
    _hadInitialCachedHome = cached != null;
    if (cached != null) {
      learning?.showCachedHome(cached);
      AppStartupTiming.afterNextFrame(
        'home-first-content',
        metadata: {
          'source': 'cache',
          'cache': 'hit',
          'planStatus': cached['planStatus']?.toString() ?? 'unknown',
        },
      );
      final cachedUnread = (cached['unreadNotificationCount'] as num?)?.toInt();
      if (cachedUnread != null) notifications.syncUnreadCount(cachedUnread);
    }
    if (widget.account == null && widget.notificationController == null) {
      unawaited(notifications.refresh());
    }
    learning?.refresh();
    _scheduleLearningDayRefresh();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _refreshVocabulary();
        unawaited(_checkLaunchNotificationTarget());
      }
    });
    if (vocabularyController == null) {
      library.restore().catchError((Object error) {
        if (mounted) {
          setState(
            () => restoreError = 'Không khôi phục được bộ từ mẫu trên thiết bị.',
          );
        }
      });
    }
    if (widget.account == null && widget.model == null) {
      model.restore().catchError((Object error, StackTrace stack) {
        // Keep preference values out of logs while retaining the failing stack.
        FlutterError.reportError(
          FlutterErrorDetails(
            exception: FlutterError(
              'Preview restore failed (${error.runtimeType})',
            ),
            stack: stack,
            library: 'learning preview storage',
          ),
        );
        if (mounted) {
          setState(
            () => restoreError =
                'Không khôi phục được dữ liệu mẫu trên thiết bị.',
          );
        }
      });
    }
    if (widget.showPlan) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          previewPush(
            context,
            daily == null
                ? WeeklyPlanPage(model: model)
                : DailyPlanPage(learning: learning!),
          );
        }
      });
    }
  }

  @override
  void dispose() {
    _learningDayTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    widget.account?.removeListener(_speakingSessionChanged);
    speaking?.dispose();
    daily?.dispose();
    learning?.dispose();
    vocabularyController?.dispose();
    grammarController?.dispose();
    if (widget.notificationController == null) notifications.dispose();
    library.dispose();
    tabs.dispose();
    selectedTab.dispose();
    if (widget.model == null) model.dispose();
    super.dispose();
  }

  void _speakingSessionChanged() {
    if (speaking != null && !speaking!.active) {
      speaking!.endSession();
    }
  }

  Timer? _learningDayTimer;
  DateTime? _vocabularyRequestedAt;

  void _scheduleLearningDayRefresh() {
    _learningDayTimer?.cancel();
    if (learning == null) return;
    final now = DateTime.now().toUtc().add(const Duration(hours: 7));
    final tomorrow = DateTime.utc(now.year, now.month, now.day + 1);
    _learningDayTimer = Timer(tomorrow.difference(now), () {
      learning?.refreshIfStale();
      _scheduleLearningDayRefresh();
    });
  }

  void _refreshVocabulary() {
    final now = DateTime.now();
    final last = _vocabularyRequestedAt;
    if (last != null && now.difference(last) < const Duration(seconds: 60)) {
      return;
    }
    _vocabularyRequestedAt = now;
    vocabularyController?.refresh();
  }

  void _loadTab(int index) {
    if (index == 1 || index == 3) learning?.loadCatalogue();
    if (index == 4) daily?.loadDetails();
    if (index == 2) _refreshVocabulary();
  }

  Future<void> _refreshAfterChange() async {
    final controller = learning;
    controller?.invalidateHome();
    await controller?.refresh();
    if (mounted) _loadTab(selectedTab.value);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _scheduleLearningDayRefresh();
      learning?.activity?.flush();
      learning?.refreshIfStale();
      _loadTab(selectedTab.value);
      _refreshVocabulary();
      unawaited(_checkLaunchNotificationTarget());
    }
  }

  void _handleHomeSnapshot(Map<String, dynamic> value) {
    final unread = (value['unreadNotificationCount'] as num?)?.toInt();
    if (unread != null) notifications.syncUnreadCount(unread);
    final date = value['date'] as String?;
    final today = value['today'];
    final goalMet = today is Map && today['goalMet'] == true;
    if (date != null) {
      if (goalMet) {
        _syncCompletedReminderDate(date);
        if (_previousGoalMetDate == date && _previousGoalMet == false) {
          notifications.showBanner(
            buildDailyGoalMetBanner(
              date: date,
              dailyGoalMinutes:
                  (today['dailyGoalMinutes'] as num?)?.toInt() ??
                  (widget.account?.profile['dailyGoalMinutes'] as num?)
                      ?.toInt(),
            ),
          );
        }
      }
      _previousGoalMetDate = date;
      _previousGoalMet = goalMet;
    }
  }

  void _syncCompletedReminderDate(String date) {
    final accountId = _accountId;
    final profile = widget.account?.profile;
    if (accountId == null || profile == null) return;
    unawaited(
      syncAccountReminderSchedule(
        platform: _reminderPlatform,
        accountId: accountId,
        enabled: profile['reminderEnabled'] as bool? ?? true,
        localTime: profile['reminderTime'] as String? ?? '19:30',
        completedDate: date,
      ).catchError((Object _) {}),
    );
  }

  void _handleGoalJustMet() {
    final today = homeLearningDate();
    _previousGoalMetDate = today;
    _previousGoalMet = true;
    _syncCompletedReminderDate(today);
    notifications.showBanner(
      buildDailyGoalMetBanner(
        date: today,
        dailyGoalMinutes:
            (daily?.today['dailyGoalMinutes'] as num?)?.toInt() ??
            (widget.account?.profile['dailyGoalMinutes'] as num?)?.toInt(),
      ),
    );
    unawaited(notifications.refresh());
  }

  void _handleLevelChanged(
    LearningAttempt attempt,
    Map<String, dynamic> levelChange,
  ) {
    notifications.showBanner(
      buildSkillLevelChangedBanner(
        attemptId: attempt.id,
        levelChange: levelChange,
      ),
    );
    unawaited(notifications.refresh());
  }

  void _handleSpeakingSucceeded(Map<String, dynamic> submission) {
    notifications.showBanner(buildSpeakingResultBanner(submission));
    unawaited(notifications.refresh());
  }

  Future<void> _checkLaunchNotificationTarget() async {
    try {
      final target = await _reminderPlatform.consumeLaunchTarget();
      if (!mounted || target == null || target.isEmpty) return;
      if (target == 'DAILY_PLAN') {
        _openNotificationTarget(AppNotificationTargetType.dailyPlan, null);
      }
    } catch (_) {
      // Ignore platform channel unavailability during tests or non-Android hosts.
    }
  }

  void openNotifications() {
    previewPush<void>(
      context,
      NotificationsPage(
        controller: notifications,
        isPreview: widget.account == null,
        onOpenNotification: (notification) => _openNotificationTarget(
          notification.targetType,
          notification.targetPayload,
          popCurrent: true,
        ),
      ),
    );
  }

  void _openNotificationTarget(
    AppNotificationTargetType targetType,
    Map<String, dynamic>? payload, {
    bool popCurrent = false,
  }) {
    if (popCurrent && mounted) {
      Navigator.of(context).maybePop();
    }
    if (!mounted) return;
    switch (targetType) {
      case AppNotificationTargetType.dailyPlan:
        previewPush<void>(
          context,
          daily == null
              ? WeeklyPlanPage(model: model)
              : DailyPlanPage(learning: learning!),
        );
      case AppNotificationTargetType.lesson:
        final lessonId = payload?['lessonId']?.toString();
        if (learning != null && lessonId != null && lessonId.isNotEmpty) {
          unawaited(openLearningLesson(context, learning!, lessonId: lessonId));
        } else {
          switchTab(1);
        }
      case AppNotificationTargetType.vocabularyReview:
        final deckId = payload?['deckId']?.toString();
        if (deckId != null && deckId.isNotEmpty) {
          openWordDeck(deckId);
        } else {
          openReview();
        }
      case AppNotificationTargetType.profile:
        openProfile();
      case AppNotificationTargetType.speaking:
        setState(() => skill = PracticeSkill.speaking);
        switchTab(3);
      case AppNotificationTargetType.none:
        break;
    }
  }

  void openProfile() {
    final account = widget.account;
    if (account != null) {
      final rememberedWords =
          (vocabularyController?.summary?['totals']
                  as Map?)?['rememberedWords']
              as int?;
      final completedLessons =
          (learning?.summary['completedLessonCount'] as num?)?.toInt();
      previewPush<void>(
        context,
        ProfilePage(
          session: account,
          rememberedWords: rememberedWords,
          completedLessonCount: completedLessons,
        ),
      ).then((_) {
        if (mounted) _refreshAfterChange();
      });
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                learningHeading('Anna · tài khoản mẫu', size: 24),
                const SizedBox(height: 12),
                learningBody(
                  'Bạn đang xem giao diện với dữ liệu mẫu trên thiết bị. Phản hồi Nói/Viết là minh họa; không thu micro hay cập nhật kết quả kiểm tra thật.',
                ),
                const SizedBox(height: 20),
                CustomAppButton(
                  text: 'Lộ trình tuần đầu tiên',
                  onPressed: () {
                    Navigator.pop(context);
                    previewPush(this.context, WeeklyPlanPage(model: model));
                  },
                ),
                const SizedBox(height: 12),
                CustomAppButton(
                  text: 'Đóng bản xem trước',
                  isSecondary: true,
                  onPressed: () {
                    Navigator.pop(context);
                    Navigator.of(this.context).maybePop();
                  },
                ),
                const SizedBox(height: 12),
                CustomAppButton(
                  key: const Key('previewLogout'),
                  text: 'Đăng xuất',
                  isSecondary: true,
                  onPressed: loggingOut
                      ? null
                      : () {
                          Navigator.pop(context);
                          logout();
                        },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void returnToTab(int index) {
    final route = ModalRoute.of(context);
    Navigator.of(context).popUntil((candidate) => candidate == route);
    if (index == 5) {
      openProfile();
    } else {
      switchTab(index);
    }
  }

  void openReview() {
    if (vocabularyController != null) {
      unawaited(
        openActiveVocabularyReview(
          context,
          vocabularyController!,
          onNoActiveReview: () {
            if (mounted) switchTab(2);
          },
        ),
      );
      return;
    }
    previewPush(
      context,
      SrsReviewPage(
        library: library,
        deckId: library.decks.firstOrNull?.id ?? 'default',
        onNavigate: returnToTab,
      ),
    );
  }

  void openWordDeck(String deckId) => previewPush(
    context,
    vocabularyController != null
        ? VocabularyDeckPage(controller: vocabularyController!, deckId: deckId)
        : WordListPage(
            library: library,
            deckId: deckId,
            onNavigate: returnToTab,
          ),
  );

  @override
  Widget build(BuildContext context) {
    final surface = ValueListenableBuilder<int>(
      valueListenable: selectedTab,
      child: InAppNotificationBannerHost(
        controller: notifications,
        onTapBanner: (banner) =>
            _openNotificationTarget(banner.targetType, banner.targetPayload),
        child: Scaffold(
          backgroundColor: AppColors.grey25,
          body: Stack(
            children: [
              PageView.builder(
                key: const Key('learningPages'),
                controller: tabs,
                physics: const ClampingScrollPhysics(),
                onPageChanged: (index) {
                  selectedTab.value = index;
                  _loadTab(index);
                },
                itemCount: 5,
                itemBuilder: (context, index) => RetainedTab(
                  key: ValueKey(index),
                  child: AnimatedBuilder(
                    animation: Listenable.merge([
                      if (index == 0) notifications,
                      if (index == 0 || index == 4 || widget.account == null)
                        model,
                      if (vocabularyController == null &&
                          (index == 0 || index == 2 || widget.account == null))
                        library,
                      widget.account,
                      if (index != 2) learning,
                      if (index == 0 || index == 4) daily,
                      if (index != 3) vocabularyController,
                    ]),
                    builder: (context, _) => tabContent(index),
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: math.max(24, MediaQuery.paddingOf(context).bottom),
                child: ValueListenableBuilder<int>(
                  valueListenable: selectedTab,
                  builder: (context, tab, _) => Container(
                    padding: const EdgeInsets.only(top: 24, bottom: 8),
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0x00FFFFFF), Colors.white],
                        stops: [0, .48],
                      ),
                    ),
                    child: PreviewNavigationBar(
                      selectedIndex: tab,
                      onSelected: switchTab,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      builder: (context, tab, child) => AnnotatedRegion<SystemUiOverlayStyle>(
        value:
            (tab == 0 || tab == 4
                    ? SystemUiOverlayStyle.light
                    : SystemUiOverlayStyle.dark)
                .copyWith(
                  statusBarColor: Colors.transparent,
                  systemNavigationBarColor: AppColors.grey25,
                  systemNavigationBarIconBrightness: Brightness.dark,
                ),
        child: child!,
      ),
    );
    return widget.account == null ? PreviewSurface(child: surface) : surface;
  }

  Widget tabContent(int page) {
    if (page == 0) {
      return RepaintBoundary(
        child: HomeDashboard(
          model: model,
          library: library,
          onProfile: openProfile,
          displayName: widget.account?.user?['name'] as String? ?? 'Anna',
          avatarUrl: widget.account?.user?['avatarUrl'] as String?,
          level: widget.account == null ? 'A1' : widget.account!.placementCefr,
          learning: learning,
          vocabularyWordsCount:
              (vocabularyController?.summary?['totals']
                      as Map?)?['rememberedWords']
                  as int?,
          vocabularySection: vocabularyController == null
              ? null
              : VocabularyHomeSection(
                  controller: vocabularyController!,
                  onWords: () => switchTab(2),
                  onDeck: openWordDeck,
                  onReview: () => switchTab(2),
                ),
          onLesson: () {
            final lesson = learning?.continueLesson;
            if (learning != null) {
              if (lesson != null) {
                openLearningLesson(context, learning!, lessonId: lesson.id);
              } else {
                switchTab(1);
              }
            } else {
              previewPush(context, VocabularyLessonPage(model: model));
            }
          },
          onGrammar: () =>
              previewPush(context, GrammarLessonPage(model: model)),
          onWords: () => switchTab(2),
          onReview: openReview,
          onNotifications: openNotifications,
          unreadNotificationCount: notifications.unreadCount,
          onDeck: openWordDeck,
          onOpenSpeakingTopic: (topicId) async {
            if (speaking != null && topicId.isNotEmpty) {
              await openSpeakingTopicFromPlan(
                context,
                controller: speaking!,
                topicId: topicId,
                practicePage: () => SpeakingPreviewPage(
                  model: model,
                  speaking: speaking,
                ),
              );
              if (mounted && (learning?.active ?? false)) {
                await learning!.refresh();
              }
            } else {
              setState(() => skill = PracticeSkill.speaking);
              switchTab(3);
            }
          },
          onOpenWritingItem: (itemId) async {
            if (itemId.isNotEmpty) {
              List<WritingPracticeItem> items = WritingPracticeItem.defaultItems;
              final restoreFuture = model.ensureRestored().catchError((Object _) {});
              try {
                final fetched = await (writing ?? WritingEvaluationService())
                    .fetchWritingItems();
                if (fetched.isNotEmpty) {
                  items = fetched;
                }
              } catch (_) {}
              await restoreFuture;
              final index = items.indexWhere((e) => e.id == itemId);
              final matched = index >= 0 ? items[index] : items.firstOrNull;
              if (matched != null && mounted) {
                await previewPush<void>(
                  context,
                  WritingTaskPage(
                    model: model,
                    item: matched,
                    itemIndex: index >= 0 ? index : 0,
                    evaluationService: writing,
                  ),
                );
                if (mounted && (learning?.active ?? false)) {
                  await learning!.refresh();
                }
                return;
              }
            }
            setState(() => skill = PracticeSkill.writing);
            switchTab(3);
          },
        ),
      );
    }
    if (page == 2) {
      return RepaintBoundary(
        child: vocabularyController != null
            ? VocabularyWordsTab(controller: vocabularyController!)
            : MyWordsTab(library: library, onNavigate: returnToTab),
      );
    }
    if (page == 4) {
      return RepaintBoundary(
        child: ProgressDashboard(
          model: model,
          displayName: widget.account?.user?['name'] as String? ?? 'Anna',
          avatarUrl: widget.account?.user?['avatarUrl'] as String?,
          level: widget.account == null ? 'A1' : widget.account!.placementCefr,
          learning: learning,
          daily: daily,
          vocabularyController: vocabularyController,
          onProfile: openProfile,
          onOpenDailyPlan: learning != null && daily != null
              ? () => previewPush(context, DailyPlanPage(learning: learning!))
              : null,
          onOpenHistory: learning != null
              ? () => previewPush(
                  context,
                  LearningHistoryPage(controller: learning!),
                )
              : null,
          onOpenWeeklyPlan: () =>
              previewPush(context, WeeklyPlanPage(model: model)),
        ),
      );
    }
    final oldPage = page > 2 ? page - 1 : page;
    return RepaintBoundary(
      child: FigmaPage(
        titleStyle: designHeading(18),
        child: ListView(
          key: PageStorageKey('preview-content-$oldPage'),
          primary: false,
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 108),
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Text(
                    ['Hello, Anna!', 'Học', 'Luyện tập', 'Tiến độ'][oldPage],
                    style: designHeading(36, height: 1),
                  ),
                ),
                PreviewLevelBadge(
                  label: widget.account == null
                      ? 'A1'
                      : widget.account!.placementCefr ?? '—',
                  onTap: () => previewMessage(
                    context,
                    widget.account == null
                        ? 'A1 là mức minh họa của bản xem trước.'
                        : 'Mức tạm tính từ bài kiểm tra Đọc/Nghe; chưa đánh giá Nói/Viết.',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            if (restoreError != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(restoreError!),
              ),
            if (oldPage == 1) ...road(),
            if (oldPage == 2) ...practice(),
          ],
        ),
      ),
    );
  }

  List<Widget> road() {
    if (learning != null) {
      final vocabLessons = learning!.lessons
          .where((l) => l.kind == 'VOCABULARY')
          .toList();
      return [
        learningSegments(
          ['Ngữ pháp', 'Từ vựng'],
          vocabulary ? 1 : 0,
          (i) => setState(() => vocabulary = i == 1),
        ),
        const SizedBox(height: 24),
        if (!vocabulary)
          grammarController != null
              ? GrammarRoadSection(
                  grammarController: grammarController!,
                  learningController: learning,
                )
              : LearningCatalogue(
                  controller: learning!,
                  kinds: const ['GRAMMAR'],
                )
        else ...[
          if (vocabLessons.isNotEmpty) ...[
            LearningCatalogue(
              controller: learning!,
              kinds: const ['VOCABULARY'],
            ),
            const SizedBox(height: 24),
          ],
          CuratedTopicsCatalogue(
            controller: vocabularyController,
            onOpenDeck: openWordDeck,
          ),
        ],
      ];
    }
    final names = vocabulary
        ? [
            'Greetings and introductions',
            'Days, months and time',
            'Numbers',
            'Personal information',
            'Family and relationships',
          ]
        : [
            "Subject pronouns and 'to be'",
            'Basic sentence structure',
            'Possessive adjectives',
          ];
    final subtitles = vocabulary
        ? [
            'Chào hỏi và giới thiệu',
            'Thứ, tháng và giờ giấc',
            'Số đếm',
            'Thông tin cá nhân',
            'Gia đình và các mối quan hệ',
          ]
        : [
            'Đại từ chủ ngữ và to be',
            'Cấu trúc câu cơ bản',
            'Cấu trúc câu cơ bản',
          ];
    return [
      learningSegments(
        ['Ngữ pháp', 'Từ vựng'],
        vocabulary ? 1 : 0,
        (i) => setState(() => vocabulary = i == 1),
      ),
      const SizedBox(height: 24),
      if (vocabulary && vocabularyController != null)
        CuratedTopicsCatalogue(
          controller: vocabularyController,
          onOpenDeck: openWordDeck,
        )
      else ...[
        Row(
          children: [
            Expanded(child: learningHeading('Chặng 1')),
            learningBody(vocabulary ? '1/4' : '1/3', size: 20),
          ],
        ),
        const SizedBox(height: 12),
        for (var i = 0; i < names.length; i++) ...[
          learningCatalogCard(
            names[i],
            subtitles[i],
            i,
            () => previewPush(
              context,
              vocabulary
                  ? VocabularyLessonPage(model: model)
                  : GrammarLessonPage(model: model),
            ),
            source: vocabulary ? 'vocabulary-road' : 'grammar-road',
          ),
          const SizedBox(height: 12),
        ],
      ],
    ];
  }

  Widget practiceCatalogue(String kind) => LearningCatalogue(
    controller: learning!,
    kinds: [kind],
    onOpenHistory: () => previewPush<void>(
      context,
      LearningHistoryPage(controller: learning!, kind: kind),
    ),
  );

  List<Widget> practice() => [
    learningSegments(
      PracticeSkill.values.map((s) => s.label).toList(),
      skill.index,
      (i) => setState(() => skill = PracticeSkill.values[i]),
      icons: [
        'imgVuesaxLinearHeadphone',
        'imgVuesaxLinearBook',
        'imgVuesaxOutlineNoteText',
        'imgVuesaxLinearMicrophone2',
      ],
    ),
    const SizedBox(height: 24),
    if (speaking == null && skill == PracticeSkill.speaking) ...[
      if (widget.onSignIn != null)
        TextButton(
          key: const Key('speakingSignIn'),
          onPressed: widget.onSignIn,
          child: const Text('Đăng nhập để chấm giọng thật'),
        ),
    ],
    if (speaking != null && skill == PracticeSkill.speaking)
      SpeakingTopicCatalogue(
        controller: speaking!,
        practicePage: () =>
            SpeakingPreviewPage(model: model, speaking: speaking),
      )
    else if (learning != null &&
        (skill == PracticeSkill.reading || skill == PracticeSkill.listening))
      practiceCatalogue(
        skill == PracticeSkill.reading ? 'READING' : 'LISTENING',
      )
    else if (skill == PracticeSkill.writing)
      WritingPracticeSection(model: model, evaluationService: writing)
    else ...[
      Row(
        children: [
          Expanded(child: learningHeading('Chặng 1')),
          learningBody('1/3', size: 20),
        ],
      ),
      const SizedBox(height: 12),
      for (var i = 0; i < 3; i++) ...[
        learningCatalogCard(
          i == 0
              ? skill.title
              : i == 1
              ? 'Personal Information'
              : 'Family and Relationships',
          i == 0
              ? skill.description
              : i == 1
              ? 'Luyện tập với thông tin về tên, tuổi, nơi sống và nghề nghiệp.'
              : 'Luyện tập từ vựng và cấu trúc về gia đình và các mối quan hệ.',
          i,
          () => previewPush(
            context,
            PracticeIntroPage(skill: skill, model: model),
          ),
        ),
        const SizedBox(height: 12),
      ],
    ],
  ];
}
