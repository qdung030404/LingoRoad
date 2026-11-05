import 'package:flutter/material.dart';

class AppSpacing {
  AppSpacing._();

  static const double xs = 4.0;
  static const double sm = 8.0;
  static const double md = 16.0;
  static const double lg = 24.0;
  static const double xl = 32.0;
  static const double xxl = 48.0;

  // Adaptive Spacing conforming to AGENTS.md
  static double horizontal(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width < 360) return sm;
    if (width > 600) return lg;
    return md;
  }

  static double item(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return width < 360 ? sm : md;
  }

  static double section(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return width < 360 ? md : lg;
  }

  // Predefined Gaps
  static const SizedBox gapXs = SizedBox(width: xs, height: xs);
  static const SizedBox gapSm = SizedBox(width: sm, height: sm);
  static const SizedBox gapMd = SizedBox(width: md, height: md);
  static const SizedBox gapLg = SizedBox(width: lg, height: lg);
  static const SizedBox gapXl = SizedBox(width: xl, height: xl);
  static const SizedBox gapXxl = SizedBox(width: xxl, height: xxl);

  // Predefined EdgeInsets
  static const EdgeInsets allXs = EdgeInsets.all(xs);
  static const EdgeInsets allSm = EdgeInsets.all(sm);
  static const EdgeInsets allMd = EdgeInsets.all(md);
  static const EdgeInsets allLg = EdgeInsets.all(lg);
  static const EdgeInsets screenPadding = EdgeInsets.symmetric(horizontal: md);
  static const EdgeInsets cardPadding = EdgeInsets.all(md);
  static const EdgeInsets dialogPadding = EdgeInsets.all(lg);
}
