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

part 'daily_pages_timeline.dart';
part 'daily_preferences_sheet.dart';

String formatCompactDailyStudyTime(int seconds, int goalMinutes) {
  if (seconds <= 0) return '0 / $goalMinutes phút';
  if (seconds < 60) return '$seconds giây / $goalMinutes phút';
  final mins = seconds ~/ 60;
  final rem = seconds % 60;
  if (rem == 0 || mins >= goalMinutes) return '$mins / $goalMinutes phút';
  return '${mins}p ${rem}s / $goalMinutes phút';
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

