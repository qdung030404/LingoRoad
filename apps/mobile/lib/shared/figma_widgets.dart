import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../core/theme/app_colors.dart';
import '../core/theme/figma_assets.dart';
import '../core/theme/learning_assets.dart';

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
    final path = FigmaAssets.files[asset] ?? LearningAssets.files[asset]!;
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
  });
  final Widget child;
  final String? title;
  final Widget? leading, trailing, bottom;
  final Color color;
  final double headerHeight;
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
                        style: designText(18, weight: FontWeight.w600),
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
    this.padding = const EdgeInsets.all(24),
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
      borderRadius: BorderRadius.circular(16),
    ),
    child: child,
  );
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
          borderRadius: BorderRadius.circular(99),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(99),
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
                  const SizedBox(width: 8),
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
                          const SizedBox(width: 8),
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
            borderRadius: BorderRadius.circular(99),
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
