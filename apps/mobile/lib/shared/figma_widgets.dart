import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_radius.dart';
import '../core/theme/app_spacing.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/figma_assets.dart';
import '../core/theme/learning_assets.dart';
import '../core/theme/updated_figma_assets.dart';
import 'app_button.dart';
import 'learning_media_image.dart';

part 'figma_widgets_practice.dart';

TextStyle designText(
  double size, {
  FontWeight weight = FontWeight.w400,
  Color color = AppColors.grey900,
  double height = 1.35,
}) => TextStyle(
  fontFamily: AppTextStyles.fontFamily,
  fontFamilyFallback: AppTextStyles.fontFallback,
  fontSize: size,
  fontWeight: weight,
  color: color,
  height: height,
  letterSpacing: -size * .01,
);

TextStyle designHeading(
  double size, {
  Color color = AppColors.grey900,
  double height = 1.2,
}) => designText(
  size,
  weight: FontWeight.w600,
  color: color,
  height: height,
).copyWith(letterSpacing: -size * .02);

class FigmaAsset extends StatelessWidget {
  const FigmaAsset(
    this.asset, {
    super.key,
    this.size = 24,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
    this.cacheWidth,
    this.colorFilter,
  });
  final String asset;
  final double size;
  final double? width, height;
  final BoxFit fit;
  final int? cacheWidth;
  final ColorFilter? colorFilter;

  int? _resolveCacheWidth(BuildContext context) {
    if (cacheWidth != null) return cacheWidth;
    final targetWidth = width ?? size;
    final dpr = (MediaQuery.maybeDevicePixelRatioOf(context) ?? 1.0)
        .clamp(1.0, 3.0);
    if (targetWidth.isFinite && targetWidth > 0) {
      return (targetWidth * dpr).round();
    }
    final viewportWidth = MediaQuery.maybeSizeOf(context)?.width;
    if (viewportWidth != null && viewportWidth.isFinite && viewportWidth > 0) {
      return (viewportWidth * dpr).round();
    }
    return 800;
  }

  @override
  Widget build(BuildContext context) {
    final path =
        UpdatedFigmaAssets.files[asset] ??
        FigmaAssets.files[asset] ??
        LearningAssets.files[asset]!;
    if (path.endsWith('.svg')) {
      return ExcludeSemantics(
        child: SvgPicture.asset(
          path,
          width: width ?? size,
          height: height ?? size,
          fit: fit,
          colorFilter: colorFilter,
        ),
      );
    }
    Widget image = Image.asset(
      path,
      cacheWidth: _resolveCacheWidth(context),
      width: width ?? size,
      height: height ?? size,
      fit: fit,
    );
    if (colorFilter != null) {
      image = ColorFiltered(colorFilter: colorFilter!, child: image);
    }
    return ExcludeSemantics(child: image);
  }
}

