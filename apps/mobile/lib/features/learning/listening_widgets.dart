import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/figma_widgets.dart';

class ListeningPreparation extends StatelessWidget {
  const ListeningPreparation({
    super.key,
    required this.preparation,
    required this.words,
  });

  final Json? preparation;
  final List<Json> words;

  @override
  Widget build(BuildContext context) {
    final situation = preparation?['situation'] as String? ?? '';
    final objective = preparation?['objective'] as String? ?? '';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (situation.isNotEmpty || objective.isNotEmpty)
          FigmaCard(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const PracticeSectionHeader(
                  icon: 'practice/imgVuesaxLinearHeadphone',
                  title: 'Chuẩn bị nghe',
                ),
                const SizedBox(height: 14),
                if (situation.isNotEmpty)
                  _prepBox(
                    label: 'Tình huống',
                    labelColor: AppColors.primary700,
                    text: situation,
                    weight: FontWeight.w500,
                    textColor: AppColors.grey900,
                  ),
                if (situation.isNotEmpty && objective.isNotEmpty)
                  const SizedBox(height: 10),
                if (objective.isNotEmpty)
                  _prepBox(
                    label: 'Mục tiêu nghe',
                    labelColor: AppColors.grey700,
                    text: objective,
                    weight: FontWeight.w400,
                    textColor: AppColors.grey800,
                  ),
              ],
            ),
          ),
        if (words.isNotEmpty) ...[
          if (situation.isNotEmpty || objective.isNotEmpty)
            const SizedBox(height: 16),
          KeyVocabularySection(
            items: words,
            compact: true,
            header: PracticeSectionHeader(
              icon: 'home-v2/imgVuesaxBulkBook',
              title: 'Từ vựng trọng tâm',
              trailing: PracticeCountBadge('${words.length} từ'),
            ),
          ),
        ],
      ],
    );
  }

  Widget _prepBox({
    required String label,
    required Color labelColor,
    required String text,
    required FontWeight weight,
    required Color textColor,
  }) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AppColors.grey25,
      borderRadius: AppRadius.cardSm,
      border: Border.all(color: AppColors.grey100),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: designText(12, weight: FontWeight.w600, color: labelColor),
        ),
        const SizedBox(height: 4),
        Text(
          text,
          style: designText(14, weight: weight, color: textColor, height: 1.45),
        ),
      ],
    ),
  );
}
