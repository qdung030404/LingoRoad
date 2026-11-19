import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_shadows.dart';
import '../../shared/figma_widgets.dart';
import '../learning/learning_widgets.dart';

String _formatPartOfSpeech(String? pos) {
  if (pos == null || pos.trim().isEmpty) return '';
  final clean = pos.trim().toLowerCase();
  switch (clean) {
    case 'noun':
    case 'n':
      return 'danh từ';
    case 'verb':
    case 'v':
      return 'động từ';
    case 'adjective':
    case 'adj':
      return 'tính từ';
    case 'adverb':
    case 'adv':
      return 'trạng từ';
    case 'preposition':
    case 'prep':
      return 'giới từ';
    case 'conjunction':
    case 'conj':
      return 'liên từ';
    case 'pronoun':
    case 'pron':
      return 'đại từ';
    case 'interjection':
      return 'thán từ';
    default:
      return pos;
  }
}

class VocabularyWordCard extends StatelessWidget {
  const VocabularyWordCard({
    super.key,
    required this.english,
    this.phonetic,
    this.partOfSpeech,
    required this.meaning,
    this.example,
    this.translation,
    this.imageUrl,
    this.isPlaying = false,
    this.onPlayAudio,
    this.topAction,
    this.isBookmarked = false,
    this.isBookmarkLoading = false,
    this.onBookmark,
    this.learningState,
  });

  final String english;
  final String? phonetic;
  final String? partOfSpeech;
  final String meaning;
  final String? example;
  final String? translation;
  final String? imageUrl;
  final bool isPlaying;
  final VoidCallback? onPlayAudio;
  final Widget? topAction;
  final bool isBookmarked;
  final bool isBookmarkLoading;
  final VoidCallback? onBookmark;
  final String? learningState;

  @override
  Widget build(BuildContext context) {
    final posLabel = _formatPartOfSpeech(partOfSpeech);
    final phoneticText = phonetic?.trim() ?? '';
    final subLabel = [
      if (phoneticText.isNotEmpty) phoneticText,
      if (posLabel.isNotEmpty) posLabel,
    ].join(' · ');

    // Chuẩn bị câu ví dụ gạch chân từ vựng mục tiêu
    final ex = example?.trim() ?? '';
    String prefix = '';
    String target = '';
    String suffix = ex;

    if (ex.isNotEmpty) {
      final split = ex.toLowerCase().indexOf(english.trim().toLowerCase());
      if (split >= 0) {
        prefix = ex.substring(0, split);
        target = ex.substring(split, split + english.trim().length);
        suffix = ex.substring(split + english.trim().length);
      }
    }

    return FigmaCard(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Khung ảnh minh họa với nút góc trên bên phải
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Stack(
              children: [
                imageUrl != null && imageUrl!.trim().isNotEmpty
                    ? Image.network(
                        imageUrl!.trim(),
                        width: double.infinity,
                        height: 160,
                        fit: BoxFit.cover,
                        errorBuilder: (context, error, stackTrace) => const FigmaAsset(
                          'word-list/imgFrame',
                          width: double.infinity,
                          height: 160,
                          fit: BoxFit.cover,
                        ),
                      )
                    : const FigmaAsset(
                        'word-list/imgFrame',
                        width: double.infinity,
                        height: 160,
                        fit: BoxFit.cover,
                      ),
                if (topAction != null)
                  Positioned(
                    top: 10,
                    right: 10,
                    child: topAction!,
                  )
                else if (onBookmark != null)
                  Positioned(
                    top: 10,
                    right: 10,
                    child: _WordCardBookmarkButton(
                      isBookmarked: isBookmarked,
                      isLoading: isBookmarkLoading,
                      onTap: onBookmark!,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // 2. Tên từ, phiên âm, định nghĩa và nút loa
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    learningHeading(english, size: 24),
                    if (subLabel.isNotEmpty || learningState != null) ...[
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          if (subLabel.isNotEmpty)
                            learningBody(subLabel, size: 14),
                          if (learningState != null)
                            LearningPill(
                              learningState == 'REMEMBERED' ? 'Đã nhớ' : 'Cần ôn',
                              small: true,
                              fill: learningState == 'REMEMBERED'
                                  ? AppColors.primary50
                                  : const Color(0xFFFFF7EA),
                              color: learningState == 'REMEMBERED'
                                  ? const Color(0xFF1F452A)
                                  : const Color(0xFFE28A00),
                            ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 8),
                    Text.rich(
                      TextSpan(
                        style: designText(16, height: 1.5),
                        children: [
                          TextSpan(
                            text: 'Định nghĩa : ',
                            style: designText(
                              16,
                              height: 1.5,
                              weight: FontWeight.w600,
                            ),
                          ),
                          TextSpan(text: meaning),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (onPlayAudio != null)
                IconButton(
                  tooltip: 'Phát âm',
                  onPressed: onPlayAudio,
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.grey900,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(48, 48),
                  ),
                  icon: isPlaying
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const FigmaAsset(
                          'word-list/imgVuesaxLinearVolumeHigh',
                          size: 20,
                        ),
                ),
            ],
          ),

          // 3. Đường kẻ ngang và câu ví dụ
          if (ex.isNotEmpty) ...[
            const Divider(height: 32, color: AppColors.grey100),
            Text.rich(
              TextSpan(
                style: designText(16),
                children: [
                  if (prefix.isNotEmpty) TextSpan(text: prefix),
                  if (target.isNotEmpty)
                    TextSpan(
                      text: target,
                      style: const TextStyle(
                        color: AppColors.primary500,
                        decoration: TextDecoration.underline,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  if (suffix.isNotEmpty) TextSpan(text: suffix),
                ],
              ),
            ),
            if (translation != null && translation!.trim().isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                translation!.trim(),
                style: designText(13, color: AppColors.grey600),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _WordCardBookmarkButton extends StatelessWidget {
  const _WordCardBookmarkButton({
    required this.isBookmarked,
    required this.isLoading,
    required this.onTap,
  });

  final bool isBookmarked;
  final bool isLoading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 36,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        boxShadow: AppShadows.level1,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          borderRadius: BorderRadius.circular(8),
          onTap: isLoading ? null : onTap,
          child: Center(
            child: isLoading
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.primary600,
                    ),
                  )
                : Icon(
                    isBookmarked
                        ? Icons.bookmark_rounded
                        : Icons.bookmark_border_rounded,
                    size: 20,
                    color: isBookmarked
                        ? AppColors.primary600
                        : AppColors.grey800,
                  ),
          ),
        ),
      ),
    );
  }
}
