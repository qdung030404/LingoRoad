import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'learning_widgets.dart';
import 'preview_model.dart';
import 'lesson_pages.dart';
import 'practice_pages.dart';
import 'home_dashboard.dart';
import 'word_collection_pages.dart';
import 'word_library.dart';
import 'srs_review_page.dart';
import 'preview_navigation_bar.dart';

class LearningPreview extends StatefulWidget {
  const LearningPreview({
    super.key,
    this.showPlan = false,
    this.model,
    this.onLogout,
  });
  final bool showPlan;
  final PreviewModel? model;
  final Future<void> Function()? onLogout;
  @override
  State<LearningPreview> createState() => _LearningPreviewState();
}

class _LearningPreviewState extends State<LearningPreview> {
  late final model = widget.model ?? PreviewModel();
  final library = WordLibrary();
  final selectedTab = ValueNotifier<int>(0);
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
      await widget.onLogout?.call();
      if (mounted) Navigator.of(context).pop();
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
        if (mounted) previewPush(context, WeeklyPlanPage(model: model));
      });
    }
  }

  @override
  void dispose() {
    library.dispose();
    tabs.dispose();
    selectedTab.dispose();
    if (widget.model == null) model.dispose();
    super.dispose();
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
                  Navigator.of(this.context).pop();
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

  void openReview() => previewPush(
    context,
    SrsReviewPage(
      library: library,
      deckId: library.decks.first.id,
      onNavigate: returnToTab,
    ),
  );

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: Listenable.merge([model, library]),
    builder: (context, _) => PreviewSurface(
      child: ValueListenableBuilder<int>(
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
                    _RetainedTab(
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
      ),
    ),
  );

  Widget tabContent(int page) {
    if (page == 0) {
      return RepaintBoundary(
        child: HomeDashboard(
          model: model,
          library: library,
          onProfile: openProfile,
          onLesson: () =>
              previewPush(context, VocabularyLessonPage(model: model)),
          onGrammar: () =>
              previewPush(context, GrammarLessonPage(model: model)),
          onWords: () => switchTab(2),
          onReview: openReview,
          onDeck: (deckId) => previewPush(
            context,
            WordListPage(
              library: library,
              deckId: deckId,
              onNavigate: returnToTab,
            ),
          ),
        ),
      );
    }
    if (page == 2) {
      return RepaintBoundary(
        child: MyWordsTab(library: library, onNavigate: returnToTab),
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
                  onTap: () => previewMessage(
                    context,
                    'A1 là mức minh họa của bản xem trước.',
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

  Widget segments(
    List<String> labels,
    int selected,
    ValueChanged<int> onChange, {
    List<String>? icons,
  }) => Container(
    padding: const EdgeInsets.all(4),
    decoration: BoxDecoration(
      color: AppColors.grey50,
      borderRadius: icons == null ? AppRadius.buttonRadius : AppRadius.cardSm,
    ),
    child: Row(
      children: [
        for (var i = 0; i < labels.length; i++)
          Expanded(
            child: InkWell(
              onTap: () => onChange(i),
              borderRadius: AppRadius.buttonRadius,
              child: Container(
                padding: EdgeInsets.symmetric(
                  vertical: icons == null ? 11.5 : 8,
                ),
                decoration: BoxDecoration(
                  color: selected == i ? Colors.white : Colors.transparent,
                  borderRadius: icons == null ? AppRadius.buttonRadius : AppRadius.tagRadius,
                  boxShadow: selected == i
                      ? const [
                          BoxShadow(
                            color: Color(0x0D1A2029),
                            blurRadius: 1.5,
                            offset: Offset(0, 1),
                          ),
                        ]
                      : null,
                ),
                child: Column(
                  children: [
                    if (icons != null) ...[
                      FigmaAsset('practice/${icons[i]}', size: 20),
                      const SizedBox(height: 8),
                    ],
                    Text(
                      labels[i],
                      style: designText(
                        14,
                        weight: FontWeight.w500,
                        color: selected == i
                            ? AppColors.grey900
                            : AppColors.grey800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    ),
  );

  List<Widget> road() {
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
      segments(
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
        catalogCard(
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

  Widget catalogCard(
    String title,
    String description,
    int index,
    VoidCallback onTap, {
    String source = 'practice',
  }) => LearningCard(
    gap: 16,
    onTap: onTap,
    children: [
      Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          learningHeading(title),
          const SizedBox(height: 8),
          learningBody(description),
        ],
      ),
      Row(
        children: [
          Expanded(
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                LearningPill(
                  index == 0
                      ? 'Hoàn thành'
                      : index == 1
                      ? 'Đang học'
                      : 'Chưa học',
                  small: true,
                  fill: index == 0
                      ? AppColors.primary25
                      : index == 1
                      ? const Color(0xFFFFF7EA)
                      : Colors.white,
                  color: index == 0
                      ? const Color(0xFF1F452A)
                      : index == 1
                      ? const Color(0xFFE28A00)
                      : AppColors.grey900,
                ),
                LearningPill(
                  '${index == 0
                      ? 8
                      : index == 1
                      ? 5
                      : 10} phút',
                  small: true,
                  icon: FigmaAsset('$source/imgVuesaxLinearTimer', size: 20),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          FigmaAsset(
            '$source/imgFrame${index == 0
                ? 74
                : index == 1
                ? 75
                : 76}',
            size: 40,
          ),
        ],
      ),
    ],
  );

  List<Widget> practice() => [
    segments(
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
    if (skill == PracticeSkill.writing)
      WritingPracticeSection(model: model)
    else ...[
      Row(
        children: [
          Expanded(child: learningHeading('Chặng 1')),
          learningBody('1/3', size: 20),
        ],
      ),
      const SizedBox(height: 12),
      for (var i = 0; i < 3; i++) ...[
        catalogCard(
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
          () =>
              previewPush(context, PracticeIntroPage(skill: skill, model: model)),
        ),
        const SizedBox(height: 12),
      ],
    ],
  ];

  List<Widget> progress() => [
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
                'A1',
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
  ];
}

// Retain visited tab elements and their scroll positions while PageView prepares
// the adjacent viewport. Navigation changes rebuild only the bottom bar.
class _RetainedTab extends StatefulWidget {
  const _RetainedTab({super.key, required this.child});
  final Widget child;

  @override
  State<_RetainedTab> createState() => _RetainedTabState();
}

class _RetainedTabState extends State<_RetainedTab>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return widget.child;
  }
}

class WeeklyPlanPage extends StatelessWidget {
  const WeeklyPlanPage({super.key, required this.model});
  final PreviewModel model;
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: model,
    builder: (context, _) => PreviewSurface(
      child: FigmaPage(
        titleStyle: designHeading(18),
        title: '',
        headerHeight: 42,
        bottom: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CustomAppButton(
              text: 'Bắt đầu học',
              onPressed: () =>
                  previewPush(context, VocabularyLessonPage(model: model)),
            ),
            const SizedBox(height: 16),
            CustomAppButton(
              text: 'Điều chỉnh kế hoạch',
              isSecondary: true,
              onPressed: () =>
                  previewPush(context, AdjustPlanPage(model: model)),
            ),
          ],
        ),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
          children: [
            learningHeading('Lộ trình tuần đầu tiên', size: 28),
            const SizedBox(height: 16),
            learningBody(
              'Dựa trên đánh giá và mục tiêu, chúng tôi thiết kế kế hoạch phù hợp để bạn bắt đầu.',
            ),
            const SizedBox(height: 24),
            LearningCard(
              children: [
                learningHeading('Trọng tâm tuần này'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: model.focus.map((s) => LearningPill(s)).toList(),
                ),
              ],
            ),
            const SizedBox(height: 12),
            LearningCard(
              children: [
                learningHeading('Thời gian học mỗi ngày'),
                _planRow(
                  'plan/imgVuesaxBulkTimer',
                  '${model.dailyMinutes} phút/ngày',
                  'Bắt đầu với những phiên học ngắn, duy trì thói quen mỗi ngày.',
                ),
              ],
            ),
            const SizedBox(height: 12),
            LearningCard(
              children: [
                learningHeading('Bắt đầu ngay hôm nay'),
                _planRow(
                  'plan/imgTaskSquare',
                  'Phiên khởi động: Đọc và Nghe',
                  'Làm quen với bài tập và giúp hệ thống hiểu rõ hơn về năng lực của bạn.',
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
  Widget _planRow(String icon, String title, String subtitle) => Row(
    children: [
      Container(
        padding: const EdgeInsets.all(12),
        decoration: const BoxDecoration(
          color: AppColors.primary25,
          shape: BoxShape.circle,
        ),
        child: FigmaAsset(icon, size: 20),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: designText(14, weight: FontWeight.w500)),
            const SizedBox(height: 4),
            learningBody(subtitle, size: 12),
          ],
        ),
      ),
    ],
  );
}

class AdjustPlanPage extends StatefulWidget {
  const AdjustPlanPage({super.key, required this.model});
  final PreviewModel model;
  @override
  State<AdjustPlanPage> createState() => _AdjustPlanPageState();
}

class _AdjustPlanPageState extends State<AdjustPlanPage> {
  late int minutes = widget.model.dailyMinutes;
  late Set<String> focus = Set.of(widget.model.focus);
  Future<void> save() async {
    await widget.model.savePlan(minutes, focus);
    if (mounted) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) => PreviewSurface(
    child: FigmaPage(
      titleStyle: designHeading(18),
      title: 'Điều chỉnh kế hoạch',
      bottom: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CustomAppButton(
            text: 'Bắt đầu học',
            onPressed: focus.isEmpty
                ? null
                : () async {
                    await widget.model.savePlan(minutes, focus);
                    if (context.mounted) {
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute<void>(
                          builder: (_) =>
                              VocabularyLessonPage(model: widget.model),
                        ),
                      );
                    }
                  },
          ),
          const SizedBox(height: 16),
          CustomAppButton(
            text: 'Lưu kế hoạch',
            isSecondary: true,
            onPressed: focus.isEmpty ? null : save,
          ),
        ],
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        children: [
          LearningCard(
            children: [
              learningHeading('Kỹ năng muốn tập trung'),
              learningBody(
                'Dựa trên đánh giá và mục tiêu, chúng tôi thiết kế kế hoạch phù hợp để bạn bắt đầu.',
                size: 14,
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final s in ['Đọc: Ngữ pháp', 'Nghe', 'Nói', 'Viết'])
                    LearningPill(
                      s,
                      selected: focus.contains(s),
                      onTap: () => setState(
                        () =>
                            focus.contains(s) ? focus.remove(s) : focus.add(s),
                      ),
                    ),
                ],
              ),
              if (focus.isEmpty) const Text('Chọn ít nhất một kỹ năng.'),
            ],
          ),
          const SizedBox(height: 12),
          LearningCard(
            children: [
              learningHeading('Thời gian học mỗi ngày'),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final n in [5, 10, 20])
                    LearningPill(
                      '$n phút',
                      selected: minutes == n,
                      onTap: () => setState(() => minutes = n),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7EA),
              border: Border.all(color: const Color(0xFFE28A00)),
              borderRadius: AppRadius.cardRadius,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const FigmaAsset('adjust/imgVuesaxOutlineInfoCircle', size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Lưu ý',
                        style: designText(16, color: const Color(0xFFE28A00)),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Thay đổi này chỉ điều chỉnh nội dung và thời lượng học được đề xuất. Kết quả đánh giá trình độ của bạn vẫn được giữ nguyên.',
                        style: designText(14, color: const Color(0xFFE28A00)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
