part of 'learning_goals_edit_page.dart';

class _NotchedStepSlider<T> extends StatelessWidget {
  const _NotchedStepSlider({
    required this.sliderKey,
    required this.stops,
    required this.value,
    required this.enabled,
    required this.itemKeyBuilder,
    required this.labelBuilder,
    required this.semanticLabelBuilder,
    required this.onChanged,
  });

  final Key sliderKey;
  final List<T> stops;
  final T value;
  final bool enabled;
  final Key Function(T stop) itemKeyBuilder;
  final String Function(T stop) labelBuilder;
  final String Function(T stop) semanticLabelBuilder;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final count = stops.length;
    if (count == 0) return const SizedBox.shrink();
    final rawIdx = stops.indexOf(value);
    final selectedIndex = rawIdx >= 0 ? rawIdx : 0;
    final maxVal = math.max(1, count - 1).toDouble();

    return Container(
      padding: const EdgeInsets.fromLTRB(8, 12, 8, 8),
      decoration: BoxDecoration(
        color: AppColors.grey5,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: ProfilePalette.line),
      ),
      child: LayoutBuilder(
        builder: (context, box) {
          final horizontalInset = box.maxWidth / (2 * count);
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(
                height: 40,
                child: SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    trackHeight: 7.5,
                    trackShape: _NotchedRulerTrackShape(
                      stopCount: count,
                      selectedIndex: selectedIndex,
                      horizontalInset: horizontalInset,
                    ),
                    thumbShape: const _NotchedRulerThumbShape(),
                    overlayShape: const RoundSliderOverlayShape(
                      overlayRadius: 18,
                    ),
                    tickMarkShape: SliderTickMarkShape.noTickMark,
                    overlayColor: AppColors.primary.withValues(alpha: 0.14),
                  ),
                  child: Slider(
                    key: sliderKey,
                    min: 0,
                    max: maxVal,
                    divisions: count > 1 ? count - 1 : null,
                    value: selectedIndex.toDouble().clamp(0, maxVal),
                    semanticFormatterCallback: (raw) {
                      final idx = raw.round().clamp(0, count - 1);
                      return semanticLabelBuilder(stops[idx]);
                    },
                    onChanged: !enabled || count <= 1
                        ? null
                        : (raw) {
                            final nextIdx = raw.round().clamp(0, count - 1);
                            if (nextIdx != selectedIndex) {
                              HapticFeedback.selectionClick();
                              onChanged(stops[nextIdx]);
                            }
                          },
                  ),
                ),
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  for (var i = 0; i < count; i++)
                    Expanded(
                      child: _NotchStopButton(
                        key: itemKeyBuilder(stops[i]),
                        label: labelBuilder(stops[i]),
                        semanticLabel: semanticLabelBuilder(stops[i]),
                        selected: i == selectedIndex,
                        passed: i < selectedIndex,
                        onTap: !enabled
                            ? null
                            : () {
                                if (i != selectedIndex) {
                                  HapticFeedback.selectionClick();
                                }
                                onChanged(stops[i]);
                              },
                      ),
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class _NotchStopButton extends StatelessWidget {
  const _NotchStopButton({
    super.key,
    required this.label,
    required this.semanticLabel,
    required this.selected,
    required this.passed,
    required this.onTap,
  });

  final String label;
  final String semanticLabel;
  final bool selected;
  final bool passed;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    label: semanticLabel,
    child: Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 38),
          child: Center(
            child: AnimatedContainer(
              duration: MediaQuery.disableAnimationsOf(context)
                  ? Duration.zero
                  : const Duration(milliseconds: 150),
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
              decoration: BoxDecoration(
                color: selected ? AppColors.primary50 : Colors.transparent,
                borderRadius: BorderRadius.circular(8),
                border: selected
                    ? Border.all(color: AppColors.primary200)
                    : null,
              ),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(
                  label,
                  maxLines: 1,
                  style:
                      designText(
                        13,
                        weight: selected
                            ? FontWeight.w800
                            : passed
                            ? FontWeight.w700
                            : FontWeight.w600,
                        color: selected
                            ? ProfilePalette.accent
                            : passed
                            ? AppColors.grey800
                            : AppColors.grey600,
                        height: 1.15,
                      ).copyWith(
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class _NotchedRulerTrackShape extends SliderTrackShape {
  const _NotchedRulerTrackShape({
    required this.stopCount,
    required this.selectedIndex,
    required this.horizontalInset,
  });

  final int stopCount;
  final int selectedIndex;
  final double horizontalInset;

  @override
  Rect getPreferredRect({
    required RenderBox parentBox,
    Offset offset = Offset.zero,
    required SliderThemeData sliderTheme,
    bool isEnabled = false,
    bool isDiscrete = false,
  }) {
    final trackHeight = sliderTheme.trackHeight ?? 6;
    final inset = horizontalInset.clamp(
      12.0,
      math.max(12.0, parentBox.size.width / 2),
    );
    final trackLeft = offset.dx + inset;
    final trackTop = offset.dy + (parentBox.size.height - trackHeight) / 2;
    final trackWidth = math.max(0.0, parentBox.size.width - inset * 2);
    return Rect.fromLTWH(trackLeft, trackTop, trackWidth, trackHeight);
  }

  @override
  void paint(
    PaintingContext context,
    Offset offset, {
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required Animation<double> enableAnimation,
    required Offset thumbCenter,
    Offset? secondaryOffset,
    bool isEnabled = false,
    bool isDiscrete = false,
    required TextDirection textDirection,
  }) {
    final trackRect = getPreferredRect(
      parentBox: parentBox,
      offset: offset,
      sliderTheme: sliderTheme,
      isEnabled: isEnabled,
      isDiscrete: isDiscrete,
    );
    if (trackRect.width <= 0) return;

    final canvas = context.canvas;
    final radius = Radius.circular(trackRect.height / 2);

    // Base inactive rail
    final inactivePaint = Paint()
      ..color = AppColors.grey200
      ..style = PaintingStyle.fill;
    canvas.drawRRect(RRect.fromRectAndRadius(trackRect, radius), inactivePaint);

    // Active emerald gradient rail
    final activeRight = thumbCenter.dx.clamp(trackRect.left, trackRect.right);
    if (activeRight > trackRect.left) {
      final activeRect = Rect.fromLTRB(
        trackRect.left,
        trackRect.top,
        activeRight,
        trackRect.bottom,
      );
      final activePaint = Paint()
        ..shader = const LinearGradient(
          colors: [
            ProfilePalette.routeJourneyStart,
            AppColors.primary,
          ],
        ).createShader(activeRect)
        ..style = PaintingStyle.fill;
      canvas.drawRRect(RRect.fromRectAndRadius(activeRect, radius), activePaint);
    }

    // Ruler notches & nodes at each division
    if (stopCount <= 1) return;
    final step = trackRect.width / (stopCount - 1);
    final cy = trackRect.center.dy;
    final tickTop = trackRect.bottom + 3.5;
    final tickBottom = tickTop + 4.5;

    final passedTickPaint = Paint()
      ..color = AppColors.primary200
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    final futureTickPaint = Paint()
      ..color = AppColors.grey300
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    final passedDotPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    final futureNodeFill = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    final futureNodeBorder = Paint()
      ..color = AppColors.grey300
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    for (var i = 0; i < stopCount; i++) {
      final x = trackRect.left + step * i;
      canvas.drawLine(
        Offset(x, tickTop),
        Offset(x, tickBottom),
        i <= selectedIndex ? passedTickPaint : futureTickPaint,
      );
      if (i == selectedIndex) continue;
      if (i < selectedIndex) {
        canvas.drawCircle(Offset(x, cy), 2.2, passedDotPaint);
      } else {
        canvas.drawCircle(Offset(x, cy), 3.6, futureNodeFill);
        canvas.drawCircle(Offset(x, cy), 3.6, futureNodeBorder);
      }
    }
  }
}

class _NotchedRulerThumbShape extends SliderComponentShape {
  const _NotchedRulerThumbShape();

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) => const Size(24, 24);

  @override
  void paint(
    PaintingContext context,
    Offset center, {
    required Animation<double> activationAnimation,
    required Animation<double> enableAnimation,
    required bool isDiscrete,
    required TextPainter labelPainter,
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required TextDirection textDirection,
    required double value,
    required double textScaleFactor,
    required Size sizeWithOverflow,
  }) {
    final canvas = context.canvas;
    // Soft emerald aura
    canvas.drawCircle(
      center,
      13 + activationAnimation.value * 2,
      Paint()..color = AppColors.primary.withValues(alpha: 0.16),
    );
    // Crisp white outer disc with subtle elevation shadow
    canvas.drawShadow(
      Path()..addOval(Rect.fromCircle(center: center, radius: 10)),
      AppColors.grey900.withValues(alpha: 0.28),
      3,
      false,
    );
    canvas.drawCircle(center, 10, Paint()..color = Colors.white);
    canvas.drawCircle(
      center,
      10,
      Paint()
        ..color = ProfilePalette.routeJourneyStart
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.2,
    );
    // Emerald core dot
    canvas.drawCircle(
      center,
      4.5,
      Paint()..color = AppColors.primary,
    );
  }
}

class _PurposeOptionCard extends StatelessWidget {
  const _PurposeOptionCard({
    super.key,
    required this.glyph,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final ConceptGlyph glyph;
  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    child: Material(
      color: selected ? AppColors.primary25 : AppColors.grey5,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.cardSm,
        side: BorderSide(
          color: selected ? AppColors.primary : ProfilePalette.line,
          width: selected ? 1.5 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.cardSm,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 54),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: selected ? AppColors.primary50 : AppColors.grey50,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  alignment: Alignment.center,
                  child: ConceptSvgIcon(
                    glyph,
                    size: 18,
                    color: selected ? ProfilePalette.accent : AppColors.grey700,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label,
                    softWrap: true,
                    style: designText(
                      15,
                      weight: selected ? FontWeight.w700 : FontWeight.w600,
                      color: selected ? ProfilePalette.accent : ProfilePalette.ink,
                      height: 1.25,
                    ),
                  ),
                ),
                if (selected) ...[
                  const SizedBox(width: 6),
                  Container(
                    width: 8.5,
                    height: 8.5,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class _SkillKindCard extends StatelessWidget {
  const _SkillKindCard({
    super.key,
    required this.kind,
    required this.glyph,
    required this.label,
    required this.rank,
    required this.onTap,
  });
  final String kind;
  final ConceptGlyph glyph;
  final String label;
  final int? rank;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final selected = rank != null;
    final isPrimary = rank == 1;
    return Semantics(
      button: true,
      selected: selected,
      child: Material(
        color: isPrimary
            ? AppColors.primary25
            : selected
            ? const Color(0xFFF8FCFA)
            : AppColors.grey5,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.cardSm,
          side: BorderSide(
            color: isPrimary
                ? AppColors.primary
                : selected
                ? AppColors.primary200
                : ProfilePalette.line,
            width: isPrimary ? 1.6 : (selected ? 1.3 : 1),
          ),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.cardSm,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 54),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: selected ? AppColors.primary50 : AppColors.grey50,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    alignment: Alignment.center,
                    child: ConceptSvgIcon(
                      glyph,
                      size: 18,
                      color: selected ? ProfilePalette.accent : AppColors.grey700,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      label,
                      softWrap: true,
                      style: designText(
                        15,
                        weight: selected ? FontWeight.w700 : FontWeight.w600,
                        color: selected
                            ? ProfilePalette.accent
                            : ProfilePalette.ink,
                        height: 1.25,
                      ),
                    ),
                  ),
                  const SizedBox(width: 6),
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: isPrimary
                          ? AppColors.primary
                          : selected
                          ? AppColors.primary50
                          : Colors.transparent,
                      shape: BoxShape.circle,
                      border: isPrimary
                          ? null
                          : Border.all(
                              color: selected
                                  ? AppColors.primary
                                  : AppColors.grey300,
                              width: 1.5,
                            ),
                    ),
                    alignment: Alignment.center,
                    child: selected
                        ? Text(
                            '$rank',
                            style: designText(
                              13,
                              weight: FontWeight.w800,
                              color: isPrimary
                                  ? Colors.white
                                  : ProfilePalette.accent,
                              height: 1.1,
                            ).copyWith(
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          )
                        : null,
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

class _GoalsErrorBanner extends StatelessWidget {
  const _GoalsErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.error0,
        borderRadius: AppRadius.cardSm,
        border: Border.all(color: AppColors.error25),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info_outline_rounded,
            size: 20,
            color: ProfilePalette.danger,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: designText(14, color: ProfilePalette.danger, height: 1.45),
            ),
          ),
        ],
      ),
    ),
  );
}

class _ConflictResolutionCard extends StatelessWidget {
  const _ConflictResolutionCard({
    required this.conflict,
    required this.onUseServer,
  });
  final _GoalConflictSnapshot conflict;
  final VoidCallback? onUseServer;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      key: const Key('goalsConflictBox'),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: ProfilePalette.permissionBg,
        borderRadius: AppRadius.cardSm,
        border: Border.all(color: ProfilePalette.permissionBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            'Thiết lập vừa thay đổi trên thiết bị khác',
            style: designText(
              14,
              weight: FontWeight.w600,
              color: ProfilePalette.ink,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Lựa chọn đang sửa của bạn (trái) khác với bản mới trên máy chủ (phải):',
            style: designText(14, color: ProfilePalette.muted, height: 1.4),
          ),
          const SizedBox(height: 6),
          for (final diff in conflict.diffs)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                '• ${diff.label}: ${diff.draftValue} ↔ ${diff.serverValue}',
                style: designText(14, color: ProfilePalette.ink, height: 1.4),
              ),
            ),
          const SizedBox(height: 10),
          CustomAppButton(
            key: const Key('goalsUseServerButton'),
            text: 'Tải bản mới từ máy chủ',
            isSecondary: true,
            onPressed: onUseServer,
          ),
        ],
      ),
    ),
  );
}
