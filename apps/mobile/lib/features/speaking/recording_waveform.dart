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

class _RecordingWaveformState extends State<RecordingWaveform> {
  final levels = List<double>.filled(32, 0, growable: true);
  StreamSubscription<double>? subscription;
  @override
  void initState() {
    super.initState();
    listen();
  }

  void listen() {
    subscription = widget.amplitudes.listen(
      (db) {
        if (!mounted) return;
        final level = db.isFinite ? ((db + 60) / 60).clamp(0.0, 1.0) : 0.0;
        setState(() {
          levels.removeAt(0);
          levels.add(level);
        });
      },
      onError: (Object _) {
        // Recording remains available if a device cannot report amplitude.
        if (mounted) setState(() => levels.fillRange(0, levels.length, 0));
      },
    );
  }

  @override
  void didUpdateWidget(RecordingWaveform oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.amplitudes != widget.amplitudes) {
      subscription?.cancel();
      levels.fillRange(0, levels.length, 0);
      listen();
    }
  }

  @override
  void dispose() {
    subscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    label: 'Mức âm thanh từ micro',
    child: SizedBox(
      height: 64,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var i = 0; i < levels.length; i++)
            Expanded(
              child: Center(
                child: AnimatedContainer(
                  key: ValueKey('amplitude-bar-$i'),
                  duration: MediaQuery.disableAnimationsOf(context)
                      ? Duration.zero
                      : const Duration(milliseconds: 100),
                  curve: Curves.easeOut,
                  width: 4,
                  height: 4 + levels[i] * 52,
                  decoration: BoxDecoration(
                    color: Color.lerp(
                      AppColors.primary100,
                      AppColors.primary600,
                      (i + 1) / levels.length,
                    ),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}
