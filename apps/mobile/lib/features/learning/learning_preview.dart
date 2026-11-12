import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../auth/session_controller.dart';
import '../placement/placement_pages.dart' show ResultPage;
import '../profile/profile_page.dart';
import '../speaking/speaking_controller.dart';
import '../speaking/speaking_recorder.dart';
import '../speaking/speaking_repository.dart';
import '../speaking/speaking_topic_catalogue.dart';
import '../vocabulary/vocabulary_controller.dart';
import '../vocabulary/vocabulary_pages.dart';
import '../vocabulary/vocabulary_repository.dart';
import '../vocabulary/vocabulary_review_page.dart';
import 'daily_learning.dart';
import 'daily_pages.dart';
import 'home_dashboard.dart';
import 'learning_controller.dart';
import 'learning_pages.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';
import 'lesson_pages.dart';
import 'practice_pages.dart';
import 'preview_model.dart';
import 'preview_navigation_bar.dart';
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
  });
  static const routeName = learningHomeRouteName;
  final bool showPlan;
  final PreviewModel? model;
  final Future<void> Function()? onLogout;
  final SessionController? account;
  final VoidCallback? onSignIn;
  @override
  State<LearningPreview> createState() => _LearningPreviewState();
}

class _LearningPreviewState extends State<LearningPreview>
    with WidgetsBindingObserver {
  late final String? _accountId = widget.account?.user?['id'] as String?;
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
  late final DailyLearningController? daily =
      widget.account == null || _accountId == null
      ? null
      : DailyLearningController(
          repository: ApiDailyRepository(widget.account!.api),
          accountId: _accountId,
          isCurrent: () => widget.account!.user?['id'] == daily?.accountId,
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
  late final library = WordLibrary(accountId: _accountId);
  final selectedTab = ValueNotifier<int>(0);
  late final LearningController? learning =
      widget.account == null || _accountId == null
      ? null
      : LearningController(
          repository: ApiLearningRepository(widget.account!.api),
          accountId: _accountId,
          daily: daily,
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
    learning?.refresh();
    vocabularyController?.refresh();
    library.restore().catchError((Object error) {
      if (mounted) {
        setState(
          () => restoreError = 'Không khôi phục được bộ từ mẫu trên thiết bị.',
        );
      }
    });
    if (widget.model == null) {
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
    WidgetsBinding.instance.removeObserver(this);
    widget.account?.removeListener(_speakingSessionChanged);
    speaking?.dispose();
    daily?.dispose();
    learning?.dispose();
    vocabularyController?.dispose();
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

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      learning?.activity?.flush();
      learning?.refresh();
      vocabularyController?.refresh();
    }
  }

  void openProfile() => showModalBottomSheet<void>(
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
              learningHeading(
                widget.account?.user?['name'] as String? ??
                    'Anna · tài khoản mẫu',
                size: 24,
              ),
              const SizedBox(height: 12),
              learningBody(
                widget.account == null
                    ? 'Bạn đang xem giao diện với dữ liệu mẫu trên thiết bị. Phản hồi Nói/Viết là minh họa; không thu micro hay cập nhật kết quả kiểm tra thật.'
                    : 'Bài học, bộ từ cá nhân, lịch sử ôn và tiến độ lưu theo tài khoản. Nói/Viết hiện là bản xem trước.',
              ),
              const SizedBox(height: 20),
              if (widget.account != null) ...[
                CustomAppButton(
                  text: 'Hồ sơ của tôi',
                  onPressed: () {
                    Navigator.pop(context);
                    previewPush<void>(
                      this.context,
                      ProfilePage(session: widget.account!),
                    ).then((_) => learning?.refresh());
                  },
                ),
                const SizedBox(height: 12),
                Builder(
                  builder: (_) {
                    final placementSessionId =
                        (widget.account?.placement['currentSessionId'] ??
                                widget.account?.placementResult?['sessionId'])
                            as String?;
                    return CustomAppButton(
                      key: const Key('accountPlacementResult'),
                      text: 'Kết quả đầu vào',
                      isSecondary: true,
                      onPressed: placementSessionId == null
                          ? null
                          : () {
                              Navigator.pop(context);
                              previewPush(
                                this.context,
                                ResultPage(
                                  session: widget.account!,
                                  sessionId: placementSessionId,
                                ),
                              );
                            },
                    );
                  },
                ),
                const SizedBox(height: 12),
              ],
              if (widget.account == null)
                CustomAppButton(
                  text: 'Lộ trình tuần đầu tiên',
                  onPressed: () {
                    Navigator.pop(context);
                    previewPush(this.context, WeeklyPlanPage(model: model));
                  },
                ),
              const SizedBox(height: 12),
              if (widget.account == null)
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
      final decks = vocabularyController!.summary?['decks'] as List? ?? [];
      final active = decks
          .where((d) => (d as Map)['activeAttemptId'] != null)
          .toList();
      if (active.length == 1) {
        previewPush(
          context,
          VocabularyReviewPage(
            controller: vocabularyController!,
            attemptId: (active.single as Map)['activeAttemptId'] as String,
          ),
        );
        return;
      }
      switchTab(2);
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
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: Listenable.merge([
      model,
      library,
      widget.account,
      learning,
      daily,
      vocabularyController,
    ]),
    builder: (context, _) {
      final surface = ValueListenableBuilder<int>(
        valueListenable: selectedTab,
        child: Scaffold(
          backgroundColor: AppColors.grey25,
          body: Stack(
            children: [
              PageView(
                key: const Key('learningPages'),
                controller: tabs,
                physics: const ClampingScrollPhysics(),
                allowImplicitScrolling: true,
                onPageChanged: (index) => selectedTab.value = index,
                children: [
                  for (var index = 0; index < 5; index++)
                    RetainedTab(
                      key: ValueKey(index),
                      child: tabContent(index),
                    ),
                ],
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
        builder: (context, tab, child) => AnnotatedRegion<SystemUiOverlayStyle>(
          value:
              (tab == 0
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
    },
  );

  Widget tabContent(int page) {
    if (page == 0) {
      return RepaintBoundary(
        child: HomeDashboard(
          model: model,
          library: library,
          onProfile: openProfile,
          displayName: widget.account?.user?['name'] as String? ?? 'Anna',
          level: widget.account == null
              ? 'A1'
              : widget.account!.placementResult?['estimatedCefr'] as String?,
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
                  onReview: openReview,
                ),
          onLesson: () {
            final lesson = learning?.continueLesson;
            if (learning != null) {
              if (lesson != null) {
                openLearningLesson(
                  context,
                  learning!,
                  lessonId: lesson.id,
                  attemptId: lesson.activeAttemptId,
                );
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
          onDeck: openWordDeck,
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
                      : widget.account!.placementResult?['estimatedCefr']
                                as String? ??
                            '—',
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
            if (oldPage == 3) ...progress(),
          ],
        ),
      ),
    );
  }

  List<Widget> road() {
    if (learning != null) {
      return [
        learningSegments(
          ['Ngữ pháp', 'Từ vựng'],
          vocabulary ? 1 : 0,
          (i) => setState(() => vocabulary = i == 1),
        ),
        const SizedBox(height: 24),
        LearningCatalogue(
          controller: learning!,
          kinds: [vocabulary ? 'VOCABULARY' : 'GRAMMAR'],
        ),
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
    ];
  }

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
      LearningCatalogue(
        controller: learning!,
        kinds: [skill == PracticeSkill.reading ? 'READING' : 'LISTENING'],
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

  List<Widget> progress() => [
    if (learning != null) ...[
      if (daily != null) DailyProgressCard(daily: daily!),
      const SizedBox(height: 16),
      if (daily != null)
        CustomAppButton(
          key: const Key('dailyPlanOpen'),
          text: 'Kế hoạch hôm nay',
          onPressed: () =>
              previewPush(context, DailyPlanPage(learning: learning!)),
        ),
      const SizedBox(height: 16),
      LearningCard(
        children: [
          learningHeading('Hành trình của bạn', size: 24),
          learningHeading(
            '${learning!.summary['completedLessonCount'] ?? '—'}/${learning!.summary['totalLessons'] ?? '—'} bài đã hoàn thành',
            size: 28,
          ),
          learningBody(
            '${learning!.summary['completedAttemptCount'] ?? '—'} lượt nộp bài · ${learning!.summary['activeAttemptCount'] ?? '—'} lượt đang học',
          ),
          learningBody('Tiến độ bài học không thay đổi mức CEFR đầu vào.'),
          if (learning!.error != null)
            LearningError(learning!.error!, retry: learning!.refresh),
          CustomAppButton(
            key: const Key('learningHistory'),
            text: 'Lịch sử học tập',
            onPressed: () => previewPush(
              context,
              LearningHistoryPage(controller: learning!),
            ),
          ),
        ],
      ),
    ] else ...[
      LearningCard(
        children: [
          learningHeading('Hành trình của bạn', size: 24),
          learningBody(
            'Tiến độ minh họa trên thiết bị; không phải kết quả đánh giá.',
          ),
          learningHeading(
            '${model.completed.length} hoạt động đã hoàn thành',
            size: 28,
          ),
          for (final s in ['Từ vựng', 'Ngữ pháp', 'Nghe', 'Đọc', 'Nói', 'Viết'])
            Row(
              children: [
                Expanded(child: learningBody(s)),
                Text(
                  widget.account == null
                      ? 'A1'
                      : (widget.account!.placementResult?['skills']?[{
                                  'Nghe': 'listening',
                                  'Đọc': 'reading',
                                }[s]]?['estimatedCefr']
                                as String? ??
                            'Chưa đánh giá'),
                  style: designText(
                    20,
                    weight: FontWeight.w600,
                    color: AppColors.primary500,
                  ),
                ),
              ],
            ),
        ],
      ),
      const SizedBox(height: 16),
      CustomAppButton(
        text: 'Lộ trình tuần đầu tiên',
        onPressed: () => previewPush(context, WeeklyPlanPage(model: model)),
      ),
    ],
  ];
}
