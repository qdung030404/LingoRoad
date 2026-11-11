import 'package:flutter/material.dart';
import '../../shared/figma_widgets.dart';
import '../../core/theme/app_colors.dart';
import 'assessment_details.dart';
import 'speaking_assessment.dart';

class AssessmentCircleHeading extends StatelessWidget {
  const AssessmentCircleHeading({
    super.key,
    required this.title,
    required this.value,
    required this.circleKey,
  });
  final String title;
  final dynamic value;
  final String circleKey;

  @override
  Widget build(BuildContext context) {
    final score = assessmentScore(value);
    final heading = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: designHeading(22)),
        const SizedBox(height: 6),
        Text(
          'Điểm tổng toàn bộ câu trả lời',
          style: designText(12, color: AppColors.grey800, height: 1.5),
        ),
      ],
    );
    final circle = Semantics(
      label:
          '$title ${score?.toStringAsFixed(1) ?? "chưa có dữ liệu"} trên 100',
      child: SizedBox(
        key: ValueKey(circleKey),
        width: 104,
        height: 104,
        child: Stack(
          alignment: Alignment.center,
          children: [
            SizedBox.expand(
              child: CircularProgressIndicator(
                value: score == null ? 0 : score / 100,
                strokeWidth: 7,
                strokeCap: StrokeCap.round,
                color: scoreColor(score),
                backgroundColor: AppColors.grey50,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      score?.toStringAsFixed(1) ?? '—',
                      style: designHeading(30, color: scoreColor(score)),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '/ 100',
                      style: designText(12, color: AppColors.grey800),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
    return MediaQuery.textScalerOf(context).scale(14) > 21
        ? Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [heading, const SizedBox(height: 16), circle],
          )
        : Row(
            children: [
              Expanded(child: heading),
              const SizedBox(width: 16),
              circle,
            ],
          );
  }
}
