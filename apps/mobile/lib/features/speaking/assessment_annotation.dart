import 'package:flutter/material.dart';
import '../../shared/figma_widgets.dart';

class AssessmentAnnotation extends StatelessWidget {
  const AssessmentAnnotation({
    super.key,
    this.reading = false,
    this.compact = false,
  });
  final bool reading;
  final bool compact;
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
        '│',
        'Ngắt nghỉ ngoài dự kiến',
        const Color(0xFFB66A00),
        const Color(0xFFFFF6E5),
        null,
      ),
      (
        '⌁',
        'Cần ngắt nghỉ',
        const Color(0xFF70539A),
        const Color(0xFFF2ECF8),
        null,
      ),
      (
        '~',
        'Giọng đều',
        const Color(0xFF70539A),
        const Color(0xFFF2ECF8),
        null,
      ),
    ];
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
                bounds.maxWidth >= (compact ? 252 : 360) &&
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
