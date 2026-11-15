import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/app_radius.dart';
import '../core/theme/app_spacing.dart';
import '../core/theme/figma_assets.dart';
import '../core/theme/learning_assets.dart';
import '../core/theme/updated_figma_assets.dart';

TextStyle designText(
  double size, {
  FontWeight weight = FontWeight.w400,
  Color color = AppColors.grey900,
  double height = 1.2,
}) => TextStyle(
  fontFamily: 'Inter',
  fontSize: size,
  fontWeight: weight,
  color: color,
  height: height,
  letterSpacing: -size * .03,
  fontVariations: [ui.FontVariation('wght', weight.value.toDouble())],
);

/// Medium headings in the current LingoRoad2 design use Be Vietnam Pro.
/// Body text and controls keep Inter, including Inter's semibold variants.
TextStyle designHeading(
  double size, {
  Color color = AppColors.grey900,
  double height = 1.2,
}) => TextStyle(
  fontFamily: 'Be Vietnam Pro',
  fontSize: size,
  fontWeight: FontWeight.w500,
  color: color,
  height: height,
  letterSpacing: -size * .03,
);

class FigmaAsset extends StatelessWidget {
  const FigmaAsset(
    this.asset, {
    super.key,
    this.size = 24,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
    this.cacheWidth,
  });
  final String asset;
  final double size;
  final double? width, height;
  final BoxFit fit;
  final int? cacheWidth;
  @override
  Widget build(BuildContext context) {
    final path =
        UpdatedFigmaAssets.files[asset] ??
        FigmaAssets.files[asset] ??
        LearningAssets.files[asset]!;
    return ExcludeSemantics(
      child: path.endsWith('.svg')
          ? SvgPicture.asset(
              path,
              width: width ?? size,
              height: height ?? size,
              fit: fit,
            )
          : Image.asset(
              path,
              cacheWidth: cacheWidth,
              width: width ?? size,
              height: height ?? size,
              fit: fit,
            ),
    );
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
    this.titleStyle,
  });
  final Widget child;
  final String? title;
  final Widget? leading, trailing, bottom;
  final Color color;
  final double headerHeight;
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
              height: math.max(0, 60 - MediaQuery.paddingOf(context).top),
            ),
            if (title != null)
              SizedBox(
                height: headerHeight,
                child: Row(
                  children: [
                    SizedBox(
                      width: 56,
                      child:
                          leading ??
                          (Navigator.of(context).canPop()
                              ? IconButton(
                                  tooltip: 'Quay lại',
                                  onPressed: () => Navigator.of(context).pop(),
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
    this.keyVocabulary = const [],
    this.savedWordKeysListenable,
    this.savingWordKeysListenable,
    this.onSaveWord,
    this.onExpandedChanged,
    this.onInteraction,
  });
  final String passage;
  final String? highlightText;
  final List<Map<String, dynamic>> keyVocabulary;
  final ValueListenable<Set<String>>? savedWordKeysListenable;
  final ValueListenable<Set<String>>? savingWordKeysListenable;
  final Future<void> Function(Map<String, dynamic> word)? onSaveWord;
  final ValueChanged<bool>? onExpandedChanged;
  final VoidCallback? onInteraction;

  Widget _buildPassageText(
    TextStyle baseStyle, {
    int? maxLines,
    TextOverflow? overflow,
  }) {
    final needle = highlightText?.trim();
    if (needle == null || needle.isEmpty) {
      return Text(
        passage,
        maxLines: maxLines,
        overflow: overflow,
        style: baseStyle,
      );
    }
    final matchStart = passage.toLowerCase().indexOf(needle.toLowerCase());
    if (matchStart < 0) {
      return Text(
        passage,
        maxLines: maxLines,
        overflow: overflow,
        style: baseStyle,
      );
    }
    final matchEnd = (matchStart + needle.length).clamp(
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
              backgroundColor: const Color(0xFFFFF3C4),
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

  Future<void> _expand(BuildContext context) async {
    onExpandedChanged?.call(true);
    try {
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => SafeArea(
          child: FractionallySizedBox(
            heightFactor: .75,
            child: Listener(
              onPointerDown: (_) => onInteraction?.call(),
              onPointerMove: (_) => onInteraction?.call(),
              onPointerSignal: (_) => onInteraction?.call(),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Đoạn văn', style: designHeading(20)),
                    const SizedBox(height: 24),
                    _buildPassageText(designText(16, height: 1.6)),
                    if (keyVocabulary.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      const Divider(color: AppColors.grey200, height: 1),
                      const SizedBox(height: 20),
                      Text('Từ vựng trọng tâm', style: designHeading(18)),
                      const SizedBox(height: 12),
                      _KeyVocabularySection(
                        items: keyVocabulary,
                        savedWordKeysListenable: savedWordKeysListenable,
                        savingWordKeysListenable: savingWordKeysListenable,
                        onSaveWord: onSaveWord,
                      ),
                    ],
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
  Widget build(BuildContext context) => FigmaCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Đoạn văn', style: designText(18, weight: FontWeight.w500)),
            Text(
              '${passage.trim().split(RegExp(r'\s+')).length} từ',
              style: designText(12, color: AppColors.grey600),
            ),
          ],
        ),
        const SizedBox(height: 24),
        _buildPassageText(
          designText(14, color: AppColors.grey800, height: 1.4),
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 16),
        InkWell(
          onTap: () => _expand(context),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const FigmaAsset('reading/imgVuesaxLinearMaximize4', size: 16),
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
    ),
  );
}

class _KeyVocabularySection extends StatelessWidget {
  const _KeyVocabularySection({
    required this.items,
    required this.savedWordKeysListenable,
    required this.savingWordKeysListenable,
    required this.onSaveWord,
  });

  final List<Map<String, dynamic>> items;
  final ValueListenable<Set<String>>? savedWordKeysListenable;
  final ValueListenable<Set<String>>? savingWordKeysListenable;
  final Future<void> Function(Map<String, dynamic> word)? onSaveWord;

  @override
  Widget build(BuildContext context) {
    final listenables = <Listenable>[
      ?savedWordKeysListenable,
      ?savingWordKeysListenable,
    ];
    if (listenables.isEmpty) return _buildList(context);
    return ListenableBuilder(
      listenable: Listenable.merge(listenables),
      builder: (context, _) => _buildList(context),
    );
  }

  Widget _buildList(BuildContext context) {
    final savedKeys = savedWordKeysListenable?.value ?? const <String>{};
    final savingKeys = savingWordKeysListenable?.value ?? const <String>{};
    return Column(
      children: [
        for (var i = 0; i < items.length; i++) ...[
          if (i > 0) const SizedBox(height: 12),
          _buildWordTile(context, items[i], savedKeys, savingKeys),
        ],
      ],
    );
  }

  Widget _buildWordTile(
    BuildContext context,
    Map<String, dynamic> item,
    Set<String> savedKeys,
    Set<String> savingKeys,
  ) {
    final id = item['id']?.toString() ?? '';
    final word = (item['word'] as String? ?? '').trim();
    final phonetic = (item['phonetic'] as String? ?? '').trim();
    final meaning = (item['meaning'] as String? ?? '').trim();
    final example = (item['example'] as String? ?? '').trim();
    final saveKey = readingWordSaveKey(word, meaning);
    final saved = savedKeys.contains(saveKey);
    final saving = savingKeys.contains(saveKey);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.grey50,
        borderRadius: AppRadius.card,
        border: Border.all(color: AppColors.grey200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      word,
                      style: designText(15, weight: FontWeight.w600),
                    ),
                    if (phonetic.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        phonetic,
                        style: designText(12, color: AppColors.grey500),
                      ),
                    ],
                  ],
                ),
              ),
              if (onSaveWord != null) ...[
                const SizedBox(width: 12),
                saved
                    ? OutlinedButton.icon(
                        key: ValueKey('reading-save-word-${id.isNotEmpty ? id : word}'),
                        onPressed: null,
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFF0A5D21),
                          disabledForegroundColor: const Color(0xFF0A5D21),
                          side: const BorderSide(color: Color(0xFFB7E4C7)),
                          backgroundColor: const Color(0xFFEAF7EE),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          minimumSize: const Size(0, 34),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        icon: const Icon(Icons.check_rounded, size: 16),
                        label: Text(
                          'Đã lưu',
                          style: designText(
                            13,
                            weight: FontWeight.w600,
                            color: const Color(0xFF0A5D21),
                          ),
                        ),
                      )
                    : FilledButton(
                        key: ValueKey('reading-save-word-${id.isNotEmpty ? id : word}'),
                        onPressed: saving ? null : () => onSaveWord!(item),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.primary500,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 6,
                          ),
                          minimumSize: const Size(0, 34),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                        child: Text(
                          saving ? 'Đang lưu...' : 'Lưu',
                          style: designText(
                            13,
                            weight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ),
              ],
            ],
          ),
          if (meaning.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              meaning,
              style: designText(14, color: AppColors.grey800, height: 1.4),
            ),
          ],
          if (example.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              example,
              style: designText(13, color: AppColors.grey600, height: 1.4),
            ),
          ],
        ],
      ),
    );
  }
}

