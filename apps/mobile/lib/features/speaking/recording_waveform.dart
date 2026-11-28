import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

/// A short rolling history of measured microphone amplitude in dBFS.
class RecordingWaveform extends StatefulWidget {
  const RecordingWaveform({super.key, required this.amplitudes});
  final Stream<double> amplitudes;
  @override
  State<RecordingWaveform> createState() => _RecordingWaveformState();
}

class _RecordingWaveformState extends State<RecordingWaveform>
    with SingleTickerProviderStateMixin {
  static const int _barCount = 32;
  static const Duration _barAnimationDuration = Duration(milliseconds: 100);

  final List<double> _fromLevels = List<double>.filled(_barCount, 0);
  final List<double> _targetLevels = List<double>.filled(_barCount, 0);
  final List<double> _paintedLevels = List<double>.filled(_barCount, 0);
  final _WaveformRepaint _repaint = _WaveformRepaint();
  late final AnimationController _controller;
  late final RecordingWaveformPainter _painter;
  StreamSubscription<double>? _subscription;
  bool _disableAnimations = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: _barAnimationDuration,
    )..addListener(_syncAnimatedLevels);
    _painter = RecordingWaveformPainter(
      levels: _paintedLevels,
      repaint: _repaint,
      animationDuration: _barAnimationDuration,
    );
    _listen();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final disabled = MediaQuery.disableAnimationsOf(context);
    if (disabled != _disableAnimations) {
      _disableAnimations = disabled;
      _painter.animationDuration = disabled
          ? Duration.zero
          : _barAnimationDuration;
      if (disabled && _controller.isAnimating) {
        _controller.stop();
        _applyDirectLevels();
      }
    }
  }

  void _syncAnimatedLevels() {
    final t = Curves.easeOut.transform(_controller.value);
    for (var i = 0; i < _barCount; i++) {
      _paintedLevels[i] =
          _fromLevels[i] + (_targetLevels[i] - _fromLevels[i]) * t;
    }
    _repaint.notify();
  }

  void _applyDirectLevels() {
    for (var i = 0; i < _barCount; i++) {
      _fromLevels[i] = _targetLevels[i];
      _paintedLevels[i] = _targetLevels[i];
    }
    _repaint.notify();
  }

  void _commitLevels({required bool animate}) {
    if (!animate || _disableAnimations) {
      _controller.stop();
      _applyDirectLevels();
      return;
    }
    for (var i = 0; i < _barCount; i++) {
      _fromLevels[i] = _paintedLevels[i];
    }
    _controller.forward(from: 0);
  }

  void _listen() {
    _subscription = widget.amplitudes.listen(
      (db) {
        if (!mounted) return;
        final level = db.isFinite ? ((db + 60) / 60).clamp(0.0, 1.0) : 0.0;
        for (var i = 0; i < _barCount - 1; i++) {
          _targetLevels[i] = _targetLevels[i + 1];
        }
        _targetLevels[_barCount - 1] = level;
        _commitLevels(animate: true);
      },
      onError: (Object _) {
        // Recording remains available if a device cannot report amplitude.
        if (!mounted) return;
        _targetLevels.fillRange(0, _barCount, 0);
        _commitLevels(animate: false);
      },
    );
  }

  @override
  void didUpdateWidget(RecordingWaveform oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.amplitudes != widget.amplitudes) {
      _subscription?.cancel();
      _targetLevels.fillRange(0, _barCount, 0);
      _commitLevels(animate: false);
      _listen();
    }
  }

  @override
  void dispose() {
    _subscription?.cancel();
    _controller.removeListener(_syncAnimatedLevels);
    _controller.dispose();
    _repaint.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Mức âm thanh từ micro',
    child: RepaintBoundary(
      child: SizedBox(
        height: 64,
        width: double.infinity,
        child: CustomPaint(painter: _painter),
      ),
    ),
  );
}

class _WaveformRepaint extends ChangeNotifier {
  void notify() => notifyListeners();
}

class RecordingWaveformPainter extends CustomPainter {
  RecordingWaveformPainter({
    required this.levels,
    required Listenable repaint,
    required this.animationDuration,
  }) : super(repaint: repaint);

  static final List<Color> _barColors = List<Color>.unmodifiable([
    for (var i = 0; i < 32; i++)
      Color.lerp(AppColors.primary100, AppColors.primary600, (i + 1) / 32)!,
  ]);

  final List<double> levels;
  Duration animationDuration;
  final Paint _paint = Paint()..style = PaintingStyle.fill;

  double barHeight(int index) => 4.0 + levels[index] * 52.0;

  @override
  void paint(Canvas canvas, Size size) {
    final count = levels.length;
    if (count == 0 || size.width <= 0 || size.height <= 0) return;
    final slotWidth = size.width / count;
    const barWidth = 4.0;
    const radius = Radius.circular(4);
    for (var i = 0; i < count; i++) {
      final height = barHeight(i);
      final left = i * slotWidth + (slotWidth - barWidth) / 2.0;
      final top = (size.height - height) / 2.0;
      _paint.color = _barColors[i];
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(left, top, barWidth, height),
          radius,
        ),
        _paint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant RecordingWaveformPainter oldDelegate) =>
      !identical(levels, oldDelegate.levels);
}
