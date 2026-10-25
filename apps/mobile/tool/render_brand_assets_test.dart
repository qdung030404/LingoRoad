// Explicit asset generation: flutter test tool/render_brand_assets_test.dart
// Only the decorative vector glow and the standalone brand logo are rendered.
import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/shared/figma_widgets.dart';

void main() {
  testWidgets('export LingoRoad2 decorative glows and brand logo', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    for (final home in [false, true]) {
      final size = Size(393, home ? 532 : 852);
      tester.view.physicalSize = size;
      final asset = '${home ? 'home' : 'welcome'}-v2/imgVector5';
      await tester.runAsync(
        () => SvgAssetLoader(
          'assets/figma/v2_${home ? 'home' : 'welcome'}_glow.svg',
        ).loadBytes(null),
      );
      final key = GlobalKey();
      final outer = home
          ? const Size(968.815, 664.78)
          : const Size(1277.231, 901.518);
      final inner = home
          ? const Size(926.363, 304.729)
          : const Size(1225.004, 402.968);
      await tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.ltr,
          child: RepaintBoundary(
            key: key,
            child: SizedBox.fromSize(
              size: size,
              child: Stack(
                clipBehavior: Clip.hardEdge,
                children: [
                  Positioned(
                    left: 196.5 + (home ? 2.75 : -58.38) - outer.width / 2,
                    top: home ? -48.11 : -129,
                    width: outer.width,
                    height: outer.height,
                    child: Center(
                      child: Transform.rotate(
                        angle: -(home ? 24.77 : 26.14) * math.pi / 180,
                        child: Transform.flip(
                          flipY: true,
                          child: SizedBox.fromSize(
                            size: inner,
                            child: Stack(
                              clipBehavior: Clip.none,
                              children: [
                                Positioned(
                                  left: home ? -139.42 : -139.43,
                                  top: -150,
                                  width: home ? 1215.8 : 1514.44,
                                  height: home ? 604.737 : 702.975,
                                  child: ImageFiltered(
                                    imageFilter: ui.ImageFilter.blur(
                                      sigmaX: 50,
                                      sigmaY: 50,
                                    ),
                                    child: FigmaAsset(
                                      asset,
                                      width: home ? 1215.8 : 1514.44,
                                      height: home ? 604.737 : 702.975,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.runAsync(() async {
        final boundary =
            key.currentContext!.findRenderObject() as RenderRepaintBoundary;
        final image = await boundary.toImage(pixelRatio: 3);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        await File(
          'assets/figma/${home ? 'home' : 'welcome'}_v2_glow_3x.png',
        ).writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
    }
    tester.view.physicalSize = const Size(242, 242);
    await tester.runAsync(
      () => SvgAssetLoader('assets/figma/logo.svg').loadBytes(null),
    );
    final key = GlobalKey();
    await tester.pumpWidget(
      Directionality(
        textDirection: TextDirection.ltr,
        child: RepaintBoundary(
          key: key,
          child: ColoredBox(
            color: Colors.white,
            child: SvgPicture.asset(
              'assets/figma/logo.svg',
              width: 242,
              height: 242,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      final image =
          await (key.currentContext!.findRenderObject()
                  as RenderRepaintBoundary)
              .toImage(pixelRatio: 1024 / 242);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      await File(
        'assets/figma/logo_1024.png',
      ).writeAsBytes(bytes!.buffer.asUint8List());
      image.dispose();
    });
  });
}
