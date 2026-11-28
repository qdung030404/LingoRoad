import '../../core/api/api_client.dart';
import 'notification_models.dart';

InAppBannerMessage buildDailyGoalMetBanner({
  required String date,
  int? dailyGoalMinutes,
}) {
  final minutes = dailyGoalMinutes ?? 10;
  return InAppBannerMessage(
    dedupeKey: 'daily_goal_met:$date',
    type: AppNotificationType.dailyGoalMet,
    title: 'Hoàn thành mục tiêu hôm nay!',
    body: 'Bạn đã đạt $minutes phút học tập hôm nay. Chạm để xem lộ trình.',
    targetType: AppNotificationTargetType.dailyPlan,
    targetPayload: {'date': date},
  );
}

InAppBannerMessage buildSkillLevelChangedBanner({
  required String attemptId,
  required Json levelChange,
}) {
  final to = levelChange['to']?.toString() ?? '';
  final from = levelChange['from']?.toString() ?? '';
  final direction = levelChange['direction']?.toString() ?? 'UP';
  final isUp = direction == 'UP';
  final kind = levelChange['kind']?.toString() ?? 'READING';
  final kindLabel = switch (kind) {
    'READING' => 'Đọc hiểu',
    'LISTENING' => 'Nghe hiểu',
    'GRAMMAR' => 'Ngữ pháp',
    'VOCABULARY' => 'Từ vựng',
    _ => 'Kỹ năng',
  };
  return InAppBannerMessage(
    dedupeKey: 'skill_level:$attemptId',
    type: AppNotificationType.skillLevelChanged,
    title: isUp ? 'Thăng hạng $kindLabel $to!' : 'Điều chỉnh mức $kindLabel',
    body: from.isNotEmpty && to.isNotEmpty
        ? 'Mức đề xuất $kindLabel vừa chuyển từ $from sang $to.'
        : 'Mức luyện tập đề xuất của bạn vừa được cập nhật.',
    targetType: AppNotificationTargetType.profile,
    targetPayload: Map<String, dynamic>.from(levelChange),
  );
}

InAppBannerMessage buildSpeakingResultBanner(Json submission) {
  final id = submission['id']?.toString() ?? 'unknown';
  final prompt = submission['promptSnapshot'];
  final title = prompt is Map ? prompt['title']?.toString().trim() : null;
  return InAppBannerMessage(
    dedupeKey: 'speaking:$id',
    type: AppNotificationType.speakingResultReady,
    title: 'Đã có kết quả luyện nói',
    body: title != null && title.isNotEmpty
        ? 'Bài luyện "$title" đã chấm xong. Chạm để xem nhận xét.'
        : 'Bài luyện nói của bạn đã chấm xong. Chạm để xem nhận xét.',
    targetType: AppNotificationTargetType.speaking,
    targetPayload: {'submissionId': id},
  );
}
