import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'daily_learning.dart';
import 'learning_controller.dart';
import 'learning_pages.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';

class DailyPlanCard extends StatelessWidget {
  const DailyPlanCard({super.key, required this.learning});
  final LearningController learning;
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
    return LearningCard(
      children: [
        Row(
          children: [
            Expanded(child: learningHeading('Kế hoạch hôm nay', size: 24)),
            IconButton(
              key: const Key('dailyPreferences'),
              tooltip: 'Điều chỉnh kế hoạch',
              onPressed: daily.preferences == null
                  ? null
                  : () => previewPush(
                      context,
                      DailyPreferencesPage(learning: learning),
                    ),
              icon: const Icon(Icons.tune),
            ),
          ],
        ),
        if (daily.loading && plan == null)
          const Center(child: CircularProgressIndicator()),
        if (daily.error != null)
          LearningError(daily.error!, retry: daily.refresh),
        Text(
          '${seconds ~/ 60} phút ${seconds % 60} giây / $goal phút hoạt động đã ghi nhận',
          key: const Key('dailyActiveMinutes'),
          style: designText(16),
        ),
        LinearProgressIndicator(
          value: (seconds / (goal * 60)).clamp(0, 1),
          backgroundColor: AppColors.grey100,
          color: AppColors.primary500,
        ),
        if (today['goalMet'] == true)
          Text(
            'Đã đạt mục tiêu hôm nay',
            key: const Key('dailyGoalMet'),
            style: designText(16, color: AppColors.primary700),
          ),
        if (plan != null) ...[
          Text(
            '${plan['completedCount']}/${plan['totalCount']} bài kế hoạch hoàn thành · ${plan['estimatedMinutes']} phút dự kiến',
            key: const Key('dailyTaskProgress'),
            style: designText(14),
          ),
          for (final item in learningItems(plan['items']))
            InkWell(
              key: ValueKey('daily-plan-${item['lessonId']}'),
              onTap: () => openLearningLesson(
                context,
                learning,
                lessonId: item['lessonId'] as String,
                attemptId:
                    (item['completed'] == true
                            ? item['completedAttemptId']
                            : item['activeAttemptId'])
                        as String?,
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      item['completed'] == true
                          ? Icons.check_circle
                          : Icons.radio_button_unchecked,
                      color: item['completed'] == true
                          ? AppColors.primary500
                          : AppColors.grey500,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          learningHeading(item['title'] as String, size: 16),
                          const SizedBox(height: 4),
                          learningBody(
                            '${item['reason']} · ${item['estimatedMinutes']} phút dự kiến',
                            size: 12,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if ((plan['totalCount'] as num? ?? 0) == 0)
            learningBody('Chưa có bài phù hợp được xuất bản.'),
          if ((plan['estimatedMinutes'] as num? ?? 0) < goal)
            learningBody(
              'Nội dung hiện có ít hơn mục tiêu. Bạn có thể học thêm từ catalogue.',
              size: 12,
            ),
        ],
        if ((learning.activity?.pendingSeconds ?? 0) > 0)
          Text(
            'Chờ đồng bộ: ${learning.activity!.pendingSeconds} giây',
            style: designText(12),
          ),
        learningBody(
          'Hoàn thành bài và đạt mục tiêu phút là hai chỉ số riêng.',
          size: 12,
        ),
        if (learning.activity?.error != null)
          LearningError(
            learning.activity!.error!,
            retry: () => learning.activity!.flush(),
          ),
      ],
    );
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

class DailyPreferencesPage extends StatefulWidget {
  const DailyPreferencesPage({super.key, required this.learning});
  final LearningController learning;
  @override
  State<DailyPreferencesPage> createState() => _DailyPreferencesPageState();
}

class _DailyPreferencesPageState extends State<DailyPreferencesPage> {
  DailyLearningController get daily => widget.learning.daily!;
  late int minutes = daily.preferences!['dailyGoalMinutes'] as int;
  late Set<String> kinds = (daily.preferences!['preferredKinds'] as List)
      .cast<String>()
      .toSet();
  bool busy = false;
  String? error;
  Future<void> save() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await daily.save(minutes, kinds.toList());
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
          minutes = daily.preferences!['dailyGoalMinutes'] as int;
          kinds = (daily.preferences!['preferredKinds'] as List)
              .cast<String>()
              .toSet();
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

  @override
  Widget build(BuildContext context) => FigmaPage(
    title: 'Điều chỉnh kế hoạch',
    bottom: CustomAppButton(
      key: const Key('dailySavePreferences'),
      text: 'Lưu kế hoạch',
      isLoading: busy,
      onPressed: busy || kinds.isEmpty ? null : save,
    ),
    child: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        LearningCard(
          children: [
            learningHeading('Nhóm bài ưu tiên'),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final kind in [
                  'GRAMMAR',
                  'VOCABULARY',
                  'READING',
                  'LISTENING',
                ])
                  LearningPill(
                    learningKindLabel(kind),
                    selected: kinds.contains(kind),
                    onTap: busy
                        ? null
                        : () => setState(
                            () => kinds.contains(kind)
                                ? kinds.remove(kind)
                                : kinds.add(kind),
                          ),
                  ),
              ],
            ),
            if (kinds.isEmpty) learningBody('Chọn ít nhất một nhóm bài.'),
          ],
        ),
        const SizedBox(height: 16),
        LearningCard(
          children: [
            learningHeading('Thời gian hoạt động mỗi ngày'),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final n in {5, 10, 20, minutes}.toList()..sort())
                  LearningPill(
                    '$n phút',
                    selected: minutes == n,
                    onTap: busy ? null : () => setState(() => minutes = n),
                  ),
              ],
            ),
            learningBody(
              'Áp dụng ngay hôm nay; giữ bài đã xong và thời gian đã ghi nhận.',
              size: 14,
            ),
          ],
        ),
        if (error != null) LearningError(error!, retry: save),
      ],
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
