import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/learning_media_image.dart';

class ListeningPreparation extends StatelessWidget {
  const ListeningPreparation({
    super.key,
    required this.preparation,
    required this.words,
    this.coverImageUrl,
  });

  final Json? preparation;
  final List<Json> words;
  final String? coverImageUrl;

  @override
  Widget build(BuildContext context) {
    final situation = preparation?['situation'] as String? ?? '';
    final objective = preparation?['objective'] as String? ?? '';
    final hasHero = coverImageUrl != null && coverImageUrl!.trim().isNotEmpty;
    final hasPrep = situation.isNotEmpty || objective.isNotEmpty;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (hasHero) ...[
          Container(
            width: double.infinity,
            decoration: BoxDecoration(
              borderRadius: AppRadius.cardRadius,
              border: Border.all(color: AppColors.primary100),
            ),
            child: ClipRRect(
              borderRadius: AppRadius.cardRadius,
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: LearningMediaImage(
                  key: const ValueKey('listening-prep-hero-image'),
                  imageUrl: coverImageUrl,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  semanticLabel: 'Minh họa bối cảnh bài nghe',
                ),
              ),
            ),
          ),
          if (hasPrep || words.isNotEmpty) const SizedBox(height: 16),
        ],
        if (hasPrep)
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
          if (hasPrep)
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
