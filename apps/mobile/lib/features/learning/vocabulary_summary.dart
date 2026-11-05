import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';
import 'word_library.dart';

class VocabularySummary extends StatelessWidget {
  const VocabularySummary({
    super.key,
    required this.library,
    required this.onReview,
    required this.onWords,
    this.decks,
  });
  final WordLibrary library;
  final VoidCallback onReview, onWords;
  final Widget? decks;

  @override
  Widget build(BuildContext context) {
    final total = library.totalWords;
    final remembered = library.rememberedWords;
    return Container(
      key: const Key('homeVocabularySummary'),
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFE8E8E9)),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: onWords,
                    child: Text('Từ của tôi', style: designHeading(24)),
                  ),
                ),
                OutlinedButton(
                  key: const Key('homeReviewWords'),
                  onPressed: total == 0 ? null : onReview,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 36),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    side: const BorderSide(color: AppColors.grey200),
                  ),
                  child: Text('Ôn từ vựng', style: designText(12)),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: Color(0xFFE8E8E9)),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 32, 24, 12),
            child: Column(
              children: [
                Semantics(
                  label:
                      'Đã học $total từ, đã nhớ $remembered, cần ôn ${total - remembered}',
                  child: ExcludeSemantics(
                    child: AspectRatio(
                      aspectRatio: 294.582 / 146.327,
                      child: Stack(
                        children: [
                          Positioned.fill(
                            child: CustomPaint(
                              painter: _VocabularyGauge(
                                total == 0 ? 0 : remembered / total,
                              ),
                            ),
                          ),
                          Positioned(
                            bottom: 8,
                            left: 0,
                            right: 0,
                            child: Column(
                              children: [
                                Text(
                                  'Đã học',
                                  style: designText(
                                    16,
                                    color: const Color(0xFF8A8C91),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  '$total',
                                  key: const Key('homeTotalWords'),
                                  style: designHeading(36, height: 1),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 30),
                Row(
                  children: [
                    Expanded(
                      child: _stat(
                        'Đã nhớ',
                        remembered,
                        'imgVuesaxBulkTickCircle',
                        'homeRememberedWords',
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _stat(
                        'Cần ôn',
                        total - remembered,
                        'imgVuesaxBulkInfoCircle',
                        'homeDueWords',
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          ?decks,
        ],
      ),
    );
  }

  Widget _stat(String label, int count, String icon, String key) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: AppColors.grey100),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            FigmaAsset('home-v2/$icon', size: 20),
            const SizedBox(width: 4),
            Flexible(child: Text(label, style: designText(14))),
          ],
        ),
        const SizedBox(height: 6),
        Text('$count', key: Key(key), style: designHeading(28, height: 1)),
      ],
    ),
  );
}

/// The Figma chart geometry with live local counts, rather than a fixed 49/70 image.
class _VocabularyGauge extends CustomPainter {
  const _VocabularyGauge(this.fraction);
  final double fraction;

  @override
  void paint(Canvas canvas, Size size) {
    final thickness = size.width * 40 / 294.582;
    final radius = (size.width - thickness) / 2;
    final rect = Rect.fromCircle(
      center: Offset(size.width / 2, size.height),
      radius: radius,
    );
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = thickness;
    canvas.drawArc(
      rect,
      math.pi,
      math.pi,
      false,
      paint..color = const Color(0xFFE1F6EF),
    );
    if (fraction > 0) {
      canvas.drawArc(
        rect,
        math.pi,
        math.pi * fraction,
        false,
        paint..color = const Color(0xFF307B45),
      );
    }
  }

  @override
  bool shouldRepaint(_VocabularyGauge old) => old.fraction != fraction;
}
