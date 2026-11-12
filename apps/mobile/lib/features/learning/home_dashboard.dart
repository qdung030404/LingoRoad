import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'daily_pages.dart';
import 'learning_controller.dart';
import 'learning_pages.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';
import 'preview_model.dart';
import 'vocabulary_summary.dart';
import 'word_collection_pages.dart' show WordStatistic, WordDeckCard;
import 'word_library.dart';

class HomeDashboard extends StatefulWidget {
  const HomeDashboard({
    super.key,
    required this.model,
    required this.library,
    required this.onProfile,
    required this.onLesson,
    required this.onGrammar,
    required this.onWords,
    required this.onReview,
    required this.onDeck,
    this.displayName = 'Anna',
    this.level = 'A1',
    this.learning,
    this.vocabularyWordsCount,
    this.vocabularySection,
  });
  final PreviewModel model;
  final WordLibrary library;
  final VoidCallback onProfile, onLesson, onGrammar, onWords, onReview;
  final ValueChanged<String> onDeck;
  final String displayName;
  final String? level;
  final LearningController? learning;
  final int? vocabularyWordsCount;
  final Widget? vocabularySection;

  @override
  State<HomeDashboard> createState() => _HomeDashboardState();
}

class _HomeDashboardState extends State<HomeDashboard> {
  final scroll = ScrollController();
  PreviewModel get model => widget.model;
  WordLibrary get library => widget.library;
  VoidCallback get onProfile => widget.onProfile;
  VoidCallback get onLesson => widget.onLesson;
  VoidCallback get onGrammar => widget.onGrammar;
  VoidCallback get onWords => widget.onWords;
  VoidCallback get onReview => widget.onReview;

  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  List<(String, bool, bool)> _weeklyDays() {
    const labels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    if (widget.learning == null) {
      return [
        for (var i = 0; i < 7; i++) (labels[i], i >= 2 && i <= 4, i == 5),
      ];
    }
    final rawDays = learningItems(widget.learning!.daily?.progress?['days']);
    final todayDate = widget.learning!.daily?.today['date'] as String?;
    if (rawDays.length == 7) {
      return [
        for (var i = 0; i < 7; i++)
          (
            rawDays[i]['date'] is String &&
                    DateTime.tryParse(rawDays[i]['date'] as String) != null
                ? labels[DateTime.parse(rawDays[i]['date'] as String).weekday - 1]
                : labels[i],
            ((rawDays[i]['activeSeconds'] as num? ?? 0) > 0) ||
                ((rawDays[i]['completedLessonCount'] as num? ?? 0) > 0) ||
                rawDays[i]['goalMet'] == true,
            rawDays[i]['date'] == todayDate,
          ),
      ];
    }
    final todayWeekday = vietnamNow().weekday;
    return [
      for (var i = 0; i < 7; i++) (labels[i], false, i + 1 == todayWeekday),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final days = _weeklyDays();
    return AnimatedBuilder(
      animation: scroll,
      builder: (context, child) => AnnotatedRegion<SystemUiOverlayStyle>(
        value:
            (scroll.hasClients && scroll.offset > 180
                    ? SystemUiOverlayStyle.dark
                    : SystemUiOverlayStyle.light)
                .copyWith(
                  statusBarColor: Colors.transparent,
                  systemNavigationBarColor: AppColors.grey25,
                  systemNavigationBarIconBrightness: Brightness.dark,
                ),
        child: child!,
      ),
      child: Stack(
        children: [
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: 532,
            child: AnimatedBuilder(
              animation: scroll,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment(-.3, -1),
                        end: Alignment(.3, 1),
                        colors: [
                          Color(0xFF1F452A),
                          Color(0xFF53AC69),
                          AppColors.grey25,
                        ],
                        stops: [.14353, .45387, .70454],
                      ),
                    ),
                  ),
                  Image.asset(
                    'assets/figma/home_v2_glow_3x.png',
                    fit: BoxFit.fill,
                  ),
                ],
              ),
              builder: (context, child) => Transform.translate(
                key: const Key('homeBackgroundScroll'),
                offset: Offset(0, scroll.hasClients ? -scroll.offset : 0),
                child: child,
              ),
            ),
          ),
          ListView(
            key: const PageStorageKey('preview-content-0'),
            controller: scroll,
            primary: false,
            padding: EdgeInsets.fromLTRB(
              8,
              (MediaQuery.paddingOf(context).top).clamp(60, double.infinity) +
                  16,
              8,
              120,
            ),
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Semantics(
                      button: true,
                      label: 'Tài khoản',
                      child: InkWell(
                        key: const Key('previewAvatar'),
                        onTap: onProfile,
                        borderRadius: AppRadius.dialogRadius,
                        child: const ClipOval(
                          child: FigmaAsset('home-v2/imgEllipse5', size: 48),
                        ),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Ôn tập hôm nay',
                      onPressed: onReview,
                      icon: const FigmaAsset(
                        'home-v2/imgVuesaxBulkNotification',
                        size: 20,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Hello, ${widget.displayName}!',
                        style: designHeading(
                          36,
                          color: Colors.white,
                          height: 1,
                        ),
                      ),
                    ),
                    InkWell(
                      onTap: onProfile,
                      borderRadius: AppRadius.pill,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primary25,
                          borderRadius: AppRadius.pill,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const FigmaAsset('home-v3/cup', size: 22),
                            const SizedBox(width: 4),
                            Text(
                              widget.level ?? 'Chưa đánh giá',
                              style: designText(
                                18,
                                weight: FontWeight.w600,
                                color: AppColors.primary600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.grey25,
                  borderRadius: AppRadius.dialogRadius,
                ),
                child: Column(
                  children: [
                    DashboardCard(
                      key: const Key('homeWeeklyCard'),
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          learningHeading(
                            widget.learning == null
                                ? 'Tuần này của bạn'
                                : 'Tiến độ học tập',
                            size: 24,
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              for (var i = 0; i < days.length; i++) ...[
                                if (i > 0) const SizedBox(width: 6),
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 6,
                                    ),
                                    decoration: BoxDecoration(
                                      border: Border.all(
                                        color: AppColors.grey100,
                                      ),
                                      borderRadius: AppRadius.cardSm,
                                    ),
                                    child: Column(
                                      children: [
                                        Text(
                                          days[i].$1,
                                          style: designText(
                                            12,
                                            color: AppColors.grey800,
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        PreviewCheck(
                                          checked: days[i].$2,
                                          size: 24,
                                          focused: days[i].$3,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                          if (widget.learning != null) ...[
                            const SizedBox(height: 12),
                            learningBody(
                              'Kết quả bài học theo tài khoản; thời gian hoạt động được ghi nhận riêng.',
                              size: 12,
                            ),
                          ],
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: WordStatistic(
                                  'Từ vựng',
                                  widget.learning == null
                                      ? '35'
                                      : '${widget.vocabularyWordsCount ?? '—'}',
                                  'imgVuesaxBulkNote2',
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: WordStatistic(
                                  'Bài học',
                                  widget.learning == null
                                      ? '12'
                                      : '${widget.learning!.summary['completedLessonCount'] ?? '—'}',
                                  'imgVuesaxBulkBook',
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: WordStatistic(
                                  widget.learning == null
                                      ? 'Thời gian'
                                      : 'Đã ghi nhận',
                                  widget.learning == null
                                      ? '2h 15p'
                                      : (widget.learning!.daily?.progress?['totals']
                                                is! Map
                                            ? '—'
                                            : '${(((widget.learning!.daily!.progress!['totals'] as Map)['activeSeconds'] as num?) ?? 0) ~/ 60} phút'),
                                  'imgVuesaxBulkTimer',
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    if (widget.learning != null) ...[
                      if (widget.learning!.daily != null) ...[
                        DailyPlanCard(learning: widget.learning!),
                        const SizedBox(height: 24),
                      ],
                      DashboardCard(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            learningHeading('Tiếp tục học', size: 24),
                            const SizedBox(height: 16),
                            if (widget.learning!.loading &&
                                widget.learning!.lessons.isEmpty)
                              const Center(child: CircularProgressIndicator()),
                            if (widget.learning!.error != null)
                              LearningError(
                                widget.learning!.error!,
                                retry: widget.learning!.refresh,
                              ),
                            learningHeading(
                              widget.learning!.continueLesson?.title ??
                                  (widget.learning!.lessons.isEmpty
                                      ? 'Chưa có bài học'
                                      : widget.learning!.daily?.plan != null
                                      ? 'Đã hoàn thành kế hoạch hôm nay'
                                      : 'Bạn đã hoàn thành các bài hiện có'),
                            ),
                            const SizedBox(height: 8),
                            learningBody(
                              widget.learning!.continueLesson?.description ??
                                  'Bạn có thể chọn thêm bài học để luyện tập.',
                            ),
                            const SizedBox(height: 16),
                            CustomAppButton(
                              key: const Key('learningContinue'),
                              text: widget.learning!.continueLesson == null
                                  ? 'Xem bài học'
                                  : 'Tiếp tục học',
                              onPressed: onLesson,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      DashboardCard(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            learningHeading('Bài học của bạn', size: 24),
                            const SizedBox(height: 16),
                            LearningCatalogue(
                              controller: widget.learning!,
                              kinds: const [
                                'GRAMMAR',
                                'VOCABULARY',
                                'READING',
                                'LISTENING',
                              ],
                            ),
                          ],
                        ),
                      ),
                    ] else ...[
                      DashboardCard(
                        child: Column(
                          children: [
                            _header('Tiếp tục học'),
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  learningHeading(
                                    'Greetings and introductions',
                                    size: 24,
                                  ),
                                  const SizedBox(height: 6),
                                  learningBody('Chào hỏi và giới thiệu'),
                                  const SizedBox(height: 12),
                                  const Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: [
                                      LearningPill(
                                        '10 từ',
                                        small: true,
                                        icon: FigmaAsset(
                                          'home/imgVuesaxLinearTaskSquare',
                                          size: 20,
                                        ),
                                      ),
                                      LearningPill(
                                        '10 phút',
                                        small: true,
                                        icon: FigmaAsset(
                                          'home/imgVuesaxLinearTimer',
                                          size: 20,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 24),
                                  _progress(
                                    model.completed.contains('vocabulary')
                                        ? 1
                                        : .32,
                                  ),
                                  const SizedBox(height: 24),
                                  CustomAppButton(
                                    text: 'Tiếp tục học',
                                    onPressed: onLesson,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      DashboardCard(
                        child: Column(
                          children: [
                            Padding(
                              padding: const EdgeInsets.fromLTRB(
                                16,
                                24,
                                16,
                                12,
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  learningHeading('Kế hoạch hôm nay', size: 24),
                                  const SizedBox(height: 10),
                                  _progress(
                                    model.completed.isEmpty
                                        ? .32
                                        : (model.completed.length / 3).clamp(
                                            0,
                                            1,
                                          ),
                                  ),
                                ],
                              ),
                            ),
                            const Divider(height: 1, color: AppColors.grey100),
                            Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                children: [
                                  for (var i = 0; i < 3; i++) ...[
                                    if (i > 0)
                                      const Divider(
                                        height: 24,
                                        color: AppColors.grey100,
                                      ),
                                    InkWell(
                                      onTap: i == 0 ? onLesson : onGrammar,
                                      child: Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          PreviewCheck(
                                            checked:
                                                i == 0 ||
                                                model.completed.contains(
                                                  'grammar',
                                                ),
                                            size: 20,
                                          ),
                                          const SizedBox(width: 8),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                learningHeading(
                                                  [
                                                    'Greetings and introductions',
                                                    'Subject pronouns and verb to be',
                                                    "Pronouns and the Verb 'To Be'",
                                                  ][i],
                                                  size: 18,
                                                ),
                                                const SizedBox(height: 4),
                                                learningBody(
                                                  '${i == 0 ? 'Từ vựng' : 'Ngữ pháp'} · 10 phút',
                                                ),
                                              ],
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child:
                    widget.vocabularySection ??
                    VocabularySummary(
                      library: library,
                      onReview: onReview,
                      onWords: onWords,
                      decks: SizedBox(
                        key: const Key('homeWordDecks'),
                        width: double.infinity,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            children: [
                              Align(
                                alignment: Alignment.centerRight,
                                child: OutlinedButton(
                                  key: const Key('homeAllWordDecks'),
                                  onPressed: onWords,
                                  style: OutlinedButton.styleFrom(
                                    minimumSize: const Size(0, 36),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                    ),
                                    side: const BorderSide(
                                      color: AppColors.grey200,
                                    ),
                                  ),
                                  child: Text(
                                    'Xem tất cả',
                                    style: designText(12),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 16),
                              if (library.decks.isEmpty)
                                learningBody('Chưa có bộ từ vựng.'),
                              for (final deck in library.decks.take(2)) ...[
                                WordDeckCard(
                                  key: ValueKey('home-deck-${deck.id}'),
                                  deck: deck,
                                  library: library,
                                  onTap: () => widget.onDeck(deck.id),
                                ),
                                const SizedBox(height: 12),
                              ],
                            ],
                          ),
                        ),
                      ),
                    ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _header(String text) => Container(
    width: double.infinity,
    padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
    decoration: const BoxDecoration(
      border: Border(bottom: BorderSide(color: AppColors.grey100)),
    ),
    child: learningHeading(text, size: 24),
  );

  Widget _progress(double value) => Row(
    children: [
      Expanded(
        child: LinearProgressIndicator(
          value: value,
          minHeight: 6,
          borderRadius: AppRadius.pill,
          color: AppColors.primary500,
          backgroundColor: AppColors.grey100,
        ),
      ),
      const SizedBox(width: 8),
      Text(
        '${(value * 100).round()}%',
        style: designText(12, color: AppColors.grey800),
      ),
    ],
  );
}

class DashboardCard extends StatelessWidget {
  const DashboardCard({
    super.key,
    required this.child,
    this.padding = EdgeInsets.zero,
    this.radius,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final BorderRadiusGeometry? radius;
  @override
  Widget build(BuildContext context) => Container(
    clipBehavior: Clip.antiAlias,
    padding: padding,
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: radius ?? AppRadius.dialogRadius,
      border: Border.all(color: AppColors.grey100),
      boxShadow: AppShadows.level1,
    ),
    child: child,
  );
}

class PreviewCheck extends StatelessWidget {
  const PreviewCheck({
    super.key,
    required this.checked,
    this.size = 20,
    this.focused = false,
  });
  final bool checked, focused;
  final double size;
  @override
  Widget build(BuildContext context) => Container(
    width: size,
    height: size,
    decoration: BoxDecoration(
      color: checked ? AppColors.primary500 : Colors.white,
      borderRadius: size == 24 ? AppRadius.xsRadius : AppRadius.xxsRadius,
      border: Border.all(
        color: checked || focused ? AppColors.primary500 : AppColors.grey200,
      ),
    ),
    child: checked
        ? Padding(
            padding: EdgeInsets.all(size * .2),
            child: const ColorFiltered(
              colorFilter: ColorFilter.mode(Colors.white, BlendMode.srcIn),
              child: FigmaAsset('reading/imgCheck', size: 12),
            ),
          )
        : null,
  );
}
