import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/figma_widgets.dart';
import 'assessment_details.dart';
import 'speaking_content_feedback.dart';
import 'speaking_repository.dart' show speakingItems;
import 'speaking_review_widgets.dart';

class ConversationScoreDetails extends StatelessWidget {
  const ConversationScoreDetails({
    super.key,
    required this.pronunciation,
    required this.content,
    this.includeCompleteness = false,
    this.insufficientContentMessage = 'Chưa đủ lời thoại để chấm nội dung.',
  });

  final Json? pronunciation;
  final Json? content;
  final bool includeCompleteness;
  final String insufficientContentMessage;

  @override
  Widget build(BuildContext context) {
    final content = this.content;
    final status = content?['status'];
    final hasContentScore = status == 'succeeded';
    final strengths = (content?['strengths'] as List? ?? [])
        .map((item) => item.toString())
        .toList();
    final improvements = speakingItems(content?['improvements']);

    return SpeakingReviewExpansionTile(
      title: 'Điểm chi tiết',
      icon: Icons.bar_chart_rounded,
      initiallyExpanded: pronunciation == null && !hasContentScore,
      children: [
        if (pronunciation != null)
          _ScoreGroup(
            title: 'Phát âm',
            scores: pronunciation!,
            criteria: {
              'accuracy': 'Chính xác',
              'fluency': 'Trôi chảy',
              if (includeCompleteness) 'completeness': 'Mức độ đọc đủ',
              'prosody': 'Ngữ điệu',
            },
          ),
        if (content != null) ...[
          if (pronunciation != null) const SizedBox(height: 8),
          _ScoreGroup(
            title: 'Nội dung bài nói',
            scores: content,
            criteria: const {
              'vocabulary': 'Từ vựng',
              'grammar': 'Ngữ pháp',
              'topic': 'Đúng chủ đề',
            },
            message: hasContentScore
                ? null
                : switch (status) {
                    'insufficient_data' => insufficientContentMessage,
                    'processing' => 'Đang đánh giá nội dung…',
                    _ => 'Phản hồi nội dung tạm thời chưa khả dụng.',
                  },
          ),
        ],
        if (hasContentScore &&
            (strengths.isNotEmpty || improvements.isNotEmpty))
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: SpeakingContentFeedback(
              strengths: strengths,
              improvements: improvements,
            ),
          ),
      ],
    );
  }
}

class _ScoreGroup extends StatelessWidget {
  const _ScoreGroup({
    required this.title,
    required this.scores,
    required this.criteria,
    this.message,
  });

  final String title;
  final Json scores;
  final Map<String, String> criteria;
  final String? message;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: const BoxDecoration(
      color: AppColors.grey25,
      borderRadius: AppRadius.cardSm,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 10,
      children: [
        Text(title, style: designHeading(15)),
        if (message case final text?)
          Text(text, style: designText(13, color: AppColors.grey800))
        else
          for (final entry in criteria.entries)
            _CriterionScore(
              label: entry.value,
              value: assessmentScore(scores[entry.key]),
            ),
      ],
    ),
  );
}

class _CriterionScore extends StatelessWidget {
  const _CriterionScore({required this.label, required this.value});

  final String label;
  final double? value;

  @override
  Widget build(BuildContext context) {
    final score = value;
    final color = scoreColor(score);
    final scoreLabel = score?.toStringAsFixed(1);
    return Semantics(
      excludeSemantics: true,
      label:
          '$label, ${scoreLabel == null ? 'chưa có dữ liệu' : '$scoreLabel trên 100'}',
      child: Row(
        spacing: 12,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 5,
              children: [
                Text(label, style: designText(13, weight: FontWeight.w500)),
                LinearProgressIndicator(
                  value: (score ?? 0) / 100,
                  borderRadius: AppRadius.xxsRadius,
                  minHeight: 4,
                  color: color,
                  backgroundColor: AppColors.grey100,
                ),
              ],
            ),
          ),
          Container(
            constraints: const BoxConstraints(minWidth: 52),
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            decoration: BoxDecoration(
              color: scoreLabel == null
                  ? AppColors.grey100
                  : color.withValues(alpha: .09),
              borderRadius: AppRadius.tagRadius,
            ),
            child: Text(
              scoreLabel ?? '—',
              textAlign: TextAlign.center,
              style: designText(
                13,
                weight: FontWeight.w600,
                color: score == null
                    ? AppColors.grey800
                    : score >= 60 && score < 80
                    ? const Color(0xFF955800)
                    : color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
