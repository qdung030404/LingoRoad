import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../shared/figma_widgets.dart';
import 'profile_constants.dart';

enum ConceptGlyph {
  back,
  arrow,
  chevron,
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
  settings,
  briefcase,
  check,
}

ConceptGlyph learningKindGlyph(String kind) => switch (kind) {
  'READING' => ConceptGlyph.book,
  'LISTENING' => ConceptGlyph.headphones,
  'GRAMMAR' => ConceptGlyph.grammar,
  'VOCABULARY' => ConceptGlyph.cards,
  _ => ConceptGlyph.book,
};

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
    ConceptGlyph.back => '<path d="M15 18l-6-6 6-6"/>',
    ConceptGlyph.arrow => '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    ConceptGlyph.chevron => '<path d="M9 6l6 6-6 6"/>',
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
    ConceptGlyph.settings =>
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
    ConceptGlyph.briefcase =>
      '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    ConceptGlyph.check => '<path d="M5 13l4 4L19 7"/>',
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

/// Biểu đồ lộ trình 6 bậc CEFR (A1 -> C2) với 3 trạng thái chặng đường:
/// đã qua, chặng đang chinh phục (Đầu vào -> Mục tiêu) và chặng tiếp theo.
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
  static const double _chartHeight = 100;

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
        padding: const EdgeInsets.fromLTRB(6, 12, 6, 10),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment(-0.7, -0.8),
            end: Alignment(0.8, 0.8),
            colors: [
              ProfilePalette.cefrChartStart,
              ProfilePalette.cefrChartMid,
              ProfilePalette.cefrChartEnd,
            ],
            stops: [0.0, 0.52, 1.0],
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
            active ? 15 : 12.5,
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
          height: 24,
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
                          10.5,
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
                      10.5,
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

  Path _segmentPath(Offset curr, Offset next, double stepX) {
    final handle = 0.4 * stepX;
    return Path()
      ..moveTo(curr.dx, curr.dy)
      ..cubicTo(
        curr.dx + handle,
        curr.dy,
        next.dx - handle,
        next.dy,
        next.dx,
        next.dy,
      );
  }

  void _drawDashedPath(
    Canvas canvas,
    Path path,
    Paint paint, {
    double dashLength = 4.0,
    double gapLength = 4.5,
  }) {
    for (final metric in path.computeMetrics()) {
      var distance = 0.0;
      while (distance < metric.length) {
        final end = (distance + dashLength).clamp(0.0, metric.length);
        canvas.drawPath(metric.extractPath(distance, end), paint);
        distance += dashLength + gapLength;
      }
    }
  }

  @override
  void paint(Canvas canvas, Size size) {
    final stepX = size.width / allCefrLevels.length;
    final points = [
      for (var i = 0; i < allCefrLevels.length; i++)
        Offset((i + 0.5) * stepX, (stopYs[i] / 90.0) * size.height),
    ];

    final inputIdx = inputLevel == null ? -1 : allCefrLevels.indexOf(inputLevel!);
    final targetIdx = allCefrLevels.indexOf(targetLevel);
    final guideBottomY = (89.0 / 90.0) * size.height;

    // 1. Nền gradient dịu dưới chặng đang chinh phục (Đầu vào -> Mục tiêu)
    if (inputIdx >= 0 && targetIdx > inputIdx) {
      final areaPath = Path()..moveTo(points[inputIdx].dx, points[inputIdx].dy);
      for (var i = inputIdx; i < targetIdx; i++) {
        final curr = points[i];
        final next = points[i + 1];
        final handle = 0.4 * stepX;
        areaPath.cubicTo(
          curr.dx + handle,
          curr.dy,
          next.dx - handle,
          next.dy,
          next.dx,
          next.dy,
        );
      }
      areaPath
        ..lineTo(points[targetIdx].dx, size.height)
        ..lineTo(points[inputIdx].dx, size.height)
        ..close();
      final areaPaint = Paint()
        ..shader = ui.Gradient.linear(
          Offset(0, points[targetIdx].dy),
          Offset(0, size.height),
          const [ProfilePalette.routeAreaTop, ProfilePalette.routeAreaBottom],
        );
      canvas.drawPath(areaPath, areaPaint);
    }

    // 2. Đường gióng dọc nét đứt từ mỗi điểm xuống chân biểu đồ
    for (var i = 0; i < points.length; i++) {
      final pt = points[i];
      final isKeyStop = i == inputIdx || i == targetIdx;
      final guidePaint = Paint()
        ..color = isKeyStop
            ? ProfilePalette.routeGuideActive
            : ProfilePalette.routeGuide
        ..strokeWidth = isKeyStop ? 1.25 : 1.0
        ..style = PaintingStyle.stroke;
      var y = pt.dy;
      while (y < guideBottomY) {
        final nextY = (y + 2.2).clamp(y, guideBottomY);
        canvas.drawLine(Offset(pt.dx, y), Offset(pt.dx, nextY), guidePaint);
        y += 6.0;
      }
    }

    // 3. Đường cong S-curve phân 3 trạng thái: đã qua / đang đi / tương lai
    final journeyShader = (inputIdx >= 0 && targetIdx > inputIdx)
        ? ui.Gradient.linear(
            points[inputIdx],
            points[targetIdx],
            const [
              ProfilePalette.routeJourneyStart,
              ProfilePalette.routeJourneyEnd,
            ],
          )
        : null;

    for (var i = 0; i < points.length - 1; i++) {
      final seg = _segmentPath(points[i], points[i + 1], stepX);
      final isPassed = inputIdx >= 0 && i < inputIdx;
      final isJourney = inputIdx >= 0 && i >= inputIdx && i < targetIdx;
      final isUnassessedLead = inputIdx < 0 && targetIdx > 0 && i < targetIdx;

      if (isJourney) {
        canvas.drawPath(
          seg,
          Paint()
            ..color = ProfilePalette.routeUnderlay
            ..strokeWidth = 9.5
            ..strokeCap = StrokeCap.round
            ..strokeJoin = StrokeJoin.round
            ..style = PaintingStyle.stroke,
        );
        final strokePaint = Paint()
          ..color = ProfilePalette.routeLine
          ..shader = journeyShader
          ..strokeWidth = 3.4
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..style = PaintingStyle.stroke;
        canvas.drawPath(seg, strokePaint);
      } else if (isPassed) {
        canvas.drawPath(
          seg,
          Paint()
            ..color = ProfilePalette.routePassed
            ..strokeWidth = 2.8
            ..strokeCap = StrokeCap.round
            ..style = PaintingStyle.stroke,
        );
      } else if (isUnassessedLead) {
        _drawDashedPath(
          canvas,
          seg,
          Paint()
            ..color = ProfilePalette.routePassed
            ..strokeWidth = 2.4
            ..strokeCap = StrokeCap.round
            ..style = PaintingStyle.stroke,
          dashLength: 5.0,
          gapLength: 4.5,
        );
      } else {
        _drawDashedPath(
          canvas,
          seg,
          Paint()
            ..color = ProfilePalette.routeFuture
            ..strokeWidth = 2.0
            ..strokeCap = StrokeCap.round
            ..style = PaintingStyle.stroke,
          dashLength: 3.2,
          gapLength: 4.8,
        );
      }
    }

    // 4. Các mốc tròn (tâm không bị méo theo aspect ratio)
    for (var i = 0; i < allCefrLevels.length; i++) {
      final center = points[i];
      final isInput = i == inputIdx;
      final isGoal = i == targetIdx;
      final isPassed = inputIdx >= 0 && i < inputIdx;

      if (isInput && isGoal) {
        canvas.drawCircle(
          center,
          13.0,
          Paint()..color = ProfilePalette.routeUnderlay,
        );
        canvas.drawCircle(
          center,
          9.0,
          Paint()..color = ProfilePalette.inputDotFill,
        );
        canvas.drawCircle(
          center,
          9.0,
          Paint()
            ..color = ProfilePalette.dotFill
            ..strokeWidth = 2.2
            ..style = PaintingStyle.stroke,
        );
        canvas.drawCircle(
          center,
          2.6,
          Paint()..color = ProfilePalette.dotFill,
        );
      } else if (isInput) {
        canvas.drawCircle(
          center,
          13.5,
          Paint()..color = ProfilePalette.inputDotHalo,
        );
        canvas.drawCircle(
          center,
          9.0,
          Paint()..color = ProfilePalette.inputDotFill,
        );
        canvas.drawCircle(
          center,
          9.0,
          Paint()
            ..color = ProfilePalette.inputDotBorder
            ..strokeWidth = 2.2
            ..style = PaintingStyle.stroke,
        );
        canvas.drawCircle(
          center,
          2.6,
          Paint()..color = ProfilePalette.dotFill,
        );
      } else if (isGoal) {
        canvas.drawCircle(
          center,
          13.5,
          Paint()..color = ProfilePalette.goalDotHalo,
        );
        canvas.drawCircle(
          center,
          9.0,
          Paint()..color = ProfilePalette.dotFill,
        );
        canvas.drawCircle(
          center,
          9.0,
          Paint()
            ..color = ProfilePalette.goalDotStroke
            ..strokeWidth = 2.8
            ..style = PaintingStyle.stroke,
        );
        canvas.drawCircle(
          center,
          3.0,
          Paint()..color = ProfilePalette.goalDotCore,
        );
      } else if (isPassed) {
        canvas.drawCircle(
          center,
          5.8,
          Paint()..color = ProfilePalette.goalDotHalo,
        );
        canvas.drawCircle(
          center,
          5.8,
          Paint()
            ..color = ProfilePalette.routeLine
            ..strokeWidth = 1.8
            ..style = PaintingStyle.stroke,
        );
      } else {
        canvas.drawCircle(
          center,
          6.8,
          Paint()..color = ProfilePalette.dotHalo,
        );
        canvas.drawCircle(
          center,
          4.8,
          Paint()..color = ProfilePalette.dotFill,
        );
        canvas.drawCircle(
          center,
          4.8,
          Paint()
            ..color = ProfilePalette.dotStroke
            ..strokeWidth = 1.5
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
