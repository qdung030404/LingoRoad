import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../grammar/grammar_controller.dart';
import '../vocabulary/vocabulary_controller.dart';
import 'cefr_milestone_detail_page.dart';
import 'daily_learning.dart';
import 'daily_pages.dart';
import 'learning_controller.dart';
import 'learning_pages.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';
import 'preview_model.dart';
import 'progress_roadmap_card.dart';

export 'progress_roadmap_card.dart' show CefrMilestoneEntry, ProgressRoadmapCard;

/// Displays the learner's CEFR milestone roadmap and improvement summary.
class ProgressDashboard extends StatefulWidget {
  const ProgressDashboard({
    super.key,
    required this.model,
    this.onLevelTap,
    this.onProfile,
    this.displayName = 'Anna',
    this.avatarUrl,
    this.level,
    this.learning,
    this.daily,
    this.vocabularyController,
    this.grammarController,
    this.showPreviousLevels = false,
    this.onTogglePreviousLevels,
    this.onOpenDailyPlan,
    this.onOpenHistory,
    this.onOpenWeeklyPlan,
  });

  final PreviewModel model;
  final VoidCallback? onLevelTap;
  final VoidCallback? onProfile;
  final String displayName;
  final String? avatarUrl;
  final String? level;
  final LearningController? learning;
  final DailyLearningController? daily;
  final VocabularyController? vocabularyController;
  final GrammarController? grammarController;
  final bool showPreviousLevels;
  final VoidCallback? onTogglePreviousLevels;
  final VoidCallback? onOpenDailyPlan;
  final VoidCallback? onOpenHistory;
  final VoidCallback? onOpenWeeklyPlan;

  @override
  State<ProgressDashboard> createState() => _ProgressDashboardState();
}

class _ProgressDashboardState extends State<ProgressDashboard> {
  static const List<String> _cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  final ScrollController scroll = ScrollController();
  bool _darkStatusBar = false;

  @override
  void initState() {
    super.initState();
    scroll.addListener(() {
      final bool next = scroll.hasClients && scroll.offset > 180;
      if (mounted && next != _darkStatusBar) {
        setState(() => _darkStatusBar = next);
      }
    });
  }

  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  bool get _isSample => widget.learning == null;

  Widget _initialAvatarCircle(String initial) => Container(
    width: 44,
    height: 44,
    decoration: const BoxDecoration(
      color: AppColors.primary50,
      shape: BoxShape.circle,
    ),
    alignment: Alignment.center,
    child: Text(
      initial,
      style: designHeading(18, color: AppColors.primary700),
    ),
  );