class AnswerOption extends StatelessWidget {
  const AnswerOption({
    super.key,
    required this.index,
    required this.text,
    this.selected = false,
    this.onTap,
    this.correct,
    this.chosen = false,
  });
  final int index;
  final String text;
  final bool selected, chosen;
  final bool? correct;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final tone = correct == true
        ? const Color(0xFF0A5D21)
        : correct == false && chosen
        ? const Color(0xFFCA8A04)
        : selected
        ? AppColors.primary500
        : AppColors.grey900;
    final border = correct == true
        ? const Color(0xFF049228)
        : correct == false && chosen
        ? const Color(0xFFFFCC01)
        : selected
        ? AppColors.primary500
        : AppColors.grey100;
    final fill = correct == true
        ? AppColors.primary25
        : correct == false && chosen
        ? const Color(0xFFFFF7EA)
        : selected
        ? Colors.white
        : AppColors.grey5;
    return Semantics(
      button: onTap != null,
      selected: selected,
      child: Material(
        color: fill,
        shape: RoundedRectangleBorder(
          side: BorderSide(color: border),
          borderRadius: AppRadius.buttonRadius,
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.buttonRadius,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 72),
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                12,
                12,
                correct == null ? 12 : 24,
                12,
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: correct == false && chosen
                          ? const Color(0xFFF4DFB2)
                          : correct == true
                          ? AppColors.primary100
                          : selected
                          ? AppColors.primary25
                          : AppColors.grey25,
                      border: Border.all(
                        color: correct == false && chosen
                            ? const Color(0xFFFFCC01)
                            : correct == true
                            ? const Color(0xFF049228)
                            : selected
                            ? AppColors.primary100
                            : AppColors.grey100,
                      ),
                    ),
                    child: Text(
                      String.fromCharCode(65 + index),
                      style: designText(
                        20,
                        weight: FontWeight.w600,
                        color: tone,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      text,
                      style: designText(
                        16,
                        weight: FontWeight.w500,
                        color: tone,
                        height: 1.35,
                      ),
                    ),
                  ),
                  if (selected && correct == null)
                    const Padding(
                      padding: EdgeInsets.only(left: 8),
                      child: FigmaAsset('reading/imgCheck'),
                    ),
                  if (correct != null && (chosen || correct == true))
                    Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          FigmaAsset(
                            correct == true
                                ? 'review/imgVuesaxLinearTickCircle'
                                : 'review/imgVuesaxLinearInfoCircle',
                            size: 20,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Text(
                            correct == true ? 'Đáp án' : 'Bạn chọn',
                            style: designText(16, color: tone),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class SectionProgress extends StatelessWidget {
  const SectionProgress({super.key, required this.index});
  final int index;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      for (var part = 0; part < 2; part++) ...[
        if (part != 0) const SizedBox(width: 12),
        Expanded(
          child: ClipRRect(
            borderRadius: AppRadius.pill,
            child: LinearProgressIndicator(
              minHeight: 4,
              value: ((index - part * 5) / 5).clamp(0, 1),
              color: AppColors.primary500,
              backgroundColor: AppColors.grey200,
              semanticsLabel: part == 0
                  ? 'Tiến độ phần Đọc'
                  : 'Tiến độ phần Nghe',
            ),
          ),
        ),
      ],
    ],
  );
}