/// Figma's 60px status area is adapted around the real Android system inset.
/// Native status and navigation controls remain owned by the platform.
class FigmaPage extends StatelessWidget {
  const FigmaPage({
    super.key,
    required this.child,
    this.title,
    this.leading,
    this.trailing,
    this.bottom,
    this.color = AppColors.grey25,
    this.headerHeight = 52,
    this.leadingWidth = 56,
    this.headerPadding = EdgeInsets.zero,
    this.minimumTopInset = 60,
    this.titleStyle,
  });
  final Widget child;
  final String? title;
  final Widget? leading, trailing, bottom;
  final Color color;
  final double headerHeight;
  final double leadingWidth;
  final EdgeInsetsGeometry headerPadding;
  final double minimumTopInset;
  final TextStyle? titleStyle;
  @override
  Widget build(BuildContext context) => AnnotatedRegion<SystemUiOverlayStyle>(
    value: SystemUiOverlayStyle.dark.copyWith(
      statusBarColor: Colors.transparent,
      systemNavigationBarColor: color,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
    child: Scaffold(
      backgroundColor: color,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            SizedBox(
              height: math.max(
                0,
                minimumTopInset - MediaQuery.paddingOf(context).top,
              ),
            ),
            if (title != null)
              SizedBox(
                height: headerHeight,
                child: Padding(
                  padding: headerPadding,
                  child: Row(
                    children: [
                      SizedBox(
                        width: leadingWidth,
                        child:
                            leading ??
                            (Navigator.of(context).canPop()
                                ? IconButton(
                                    tooltip: 'Quay lại',
                                    onPressed: () =>
                                        Navigator.of(context).pop(),
                                    icon: const FigmaAsset(
                                      'intro/imgVuesaxLinearArrowLeft',
                                    ),
                                  )
                                : null),
                      ),
                      Expanded(
                        child: Text(
                          title!,
                          textAlign: TextAlign.center,
                          style:
                              titleStyle ??
                              designText(18, weight: FontWeight.w600),
                        ),
                      ),
                      SizedBox(width: 56, child: trailing),
                    ],
                  ),
                ),
              ),
            Expanded(child: child),
            if (bottom != null)
              Padding(
                padding: EdgeInsets.fromLTRB(
                  12,
                  16,
                  12,
                  math.max(32, MediaQuery.paddingOf(context).bottom + 8),
                ),
                child: bottom!,
              ),
            if (bottom == null)
              SizedBox(
                height: math.max(24, MediaQuery.paddingOf(context).bottom),
              ),
          ],
        ),
      ),
    ),
  );
}

class FigmaCard extends StatelessWidget {
  const FigmaCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: padding,
    decoration: BoxDecoration(
      color: AppColors.grey5,
      border: Border.all(color: AppColors.grey100),
      borderRadius: AppRadius.cardRadius,
    ),
    child: child,
  );
}

/// Normalizes `(word, meaning)` to match backend deduplication for saved reading words.
String readingWordSaveKey(String word, String meaning) =>
    '${word.trim().toLowerCase()}||${meaning.trim().toLowerCase()}';

class PassageCard extends StatelessWidget {
  const PassageCard({
    super.key,
    required this.passage,
    this.highlightText,
    this.onExpandedChanged,
    this.onInteraction,
    this.practice = false,
    this.evidencePreview = false,
  });
  final String passage;
  final String? highlightText;
  final ValueChanged<bool>? onExpandedChanged;
  final VoidCallback? onInteraction;
  final bool practice, evidencePreview;

  int get _evidenceStart {
    final needle = highlightText?.trim();
    if (needle == null || needle.isEmpty) return -1;
    return passage.toLowerCase().indexOf(needle.toLowerCase());
  }

  Color get _highlightColor =>
      evidencePreview ? AppColors.primary100 : const Color(0xFFFFF3C4);