  Widget _buildHeaderAvatar() {
    final trimmed = widget.avatarUrl?.trim() ?? '';
    if (_isSample && trimmed.isEmpty) {
      return const ClipOval(
        child: FigmaAsset('home-v2/imgEllipse5', size: 48),
      );
    }
    final name = widget.displayName.trim();
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'L';
    return Container(
      width: 48,
      height: 48,
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.9),
        shape: BoxShape.circle,
      ),
      child: ClipOval(
        child: trimmed.isNotEmpty
            ? Image.network(
                trimmed,
                width: 44,
                height: 44,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => _initialAvatarCircle(initial),
              )
            : _initialAvatarCircle(initial),
      ),
    );
  }

  List<CefrMilestoneEntry> _withComputedStatuses(
    List<(String level, int completed, int total)> buckets,
    int startRank,
  ) {
    final List<String> statuses = List<String>.filled(buckets.length, 'UPCOMING');
    int? activeIndex;
    for (int i = 0; i < buckets.length; i++) {
      final (_, completed, total) = buckets[i];
      if (total > 0 && completed >= total) {
        statuses[i] = 'COMPLETED';
      } else if (i >= startRank && total > 0 && activeIndex == null) {
        activeIndex = i;
        statuses[i] = 'IN_PROGRESS';
      }
    }
    if (activeIndex == null) {
      final bool anyFromStart = [
        for (int i = startRank; i < buckets.length; i++) i,
      ].any((i) => buckets[i].$3 > 0);
      if (!anyFromStart && startRank < buckets.length && statuses[startRank] != 'COMPLETED') {
        statuses[startRank] = 'IN_PROGRESS';
      }
    }
    return [
      for (int i = 0; i < buckets.length; i++)
        CefrMilestoneEntry(
          cefrLevel: buckets[i].$1,
          completedLessonCount: buckets[i].$2,
          totalLessons: buckets[i].$3,
          status: statuses[i],
        ),
    ];
  }

  List<CefrMilestoneEntry> _resolveMilestones(Json? progress, int startRank) {
    if (_isSample) {
      return _withComputedStatuses(const [
        ('A1', 3, 12), ('A2', 0, 14), ('B1', 0, 18), ('B2', 0, 13), ('C1', 0, 7), ('C2', 0, 4),
      ], startRank);
    }
    final List<Json> rawMilestones = learningItems(progress?['milestones']);
    if (rawMilestones.isNotEmpty) {
      final Map<String, Json> byLevel = {
        for (final m in rawMilestones)
          if (m['cefrLevel'] is String) m['cefrLevel'] as String: m,
      };
      return [
        for (final level in _cefrOrder)
          CefrMilestoneEntry(
            cefrLevel: level,
            totalLessons: (byLevel[level]?['totalLessons'] as num?)?.toInt() ?? 0,
            completedLessonCount: (byLevel[level]?['completedLessonCount'] as num?)?.toInt() ?? 0,
            status: byLevel[level]?['status'] as String? ?? 'UPCOMING',
          ),
      ];
    }
    final List<Json> units = learningItems(progress?['units']);
    final Map<String, int> totals = {for (final l in _cefrOrder) l: 0};
    final Map<String, int> completed = {for (final l in _cefrOrder) l: 0};
    final String fallbackLevel = _cefrOrder[startRank.clamp(0, 5)];
    for (final unit in units) {
      final String? rawLevel = unit['cefrLevel'] as String?;
      final String level = _cefrOrder.contains(rawLevel) ? rawLevel! : fallbackLevel;
      totals[level] = totals[level]! + ((unit['totalLessons'] as num?)?.toInt() ?? 0);
      completed[level] = completed[level]! + ((unit['completedLessonCount'] as num?)?.toInt() ?? 0);
    }
    return _withComputedStatuses([
      for (final level in _cefrOrder) (level, completed[level]!, totals[level]!),
    ], startRank);
  }

  CefrMilestoneEntry _resolveActiveMilestone(List<CefrMilestoneEntry> all, int startRank) {
    final List<CefrMilestoneEntry> fromStart = all
        .where((m) => GrammarController.cefrRank(m.cefrLevel) >= startRank)
        .toList();
    for (final m in fromStart) {
      if (m.totalLessons > 0 && m.completedLessonCount < m.totalLessons) return m;
    }
    final List<CefrMilestoneEntry> populatedFromStart = fromStart
        .where((m) => m.totalLessons > 0)
        .toList();
    if (populatedFromStart.isNotEmpty) {
      return populatedFromStart.last;
    }
    return fromStart.isNotEmpty ? fromStart.first : all.first;
  }

  int _averageMinutesFrom(Json? progress) {
    final totals = progress?['totals'] as Map?;
    if (totals?['averageStudyMinutes'] case final num m) return m.toInt();
    final days = learningItems(progress?['days']);
    final measured = days.where((d) => d['timeMeasured'] == true).toList();
    if (measured.isEmpty) return 0;
    final avgSeconds = measured.fold<num>(0, (s, d) => s + (d['activeSeconds'] as num? ?? 0)) / measured.length;
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
      (m, d) => (d['activeSeconds'] as num? ?? 0) > m ? d['activeSeconds'] as num : m,
    );
    return [for (final day in padded) ((day['activeSeconds'] as num? ?? 0) / maxSeconds).clamp(0.15, 1.0).toDouble()];
  }

  @override
  Widget build(BuildContext context) {
    final progress = widget.daily?.progress;
    final String startCefr = widget.level ?? (progress?['placementCefr'] as String?) ?? 'A1';
    final int startRank = math.max(0, GrammarController.cefrRank(startCefr));
    final List<Json> rawMilestones = learningItems(progress?['milestones']);
    final List<Json> rawUnits = learningItems(progress?['units']);
    final bool roadmapLoading = !_isSample && rawMilestones.isEmpty && (progress == null || rawUnits.isEmpty) && widget.daily?.loading == true;

    final List<CefrMilestoneEntry> allMilestones = _resolveMilestones(progress, startRank);
    final CefrMilestoneEntry activeMilestone = _resolveActiveMilestone(allMilestones, startRank);
    final List<CefrMilestoneEntry> visibleMilestones = (!widget.showPreviousLevels && startRank > 0)
        ? allMilestones.where((m) => GrammarController.cefrRank(m.cefrLevel) >= startRank).toList()
        : allMilestones;

    final scoreStats = progress?['scoreStats'] as Map?;
    final int? averageScore = _isSample ? 80 : (scoreStats?['averageScore'] as num?)?.toInt();
    final int? deltaPercent = _isSample ? 6 : (scoreStats?['deltaPercent'] as num?)?.toInt();
    final int averageMinutes = _isSample ? 40 : _averageMinutesFrom(progress);
    final List<double> barRatios = _isSample ? const [36 / 52, 45 / 52, 36 / 52, 39 / 52, 1.0] : _barRatiosFrom(progress);
    final int rememberedWords = _isSample ? 49 : ((widget.vocabularyController?.summary?['totals'] as Map?)?['rememberedWords'] as num?)?.toInt() ?? 0;
    final recommendedReading = !_isSample ? (progress?['recommendedLevels']?['reading'] as Map?)?.cast<String, dynamic>() : null;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: (_darkStatusBar ? SystemUiOverlayStyle.dark : SystemUiOverlayStyle.light).copyWith(
        statusBarColor: Colors.transparent,
        systemNavigationBarColor: AppColors.grey25,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Stack(
        children: [
          LearningGradientBackdrop(scroll: scroll, scrollKey: const Key('progressBackgroundScroll')),
          ListView(
            key: const PageStorageKey('preview-content-3'),
            controller: scroll,
            primary: false,
            padding: EdgeInsets.fromLTRB(8, (MediaQuery.paddingOf(context).top).clamp(60, double.infinity) + 16, 8, 120),
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Row(
                  children: [
                    Expanded(child: Text('Tiến độ', style: designHeading(36, color: Colors.white, height: 1))),
                    Semantics(
                      button: true,
                      label: 'Tài khoản',
                      child: Tooltip(
                        message: 'Hồ sơ của tôi',
                        child: InkWell(
                          key: const Key('progressAvatar'),
                          customBorder: const CircleBorder(),
                          onTap: widget.onProfile ?? widget.onLevelTap,
                          child: _buildHeaderAvatar(),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: AppColors.grey25, borderRadius: AppRadius.dialogRadius),
                child: Column(
                  children: [
                    if (widget.learning?.error != null) ...[
                      LearningError(widget.learning!.error!, retry: widget.daily?.loadDetails ?? widget.learning!.refresh),
                      const SizedBox(height: 12),
                    ],
                    ProgressRoadmapCard(
                      cefrLabel: roadmapLoading ? startCefr : activeMilestone.cefrLevel,
                      completedCount: activeMilestone.completedLessonCount,
                      totalCount: activeMilestone.totalLessons,
                      milestones: visibleMilestones,
                      activeCefr: activeMilestone.cefrLevel,
                      canTogglePreviousLevels: startRank > 0 && widget.onTogglePreviousLevels != null,
                      showPreviousLevels: widget.showPreviousLevels,
                      onTogglePreviousLevels: widget.onTogglePreviousLevels,
                      onSelectMilestone: (m) => previewPush<void>(
                        context,
                        CefrMilestoneDetailPage(
                          milestoneCefr: m.cefrLevel,
                          placementCefr: startCefr,
                          learningController: widget.learning,
                          grammarController: widget.grammarController,
                          dailyController: widget.daily,
                        ),
                      ),
                      loading: roadmapLoading,
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
                      if (widget.daily != null) DailyProgressCard(daily: widget.daily!),
                      const SizedBox(height: 16),
                      if (widget.onOpenDailyPlan != null) ...[
                        CustomAppButton(key: const Key('dailyPlanOpen'), text: 'Kế hoạch hôm nay', onPressed: widget.onOpenDailyPlan),
                        const SizedBox(height: 12),
                      ],
                      if (widget.onOpenHistory != null)
                        CustomAppButton(key: const Key('learningHistory'), text: 'Lịch sử học tập', isSecondary: true, onPressed: widget.onOpenHistory),
                    ] else ...[
                      LearningCard(
                        children: [
                          learningBody('Tiến độ minh họa trên thiết bị; không phải kết quả đánh giá.'),
                          if (widget.onOpenWeeklyPlan != null)
                            CustomAppButton(text: 'Lộ trình tuần đầu tiên', onPressed: widget.onOpenWeeklyPlan),
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
    if (changedAt == null || DateTime.now().difference(changedAt).inDays.abs() > 7) return '';
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
          const ProgressSectionCardHeader(title: 'Mức luyện tập đề xuất'),
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
                          Text('Đọc', style: designText(16, weight: FontWeight.w600, color: AppColors.grey900)),
                          const SizedBox(height: 2),
                          Text(_sourceLabel(source), style: designText(13, color: AppColors.grey600, height: 1.4)),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: source == 'ADAPTIVE' ? AppColors.primary50 : AppColors.grey100,
                        borderRadius: AppRadius.pill,
                        border: Border.all(color: source == 'ADAPTIVE' ? AppColors.primary300 : AppColors.grey200),
                      ),
                      child: Text(
                        '$cefr$arrow',
                        style: designText(14, weight: FontWeight.w700, color: source == 'ADAPTIVE' ? AppColors.primary700 : AppColors.grey800),
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
        const ProgressSectionCardHeader(title: 'Bạn đã tiến bộ thế nào'),
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
                              Text('Điểm trung bình', style: designText(14, color: AppColors.grey800, height: 1.5)),
                              const SizedBox(height: 8),
                              averageScore == null
                                  ? Text('—', key: const Key('progressAverageScore'), style: designHeading(36, height: 1))
                                  : Text.rich(
                                      key: const Key('progressAverageScore'),
                                      TextSpan(
                                        children: [
                                          TextSpan(text: '$averageScore', style: designHeading(36, color: AppColors.primary500, height: 1)),
                                          TextSpan(text: '/100', style: designHeading(36, color: AppColors.grey900, height: 1)),
                                        ],
                                      ),
                                    ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Flexible(child: Align(alignment: Alignment.topRight, child: _TrendBadge(deltaPercent: deltaPercent))),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text('Điểm bài luyện tập đã nộp; không đổi mức CEFR.', style: designText(11, color: AppColors.grey600, height: 1.4)),
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
                          Text('Trung bình thời gian học', style: designText(14, color: AppColors.grey800, height: 1.5)),
                          const SizedBox(height: 8),
                          Text('${averageMinutes}p', key: const Key('progressAverageMinutes'), style: designHeading(36, height: 1)),
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
                      Text('Số từ đã học thuộc', style: designText(14, color: AppColors.grey800, height: 1.5)),
                      const SizedBox(height: 8),
                      Text('$rememberedWords', key: const Key('progressRememberedWords'), style: designHeading(36, height: 1)),
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
    decoration: BoxDecoration(color: AppColors.grey50, borderRadius: AppRadius.cardSm, border: Border.all(color: AppColors.grey100)),
    child: child,
  );
}

class _TrendBadge extends StatelessWidget {
  const _TrendBadge({required this.deltaPercent});
  final int? deltaPercent;

  @override
  Widget build(BuildContext context) {
    if (deltaPercent == null) {
      return Text('Chưa đủ dữ liệu tuần trước', textAlign: TextAlign.end, style: designText(11, color: AppColors.grey600));
    }
    if (deltaPercent == 0) {
      return Text('Không đổi so với tuần trước', textAlign: TextAlign.end, style: designText(12, weight: FontWeight.w500, color: AppColors.grey600));
    }
    final up = deltaPercent! > 0;
    final color = up ? AppColors.primary500 : AppColors.error100;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Transform.rotate(
          angle: up ? 0 : math.pi,
          child: ColorFiltered(colorFilter: ColorFilter.mode(color, BlendMode.srcIn), child: const FigmaAsset('progress/arrow-up', size: 16)),
        ),
        const SizedBox(width: 4),
        Flexible(child: Text('${deltaPercent!.abs()}% so với tuần trước', textAlign: TextAlign.end, style: designText(12, weight: FontWeight.w500, color: color))),
      ],
    );
  }
}

class _MiniStudyBars extends StatelessWidget {
  const _MiniStudyBars({required this.ratios});
  final List<double> ratios;
  static const List<Color> _palette = [AppColors.primary50, AppColors.primary100, AppColors.primary200, AppColors.primary300, AppColors.primary500];

  @override
  Widget build(BuildContext context) {
    final bars = ratios.length == 5 ? ratios : List<double>.filled(5, 0.15, growable: false);
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
                decoration: BoxDecoration(color: _palette[i], borderRadius: const BorderRadius.all(Radius.circular(AppRadius.xxs / 2))),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
