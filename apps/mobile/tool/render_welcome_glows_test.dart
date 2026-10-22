// Run explicitly from apps/mobile:
// flutter test tool/render_welcome_glows_test.dart --no-pub
// Only the transparent glow is rendered: no background, phone or welcome card.
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:mobile/core/theme/figma_assets.dart';
import 'package:mobile/shared/figma_widgets.dart';

void main() {
  testWidgets('render the three original transparent welcome glows', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(393, 852);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    for (final source in ['welcome', 'welcome-audio', 'welcome-path']) {
      await tester.runAsync(() async {
        await SvgAssetLoader(
          FigmaAssets.files['$source/imgVector4']!,
        ).loadBytes(null);
      });
      final key = GlobalKey();
      await tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.ltr,
          child: RepaintBoundary(
            key: key,
            child: Stack(
              clipBehavior: Clip.hardEdge,
              children: [
                Positioned(
                  left: -414.60,
                  top: 197.21,
                  child: Transform.rotate(
                    angle: .33214,
                    child: SizedBox(
                      width: 910.543,
                      height: 299.525,
                      child: Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Positioned(
                            left: -168.18,
                            top: -186.46,
                            child: ImageFiltered(
                              imageFilter: ui.ImageFilter.blur(
                                sigmaX: 50,
                                sigmaY: 50,
                              ),
                              child: FigmaAsset(
                                '$source/imgVector4',
                                width: 1265.2,
                                height: 672.462,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.runAsync(() async {
        final boundary =
            key.currentContext!.findRenderObject() as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 3);
        final rgba = (await image.toByteData())!.buffer.asUint8List();
        var transparent = false, translucent = false;
        for (var offset = 3; offset < rgba.length; offset += 4) {
          transparent |= rgba[offset] == 0;
          translucent |= rgba[offset] > 0 && rgba[offset] < 255;
        }
        expect(transparent && translucent, isTrue);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        await File(
          'assets/figma/${source}_glow_3x.png',
        ).writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
    }
  });
}
