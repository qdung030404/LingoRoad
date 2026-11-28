import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
import '../../shared/figma_widgets.dart';
import 'word_library.dart';

class VocabularySummary extends StatelessWidget {
  const VocabularySummary({
    super.key,
    this.library,
    this.totalWords,
    this.rememberedWords,
    this.realData = false,
    required this.onReview,
    required this.onWords,
    this.decks,
  });

  final WordLibrary? library;
  final int? totalWords, rememberedWords;
  final bool realData;
  final VoidCallback onReview, onWords;
  final Widget? decks;

  @override
  Widget build(BuildContext context) {
    final total = totalWords ?? library?.totalWords ?? 0;
    final remembered = (rememberedWords ?? library?.rememberedWords ?? 0).clamp(
      0,
      total,
    );
    final due = math.max(0, total - remembered);
    final totalLabel = realData ? 'Tổng từ' : 'Đã học';
    final subtitle = total == 0
        ? 'Lưu từ mới để ôn tập ngắt quãng'
        : (due > 0
              ? 'Còn $due từ đến hạn cần ôn tập'
              : 'Đã thuộc hết từ hiện có');

    return Container(
      key: const Key('homeVocabularySummary'),
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.grey100),
        borderRadius: AppRadius.cardRadius,
        boxShadow: AppShadows.level1,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: onWords,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Từ của tôi', style: designHeading(24)),
                        const SizedBox(height: 4),
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: designText(
                            14,
                            color: const Color(0xFF657482),
                            height: 1.3,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 164),
                  child: _buildReviewAction(total: total, due: due),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, decks == null ? 16 : 6),
            child: Semantics(
              label:
                  '$totalLabel $total từ, đã nhớ $remembered, cần ôn $due',
              child: Container(
                padding: const EdgeInsets.fromLTRB(14, 18, 14, 14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF7FAFC),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFE8EEF5)),
                ),
                child: Column(
                  children: [
                    Center(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 256),
                        child: AspectRatio(
                          aspectRatio: 1.98,
                          child: Stack(
                            alignment: Alignment.bottomCenter,
                            children: [
                              Positioned.fill(
                                child: ExcludeSemantics(
                                  child: CustomPaint(
                                    painter: _VocabularySemiCircleGauge(
                                      total == 0 ? 0 : remembered / total,
                                    ),
                                  ),
                                ),
                              ),
                              Positioned(
                                left: 32,
                                right: 32,
                                bottom: 4,
                                child: FittedBox(
                                  fit: BoxFit.scaleDown,
                                  child: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        totalLabel,
                                        style: designText(
                                          14,
                                          weight: FontWeight.w600,
                                          color: const Color(0xFF657482),
                                        ),
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        '$total',
                                        key: const Key('homeTotalWords'),
                                        style: designHeading(34, height: 1.0)
                                            .copyWith(
                                              fontWeight: FontWeight.w800,
                                              fontFeatures: const [
                                                FontFeature.tabularFigures(),
                                              ],
                                            ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 13,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(15),
                        border: Border.all(color: const Color(0xFFE6ECF2)),
                      ),
                      child: IntrinsicHeight(
                        child: Row(
                          children: [
                            Expanded(
                              child: _buildMinimalStatColumn(
                                label: 'Đã nhớ',
                                count: remembered,
                                countKey: 'homeRememberedWords',
                                dotColor: const Color(0xFF2F854A),
                              ),
                            ),
                            Container(
                              width: 1,
                              margin: const EdgeInsets.symmetric(vertical: 2),
                              color: const Color(0xFFE8EEF4),
                            ),
                            Expanded(
                              child: _buildMinimalStatColumn(
                                label: 'Cần ôn',
                                count: due,
                                countKey: 'homeDueWords',
                                dotColor: const Color(0xFFCBD5E1),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          ?decks,
        ],
      ),
    );
  }

  Widget _buildReviewAction({required int total, required int due}) {
    if (total == 0) {
      return OutlinedButton(
        key: const Key('homeReviewWords'),
        onPressed: null,
        style: OutlinedButton.styleFrom(
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          minimumSize: const Size(0, 42),
          backgroundColor: AppColors.grey50,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          side: const BorderSide(color: AppColors.grey200),
          shape: const StadiumBorder(),
        ),
        child: Text(
          'Ôn từ vựng',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: designText(
            14,
            weight: FontWeight.w700,
            color: AppColors.grey400,
          ),
        ),
      );
    }

    if (due > 0) {
      return FilledButton(
        key: const Key('homeReviewWords'),
        onPressed: onReview,
        style: FilledButton.styleFrom(
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          minimumSize: const Size(0, 42),
          backgroundColor: const Color(0xFF1E713B),
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          shape: const StadiumBorder(),
        ),
        child: Text(
          'Ôn từ vựng →',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: designText(
            14,
            weight: FontWeight.w700,
            color: Colors.white,
          ),
        ),
      );
    }

    return OutlinedButton(
      key: const Key('homeReviewWords'),
      onPressed: onReview,
      style: OutlinedButton.styleFrom(
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        minimumSize: const Size(0, 42),
        backgroundColor: const Color(0xFFECF9F0),
        foregroundColor: const Color(0xFF1E713B),
        padding: const EdgeInsets.symmetric(horizontal: 16),
        side: const BorderSide(color: Color(0xFFB7E4C7)),
        shape: const StadiumBorder(),
      ),
      child: Text(
        'Ôn lại từ',
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: designText(
          14,
          weight: FontWeight.w700,
          color: const Color(0xFF1E713B),
        ),
      ),
    );
  }

  Widget _buildMinimalStatColumn({
    required String label,
    required int count,
    required String countKey,
    required Color dotColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8.5,
                height: 8.5,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 7),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: designText(
                    14,
                    weight: FontWeight.w600,
                    color: const Color(0xFF64748B),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '$count',
            key: Key(countKey),
            style: designHeading(24, height: 1.05, color: AppColors.grey900)
                .copyWith(
                  fontWeight: FontWeight.w800,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
          ),
        ],
      ),
    );
  }
}

class _VocabularySemiCircleGauge extends CustomPainter {
  const _VocabularySemiCircleGauge(this.fraction);
  final double fraction;

  @override
  void paint(Canvas canvas, Size size) {
    final strokeWidth = (size.width * 0.105).clamp(18.0, 25.0);
    final radius = math.min(
      (size.width - strokeWidth) / 2,
      size.height - strokeWidth,
    );
    if (radius <= 0) return;

    final center = Offset(size.width / 2, size.height - strokeWidth / 2);
    final rect = Rect.fromCircle(center: center, radius: radius);

    final trackPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeWidth = strokeWidth
      ..color = const Color(0xFFDCEEE3);
    canvas.drawArc(rect, math.pi, math.pi, false, trackPaint);

    final clamped = fraction.clamp(0.0, 1.0);
    if (clamped > 0) {
      final activePaint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = strokeWidth
        ..color = const Color(0xFF2F854A);
      canvas.drawArc(rect, math.pi, math.pi * clamped, false, activePaint);
    }
  }

  @override
  bool shouldRebuildSemantics(_VocabularySemiCircleGauge oldDelegate) => false;

  @override
  bool shouldRepaint(_VocabularySemiCircleGauge old) =>
      old.fraction != fraction;
}
