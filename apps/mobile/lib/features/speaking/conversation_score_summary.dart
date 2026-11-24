import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/figma_widgets.dart';
import 'assessment_details.dart';

class ConversationScoreSummary extends StatelessWidget {
  const ConversationScoreSummary({
    super.key,
    required this.pronunciation,
    required this.content,
  });
  final Json? pronunciation;
  final Json content;

  @override
  Widget build(BuildContext context) {
    final speech = assessmentScore(pronunciation?['overall']);
    final meaning = content['status'] == 'succeeded'
        ? assessmentScore(content['overall'])
        : null;
    final average = speech != null && meaning != null
        ? (speech + meaning) / 2
        : null;
    final description = average == null
        ? 'Cần đủ điểm phát âm và nội dung để tính trung bình.'
        : speech! >= 80 && meaning! >= 80
        ? 'Bạn phát âm tốt và trả lời đúng trọng tâm.'
        : speech < meaning!
        ? 'Hãy nghe lại những từ cần luyện phát âm.'
        : 'Xem lại cách diễn đạt để cải thiện nội dung.';
    return SpeakingScoreSummary(
      key: const Key('conversation-score-summary'),
      score: average,
      scoreLabel: 'Điểm trung bình của phát âm và nội dung',
      description: description,
      metrics: [
        (title: 'Phát âm', value: speech),
        (title: 'Nội dung', value: meaning),
      ],
      partial: pronunciation?['assessmentCompleteness'] == 'partial',
    );
  }
}

class SpeakingScoreSummary extends StatelessWidget {
  const SpeakingScoreSummary({
    super.key,
    required this.score,
    required this.scoreLabel,
    this.title = 'Điểm của bạn',
    this.description,
    this.metrics = const [],
    this.partial = false,
    this.showDecimal = false,
    this.onScoringPolicy,
  });

  final double? score;
  final String scoreLabel;
  final String title;
  final String? description;
  final List<({String title, double? value})> metrics;
  final bool partial;
  final bool showDecimal;
  final VoidCallback? onScoringPolicy;

  @override
  Widget build(BuildContext context) {
    final color = scoreColor(score);
    final large = MediaQuery.textScalerOf(context).scale(14) > 21;
    final ring = Semantics(
      label: scoreLabel,
      child: SizedBox.square(
        dimension: 104,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Positioned.fill(
              child: CircularProgressIndicator(
                value: (score ?? 0) / 100,
                strokeWidth: 7,
                strokeCap: StrokeCap.round,
                color: color,
                backgroundColor: AppColors.grey100,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      (showDecimal
                              ? score?.toStringAsFixed(1)
                              : score?.round().toString()) ??
                          '—',
                      style: designHeading(32, height: 1),
                    ),
                    Text(
                      '/100',
                      style: designHeading(18, color: AppColors.grey800),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
    final note = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (score case final value?) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: color.withValues(alpha: .10),
              borderRadius: AppRadius.tagRadius,
            ),
            child: Text(
              _grade(value),
              style: designText(
                14,
                weight: FontWeight.w500,
                height: 1.5,
                color: color,
              ),
            ),
          ),
        ],
        if (description case final text?) ...[
          if (score != null) const SizedBox(height: 8),
          Text(text, style: designHeading(18)),
        ],
      ],
    );
    final cards = [
      for (final metric in metrics)
        _Metric(title: metric.title, value: metric.value),
    ];
    final hasNote = score != null || description != null;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.grey100),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(title, style: designHeading(24))),
              if (onScoringPolicy != null)
                IconButton(
                  key: const Key('speakingScorePolicy'),
                  tooltip: 'Cách tính điểm tổng',
                  onPressed: onScoringPolicy,
                  icon: const Icon(
                    Icons.info_outline_rounded,
                    color: AppColors.primary700,
                  ),
                ),
            ],
          ),
          const Divider(height: 24, color: AppColors.grey100),
          if (large) ...[
            Align(alignment: Alignment.centerLeft, child: ring),
            if (hasNote) ...[const SizedBox(height: 12), note],
          ] else
            Row(
              children: [
                ring,
                const SizedBox(width: 20),
                Expanded(child: note),
              ],
            ),
          if (cards.isNotEmpty) ...[
            const SizedBox(height: 16),
            if (large || cards.length == 1)
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 8,
                children: cards,
              )
            else
              IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  spacing: 8,
                  children: [for (final card in cards) Expanded(child: card)],
                ),
              ),
          ],
          if (partial)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                'Đánh giá chưa đầy đủ',
                style: designText(13, color: AppColors.grey800),
              ),
            ),
        ],
      ),
    );
  }
}

String _grade(double score) => score >= 80
    ? 'Tốt'
    : score >= 60
    ? 'Khá'
    : 'Cần luyện thêm';

class _Metric extends StatelessWidget {
  const _Metric({required this.title, required this.value});
  final String title;
  final double? value;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(10),
    decoration: BoxDecoration(
      border: Border.all(color: AppColors.grey100),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: designText(18, weight: FontWeight.w500)),
            const SizedBox(height: 6),
            Text(
              value?.toStringAsFixed(1) ?? '—',
              style: designHeading(24, color: scoreColor(value)),
            ),
            Text(
              value == null ? 'Chưa có điểm' : _grade(value!),
              style: designText(
                14,
                weight: FontWeight.w500,
                color: AppColors.grey800,
              ),
            ),
            const SizedBox(height: 8),
          ],
        ),
        LinearProgressIndicator(
          value: (value ?? 0) / 100,
          minHeight: 5,
          borderRadius: AppRadius.xxsRadius,
          color: scoreColor(value),
          backgroundColor: AppColors.grey100,
        ),
      ],
    ),
  );
}
