import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
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
  const PreviewSurface({
    super.key,
    required this.child,
    this.showSampleLabel = true,
  });
  final Widget child;
  final bool showSampleLabel;

  @override
  Widget build(BuildContext context) => !showSampleLabel
      ? child
      : Stack(
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
              borderRadius: AppRadius.cardRadius,
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
      borderRadius: small ? AppRadius.tagRadius : AppRadius.buttonRadius,
      side: BorderSide(
        color: selected ? AppColors.primary500 : (fill ?? AppColors.grey200),
      ),
    ),
    child: InkWell(
      onTap: onTap,
      borderRadius: small ? AppRadius.tagRadius : AppRadius.buttonRadius,
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
  const PreviewLevelBadge({super.key, this.onTap, this.label = 'A1'});
  final VoidCallback? onTap;
  final String label;
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: const BorderRadius.all(Radius.circular(AppRadius.xs)),
    child: Container(
      height: 40,
      width: 40,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.primary25,
        border: Border.all(color: AppColors.primary200),
        borderRadius: const BorderRadius.all(Radius.circular(AppRadius.xs)),
      ),
      child: Text(
        label,
        maxLines: 1,
        softWrap: false,
        style: designText(14, color: AppColors.primary500),
      ),
    ),
  );
}

Widget learningHeading(String value, {double size = 20}) =>
    Text(value, style: designHeading(size, height: size >= 28 ? 1 : 1.2));
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
          borderRadius: AppRadius.tagRadius,
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
          borderRadius: AppRadius.tagRadius,
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
          borderRadius: AppRadius.tagRadius,
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
          borderRadius: AppRadius.pill,
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

DateTime vietnamNow([DateTime? now]) =>
    (now ?? DateTime.now()).toUtc().add(const Duration(hours: 7));

const String learningHomeRouteName = 'learning-home';

class DashboardCard extends StatelessWidget {
  const DashboardCard({
    super.key,
    required this.child,
    this.padding = EdgeInsets.zero,
    this.radius,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final BorderRadiusGeometry? radius;
  @override
  Widget build(BuildContext context) => Container(
    clipBehavior: Clip.antiAlias,
    padding: padding,
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: radius ?? AppRadius.dialogRadius,
      border: Border.all(color: AppColors.grey100),
      boxShadow: AppShadows.level1,
    ),
    child: child,
  );
}

class LearningGradientBackdrop extends StatelessWidget {
  const LearningGradientBackdrop({
    super.key,
    required this.scroll,
    this.scrollKey,
  });
  final ScrollController scroll;
  final Key? scrollKey;

  @override
  Widget build(BuildContext context) => Positioned(
    left: 0,
    right: 0,
    top: 0,
    height: 532,
    child: AnimatedBuilder(
      animation: scroll,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment(-.3, -1),
                end: Alignment(.3, 1),
                colors: [
                  Color(0xFF1F452A),
                  Color(0xFF53AC69),
                  AppColors.grey25,
                ],
                stops: [.14353, .45387, .70454],
              ),
            ),
          ),
          Image.asset(
            'assets/figma/home_v2_glow_3x.png',
            fit: BoxFit.fill,
          ),
        ],
      ),
      builder: (context, child) => Transform.translate(
        key: scrollKey,
        offset: Offset(0, scroll.hasClients ? -scroll.offset : 0),
        child: child,
      ),
    ),
  );
}

class LevelCupBadge extends StatelessWidget {
  const LevelCupBadge({super.key, required this.label, this.onTap});
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: AppRadius.pill,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.primary25,
        borderRadius: AppRadius.pill,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const FigmaAsset('home-v3/cup', size: 22),
          const SizedBox(width: 4),
          Text(
            label,
            style: designText(
              18,
              weight: FontWeight.w600,
              color: AppColors.primary600,
            ),
          ),
        ],
      ),
    ),
  );
}
