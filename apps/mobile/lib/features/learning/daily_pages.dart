import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'daily_learning.dart';
import 'learning_controller.dart';
import 'learning_pages.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';

String formatCompactDailyStudyTime(int seconds, int goalMinutes) {
  if (seconds <= 0) return '0 / $goalMinutes phút';
  if (seconds < 60) return '$seconds giây / $goalMinutes phút';
  final mins = seconds ~/ 60;
  final rem = seconds % 60;
  if (rem == 0 || mins >= goalMinutes) return '$mins / $goalMinutes phút';
  return '${mins}p ${rem}s / $goalMinutes phút';
}

class DailyStudyMinutesStrip extends StatelessWidget {
  const DailyStudyMinutesStrip({super.key, required this.daily});

  final DailyLearningController daily;

  @override
  Widget build(BuildContext context) {
    final today = daily.today;
    final seconds = (today['activeSeconds'] as num? ?? 0).toInt();
    final goal =
        (today['dailyGoalMinutes'] as num? ??
                daily.preferences?['dailyGoalMinutes'] as num? ??
                10)
            .toInt();
    final ratio = goal > 0 ? (seconds / (goal * 60)).clamp(0.0, 1.0) : 0.0;
    final goalMet = today['goalMet'] == true;

    return Container(
      key: const Key('dailyHomeMinutesStrip'),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: goalMet ? const Color(0xFFECF9F0) : const Color(0xFFF6FAF8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: goalMet ? const Color(0xFF9ADFB0) : const Color(0xFFE1EFE6),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Row(
                  children: [
                    Icon(
                      goalMet
                          ? Icons.check_circle_rounded
                          : Icons.schedule_rounded,
                      size: 19,
                      color: goalMet
                          ? const Color(0xFF1E713B)
                          : const Color(0xFF2E7D4A),
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        goalMet
                            ? 'Đã đạt mục tiêu ngày'
                            : 'Thời gian học hôm nay',
                        key: goalMet ? const Key('dailyGoalMet') : null,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: designText(
                          14.5,
                          weight: goalMet ? FontWeight.w700 : FontWeight.w600,
                          color: goalMet
                              ? const Color(0xFF1E713B)
                              : const Color(0xFF334155),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 152),
                child: Text(
                  formatCompactDailyStudyTime(seconds, goal),
                  key: const Key('dailyHomeStudyTime'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.right,
                  style: designText(
                    15,
                    weight: FontWeight.w800,
                    color: const Color(0xFF1E713B),
                  ).copyWith(
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: AppRadius.pill,
            child: LinearProgressIndicator(
              value: seconds > 0 ? ratio.clamp(0.06, 1.0) : 0.0,
              minHeight: 8,
              backgroundColor: const Color(0xFFDCECE2),
              color: const Color(0xFF48A860),
            ),
          ),
        ],
      ),
    );
  }
}

class DailyPlanCard extends StatefulWidget {
  const DailyPlanCard({
    super.key,
    required this.learning,
    this.showActivitySummary = true,
    this.defaultCefrLevel,
    this.onReviewVocabulary,
    this.onOpenSpeakingTopic,
    this.onOpenWritingItem,
  });

  final LearningController learning;
  final bool showActivitySummary;
  final String? defaultCefrLevel;
  final VoidCallback? onReviewVocabulary;
  final Future<void> Function(String topicId)? onOpenSpeakingTopic;
  final Future<void> Function(String itemId)? onOpenWritingItem;

  @override
  State<DailyPlanCard> createState() => _DailyPlanCardState();
}

class _DailyPlanCardState extends State<DailyPlanCard> {
  static const int _collapsedStepLimit = 3;

  bool _expanded = false;

  LearningController get learning => widget.learning;
  bool get showActivitySummary => widget.showActivitySummary;
  String? get defaultCefrLevel => widget.defaultCefrLevel;
  VoidCallback? get onReviewVocabulary => widget.onReviewVocabulary;
  Future<void> Function(String topicId)? get onOpenSpeakingTopic =>
      widget.onOpenSpeakingTopic;
  Future<void> Function(String itemId)? get onOpenWritingItem =>
      widget.onOpenWritingItem;

  String? _resolveLessonCefr(Json item) {
    final direct = (item['cefrLevel'] as String?)?.trim();
    if (direct != null && direct.isNotEmpty) return direct;
    final lessonId = item['lessonId'] as String?;
    if (lessonId != null) {
      for (final lesson in learning.lessons) {
        if (lesson.id == lessonId &&
            lesson.cefrLevel != null &&
            lesson.cefrLevel!.trim().isNotEmpty) {
          return lesson.cefrLevel!.trim();
        }
      }
    }
    final fallback = defaultCefrLevel?.trim();
    if (fallback != null &&
        const {'A1', 'A2', 'B1', 'B2', 'C1', 'C2'}.contains(fallback)) {
      return fallback;
    }
    return null;
  }

  int _dueVocabularyCount() {
    final totals = learning.vocabulary?.summary?['totals'];
    if (totals is! Map) return 0;
    final total = (totals['totalWords'] as num? ?? 0).toInt();
    final remembered = (totals['rememberedWords'] as num? ?? 0).toInt();
    return (total - remembered).clamp(0, 999999);
  }

  @override
  Widget build(BuildContext context) {
    final daily = learning.daily!;
    final plan = daily.plan;
    final today = daily.today;
    final seconds = (today['activeSeconds'] as num? ?? 0).toInt();
    final goal =
        (today['dailyGoalMinutes'] as num? ??
                daily.preferences?['dailyGoalMinutes'] as num? ??
                10)
            .toInt();
    final ratio = goal > 0 ? (seconds / (goal * 60)).clamp(0.0, 1.0) : 0.0;
    final rawItems = plan == null
        ? const <Json>[]
        : learningItems(plan['items']);
    final seenStepKeys = <String>{};
    final items = <Json>[
      for (final item in rawItems)
        if (seenStepKeys.add(
          '${item['kind'] ?? ''}:${item['lessonId'] ?? item['id'] ?? ''}',
        ))
          item,
    ];
    final firstIncompleteIndex = items.indexWhere(
      (item) => item['completed'] != true,
    );
    final dueWords = onReviewVocabulary == null ? 0 : _dueVocabularyCount();
    final showSrsStep = plan != null && dueWords > 0;
    final srsMinutes = ((dueWords / 5).round()).clamp(1, 15);
    final allSteps = <({
      _TimelineStepState state,
      Widget card,
    })>[
      if (plan != null) ...[
        for (var i = 0; i < items.length; i++)
          (
            state: items[i]['completed'] == true
                ? _TimelineStepState.completed
                : (i == firstIncompleteIndex
                      ? _TimelineStepState.active
                      : _TimelineStepState.upcoming),
            card: _buildLessonStepCard(
              context,
              item: items[i],
              isActive: i == firstIncompleteIndex,
            ),
          ),
        if (showSrsStep)
          (
            state: firstIncompleteIndex == -1
                ? _TimelineStepState.active
                : _TimelineStepState.upcoming,
            card: _buildSrsStepCard(
              dueWords: dueWords,
              estimatedMinutes: srsMinutes,
              isActive: firstIncompleteIndex == -1,
            ),
          ),
      ],
    ];
    final canCollapse =
        !showActivitySummary && allSteps.length > _collapsedStepLimit;
    final isCollapsed = canCollapse && !_expanded;
    final visibleSteps = isCollapsed
        ? allSteps.take(_collapsedStepLimit).toList()
        : allSteps;
    final hiddenCount = allSteps.length - visibleSteps.length;

    return DashboardCard(
      radius: AppRadius.cardRadius,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: learningHeading('Lộ trình trong ngày', size: 24),
              ),
              const SizedBox(width: 8),
              InkWell(
                key: const Key('dailyPreferences'),
                borderRadius: BorderRadius.circular(8),
                onTap: daily.preferences == null
                    ? null
                    : () => showDailyPreferencesSheet(context, learning),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 6,
                  ),
                  child: Text(
                    'Điều chỉnh',
                    style: designText(
                      15,
                      weight: FontWeight.w700,
                      color: daily.preferences == null
                          ? AppColors.grey400
                          : const Color(0xFF1E713B),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (daily.loading && plan == null) ...[
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: CircularProgressIndicator()),
            ),
          ],
          if (daily.error != null) ...[
            LearningError(daily.error!, retry: daily.refresh),
            const SizedBox(height: 12),
          ],
          if (showActivitySummary) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF5FBF7),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFD7EFE0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    '${seconds ~/ 60} phút ${seconds % 60} giây / $goal phút hoạt động đã ghi nhận',
                    key: const Key('dailyActiveMinutes'),
                    style: designText(
                      13.5,
                      weight: FontWeight.w600,
                      color: AppColors.grey900,
                    ).copyWith(
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: AppRadius.pill,
                    child: LinearProgressIndicator(
                      value: ratio,
                      minHeight: 7,
                      backgroundColor: const Color(0xFFDCEEE3),
                      color: AppColors.primary500,
                    ),
                  ),
                  if (today['goalMet'] == true) ...[
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(
                          Icons.check_circle_rounded,
                          size: 16,
                          color: AppColors.primary700,
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            'Đã đạt mục tiêu hôm nay',
                            key: const Key('dailyGoalMet'),
                            style: designText(
                              13,
                              weight: FontWeight.w700,
                              color: AppColors.primary700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            if (plan != null) ...[
              const SizedBox(height: 14),
              Text(
                '${plan['completedCount']}/${plan['totalCount']} bài kế hoạch hoàn thành · ${plan['estimatedMinutes']} phút dự kiến',
                key: const Key('dailyTaskProgress'),
                style: designText(
                  12.5,
                  weight: FontWeight.w600,
                  color: AppColors.grey700,
                ).copyWith(
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(height: 12),
            ],
          ],
          if (plan != null)
            AnimatedSize(
              duration: MediaQuery.disableAnimationsOf(context)
                  ? Duration.zero
                  : const Duration(milliseconds: 240),
              curve: Curves.easeOutCubic,
              alignment: Alignment.topCenter,
              child: Column(
                key: showActivitySummary ? null : const Key('dailyTaskProgress'),
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < visibleSteps.length; i++)
                    _DailyTimelineRow(
                      stepNumber: i + 1,
                      isFirst: i == 0,
                      isLast: !isCollapsed && i == visibleSteps.length - 1,
                      state: visibleSteps[i].state,
                      child: visibleSteps[i].card,
                    ),
                  if (isCollapsed && hiddenCount > 0)
                    _DailySkeletonStackRow(
                      hiddenCount: hiddenCount,
                      onExpand: () => setState(() => _expanded = true),
                    ),
                  if (canCollapse && _expanded)
                    Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Center(
                        child: Material(
                          color: const Color(0xFFF4F7FA),
                          shape: const StadiumBorder(
                            side: BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: InkWell(
                            key: const Key('dailyCollapseSteps'),
                            onTap: () => setState(() => _expanded = false),
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(14, 8, 10, 8),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    'Thu gọn lộ trình',
                                    style: designText(
                                      13.5,
                                      weight: FontWeight.w700,
                                      color: const Color(0xFF475569),
                                    ),
                                  ),
                                  const SizedBox(width: 4),
                                  const Icon(
                                    Icons.keyboard_arrow_up_rounded,
                                    size: 19,
                                    color: Color(0xFF475569),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  if ((plan['totalCount'] as num? ?? 0) == 0 && !showSrsStep)
                    learningBody('Chưa có bài phù hợp được xuất bản.', size: 14),
                  if (showActivitySummary &&
                      (plan['estimatedMinutes'] as num? ?? 0) < goal) ...[
                    const SizedBox(height: 10),
                    learningBody(
                      'Nội dung hiện có ít hơn mục tiêu. Bạn có thể học thêm từ lộ trình.',
                      size: 12,
                    ),
                  ],
                ],
              ),
            ),
          if (showActivitySummary &&
              (learning.activity?.pendingSeconds ?? 0) > 0) ...[
            const SizedBox(height: 8),
            Text(
              'Chờ đồng bộ: ${learning.activity!.pendingSeconds} giây',
              style: designText(12, color: AppColors.grey700),
            ),
          ],
          if (learning.activity?.error != null) ...[
            const SizedBox(height: 10),
            LearningError(
              learning.activity!.error!,
              retry: () => learning.activity!.flush(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildLessonStepCard(
    BuildContext context, {
    required Json item,
    required bool isActive,
  }) {
    final lessonId = item['lessonId'] as String;
    final completed = item['completed'] == true;
    final title = item['title'] as String? ?? '';
    final kind = item['kind'] as String? ?? '';
    final isSpeaking = kind == 'SPEAKING';
    final isWriting = kind == 'WRITING';
    final kindLabel = isSpeaking
        ? 'Luyện nói'
        : isWriting
        ? 'Luyện viết'
        : learningKindLabel(kind);
    final minutes = (item['estimatedMinutes'] as num? ?? 5).toInt();
    final reason = (item['reason'] as String? ?? '').trim();
    final cefr = isSpeaking ? null : _resolveLessonCefr(item);
    final badgeLabel = cefr == null ? kindLabel : '$kindLabel $cefr';

    void handleOpen() {
      if (isSpeaking) {
        onOpenSpeakingTopic?.call(lessonId);
        return;
      }
      if (isWriting) {
        onOpenWritingItem?.call(lessonId);
        return;
      }
      if (!completed && kind == 'GRAMMAR' && learning.grammar != null) {
        openUncompletedGrammarCard(
          context,
          learning,
          lessonId: lessonId,
          grammarTopicCode: item['grammarTopicCode'] as String?,
          title: title,
        );
        return;
      }
      openLearningLesson(
        context,
        learning,
        lessonId: lessonId,
        attemptId: completed ? item['completedAttemptId'] as String? : null,
      );
    }

    if (completed) {
      return Material(
        color: const Color(0xFFF4F7FB),
        borderRadius: BorderRadius.circular(16),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          key: ValueKey('daily-plan-$lessonId'),
          onTap: handleOpen,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: designText(
                    16.5,
                    weight: FontWeight.w700,
                    color: const Color(0xFF5B6574),
                    height: 1.3,
                  ).copyWith(
                    decoration: TextDecoration.lineThrough,
                    decorationColor: const Color(0xFF5B6574),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '$kindLabel · Đã hoàn thành',
                  style: designText(
                    14,
                    color: const Color(0xFF7B8799),
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    if (isActive) {
      final hasFocusReason =
          reason.isNotEmpty &&
          reason != 'Bài mới' &&
          reason != 'Chủ đề luyện nói' &&
          reason != 'Tiếp tục lộ trình';
      return Material(
        color: const Color(0xFFF5FBF7),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: Color(0xFF59B070), width: 1.5),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          key: ValueKey('daily-plan-$lessonId'),
          onTap: handleOpen,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'TIẾP THEO · $minutes PHÚT',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: designText(
                          13,
                          weight: FontWeight.w800,
                          color: const Color(0xFF1E713B),
                        ).copyWith(letterSpacing: 0.3),
                      ),
                    ),
                    const SizedBox(width: 8),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 140),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 11,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFDCF1E0),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          badgeLabel,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: designText(
                            13,
                            weight: FontWeight.w700,
                            color: const Color(0xFF1E713B),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  title,
                  style: designHeading(19.5, height: 1.3),
                ),
                if (hasFocusReason) ...[
                  const SizedBox(height: 6),
                  Text(
                    reason,
                    style: designText(
                      14,
                      color: const Color(0xFF5B6574),
                      height: 1.3,
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                SizedBox(
                  height: 48,
                  child: FilledButton(
                    onPressed: handleOpen,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF1A2029),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: const StadiumBorder(),
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Flexible(
                          child: Text(
                            isSpeaking
                                ? 'Bắt đầu luyện nói'
                                : isWriting
                                ? 'Bắt đầu luyện viết'
                                : 'Bắt đầu bài này',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: designText(
                              15.5,
                              weight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Icon(
                          Icons.arrow_forward_rounded,
                          size: 18,
                          color: Colors.white,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final subtitle = isSpeaking
        ? 'Luyện nói theo chủ đề · ~$minutes phút'
        : isWriting
        ? '$badgeLabel${reason.isNotEmpty && reason != 'Bài mới' ? ' · $reason' : ''} · ~$minutes phút'
        : reason.isNotEmpty &&
              reason != 'Bài mới' &&
              reason != 'Tiếp tục lộ trình'
        ? '$kindLabel · $reason · ~$minutes phút'
        : '$kindLabel · ~$minutes phút';

    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFE4E9F0), width: 1.2),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: ValueKey('daily-plan-$lessonId'),
        onTap: handleOpen,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: designHeading(16.5, height: 1.3),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: designText(
                  14,
                  color: const Color(0xFF657482),
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSrsStepCard({
    required int dueWords,
    required int estimatedMinutes,
    required bool isActive,
  }) {
    if (isActive) {
      return Material(
        color: const Color(0xFFF5FBF7),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: Color(0xFF59B070), width: 1.5),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          key: const Key('daily-plan-srs-due'),
          onTap: onReviewVocabulary,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'TIẾP THEO · ~$estimatedMinutes PHÚT',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: designText(
                          13,
                          weight: FontWeight.w800,
                          color: const Color(0xFF1E713B),
                        ).copyWith(letterSpacing: 0.3),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 11,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCF1E0),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        'Thẻ SRS',
                        style: designText(
                          13,
                          weight: FontWeight.w700,
                          color: const Color(0xFF1E713B),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  'Ôn $dueWords từ vựng đến hạn',
                  style: designHeading(19.5, height: 1.3),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  height: 48,
                  child: FilledButton(
                    onPressed: onReviewVocabulary,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF1A2029),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: const StadiumBorder(),
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Flexible(
                          child: Text(
                            'Bắt đầu ôn từ',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: designText(
                              15.5,
                              weight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Icon(
                          Icons.arrow_forward_rounded,
                          size: 18,
                          color: Colors.white,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFE4E9F0), width: 1.2),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: const Key('daily-plan-srs-due'),
        onTap: onReviewVocabulary,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Ôn $dueWords từ vựng đến hạn',
                style: designHeading(16.5, height: 1.3),
              ),
              const SizedBox(height: 4),
              Text(
                'Thẻ ghi nhớ SRS · ~$estimatedMinutes phút',
                style: designText(
                  14,
                  color: const Color(0xFF657482),
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

enum _TimelineStepState { completed, active, upcoming }

class _DailySkeletonStackRow extends StatelessWidget {
  const _DailySkeletonStackRow({
    required this.hiddenCount,
    required this.onExpand,
  });

  final int hiddenCount;
  final VoidCallback onExpand;

  @override
  Widget build(BuildContext context) {
    const lineColor = Color(0xFFE4E9F0);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 42,
            child: Column(
              children: [
                SizedBox(
                  height: 5,
                  child: Center(child: Container(width: 2, color: lineColor)),
                ),
                SizedBox(
                  width: 42,
                  height: 42,
                  child: Center(
                    child: Container(
                      width: 32,
                      height: 32,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF4F7FA),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0xFFCBD5E1),
                          width: 1.5,
                        ),
                      ),
                      alignment: Alignment.center,
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 3),
                          child: Text(
                            '+$hiddenCount',
                            style: designText(
                              12.5,
                              weight: FontWeight.w800,
                              color: const Color(0xFF64748B),
                              height: 1.1,
                            ).copyWith(
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: Container(
                      width: 2,
                      height: 14,
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [lineColor, Color(0x00E4E9F0)],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Semantics(
              button: true,
              label: 'Xem thêm $hiddenCount mục trong lộ trình hôm nay',
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Material(
                    color: const Color(0xFFFBFCFE),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: const BorderSide(
                        color: Color(0xFFE2E8F0),
                        width: 1.2,
                      ),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      key: const Key('dailyExpandSkeleton'),
                      onTap: onExpand,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 14,
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  FractionallySizedBox(
                                    alignment: Alignment.centerLeft,
                                    widthFactor: 0.84,
                                    child: Container(
                                      height: 11.5,
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(6),
                                        gradient: const LinearGradient(
                                          colors: [
                                            Color(0xFFDCE4EE),
                                            Color(0xFFEDF2F7),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      Flexible(
                                        flex: 5,
                                        child: Container(
                                          height: 8.5,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFE6ECF3),
                                            borderRadius:
                                                BorderRadius.circular(5),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Flexible(
                                        flex: 3,
                                        child: Container(
                                          height: 8.5,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFEEF3F8),
                                            borderRadius:
                                                BorderRadius.circular(5),
                                          ),
                                        ),
                                      ),
                                      const Spacer(flex: 3),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 10),
                            Container(
                              padding: const EdgeInsets.fromLTRB(11, 6, 6, 6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEEF8F1),
                                borderRadius: AppRadius.pill,
                                border: Border.all(
                                  color: const Color(0xFFC7E8D2),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(
                                    'Xem thêm $hiddenCount',
                                    style: designText(
                                      13,
                                      weight: FontWeight.w700,
                                      color: const Color(0xFF1E713B),
                                      height: 1.15,
                                    ).copyWith(
                                      fontFeatures: const [
                                        FontFeature.tabularFigures(),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 2),
                                  const Icon(
                                    Icons.keyboard_arrow_down_rounded,
                                    size: 18,
                                    color: Color(0xFF1E713B),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  if (hiddenCount >= 2)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 9),
                      child: Container(
                        height: 6,
                        decoration: const BoxDecoration(
                          color: Color(0xFFF6F9FC),
                          borderRadius: BorderRadius.vertical(
                            bottom: Radius.circular(12),
                          ),
                          border: Border(
                            left: BorderSide(color: Color(0xFFE4E9F0)),
                            right: BorderSide(color: Color(0xFFE4E9F0)),
                            bottom: BorderSide(color: Color(0xFFE4E9F0)),
                          ),
                        ),
                      ),
                    ),
                  if (hiddenCount >= 3)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                      child: Container(
                        height: 5,
                        decoration: const BoxDecoration(
                          color: Color(0xFFF9FBFD),
                          borderRadius: BorderRadius.vertical(
                            bottom: Radius.circular(10),
                          ),
                          border: Border(
                            left: BorderSide(color: Color(0xFFEAEEF4)),
                            right: BorderSide(color: Color(0xFFEAEEF4)),
                            bottom: BorderSide(color: Color(0xFFEAEEF4)),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DailyTimelineRow extends StatelessWidget {
  const _DailyTimelineRow({
    required this.stepNumber,
    required this.isFirst,
    required this.isLast,
    required this.state,
    required this.child,
  });

  final int stepNumber;
  final bool isFirst;
  final bool isLast;
  final _TimelineStepState state;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    const lineColor = Color(0xFFE4E9F0);
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            width: 42,
            child: Column(
              children: [
                SizedBox(
                  height: 5,
                  child: isFirst
                      ? null
                      : Center(child: Container(width: 2, color: lineColor)),
                ),
                SizedBox(
                  width: 42,
                  height: 42,
                  child: Center(child: _buildIndicator()),
                ),
                Expanded(
                  child: isLast
                      ? Align(
                          alignment: Alignment.topCenter,
                          child: Container(
                            width: 2,
                            height: 12,
                            color: lineColor,
                          ),
                        )
                      : Center(child: Container(width: 2, color: lineColor)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: EdgeInsets.only(bottom: isLast ? 0 : 14),
              child: child,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIndicator() {
    switch (state) {
      case _TimelineStepState.completed:
        return Container(
          width: 32,
          height: 32,
          decoration: const BoxDecoration(
            color: Color(0xFF59B070),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: const Icon(Icons.check_rounded, size: 18, color: Colors.white),
        );
      case _TimelineStepState.active:
        return Container(
          width: 42,
          height: 42,
          decoration: const BoxDecoration(
            color: Color(0xFFDCF1E0),
            shape: BoxShape.circle,
          ),
          alignment: Alignment.center,
          child: Container(
            width: 32,
            height: 32,
            decoration: const BoxDecoration(
              color: Color(0xFF1E713B),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              '$stepNumber',
              style: designText(
                14.5,
                weight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ),
        );
      case _TimelineStepState.upcoming:
        return Container(
          width: 32,
          height: 32,
          decoration: BoxDecoration(
            color: Colors.white,
            shape: BoxShape.circle,
            border: Border.all(color: const Color(0xFFCCD6E0), width: 1.7),
          ),
          alignment: Alignment.center,
          child: Text(
            '$stepNumber',
            style: designText(
              14.5,
              weight: FontWeight.w700,
              color: const Color(0xFF657482),
            ),
          ),
        );
    }
  }
}

class DailyPlanPage extends StatelessWidget {
  const DailyPlanPage({super.key, required this.learning});
  final LearningController learning;
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: learning.daily!,
    builder: (context, _) => FigmaPage(
      title: 'Kế hoạch hôm nay',
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [DailyPlanCard(learning: learning)],
      ),
    ),
  );
}

Future<void> showDailyPreferencesSheet(
  BuildContext context,
  LearningController learning,
) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => DailyPreferencesSheet(learning: learning),
  );
}

class DailyPreferencesSheet extends StatefulWidget {
  const DailyPreferencesSheet({super.key, required this.learning});
  final LearningController learning;

  @override
  State<DailyPreferencesSheet> createState() => _DailyPreferencesSheetState();
}

class _DailyPreferencesSheetState extends State<DailyPreferencesSheet> {
  static const _skillOrder = [
    'GRAMMAR',
    'VOCABULARY',
    'READING',
    'LISTENING',
    'SPEAKING',
    'WRITING',
  ];

  static List<String> _dedupeKinds(Iterable<String> raw) {
    final seen = <String>{};
    return [
      for (final k in raw)
        if (seen.add(k)) k,
    ];
  }

  DailyLearningController get daily => widget.learning.daily!;
  late List<String> kinds = _dedupeKinds(
    (daily.preferences!['preferredKinds'] as List).cast<String>(),
  );
  bool busy = false;
  String? error;

  IconData _kindIcon(String kind) => switch (kind) {
    'GRAMMAR' => Icons.spellcheck_rounded,
    'VOCABULARY' => Icons.style_outlined,
    'READING' => Icons.menu_book_rounded,
    'LISTENING' => Icons.headphones_rounded,
    'SPEAKING' => Icons.mic_rounded,
    'WRITING' => Icons.edit_note_rounded,
    _ => Icons.school_outlined,
  };

  Future<void> save() async {
    if (busy || kinds.isEmpty) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final currentMinutes =
          (daily.preferences!['dailyGoalMinutes'] as num).toInt();
      await daily.save(currentMinutes, List<String>.from(kinds));
      if (!daily.active) return;
      await widget.learning.refresh();
      if (mounted && daily.error == null) {
        Navigator.pop(context);
      } else if (mounted) {
        setState(() => error = daily.error);
      }
    } catch (e) {
      if (e is ApiFailure && e.status == 409) {
        await daily.refresh();
        if (mounted && daily.preferences != null) {
          kinds = _dedupeKinds(
            (daily.preferences!['preferredKinds'] as List).cast<String>(),
          );
        }
      }
      if (mounted) {
        setState(
          () => error = e is ApiFailure && e.status == 409
              ? 'Mục tiêu đã đổi trên thiết bị khác. Đã tải bản mới; hãy kiểm tra rồi lưu lại.'
              : e is ApiFailure
              ? e.message
              : 'Không lưu được kế hoạch. Hãy thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _toggleKind(String kind) {
    if (busy) return;
    setState(() {
      error = null;
      if (kinds.contains(kind)) {
        kinds.remove(kind);
      } else {
        kinds.add(kind);
      }
    });
  }

  void _resetKinds() {
    if (busy) return;
    setState(() {
      error = null;
      kinds.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.90,
        ),
        child: DecoratedBox(
          key: const Key('dailyPreferencesSheet'),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 12),
                Center(
                  child: Container(
                    width: 42,
                    height: 4.5,
                    decoration: BoxDecoration(
                      color: const Color(0xFFD5DDE7),
                      borderRadius: AppRadius.pill,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 16, 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Điều chỉnh lộ trình ngày',
                              style: designHeading(22),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Chọn kỹ năng ưu tiên cho lộ trình hôm nay',
                              style: designText(
                                14,
                                color: const Color(0xFF64748B),
                                height: 1.35,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Material(
                        color: const Color(0xFFF1F5F9),
                        shape: const CircleBorder(),
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: busy ? null : () => Navigator.pop(context),
                          child: const SizedBox(
                            width: 38,
                            height: 38,
                            child: Icon(
                              Icons.close_rounded,
                              size: 20,
                              color: Color(0xFF475569),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFEEF2F6)),
                Flexible(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                'Nhóm bài ưu tiên',
                                style: designHeading(17),
                              ),
                            ),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Đã chọn ${kinds.length}/${_skillOrder.length}',
                                  style: designText(
                                    14,
                                    weight: FontWeight.w600,
                                    color: const Color(0xFF64748B),
                                  ).copyWith(
                                    fontFeatures: const [
                                      FontFeature.tabularFigures(),
                                    ],
                                  ),
                                ),
                                if (kinds.isNotEmpty) ...[
                                  const SizedBox(width: 10),
                                  InkWell(
                                    key: const Key('dailyResetKindOrder'),
                                    onTap: busy ? null : _resetKinds,
                                    borderRadius: BorderRadius.circular(8),
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 2,
                                      ),
                                      child: Text(
                                        'Đặt lại',
                                        style: designText(
                                          14,
                                          weight: FontWeight.w700,
                                          color: const Color(0xFF1E713B),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        LayoutBuilder(
                          builder: (context, constraints) {
                            if (constraints.maxWidth < 250) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  for (final (i, kind) in _skillOrder.indexed) ...[
                                    if (i > 0) const SizedBox(height: 10),
                                    _buildKindTile(kind),
                                  ],
                                ],
                              );
                            }
                            final rows = <Widget>[];
                            for (var i = 0; i < _skillOrder.length; i += 2) {
                              final left = _skillOrder[i];
                              final right = i + 1 < _skillOrder.length
                                  ? _skillOrder[i + 1]
                                  : null;
                              if (rows.isNotEmpty) {
                                rows.add(const SizedBox(height: 10));
                              }
                              rows.add(
                                IntrinsicHeight(
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      Expanded(child: _buildKindTile(left)),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: right != null
                                            ? _buildKindTile(right)
                                            : const SizedBox.shrink(),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }
                            return Column(children: rows);
                          },
                        ),
                        if (error != null) ...[
                          const SizedBox(height: 14),
                          LearningError(error!, retry: save),
                        ],
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 18),
                  child: CustomAppButton(
                    key: const Key('dailySavePreferences'),
                    text: kinds.isEmpty
                        ? 'Chọn ít nhất 1 kỹ năng'
                        : 'Lưu lộ trình',
                    isLoading: busy,
                    onPressed: busy || kinds.isEmpty ? null : save,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildKindTile(String kind) {
    final rankIndex = kinds.indexOf(kind);
    final selected = rankIndex >= 0;
    final isPrimary = rankIndex == 0;
    return Material(
      key: ValueKey('daily-kind-$kind'),
      color: isPrimary
          ? const Color(0xFFF1FAF4)
          : selected
          ? const Color(0xFFF8FCFA)
          : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: isPrimary
              ? const Color(0xFF2F854A)
              : selected
              ? const Color(0xFF7BC494)
              : const Color(0xFFE2E8F0),
          width: isPrimary ? 1.6 : (selected ? 1.3 : 1.0),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: busy ? null : () => _toggleKind(kind),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              Icon(
                _kindIcon(kind),
                size: 21,
                color: selected
                    ? const Color(0xFF1E713B)
                    : const Color(0xFF64748B),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  learningKindLabel(kind),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: designText(
                    15.5,
                    weight: selected ? FontWeight.w700 : FontWeight.w600,
                    color: selected
                        ? const Color(0xFF1E713B)
                        : AppColors.grey900,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: isPrimary
                      ? const Color(0xFF2F854A)
                      : selected
                      ? const Color(0xFFE2F4EA)
                      : Colors.white,
                  shape: BoxShape.circle,
                  border: isPrimary
                      ? null
                      : Border.all(
                          color: selected
                              ? const Color(0xFF2F854A)
                              : const Color(0xFFCBD5E1),
                          width: 1.5,
                        ),
                ),
                alignment: Alignment.center,
                child: selected
                    ? Text(
                        '${rankIndex + 1}',
                        style: designText(
                          13.5,
                          weight: FontWeight.w800,
                          color: isPrimary
                              ? Colors.white
                              : const Color(0xFF1E713B),
                          height: 1.1,
                        ).copyWith(
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      )
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class DailyProgressCard extends StatelessWidget {
  const DailyProgressCard({super.key, required this.daily});
  final DailyLearningController daily;
  @override
  Widget build(BuildContext context) {
    final data = daily.progress;
    final days = learningItems(data?['days']);
    final firstTracked = data?['trackingStartedAt'] is String
        ? DateTime.parse(data!['trackingStartedAt'] as String)
              .toUtc()
              .add(const Duration(hours: 7))
              .toIso8601String()
              .substring(0, 10)
        : null;
    bool measured(Json day) =>
        day['date'] == daily.today['date'] ||
        (firstTracked != null &&
            (day['date'] as String).compareTo(firstTracked) >= 0);
    final maxSeconds = days.fold<num>(
      60,
      (m, d) =>
          (d['activeSeconds'] as num? ?? 0) > m ? d['activeSeconds'] as num : m,
    );
    return LearningCard(
      children: [
        learningHeading('Hoạt động 7 ngày', size: 24),
        if (daily.error != null)
          LearningError(daily.error!, retry: daily.refresh),
        if (data == null && daily.loading)
          const Center(child: CircularProgressIndicator()),
        SizedBox(
          height: 150,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              for (final day in days)
                Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        measured(day)
                            ? '${(day['activeSeconds'] as num? ?? 0) ~/ 60}p'
                            : '—',
                        style: designText(12),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        width: 20,
                        height:
                            8 +
                            70 *
                                (day['activeSeconds'] as num? ?? 0) /
                                maxSeconds,
                        decoration: BoxDecoration(
                          color: day['goalMet'] == true
                              ? AppColors.primary500
                              : AppColors.primary100,
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        (day['date'] as String).substring(5),
                        style: designText(11),
                      ),
                      Text(
                        '${day['completedLessonCount']} bài',
                        style: designText(10),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        learningBody(
          'Phút hoạt động đã ghi nhận · ngày theo giờ Việt Nam. Thời gian trước khi bật ghi nhận chưa được đo.',
          size: 12,
        ),
        learningHeading('Kết quả gần nhất', size: 18),
        if (learningItems(data?['latestResults']).isEmpty)
          learningBody('Chưa có bài đã nộp.'),
        for (final result in learningItems(data?['latestResults']))
          learningBody(
            '${learningKindLabel(result['kind'] as String)}: ${result['correctCount']}/${result['totalQuestions']} · ${result['lessonTitle']}',
            size: 14,
          ),
        learningBody(
          'Điểm luyện tập không phải mức thành thạo hay CEFR mới. Nói/Viết: chưa đánh giá.',
          size: 12,
        ),
        learningHeading('Kết quả đầu vào', size: 18),
        if (data?['placement'] is Map)
          for (final kind in ['reading', 'listening'])
            learningBody(
              '${kind == 'reading' ? 'Đọc' : 'Nghe'}: ${(data!['placement'] as Map)[kind]?['estimatedCefr'] ?? 'Chưa đánh giá'} · kết quả placement tạm tính',
              size: 14,
            )
        else
          learningBody('Chưa có kết quả đầu vào.'),
      ],
    );
  }
}
