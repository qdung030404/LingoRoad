part of 'daily_pages.dart';

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
