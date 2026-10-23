import 'package:flutter/material.dart';

class AppRadius {
  AppRadius._();

  static const double xs = 6.0;
  static const double sm = 10.0;
  static const double md = 14.0;
  static const double lg = 20.0;
  static const double xl = 24.0;
  static const double xxl = 28.0;
  static const double full = 999.0;

  // Semantic Radius conforming to AGENTS.md
  static const BorderRadius buttonRadius = BorderRadius.all(
    Radius.circular(99),
  );
  static const BorderRadius inputRadius = BorderRadius.all(Radius.circular(99));
  static const BorderRadius cardRadius = BorderRadius.all(Radius.circular(16));
  static const BorderRadius dialogRadius = BorderRadius.all(
    Radius.circular(xl),
  );
  static const BorderRadius bottomSheetRadius = BorderRadius.vertical(
    top: Radius.circular(xxl),
  );

  // Aliases for backward compatibility
  static BorderRadius get button => buttonRadius;
  static BorderRadius get input => inputRadius;
  static BorderRadius get card => cardRadius;
  static BorderRadius get dialog => dialogRadius;
  static BorderRadius get bottomSheet => bottomSheetRadius;
}
