import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../shared/figma_widgets.dart';
import 'profile_constants.dart';

enum ConceptGlyph {
  arrow,
  pen,
  camera,
  book,
  headphones,
  grammar,
  cards,
  bell,
  bellOff,
  clock,
  lock,
  exit,
  mail,
}

/// Icon SVG nét mảnh đồng bộ 100% với bản thiết kế Hồ sơ (strokeWidth 1.75).
class ConceptSvgIcon extends StatelessWidget {
  const ConceptSvgIcon(
    this.glyph, {
    super.key,
    this.size = 20,
    this.color = ProfilePalette.ink,
    this.strokeWidth = 1.75,
  });

  final ConceptGlyph glyph;
  final double size;
  final Color color;
  final double strokeWidth;

  String _pathMarkup() => switch (glyph) {
    ConceptGlyph.arrow => '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    ConceptGlyph.pen =>
      '<path d="m14 6 4 4M4 20l1-5L16 4a2.8 2.8 0 0 1 4 4L9 19l-5 1Z"/>',
    ConceptGlyph.camera =>
      '<path d="M8 6l2-2h4l2 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3"/>',
    ConceptGlyph.book =>
      '<path d="M12 5v15m0 0c-3-3-6-3-9-2V5c3-1 6-1 9 2 3-3 6-3 9-2v13c-3-1-6-1-9 2Z"/>',
    ConceptGlyph.headphones =>
      '<path d="M3 14v-2a9 9 0 1 1 18 0v2m-18 0h3a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm18 0h-3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2Z"/>',
    ConceptGlyph.grammar =>
      '<path d="M4 19 9 5l5 14m-8-5h6m4 0h5m-2.5-2.5v5"/>',
    ConceptGlyph.cards =>
      '<rect x="4" y="3" width="12" height="15" rx="2"/><path d="M9 21h9a2 2 0 0 0 2-2V8m-13 0h6m-6 4h4"/>',
    ConceptGlyph.bell =>
      '<path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-3 9h18c-1-2-3-3-3-9Zm-8 12a2 2 0 0 0 4 0"/>',
    ConceptGlyph.bellOff =>
      '<path d="M9.6 4.5a6 6 0 0 1 8.4 5.4c0 2.7.4 4.4 1 5.6m-13-8C5.2 10.7 6 13.8 3 17h14m-7 3a2 2 0 0 0 4 0M3 3l18 18"/>',
    ConceptGlyph.clock =>
      '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    ConceptGlyph.lock =>
      '<rect x="5" y="10" rx="2" width="14" height="11"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/>',
    ConceptGlyph.exit =>
      '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m3-13 5 5-5 5m-5-5h12"/>',
    ConceptGlyph.mail =>
      '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
  };

  @override
  Widget build(BuildContext context) {
    final hex = color
        .toARGB32()
        .toRadixString(16)
        .padLeft(8, '0')
        .substring(2);
    final opacity = color.a;
    final svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
        'fill="none" stroke="#$hex" stroke-opacity="$opacity" '
        'stroke-width="$strokeWidth" stroke-linecap="round" '
        'stroke-linejoin="round">${_pathMarkup()}</svg>';
    return ExcludeSemantics(
      child: SvgPicture.string(svg, width: size, height: size),
    );
  }
}

/// Biểu đồ lộ trình 6 bậc CEFR (A1 -> C2) đánh dấu Đầu vào & Mục tiêu.
class CefrRoadChart extends StatelessWidget {
  const CefrRoadChart({
    super.key,
    required this.hasPlacement,
    required this.inputLevel,
    required this.targetLevel,
  });

  final bool hasPlacement;
  final String? inputLevel;
  final String targetLevel;

  static const List<double> _stopYs = [72, 64, 52, 36, 23, 13];
  static const double _chartHeight = 104;