  Widget _buildPassageText(
    TextStyle baseStyle, {
    int? maxLines,
    TextOverflow? overflow,
  }) {
    final matchStart = _evidenceStart;
    if (matchStart < 0) {
      return Text(
        passage,
        maxLines: maxLines,
        overflow: overflow,
        style: baseStyle,
      );
    }
    final matchEnd = (matchStart + highlightText!.trim().length).clamp(
      matchStart,
      passage.length,
    );
    return Text.rich(
      TextSpan(
        style: baseStyle,
        children: [
          if (matchStart > 0) TextSpan(text: passage.substring(0, matchStart)),
          TextSpan(
            text: passage.substring(matchStart, matchEnd),
            style: baseStyle.copyWith(
              backgroundColor: _highlightColor,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (matchEnd < passage.length)
            TextSpan(text: passage.substring(matchEnd)),
        ],
      ),
      maxLines: maxLines,
      overflow: overflow,
    );
  }

  Widget _buildPreview() {
    final style = designText(14, color: AppColors.grey800, height: 1.45);
    final start = evidencePreview ? _evidenceStart : -1;
    if (start < 0) {
      return _buildPassageText(
        style,
        maxLines: 3,
        overflow: TextOverflow.ellipsis,
      );
    }
    final end = (start + highlightText!.trim().length).clamp(
      start,
      passage.length,
    );
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.primary25,
        borderRadius: AppRadius.cardSm,
        border: Border.all(color: AppColors.primary100),
      ),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              width: 3,
              decoration: BoxDecoration(
                color: AppColors.primary500,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                passage.substring(start, end),
                style: designText(
                  14,
                  weight: FontWeight.w500,
                  color: AppColors.grey900,
                  height: 1.45,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _readingSheet(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text('Đoạn văn', style: designHeading(20))),
              IconButton(
                tooltip: 'Đóng đoạn văn',
                icon: const Icon(Icons.close),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          Expanded(
            child: Scrollbar(
              child: SingleChildScrollView(
                primary: true,
                padding: const EdgeInsets.fromLTRB(0, 6, 8, 16),
                child: _buildPassageText(designText(16, height: 1.6)),
              ),
            ),
          ),
          CustomAppButton(
            text: 'Quay lại câu hỏi',
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
    );
  }

  Future<void> _expand(BuildContext context) async {
    onExpandedChanged?.call(true);
    final moveWatch = Stopwatch();
    void handleThrottledInteraction() {
      if (!moveWatch.isRunning || moveWatch.elapsedMilliseconds >= 500) {
        moveWatch
          ..reset()
          ..start();
        onInteraction?.call();
      }
    }

    try {
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (sheetContext) => SafeArea(
          child: FractionallySizedBox(
            heightFactor: practice ? .82 : .75,
            child: Listener(
              onPointerDown: (_) {
                moveWatch
                  ..reset()
                  ..start();
                onInteraction?.call();
              },
              onPointerMove: (_) => handleThrottledInteraction(),
              onPointerSignal: (_) => handleThrottledInteraction(),
              child: practice
                  ? _readingSheet(sheetContext)
                  : SingleChildScrollView(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Đoạn văn', style: designHeading(20)),
                          const SizedBox(height: 24),
                          _buildPassageText(designText(16, height: 1.6)),
                        ],
                      ),
                    ),
            ),
          ),
        ),
      );
    } finally {
      onExpandedChanged?.call(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final wordsCount = passage.trim().isEmpty
        ? 0
        : passage.trim().split(RegExp(r'\s+')).length;
    return FigmaCard(
      padding: EdgeInsets.all(practice ? 16 : AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Đoạn văn',
                  style: practice
                      ? designHeading(18, height: 1.2)
                      : designText(18, weight: FontWeight.w500),
                ),
              ),
              const SizedBox(width: 8),
              if (practice)
                PracticeCountBadge('$wordsCount từ', accent: false)
              else
                Text(
                  '$wordsCount từ',
                  style: designText(12, color: AppColors.grey600),
                ),
            ],
          ),
          SizedBox(height: practice ? 12 : 24),
          _buildPreview(),
          if (evidencePreview && _evidenceStart >= 0) ...[
            const SizedBox(height: 8),
            Text(
              'Dẫn chứng trong bài',
              style: designText(
                12,
                weight: FontWeight.w500,
                color: AppColors.primary700,
              ),
            ),
          ],
          if (practice) ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => _expand(context),
                style: TextButton.styleFrom(
                  foregroundColor: AppColors.primary800,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 4,
                    vertical: 6,
                  ),
                  minimumSize: const Size(0, 36),
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                ),
                icon: const FigmaAsset(
                  'reading/imgVuesaxLinearMaximize4',
                  size: 16,
                ),
                label: const Text('Xem toàn bộ'),
              ),
            ),
          ] else ...[
            const SizedBox(height: 16),
            InkWell(
              onTap: () => _expand(context),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const FigmaAsset(
                    'reading/imgVuesaxLinearMaximize4',
                    size: 16,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Xem toàn bộ',
                    style: designText(
                      14,
                      weight: FontWeight.w500,
                      color: AppColors.primary500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Unified section card header with a circular tinted icon badge and optional trailing widget.
class PracticeSectionHeader extends StatelessWidget {
  const PracticeSectionHeader({
    super.key,
    required this.icon,
    required this.title,
    this.trailing,
  });

  final String icon;
  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: const BoxDecoration(
          color: AppColors.primary25,
          shape: BoxShape.circle,
        ),
        child: FigmaAsset(icon, size: 20),
      ),
      const SizedBox(width: 12),
      Expanded(child: Text(title, style: designHeading(18, height: 1.2))),
      if (trailing != null) ...[const SizedBox(width: 8), trailing!],
    ],
  );
}

/// Compact pill badge displaying an item or word count inside practice cards.
class PracticeCountBadge extends StatelessWidget {
  const PracticeCountBadge(this.label, {super.key, this.accent = true});

  final String label;
  final bool accent;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: accent ? AppColors.primary25 : AppColors.grey25,
      borderRadius: AppRadius.pill,
      border: accent ? null : Border.all(color: AppColors.grey100),
    ),
    child: Text(
      label,
      style: designText(
        12,
        weight: FontWeight.w600,
        color: accent ? AppColors.primary700 : AppColors.grey700,
      ),
    ),
  );
}

