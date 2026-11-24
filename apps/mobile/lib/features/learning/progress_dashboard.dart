import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../vocabulary/vocabulary_controller.dart';
import 'daily_learning.dart';
import 'daily_pages.dart';
import 'learning_controller.dart';
import 'learning_pages.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';
import 'preview_model.dart';

/// Displays the learner's roadmap stages and improvement summary matching Figma `2228:3042` & `2233:3567`.
class ProgressDashboard extends StatefulWidget {
  const ProgressDashboard({
    super.key,
    required this.model,
    required this.onLevelTap,
    this.level = 'A1',
    this.learning,
    this.daily,
    this.vocabularyController,
    this.onOpenDailyPlan,
    this.onOpenHistory,
    this.onOpenWeeklyPlan,
  });

  final PreviewModel model;
  final VoidCallback onLevelTap;
  final String? level;
  final LearningController? learning;
  final DailyLearningController? daily;
  final VocabularyController? vocabularyController;
  final VoidCallback? onOpenDailyPlan;
  final VoidCallback? onOpenHistory;
  final VoidCallback? onOpenWeeklyPlan;

  @override
  State<ProgressDashboard> createState() => _ProgressDashboardState();
}

class _ProgressDashboardState extends State<ProgressDashboard> {
  final ScrollController scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    scroll.addListener(() {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  bool get _isSample => widget.learning == null;

  List<Json> _sampleUnits() => const [
    {
      'orderIndex': 1,
      'title': 'Làm quen và giới thiệu',
      'description': 'Chào hỏi, giới thiệu bản thân, nói số thứ tự và giờ',
      'totalLessons': 7,
      'completedLessonCount': 3,
      'status': 'IN_PROGRESS',
    },
    {
      'orderIndex': 2,
      'title': 'Gia đình và đồ vật',
      'description': 'Nói về gia đình, đồ vật và đồ ăn',
      'totalLessons': 7,
      'completedLessonCount': 0,
      'status': 'UPCOMING',
    },
    {
      'orderIndex': 3,
      'title': 'Thói quen và sở thích',
      'description': 'Kể thói quen nghề nghiệp, sở thích và hỏi đáp đơn giản',
      'totalLessons': 6,
      'completedLessonCount': 0,
      'status': 'UPCOMING',
    },
    {
      'orderIndex': 4,
      'title': 'Nơi chốn và mua sắm',
      'description': 'Hỏi đường, nói về nơi chốn và mua sắm',
      'totalLessons': 6,
      'completedLessonCount': 0,
      'status': 'UPCOMING',
    },
  ];

  int _averageMinutesFrom(Json? progress) {
    final totals = progress?['totals'] as Map?;
    if (totals?['averageStudyMinutes'] case final num m) {
      return m.toInt();
    }
    final days = learningItems(progress?['days']);
    final measured = days.where((d) => d['timeMeasured'] == true).toList();
    if (measured.isEmpty) return 0;
    final avgSeconds =
        measured.fold<num>(0, (s, d) => s + (d['activeSeconds'] as num? ?? 0)) /
        measured.length;
    return avgSeconds ~/ 60;
  }

  List<double> _barRatiosFrom(Json? progress) {
    final days = learningItems(progress?['days']);
    if (days.isEmpty) return const [0.15, 0.15, 0.15, 0.15, 0.15];
    final recent = days.length > 5 ? days.sublist(days.length - 5) : days;
    final padded = <Json>[
      for (var i = 0; i < 5 - recent.length; i++) const {'activeSeconds': 0},
      ...recent,
    ];
    final maxSeconds = padded.fold<num>(
      60,
      (m, d) =>
          (d['activeSeconds'] as num? ?? 0) > m ? d['activeSeconds'] as num : m,
    );
    return [
      for (final day in padded)
        ((day['activeSeconds'] as num? ?? 0) / maxSeconds)
            .clamp(0.15, 1.0)
            .toDouble(),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final progress = widget.daily?.progress;
    final units = _isSample
        ? _sampleUnits()
        : learningItems(progress?['units']);
    final completedCount = _isSample
        ? 3
        : (widget.learning!.summary['completedLessonCount'] as num?)?.toInt() ??
              (progress?['totals']?['completedLessonCount'] as num?)?.toInt() ??
              0;
    final totalCount = _isSample
        ? 26
        : (widget.learning!.summary['totalLessons'] as num?)?.toInt() ??
              (progress?['totals']?['totalLessons'] as num?)?.toInt() ??
              0;

    final scoreStats = progress?['scoreStats'] as Map?;
    final int? averageScore = _isSample
        ? 80
        : (scoreStats?['averageScore'] as num?)?.toInt();
    final int? deltaPercent = _isSample
        ? 6
        : (scoreStats?['deltaPercent'] as num?)?.toInt();
    final int averageMinutes = _isSample ? 40 : _averageMinutesFrom(progress);
    final List<double> barRatios = _isSample
        ? const [36 / 52, 45 / 52, 36 / 52, 39 / 52, 1.0]
        : _barRatiosFrom(progress);
    final int rememberedWords = _isSample
        ? 49
        : ((widget.vocabularyController?.summary?['totals']
                          as Map?)?['rememberedWords']
                      as num?)
                  ?.toInt() ??
              0;
    final unitLevels =
        units
            .map((unit) => unit['cefrLevel'])
            .whereType<String>()
            .toSet()
            .toList()
          ..sort();
    final cefrTitle = unitLevels.isEmpty
        ? widget.level ?? 'A1'
        : unitLevels.join('–');
    final recommendedReading = !_isSample
        ? (progress?['recommendedLevels']?['reading'] as Map?)
              ?.cast<String, dynamic>()
        : null;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value:
          (scroll.hasClients && scroll.offset > 180
                  ? SystemUiOverlayStyle.dark
                  : SystemUiOverlayStyle.light)
              .copyWith(
                statusBarColor: Colors.transparent,
                systemNavigationBarColor: AppColors.grey25,
                systemNavigationBarIconBrightness: Brightness.dark,
              ),
      child: Stack(
        children: [
          LearningGradientBackdrop(
            scroll: scroll,
            scrollKey: const Key('progressBackgroundScroll'),
          ),
          ListView(
            key: const PageStorageKey('preview-content-3'),
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
                  children: [
                    Expanded(
                      child: Text(
                        'Tiến độ',
                        style: designHeading(
                          36,
                          color: Colors.white,
                          height: 1,
                        ),
                      ),
                    ),
                    LevelCupBadge(
                      label: widget.level ?? 'Chưa đánh giá',
                      onTap: widget.onLevelTap,
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
                    if (widget.learning?.error != null) ...[
                      LearningError(
                        widget.learning!.error!,
                        retry: widget.daily?.loadDetails ?? widget.learning!.refresh,
                      ),
                      const SizedBox(height: 12),
                    ],
                    ProgressRoadmapCard(
                      cefrLabel: cefrTitle,
                      completedCount: completedCount,
                      totalCount: totalCount,
                      units: units,
                      isSample: _isSample,
                      loading: widget.daily?.loading == true && units.isEmpty,
                    ),
                    if (recommendedReading != null) ...[
                      const SizedBox(height: 24),
                      ProgressRecommendedLevelCard(reading: recommendedReading),
                    ],
                    const SizedBox(height: 24),
                    ProgressImprovementCard(
                      averageScore: averageScore,
                      deltaPercent: deltaPercent,
                      averageMinutes: averageMinutes,
                      barRatios: barRatios,
                      rememberedWords: rememberedWords,
                      isSample: _isSample,
                    ),
                    const SizedBox(height: 24),
                    if (!_isSample) ...[
                      if (widget.daily != null)
                        DailyProgressCard(daily: widget.daily!),
                      const SizedBox(height: 16),
                      if (widget.onOpenDailyPlan != null) ...[
                        CustomAppButton(
                          key: const Key('dailyPlanOpen'),
                          text: 'Kế hoạch hôm nay',
                          onPressed: widget.onOpenDailyPlan,
                        ),
                        const SizedBox(height: 12),
                      ],
                      if (widget.onOpenHistory != null)
                        CustomAppButton(
                          key: const Key('learningHistory'),
                          text: 'Lịch sử học tập',
                          isSecondary: true,
                          onPressed: widget.onOpenHistory,
                        ),
                    ] else ...[
                      LearningCard(
                        children: [
                          learningBody(
                            'Tiến độ minh họa trên thiết bị; không phải kết quả đánh giá.',
                          ),
                          if (widget.onOpenWeeklyPlan != null)
                            CustomAppButton(
                              text: 'Lộ trình tuần đầu tiên',
                              onPressed: widget.onOpenWeeklyPlan,
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SectionCardHeader extends StatelessWidget {
  const _SectionCardHeader({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
    decoration: const BoxDecoration(
      color: Colors.white,
      border: Border(bottom: BorderSide(color: AppColors.grey100)),
    ),
    child: Text(title, style: designHeading(24)),
  );
}

class ProgressRecommendedLevelCard extends StatelessWidget {
  const ProgressRecommendedLevelCard({super.key, required this.reading});

  final Json reading;

  static const _cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  String _sourceLabel(String? source) => switch (source) {
    'ADAPTIVE' => 'Tự điều chỉnh từ kết quả học',
    'PLACEMENT' => 'Từ bài kiểm tra đầu vào',
    _ => 'Mặc định ban đầu',
  };

  String _recentArrow() {
    if (reading['source'] != 'ADAPTIVE') return '';
    final current = reading['cefrLevel'] as String?;
    final previous = reading['previousCefr'] as String?;
    final rawAt = reading['changedAt'] as String?;
    if (current == null || previous == null || rawAt == null) return '';
    final changedAt = DateTime.tryParse(rawAt);
    if (changedAt == null ||
        DateTime.now().difference(changedAt).inDays.abs() > 7) {
      return '';
    }
    final cIdx = _cefrOrder.indexOf(current);
    final pIdx = _cefrOrder.indexOf(previous);
    if (cIdx < 0 || pIdx < 0 || cIdx == pIdx) return '';
    return cIdx > pIdx ? ' ↑' : ' ↓';
  }

  @override
  Widget build(BuildContext context) {
    final cefr = reading['cefrLevel'] as String? ?? 'A1';
    final source = reading['source'] as String?;
    final arrow = _recentArrow();
    return DashboardCard(
      key: const Key('progressRecommendedLevel'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionCardHeader(title: 'Mức luyện tập đề xuất'),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Đọc',
                            style: designText(
                              16,
                              weight: FontWeight.w600,
                              color: AppColors.grey900,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _sourceLabel(source),
                            style: designText(
                              13,
                              color: AppColors.grey600,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: source == 'ADAPTIVE'
                            ? AppColors.primary50
                            : AppColors.grey100,
                        borderRadius: AppRadius.pill,
                        border: Border.all(
                          color: source == 'ADAPTIVE'
                              ? AppColors.primary300
                              : AppColors.grey200,
                        ),
                      ),
                      child: Text(
                        '$cefr$arrow',
                        style: designText(
                          14,
                          weight: FontWeight.w700,
                          color: source == 'ADAPTIVE'
                              ? AppColors.primary700
                              : AppColors.grey800,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Chỉ kỹ năng Đọc tự điều chỉnh theo kết quả bài mới; mức CEFR đầu vào trên góc phải không thay đổi.',
                  style: designText(12, color: AppColors.grey600, height: 1.45),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ProgressRoadmapCard extends StatelessWidget {
  const ProgressRoadmapCard({
    super.key,
    required this.cefrLabel,
    required this.completedCount,
    required this.totalCount,
    required this.units,
    this.isSample = false,
    this.loading = false,
  });

  final String cefrLabel;
  final int completedCount;
  final int totalCount;
  final List<Json> units;
  final bool isSample;
  final bool loading;

  String _subtitle() {
    if (units.isEmpty) {
      return isSample
          ? 'Chặng đầu tiên của lộ trình A1'
          : 'Lộ trình theo dõi tiến độ bài học';
    }
    final active = units.where((u) => u['status'] == 'IN_PROGRESS').firstOrNull;
    if (active != null) {
      final order = active['orderIndex'] ?? 1;
      if (order == 1) {
        return 'Chặng đầu tiên của lộ trình ${active['cefrLevel'] ?? cefrLabel}';
      }
      return 'Đang học chặng $order · ${active['title'] ?? ''}';
    }
    final allDone = units
        .where((u) => (u['totalLessons'] as num? ?? 0) > 0)
        .every((u) => u['status'] == 'COMPLETED');
    if (allDone && completedCount > 0) {
      return 'Đã hoàn thành các bài học hiện có trong lộ trình $cefrLabel';
    }
    return 'Chặng đầu tiên của lộ trình $cefrLabel';
  }

  @override
  Widget build(BuildContext context) => DashboardCard(
    key: const Key('progressRoadmapCard'),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionCardHeader(title: 'Lộ trình $cefrLabel'),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Đã hoàn thành $completedCount trên $totalCount bài',
                key: const Key('progressCompletedSummary'),
                style: designHeading(20),
              ),
              const SizedBox(height: 8),
              Text(
                _subtitle(),
                style: designText(16, color: AppColors.grey800, height: 1.35),
              ),
              const SizedBox(height: 24),
              if (loading)
                const Center(child: CircularProgressIndicator())
              else if (units.isEmpty)
                learningBody('Chưa có chặng lộ trình được cấu hình.')
              else
                for (var i = 0; i < units.length; i++)
                  _RoadmapUnitRow(
                    unit: units[i],
                    isLast: i == units.length - 1,
                  ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _RoadmapUnitRow extends StatelessWidget {
  const _RoadmapUnitRow({required this.unit, required this.isLast});

  final Json unit;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final orderIndex = (unit['orderIndex'] as num?)?.toInt() ?? 1;
    final level = unit['cefrLevel'] as String?;
    final title = unit['title'] as String? ?? '';
    final description = unit['description'] as String? ?? '';
    final total = (unit['totalLessons'] as num?)?.toInt() ?? 0;
    final completed = (unit['completedLessonCount'] as num?)?.toInt() ?? 0;
    final status = unit['status'] as String? ?? 'UPCOMING';
    final isCompleted = status == 'COMPLETED';
    final isActive = status == 'IN_PROGRESS';
    final remaining = math.max(0, total - completed);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 40,
            child: Column(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: (isCompleted || isActive)
                        ? AppColors.primary500
                        : AppColors.grey5,
                    border: Border.all(
                      color: (isCompleted || isActive)
                          ? AppColors.primary600
                          : AppColors.grey300,
                    ),
                  ),
                  child: isCompleted
                      ? const ColorFiltered(
                          colorFilter: ColorFilter.mode(
                            Colors.white,
                            BlendMode.srcIn,
                          ),
                          child: FigmaAsset('reading/imgCheck', size: 20),
                        )
                      : Text(
                          '$orderIndex',
                          style: designHeading(
                            18,
                            color: isActive ? Colors.white : AppColors.grey900,
                          ),
                        ),
                ),
                if (!isLast)
                  Expanded(
                    child: Center(
                      child: Container(
                        width: 1,
                        color: isCompleted
                            ? AppColors.primary600
                            : AppColors.grey300,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(top: 9, bottom: isLast ? 0 : 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${level == null ? '' : '$level · '}Chặng $orderIndex · $title',
                    style: designHeading(18),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    description,
                    style: designText(
                      16,
                      color: AppColors.grey800,
                      height: 1.35,
                    ),
                  ),
                  if (isCompleted) ...[
                    const SizedBox(height: 12),
                    Text(
                      'Hoàn thành $completed/$total bài',
                      style: designText(
                        12,
                        color: AppColors.grey600,
                        height: 1.5,
                      ),
                    ),
                  ] else if (isActive && total > 0) ...[
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(
                                text: '$completed',
                                style: designText(
                                  12,
                                  weight: FontWeight.w600,
                                  color: AppColors.grey900,
                                  height: 1.5,
                                ),
                              ),
                              TextSpan(
                                text: '/$total bài',
                                style: designText(
                                  12,
                                  weight: FontWeight.w500,
                                  color: AppColors.grey600,
                                  height: 1.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          'Còn $remaining bài',
                          style: designText(
                            12,
                            color: AppColors.grey600,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: AppRadius.pill,
                      child: LinearProgressIndicator(
                        value: (completed / total).clamp(0, 1),
                        minHeight: 6,
                        backgroundColor: AppColors.grey100,
                        color: AppColors.primary500,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ProgressImprovementCard extends StatelessWidget {
  const ProgressImprovementCard({
    super.key,
    required this.averageScore,
    required this.deltaPercent,
    required this.averageMinutes,
    required this.barRatios,
    required this.rememberedWords,
    this.isSample = false,
  });

  final int? averageScore;
  final int? deltaPercent;
  final int averageMinutes;
  final List<double> barRatios;
  final int rememberedWords;
  final bool isSample;

  @override
  Widget build(BuildContext context) => DashboardCard(
    key: const Key('progressImprovementCard'),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionCardHeader(title: 'Bạn đã tiến bộ thế nào'),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              _StatBox(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Điểm trung bình',
                                style: designText(
                                  14,
                                  color: AppColors.grey800,
                                  height: 1.5,
                                ),
                              ),
                              const SizedBox(height: 8),
                              averageScore == null
                                  ? Text(
                                      '—',
                                      key: const Key('progressAverageScore'),
                                      style: designHeading(36, height: 1),
                                    )
                                  : Text.rich(
                                      key: const Key('progressAverageScore'),
                                      TextSpan(
                                        children: [
                                          TextSpan(
                                            text: '$averageScore',
                                            style: designHeading(
                                              36,
                                              color: AppColors.primary500,
                                              height: 1,
                                            ),
                                          ),
                                          TextSpan(
                                            text: '/100',
                                            style: designHeading(
                                              36,
                                              color: AppColors.grey900,
                                              height: 1,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Flexible(
                          child: Align(
                            alignment: Alignment.topRight,
                            child: _TrendBadge(deltaPercent: deltaPercent),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Điểm bài luyện tập đã nộp; không đổi mức CEFR.',
                      style: designText(
                        11,
                        color: AppColors.grey600,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _StatBox(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Trung bình thời gian học',
                            style: designText(
                              14,
                              color: AppColors.grey800,
                              height: 1.5,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${averageMinutes}p',
                            key: const Key('progressAverageMinutes'),
                            style: designHeading(36, height: 1),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    _MiniStudyBars(ratios: barRatios),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              _StatBox(
                child: SizedBox(
                  width: double.infinity,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Số từ đã học thuộc',
                        style: designText(
                          14,
                          color: AppColors.grey800,
                          height: 1.5,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '$rememberedWords',
                        key: const Key('progressRememberedWords'),
                        style: designHeading(36, height: 1),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _StatBox extends StatelessWidget {
  const _StatBox({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.grey5,
      borderRadius: AppRadius.cardSm,
      border: Border.all(color: AppColors.grey100),
    ),
    child: child,
  );
}

class _TrendBadge extends StatelessWidget {
  const _TrendBadge({required this.deltaPercent});
  final int? deltaPercent;

  @override
  Widget build(BuildContext context) {
    if (deltaPercent == null) {
      return Text(
        'Chưa đủ dữ liệu tuần trước',
        textAlign: TextAlign.end,
        style: designText(11, color: AppColors.grey600),
      );
    }
    if (deltaPercent == 0) {
      return Text(
        'Không đổi so với tuần trước',
        textAlign: TextAlign.end,
        style: designText(
          12,
          weight: FontWeight.w500,
          color: AppColors.grey600,
        ),
      );
    }
    final up = deltaPercent! > 0;
    final color = up ? AppColors.primary500 : AppColors.error100;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Transform.rotate(
          angle: up ? 0 : math.pi,
          child: ColorFiltered(
            colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
            child: const FigmaAsset('progress/arrow-up', size: 16),
          ),
        ),
        const SizedBox(width: 4),
        Flexible(
          child: Text(
            '${deltaPercent!.abs()}% so với tuần trước',
            textAlign: TextAlign.end,
            style: designText(12, weight: FontWeight.w500, color: color),
          ),
        ),
      ],
    );
  }
}

class _MiniStudyBars extends StatelessWidget {
  const _MiniStudyBars({required this.ratios});
  final List<double> ratios;

  static const List<Color> _palette = [
    AppColors.primary50,
    AppColors.primary100,
    AppColors.primary200,
    AppColors.primary300,
    AppColors.primary500,
  ];

  @override
  Widget build(BuildContext context) {
    final bars = ratios.length == 5
        ? ratios
        : List<double>.filled(5, 0.15, growable: false);
    return SizedBox(
      width: 100,
      height: 65,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (var i = 0; i < bars.length; i++) ...[
            if (i > 0) const SizedBox(width: 4),
            Expanded(
              child: Container(
                height: (bars[i].clamp(0.15, 1.0) * 52).toDouble(),
                decoration: BoxDecoration(
                  color: _palette[i],
                  borderRadius: const BorderRadius.all(
                    Radius.circular(AppRadius.xxs / 2),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
