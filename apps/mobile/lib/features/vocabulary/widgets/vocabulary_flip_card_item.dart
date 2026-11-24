import 'package:flip_card/flip_card.dart';
import 'package:flip_card/flip_card_controller.dart';
import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/theme/app_radius.dart';
import 'package:mobile/core/theme/app_shadows.dart';
import 'package:mobile/core/theme/app_spacing.dart';
import 'package:mobile/shared/figma_widgets.dart';
import 'package:mobile/features/vocabulary/vocabulary_models.dart';

class VocabularyFlipCardItem extends StatelessWidget {
  const VocabularyFlipCardItem({
    super.key,
    required this.item,
    required this.controller,
    required this.onFlipDone,
    this.cardHeight = 440,
  });

  final VocabularyReviewItem item;
  final FlipCardController controller;
  final ValueChanged<bool> onFlipDone;
  final double cardHeight;

  Widget _buildCardContainer({
    required BuildContext context,
    required Widget child,
    bool isBack = false,
  }) {
    return Container(
      width: double.infinity,
      height: cardHeight,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.grey0,
        borderRadius: AppRadius.cardRadius,
        border: Border.all(color: AppColors.borderLight, width: 1.5),
        boxShadow: AppShadows.level2,
      ),
      child: child,
    );
  }

  Widget _frontSide(BuildContext context) {
    final word = item.word;
    return _buildCardContainer(
      context: context,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Header tag: Từ loại
          Align(
            alignment: Alignment.topLeft,
            child: word.partOfSpeech.isNotEmpty
                ? Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: const BoxDecoration(
                      color: AppColors.grey50,
                      borderRadius: AppRadius.cardSm,
                    ),
                    child: Text(
                      word.partOfSpeech,
                      style: designText(
                        13,
                        weight: FontWeight.w600,
                        color: AppColors.grey700,
                      ),
                    ),
                  )
                : const SizedBox(height: AppSpacing.lg),
          ),

          // Center: Từ vựng to + Phiên âm
          Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  word.english,
                  textAlign: TextAlign.center,
                  style: designHeading(38, height: 1.15),
                  maxLines: 2,
                ),
              ),
              if (word.phonetic.isNotEmpty) ...[
                AppSpacing.gapSm,
                Text(
                  word.phonetic,
                  textAlign: TextAlign.center,
                  style: designText(
                    20,
                    weight: FontWeight.w500,
                    color: AppColors.grey600,
                  ),
                ),
              ],
            ],
          ),

          // Footer: Hướng dẫn chạm lật thẻ
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.touch_app_outlined,
                size: 18,
                color: AppColors.grey500,
              ),
              AppSpacing.gapSm,
              Flexible(
                child: Text(
                  'Chạm để xem nghĩa',
                  textAlign: TextAlign.center,
                  style: designText(13, color: AppColors.grey500),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _backSide(BuildContext context) {
    final word = item.word;
    final imageUrl = word.imageUrl;
    final example = word.example;
    final translation = word.translation;

    return _buildCardContainer(
      context: context,
      isBack: true,
      child: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Ảnh minh họa nếu có
            if (imageUrl != null && imageUrl.isNotEmpty) ...[
              ClipRRect(
                borderRadius: AppRadius.cardSm,
                child: Container(
                  height: 160,
                  width: double.infinity,
                  color: AppColors.grey25,
                  child: Image.network(
                    imageUrl,
                    cacheWidth: 800,
                    fit: BoxFit.cover,
                    loadingBuilder: (context, child, progress) {
                      if (progress == null) return child;
                      return const Center(
                        child: CircularProgressIndicator(strokeWidth: 2),
                      );
                    },
                    errorBuilder: (context, error, stackTrace) => const Center(
                      child: Icon(
                        Icons.image_not_supported_outlined,
                        color: AppColors.grey400,
                        size: 36,
                      ),
                    ),
                  ),
                ),
              ),
              AppSpacing.gapMd,
            ],

            // Từ tiếng Anh thu nhỏ + Phiên âm
            Row(
              children: [
                Expanded(
                  child: Text(
                    word.english,
                    style: designHeading(22),
                  ),
                ),
                if (word.partOfSpeech.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: const BoxDecoration(
                      color: AppColors.grey50,
                      borderRadius: AppRadius.tagRadius,
                    ),
                    child: Text(
                      word.partOfSpeech,
                      style: designText(12, color: AppColors.grey700),
                    ),
                  ),
              ],
            ),
            if (word.phonetic.isNotEmpty) ...[
              AppSpacing.gapXs,
              Text(
                word.phonetic,
                style: designText(14, color: AppColors.grey600),
              ),
            ],

            const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
              child: Divider(height: 1, color: AppColors.borderLight),
            ),

            // Nghĩa tiếng Việt
            Text(
              'Định nghĩa',
              style: designText(12, weight: FontWeight.w600, color: AppColors.grey500),
            ),
            AppSpacing.gapXs,
            Text(
              word.meaning,
              style: designText(
                18,
                weight: FontWeight.w700,
                color: AppColors.grey900,
              ),
            ),

            // Ví dụ câu & bản dịch (nếu có)
            if (example.isNotEmpty) ...[
              AppSpacing.gapMd,
              Text(
                'Ví dụ',
                style: designText(12, weight: FontWeight.w600, color: AppColors.grey500),
              ),
              AppSpacing.gapXs,
              _buildHighlightedExample(example, word.english),
              if (translation.isNotEmpty) ...[
                AppSpacing.gapXs,
                Text(
                  translation,
                  style: designText(
                    14,
                    color: AppColors.grey600,
                  ).copyWith(fontStyle: FontStyle.italic),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildHighlightedExample(String example, String targetWord) {
    final trimmed = targetWord.trim();
    if (trimmed.isEmpty) {
      return Text(example, style: designText(15, color: AppColors.grey800));
    }

    final pattern = RegExp(
      r'(?<!\w)' + RegExp.escape(trimmed) + r'(?!\w)',
      caseSensitive: false,
    );
    final match = pattern.firstMatch(example);

    if (match == null) {
      return Text(example, style: designText(15, color: AppColors.grey800));
    }

    final before = example.substring(0, match.start);
    final matchedText = example.substring(match.start, match.end);
    final after = example.substring(match.end);

    return Text.rich(
      TextSpan(
        style: designText(15, color: AppColors.grey800),
        children: [
          TextSpan(text: before),
          TextSpan(
            text: matchedText,
            style: const TextStyle(
              color: AppColors.primary500,
              fontWeight: FontWeight.bold,
              decoration: TextDecoration.underline,
            ),
          ),
          TextSpan(text: after),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      button: true,
      label: 'Thẻ từ vựng ${item.word.english}',
      hint: 'Chạm để lật thẻ xem nghĩa',
      child: FlipCard(
        key: ValueKey('flip-${item.id}'),
        controller: controller,
        direction: FlipDirection.HORIZONTAL,
        speed: 320,
        flipOnTouch: false,
        onFlipDone: (isFrontBeforeToggle) {
          // In flip_card 0.7.0, onFlipDone is invoked with `isFront` before
          // `setState(() => isFront = !isFrontBefore)` toggles it.
          // Therefore, the resulting state is `!isFrontBeforeToggle`.
          onFlipDone(!isFrontBeforeToggle);
        },
        front: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => controller.toggleCard(),
          child: _frontSide(context),
        ),
        back: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => controller.toggleCard(),
          child: _backSide(context),
        ),
      ),
    );
  }
}
