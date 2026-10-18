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

  // Predefined EdgeInsets
  static const EdgeInsets screenPadding = EdgeInsets.symmetric(horizontal: md);
  static const EdgeInsets cardPadding = EdgeInsets.all(md);
  static const EdgeInsets dialogPadding = EdgeInsets.all(lg);
}