import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';

void previewMessage(BuildContext context, String text) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));
}

Future<T?> previewPush<T>(BuildContext context, Widget page) =>
    Navigator.of(context).push<T>(MaterialPageRoute(builder: (_) => page));

class PreviewSurface extends StatelessWidget {
  const PreviewSurface({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Stack(
    children: [
      child,
      Positioned(
        top: MediaQuery.paddingOf(context).top + 5,
        right: 16,
        child: IgnorePointer(
          child: Material(
            color: Colors.transparent,
            child: Text(
              'Dữ liệu mẫu',
              style: designText(10, color: AppColors.grey800),
            ),
          ),
        ),
      ),
    ],
  );
}

class LearningCard extends StatelessWidget {
  const LearningCard({
    super.key,
    required this.children,
    this.gap = 16,
    this.onTap,
  });
  final List<Widget> children;
  final double gap;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final card = FigmaCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) SizedBox(height: gap),
            children[i],
          ],
        ],
      ),
    );
    return onTap == null
        ? card
        : Semantics(
            button: true,
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(16),
              child: card,
            ),
          );
  }
}

class LearningPill extends StatelessWidget {
  const LearningPill(
    this.text, {
    super.key,
    this.selected = false,
    this.onTap,
    this.icon,
    this.color,
    this.fill,
    this.small = false,
  });
  final String text;
  final bool selected, small;
  final VoidCallback? onTap;
  final Widget? icon;
  final Color? color, fill;
  @override
  Widget build(BuildContext context) => Material(
    color: fill ?? (selected ? AppColors.primary25 : Colors.white),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(small ? 8 : 99),
      side: BorderSide(
        color: selected ? AppColors.primary500 : (fill ?? AppColors.grey200),
      ),
    ),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(small ? 8 : 99),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: small ? 12 : 20,
          vertical: small ? 9 : 11,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[icon!, const SizedBox(width: 8)],
            Text(
              text,
              style: designText(
                14,
                weight: FontWeight.w500,
                color:
                    color ??
                    (selected ? AppColors.primary500 : AppColors.grey900),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class PreviewLevelBadge extends StatelessWidget {
  const PreviewLevelBadge({super.key, this.onTap});
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: BorderRadius.circular(4),
    child: Container(
      height: 40,
      width: 40,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.primary25,
        border: Border.all(color: AppColors.primary200),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        'A1',
        maxLines: 1,
        softWrap: false,
        style: designText(14, color: AppColors.primary500),
      ),
    ),
  );
}

Widget learningHeading(String value, {double size = 20}) => Text(
  value,
  style: designText(
    size,
    weight: FontWeight.w600,
    height: size >= 28 ? 1 : 1.2,
  ),
);
Widget learningBody(String value, {double size = 16}) =>
    Text(value, style: designText(size, color: AppColors.grey800));

class PreviewToolbar extends StatelessWidget {
  const PreviewToolbar({
    super.key,
    required this.index,
    required this.total,
    this.onBack,
    required this.onNext,
    this.onGrid,
    this.nextLabel = 'Tiếp theo',
  });
  final int index, total;
  final VoidCallback? onBack, onNext, onGrid;
  final String nextLabel;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      SizedBox(
        width: 48,
        child: CustomAppButton(
          text: '',
          isSecondary: true,
          onPressed: onBack,
          borderRadius: BorderRadius.circular(8),
          icon: const FigmaAsset(
            'vocabulary-word/imgVuesaxLinearArrowLeft1',
            size: 20,
          ),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: CustomAppButton(
          text: '${index + 1}/$total',
          isSecondary: true,
          onPressed:
              onGrid ??
              () => previewMessage(context, 'Câu ${index + 1} trên $total'),
          borderRadius: BorderRadius.circular(8),
          icon: const FigmaAsset(
            'vocabulary-word/imgVuesaxBoldCategory',
            size: 20,
          ),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: CustomAppButton(
          key: const Key('previewNext'),
          text: nextLabel,
          onPressed: onNext,
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    ],
  );
}

class PreviewProgress extends StatelessWidget {
  const PreviewProgress({
    super.key,
    required this.index,
    required this.total,
    required this.label,
    this.sections = false,
  });
  final int index, total;
  final String label;
  final bool sections;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (sections)
        Row(
          children: [
            Expanded(
              child: LinearProgressIndicator(
                value: index / total,
                minHeight: 4,
                color: AppColors.primary500,
                backgroundColor: AppColors.grey200,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: Container(height: 4, color: AppColors.grey200)),
          ],
        )
      else
        ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            value: (index + 1) / total,
            minHeight: 4,
            backgroundColor: AppColors.grey200,
            color: AppColors.primary500,
          ),
        ),
      const SizedBox(height: 12),
      Text(
        label,
        style: designText(
          16,
          weight: FontWeight.w500,
          color: AppColors.grey800,
          height: 1.5,
        ),
      ),
      const SizedBox(height: 12),
    ],
  );
}
