import 'package:flutter/material.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/theme/app_radius.dart';
import 'package:mobile/core/theme/app_shadows.dart';
import 'package:mobile/core/theme/app_spacing.dart';
import 'package:mobile/shared/figma_widgets.dart';

class VocabularyReviewBottomBar extends StatelessWidget {
  const VocabularyReviewBottomBar({
    super.key,
    required this.isFront,
    required this.isPlayingAudio,
    required this.disabled,
    required this.onOpenDetails,
    required this.onPrimaryAction,
    required this.onPlayAudio,
  });

  final bool isFront;
  final bool isPlayingAudio;
  final bool disabled;
  final VoidCallback onOpenDetails;
  final VoidCallback onPrimaryAction;
  final VoidCallback onPlayAudio;

  @override
  Widget build(BuildContext context) {
    final horizontalPad = AppSpacing.horizontal(context);
    final itemGap = AppSpacing.item(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        horizontalPad,
        AppSpacing.sm,
        horizontalPad,
        AppSpacing.md,
      ),
      child: Row(
        children: [
          // Button 1: Tròn - Mở BottomSheet chi tiết lượt ôn (icon mũi tên lên)
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.grey0,
              border: Border.all(color: AppColors.borderLight, width: 1.5),
              boxShadow: AppShadows.level1,
            ),
            child: IconButton(
              key: const Key('vocabularyReviewDetailsBtn'),
              tooltip: 'Chi tiết lượt ôn',
              onPressed: disabled ? null : onOpenDetails,
              icon: const Icon(
                Icons.keyboard_arrow_up_rounded,
                size: 30,
                color: AppColors.grey900,
              ),
            ),
          ),
          SizedBox(width: itemGap),

          // Button 2: Bo dài chiếm toàn bộ chiều ngang còn lại - Hành động chính
          Expanded(
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 52),
              child: FilledButton(
                key: const Key('vocabularyReviewPrimaryBtn'),
                onPressed: disabled ? null : onPrimaryAction,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.grey900,
                  foregroundColor: AppColors.grey0,
                  shape: const RoundedRectangleBorder(
                    borderRadius: AppRadius.buttonRadius,
                  ),
                  elevation: 2,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      isFront
                          ? Icons.flip_to_back_rounded
                          : Icons.arrow_forward_rounded,
                      size: 20,
                      color: AppColors.grey0,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Flexible(
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          isFront ? 'Xem nghĩa' : 'Tiếp theo',
                          maxLines: 1,
                          style: designText(
                            17,
                            weight: FontWeight.w700,
                            color: AppColors.grey0,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          SizedBox(width: itemGap),

          // Button 3: Tròn - Nút phát Audio của từ hiện tại
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isPlayingAudio
                  ? AppColors.primary500.withValues(alpha: 0.12)
                  : AppColors.grey0,
              border: Border.all(
                color: isPlayingAudio
                    ? AppColors.primary500
                    : AppColors.borderLight,
                width: 1.5,
              ),
              boxShadow: AppShadows.level1,
            ),
            child: IconButton(
              key: const Key('vocabularyReviewAudioBtn'),
              tooltip: 'Phát âm thanh',
              onPressed: disabled ? null : onPlayAudio,
              icon: isPlayingAudio
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          AppColors.primary500,
                        ),
                      ),
                    )
                  : const Icon(
                      Icons.volume_up_rounded,
                      size: 26,
                      color: AppColors.primary500,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}
