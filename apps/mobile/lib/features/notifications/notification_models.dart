enum AppNotificationType {
  dailyPlanReady,
  dailyGoalMet,
  skillLevelChanged,
  placementCompleted,
  vocabularyReviewDue,
  speakingResultReady,
  unknown;

  static AppNotificationType fromApi(Object? value) {
    final normalized = value?.toString().trim().toUpperCase();
    return switch (normalized) {
      'DAILY_PLAN_READY' => AppNotificationType.dailyPlanReady,
      'DAILY_GOAL_MET' => AppNotificationType.dailyGoalMet,
      'SKILL_LEVEL_CHANGED' => AppNotificationType.skillLevelChanged,
      'PLACEMENT_COMPLETED' => AppNotificationType.placementCompleted,
      'VOCABULARY_REVIEW_DUE' => AppNotificationType.vocabularyReviewDue,
      'SPEAKING_RESULT_READY' => AppNotificationType.speakingResultReady,
      _ => AppNotificationType.unknown,
    };
  }

  String get apiValue => switch (this) {
    AppNotificationType.dailyPlanReady => 'DAILY_PLAN_READY',
    AppNotificationType.dailyGoalMet => 'DAILY_GOAL_MET',
    AppNotificationType.skillLevelChanged => 'SKILL_LEVEL_CHANGED',
    AppNotificationType.placementCompleted => 'PLACEMENT_COMPLETED',
    AppNotificationType.vocabularyReviewDue => 'VOCABULARY_REVIEW_DUE',
    AppNotificationType.speakingResultReady => 'SPEAKING_RESULT_READY',
    AppNotificationType.unknown => 'UNKNOWN',
  };
}

enum AppNotificationTargetType {
  dailyPlan,
  lesson,
  vocabularyReview,
  profile,
  speaking,
  none;

  static AppNotificationTargetType fromApi(Object? value) {
    final normalized = value?.toString().trim().toUpperCase();
    return switch (normalized) {
      'DAILY_PLAN' => AppNotificationTargetType.dailyPlan,
      'LESSON' => AppNotificationTargetType.lesson,
      'VOCABULARY_REVIEW' => AppNotificationTargetType.vocabularyReview,
      'PROFILE' => AppNotificationTargetType.profile,
      'SPEAKING' => AppNotificationTargetType.speaking,
      'NONE' || null || '' => AppNotificationTargetType.none,
      _ => AppNotificationTargetType.none,
    };
  }

  String get apiValue => switch (this) {
    AppNotificationTargetType.dailyPlan => 'DAILY_PLAN',
    AppNotificationTargetType.lesson => 'LESSON',
    AppNotificationTargetType.vocabularyReview => 'VOCABULARY_REVIEW',
    AppNotificationTargetType.profile => 'PROFILE',
    AppNotificationTargetType.speaking => 'SPEAKING',
    AppNotificationTargetType.none => 'NONE',
  };
}

DateTime? _parseNotificationDateTime(Object? raw) {
  if (raw == null) return null;
  if (raw is DateTime) return raw;
  final text = raw.toString().trim();
  if (text.isEmpty) return null;
  return DateTime.tryParse(text);
}

Map<String, dynamic>? _parseTargetPayload(Object? raw) {
  if (raw is Map) {
    return Map<String, dynamic>.from(raw);
  }
  return null;
}

class AppNotification {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.targetType = AppNotificationTargetType.none,
    this.targetPayload,
    this.readAt,
    required this.createdAt,
  });

  final String id;
  final AppNotificationType type;
  final String title;
  final String body;
  final AppNotificationTargetType targetType;
  final Map<String, dynamic>? targetPayload;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get isUnread => readAt == null;

  factory AppNotification.fromJson(Map<String, dynamic> json) {
    return AppNotification(
      id: (json['id'] ?? '').toString(),
      type: AppNotificationType.fromApi(json['type']),
      title: (json['title'] ?? '').toString(),
      body: (json['body'] ?? '').toString(),
      targetType: AppNotificationTargetType.fromApi(json['targetType']),
      targetPayload: _parseTargetPayload(json['targetPayload']),
      readAt: _parseNotificationDateTime(json['readAt']),
      createdAt: _parseNotificationDateTime(json['createdAt']) ?? DateTime.now(),
    );
  }

  AppNotification copyWith({
    DateTime? readAt,
    bool clearReadAt = false,
  }) {
    return AppNotification(
      id: id,
      type: type,
      title: title,
      body: body,
      targetType: targetType,
      targetPayload: targetPayload == null
          ? null
          : Map<String, dynamic>.from(targetPayload!),
      readAt: clearReadAt ? null : (readAt ?? this.readAt),
      createdAt: createdAt,
    );
  }
}

class NotificationPageResult {
  const NotificationPageResult({
    required this.items,
    required this.unreadCount,
    this.nextCursor,
  });

  final List<AppNotification> items;
  final String? nextCursor;
  final int unreadCount;

  factory NotificationPageResult.fromJson(Map<String, dynamic> json) {
    final rawItems = json['items'];
    final items = rawItems is List
        ? rawItems
              .whereType<Map>()
              .map(
                (entry) =>
                    AppNotification.fromJson(Map<String, dynamic>.from(entry)),
              )
              .toList()
        : const <AppNotification>[];
    final rawCursor = json['nextCursor']?.toString().trim();
    return NotificationPageResult(
      items: items,
      nextCursor: rawCursor != null && rawCursor.isNotEmpty ? rawCursor : null,
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class InAppBannerMessage {
  const InAppBannerMessage({
    required this.dedupeKey,
    required this.type,
    required this.title,
    required this.body,
    this.targetType = AppNotificationTargetType.none,
    this.targetPayload,
  });

  final String dedupeKey;
  final AppNotificationType type;
  final String title;
  final String body;
  final AppNotificationTargetType targetType;
  final Map<String, dynamic>? targetPayload;
}