  @override
  Widget build(BuildContext context) {
    final normalizedInput = hasPlacement && inputLevel != null
        ? inputLevel!.trim().toUpperCase()
        : null;
    final normalizedTarget = targetLevel.trim().toUpperCase();
    final semanticLabel =
        'Sáu bậc CEFR. '
        '${normalizedInput != null ? 'Đầu vào $normalizedInput' : 'Chưa có kết quả đầu vào'}. '
        'Mục tiêu $normalizedTarget.';

    return Semantics(
      label: semanticLabel,
      child: Container(
        padding: const EdgeInsets.fromLTRB(6, 14, 6, 10),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment(-0.7, -0.8),
            end: Alignment(0.8, 0.8),
            colors: [
              ProfilePalette.cefrChartStart,
              ProfilePalette.cefrChartMid,
              ProfilePalette.cefrChartEnd,
            ],
            stops: [0.0, 0.53, 1.0],
          ),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: ProfilePalette.cefrChartBorder),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(
              height: _chartHeight,
              width: double.infinity,
              child: CustomPaint(
                painter: _CefrRoadPainter(
                  stopYs: _stopYs,
                  inputLevel: normalizedInput,
                  targetLevel: normalizedTarget,
                ),
              ),
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final level in allCefrLevels)
                  Expanded(
                    child: _CefrStopFooter(
                      level: level,
                      isInput: normalizedInput == level,
                      isGoal: normalizedTarget == level,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CefrStopFooter extends StatelessWidget {
  const _CefrStopFooter({
    required this.level,
    required this.isInput,
    required this.isGoal,
  });

  final String level;
  final bool isInput;
  final bool isGoal;

  @override
  Widget build(BuildContext context) {
    final active = isInput || isGoal;
    Widget labelWidget = Text(
      level,
      textAlign: TextAlign.center,
      style:
          designText(
            active ? 15.5 : 13,
            weight: active ? FontWeight.w800 : FontWeight.w600,
            color: active
                ? ProfilePalette.activeCefrLabel
                : ProfilePalette.inactiveCefrLabel,
            height: 1.15,
          ).copyWith(
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
    );
    if (isInput) {
      labelWidget = KeyedSubtree(
        key: const Key('cefrPlacementSummary'),
        child: labelWidget,
      );
    }
    if (isGoal) {
      labelWidget = KeyedSubtree(
        key: const Key('cefrTargetSummary'),
        child: labelWidget,
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 26,
          child: Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: labelWidget,
            ),
          ),
        ),
        ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.start,
            children: [
              if (isInput)
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Container(
                        width: 5,
                        height: 5,
                        decoration: const BoxDecoration(
                          color: ProfilePalette.inputDotFill,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 3),
                      Text(
                        'Đầu vào',
                        maxLines: 1,
                        style: designText(
                          11,
                          weight: FontWeight.w700,
                          color: ProfilePalette.roleText,
                          height: 1.25,
                        ),
                      ),
                    ],
                  ),
                ),
              if (isInput && isGoal) const SizedBox(height: 2),
              if (isGoal)
                FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    'Mục tiêu',
                    maxLines: 1,
                    style: designText(
                      11,
                      weight: FontWeight.w700,
                      color: ProfilePalette.roleText,
                      height: 1.25,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CefrRoadPainter extends CustomPainter {
  const _CefrRoadPainter({
    required this.stopYs,
    required this.inputLevel,
    required this.targetLevel,
  });

  final List<double> stopYs;
  final String? inputLevel;
  final String targetLevel;

  @override
  void paint(Canvas canvas, Size size) {
    final stepX = size.width / allCefrLevels.length;
    final points = [
      for (var i = 0; i < allCefrLevels.length; i++)
        Offset((i + 0.5) * stepX, (stopYs[i] / 90.0) * size.height),
    ];

    // 1. Đường gióng dọc nét đứt từ mỗi điểm xuống chân biểu đồ
    final guideBottomY = (89.0 / 90.0) * size.height;
    final guidePaint = Paint()
      ..color = ProfilePalette.routeGuide
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;
    for (final pt in points) {
      var y = pt.dy;
      while (y < guideBottomY) {
        final nextY = (y + 2.0).clamp(y, guideBottomY);
        canvas.drawLine(Offset(pt.dx, y), Offset(pt.dx, nextY), guidePaint);
        y += 6.0;
      }
    }

    // 2. Đường cong S-curve nối các bậc CEFR
    final routePath = Path()..moveTo(points.first.dx, points.first.dy);
    for (var i = 0; i < points.length - 1; i++) {
      final curr = points[i];
      final next = points[i + 1];
      final handle = 0.4 * stepX;
      routePath.cubicTo(
        curr.dx + handle,
        curr.dy,
        next.dx - handle,
        next.dy,
        next.dx,
        next.dy,
      );
    }

    final underlayPaint = Paint()
      ..color = ProfilePalette.routeUnderlay
      ..strokeWidth = 9.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    canvas.drawPath(routePath, underlayPaint);

    final linePaint = Paint()
      ..color = ProfilePalette.routeLine
      ..strokeWidth = 2.8
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    canvas.drawPath(routePath, linePaint);

    // 3. Các mốc tròn (tâm không bị méo theo aspect ratio)
    for (var i = 0; i < allCefrLevels.length; i++) {
      final level = allCefrLevels[i];
      final center = points[i];
      final isInput = inputLevel == level;
      final isGoal = targetLevel == level;

      if (isInput && isGoal) {
        canvas.drawCircle(
          center,
          12.5,
          Paint()..color = ProfilePalette.goalDotStroke,
        );
        canvas.drawCircle(
          center,
          9.5,
          Paint()..color = ProfilePalette.inputDotFill,
        );
        canvas.drawCircle(
          center,
          9.5,
          Paint()
            ..color = ProfilePalette.dotFill
            ..strokeWidth = 2.2
            ..style = PaintingStyle.stroke,
        );
      } else if (isInput) {
        canvas.drawCircle(
          center,
          13.5,
          Paint()..color = ProfilePalette.inputDotHalo,
        );
        canvas.drawCircle(
          center,
          9.5,
          Paint()..color = ProfilePalette.inputDotFill,
        );
        canvas.drawCircle(
          center,
          9.5,
          Paint()
            ..color = ProfilePalette.inputDotBorder
            ..strokeWidth = 2.2
            ..style = PaintingStyle.stroke,
        );
      } else if (isGoal) {
        canvas.drawCircle(
          center,
          13.5,
          Paint()..color = ProfilePalette.goalDotHalo,
        );
        canvas.drawCircle(
          center,
          9.5,
          Paint()..color = ProfilePalette.dotFill,
        );
        canvas.drawCircle(
          center,
          9.5,
          Paint()
            ..color = ProfilePalette.goalDotStroke
            ..strokeWidth = 2.8
            ..style = PaintingStyle.stroke,
        );
      } else {
        canvas.drawCircle(
          center,
          7.5,
          Paint()..color = ProfilePalette.dotHalo,
        );
        canvas.drawCircle(
          center,
          5.5,
          Paint()..color = ProfilePalette.dotFill,
        );
        canvas.drawCircle(
          center,
          5.5,
          Paint()
            ..color = ProfilePalette.dotStroke
            ..strokeWidth = 1.6
            ..style = PaintingStyle.stroke,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _CefrRoadPainter oldDelegate) =>
      oldDelegate.inputLevel != inputLevel ||
      oldDelegate.targetLevel != targetLevel ||
      oldDelegate.stopYs != stopYs;
}
