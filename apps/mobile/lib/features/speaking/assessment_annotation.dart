import 'package:flutter/material.dart';
import '../../shared/figma_widgets.dart';

class AssessmentAnnotation extends StatelessWidget {
  const AssessmentAnnotation({
    super.key,
    this.reading = false,
    this.compact = false,
    this.showMonotone = true,
  });
  final bool reading;
  final bool compact;
  final bool showMonotone;
  @override
  Widget build(BuildContext context) {
    final entries = [
      (
        'Aa',
        'Phát âm cần luyện',
        const Color(0xFFB66A00),
        const Color(0xFFFFF6E5),
        null,
      ),
      if (reading) ...[
        (
          'Aa',
          'Bỏ sót',
          const Color(0xFF5B6574),
          const Color(0xFFEDF1F6),
          TextDecoration.underline,
        ),
        (
          'Aa',
          'Đọc thêm',
          const Color(0xFFB3261E),
          const Color(0xFFFFECEA),
          TextDecoration.lineThrough,
        ),
      ],
      (
        compact ? '|' : '│',
        compact ? 'Ngắt nghỉ sai' : 'Ngắt nghỉ ngoài dự kiến',
        const Color(0xFFB66A00),
        const Color(0xFFFFF6E5),
        null,
      ),
      (
        compact ? '~' : '⌁',
        'Cần ngắt nghỉ',
        compact ? const Color(0xff1e713b) : const Color(0xFF70539A),
        compact ? const Color(0xffe7f6ed) : const Color(0xFFF2ECF8),
        null,
      ),
      if (showMonotone)
        (
          compact ? '≈' : '~',
          'Giọng đều',
          const Color(0xFF70539A),
          const Color(0xFFF2ECF8),
          null,
        ),
    ];
    if (compact) {
      final chips = [
        for (final entry in entries)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xffdbe2eb)),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  color: entry.$4,
                  child: Text(
                    entry.$1,
                    style: designText(
                      12,
                      color: entry.$3,
                    ).copyWith(decoration: entry.$5),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    entry.$2,
                    style: designText(12, weight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
      ];
      return Column(
        spacing: 6,
        children: [
          for (var index = 0; index < chips.length; index += 2)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 6,
                children: [
                  Expanded(child: chips[index]),
                  Expanded(
                    child: index + 1 < chips.length
                        ? chips[index + 1]
                        : const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
        ],
      );
    }
    return Column(
      key: const Key('speakingAnnotation'),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Annotation', style: designHeading(18)),
        const SizedBox(height: 4),
        Text(
          'Chú thích màu và ký hiệu',
          style: designText(12, color: const Color(0xFF5B6574)),
        ),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, bounds) {
            final columns =
                bounds.maxWidth >= 360 &&
                    MediaQuery.textScalerOf(context).scale(14) <= 18
                ? 2
                : 1;
            return Wrap(
              spacing: 12,
              runSpacing: 10,
              children: [
                for (final entry in entries)
                  SizedBox(
                    width: (bounds.maxWidth - (columns - 1) * 12) / columns,
                    child: Row(
                      children: [
                        Container(
                          width: 28,
                          height: 28,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: entry.$4,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            entry.$1,
                            style: designText(
                              14,
                              weight: FontWeight.w600,
                              color: entry.$3,
                            ).copyWith(decoration: entry.$5),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            entry.$2,
                            style: designText(
                              12,
                              color: const Color(0xFF5B6574),
                              height: 1.4,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}
