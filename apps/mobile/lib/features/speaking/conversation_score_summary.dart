import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';
import 'assessment_details.dart';
import 'speaking_assessment.dart';
import 'assessment_circle_heading.dart';

class ConversationScoreSummary extends StatelessWidget {
  const ConversationScoreSummary({super.key, required this.pronunciation});
  final Json? pronunciation;

  @override
  Widget build(BuildContext context) => Container(
    key: const Key('conversation-score-summary'),
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AppColors.grey100),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AssessmentCircleHeading(
          title: 'Phát âm',
          value: pronunciation?['overall'],
          circleKey: 'pronunciation-score-circle',
        ),
        if (pronunciation != null) ...[
          const SizedBox(height: 16),
          for (final entry in const {
            'accuracy': 'Chính xác',
            'fluency': 'Trôi chảy',
            'prosody': 'Ngữ điệu',
          }.entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          entry.value,
                          style: designText(14, color: AppColors.grey800),
                        ),
                      ),
                      Expanded(
                        child: Text(
                          assessmentScoreText(pronunciation![entry.key]),
                          textAlign: TextAlign.right,
                          style: designText(14, weight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      minHeight: 6,
                      value:
                          (assessmentScore(pronunciation![entry.key]) ?? 0) /
                          100,
                      color: scoreColor(
                        assessmentScore(pronunciation![entry.key]),
                      ),
                      backgroundColor: AppColors.grey50,
                    ),
                  ),
                ],
              ),
            ),
          if (pronunciation!['assessmentCompleteness'] == 'partial')
            Text(
              'Đánh giá chưa đầy đủ',
              style: designText(12, color: AppColors.warning300),
            ),
        ],
      ],
    ),
  );
}
