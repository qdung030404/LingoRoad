import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

/// Rectangle geometry from Figma 47:9176; illustrative, not microphone analysis.
class PreviewWaveform extends StatelessWidget {
  const PreviewWaveform({super.key});
  static const heights = <double>[
    22,
    29,
    23,
    35,
    41,
    35,
    25,
    42,
    47,
    27,
    25,
    60,
    25,
    47,
    27,
    57,
    27,
    35,
    54,
    35,
    55,
    27,
    57,
    27,
    57,
    27,
    47,
    57,
    52,
    35,
    35,
    52,
    46,
    35,
    52,
    35,
    25,
    35,
    25,
    15,
    44,
    25,
    35,
    21,
    11,
  ];
  @override
  Widget build(BuildContext context) => SizedBox(
    height: 83,
    child: FittedBox(
      fit: BoxFit.scaleDown,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < heights.length; i++) ...[
            if (i > 0) const SizedBox(width: 4.599),
            Container(
              width: 3,
              height: heights[i],
              decoration: BoxDecoration(
                color: AppColors.primary500,
                borderRadius: BorderRadius.circular(114),
              ),
            ),
          ],
        ],
      ),
    ),
  );
}