/// Reusable vocabulary card displaying an English word/phrase, optional IPA
/// phonetic pill, Vietnamese meaning, accented example quote, and optional action.
class PracticeVocabularyCard extends StatelessWidget {
  const PracticeVocabularyCard({
    super.key,
    required this.word,
    required this.meaning,
    this.phonetic = '',
    this.example = '',
    this.imageUrl,
    this.compact = false,
    this.highlighted = false,
    this.trailing,
  });

  final String word;
  final String meaning;
  final String phonetic;
  final String example;
  final String? imageUrl;
  final bool compact;
  final bool highlighted;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final trimmedWord = word.trim();
    final trimmedPhonetic = phonetic.trim();
    final trimmedMeaning = meaning.trim();
    final trimmedExample = example.trim();
    final trimmedImage = imageUrl?.trim() ?? '';
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: 12,
        vertical: compact ? 10 : 12,
      ),
      decoration: BoxDecoration(
        color: AppColors.grey25,
        borderRadius: AppRadius.cardSm,
        border: Border.all(
          color: highlighted ? AppColors.primary200 : AppColors.grey100,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (trimmedImage.isNotEmpty) ...[
                LearningMediaImage(
                  imageUrl: trimmedImage,
                  width: 48,
                  height: 48,
                  borderRadius: BorderRadius.circular(10),
                  semanticLabel: trimmedWord,
                ),
                const SizedBox(width: 12),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Text(
                          trimmedWord,
                          style: designText(
                            compact ? 15 : 16,
                            weight: FontWeight.w700,
                            color: AppColors.grey900,
                            height: 1.25,
                          ),
                        ),
                        if (trimmedPhonetic.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.grey0,
                              borderRadius: AppRadius.pill,
                              border: Border.all(color: AppColors.grey100),
                            ),
                            child: Text(
                              trimmedPhonetic,
                              style: designText(
                                12,
                                color: AppColors.grey700,
                                height: 1.2,
                              ),
                            ),
                          ),
                      ],
                    ),
                    if (trimmedMeaning.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        trimmedMeaning,
                        style: designText(
                          14,
                          weight: FontWeight.w500,
                          color: AppColors.grey800,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) ...[const SizedBox(width: 10), trailing!],
            ],
          ),
          if (trimmedExample.isNotEmpty) ...[
            const SizedBox(height: 8),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    width: 2.5,
                    decoration: BoxDecoration(
                      color: AppColors.primary300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      trimmedExample,
                      style: designText(
                        13,
                        color: AppColors.grey700,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

