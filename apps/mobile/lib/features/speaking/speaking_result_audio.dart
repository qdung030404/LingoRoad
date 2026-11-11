import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';

class SpeakingResultAudio extends StatefulWidget {
  const SpeakingResultAudio({
    super.key,
    required this.path,
    this.isCurrent,
    this.durationSeconds,
  });
  final String path;
  final bool Function()? isCurrent;
  final double? durationSeconds;
  @override
  State<SpeakingResultAudio> createState() => SpeakingResultAudioState();
}

class SpeakingResultAudioState extends State<SpeakingResultAudio>
    with WidgetsBindingObserver {
  final player = AudioPlayer();
  final subscriptions = <StreamSubscription<dynamic>>[];
  Duration position = Duration.zero, duration = Duration.zero;
  double? segmentEndMs;
  bool playing = false;
  bool foreground = true;
  int playbackGeneration = 0;
  String? error;
  bool get active => mounted && (widget.isCurrent?.call() ?? true);
  bool get canPlay => active && foreground;

  @override
  void initState() {
    super.initState();
    final seconds = widget.durationSeconds;
    if (seconds != null && seconds.isFinite && seconds > 0) {
      duration = Duration(milliseconds: (seconds * 1000).round());
    }
    WidgetsBinding.instance.addObserver(this);
    subscriptions.add(
      player.onPositionChanged.listen((value) {
        if (!active) {
          unawaited(player.stop());
          return;
        }
        setState(() => position = value);
        if (segmentEndMs != null && value.inMilliseconds >= segmentEndMs!) {
          segmentEndMs = null;
          unawaited(player.pause());
        }
      }),
    );
    subscriptions.add(
      player.onDurationChanged.listen((value) {
        if (active) setState(() => duration = value);
      }),
    );
    subscriptions.add(
      player.onPlayerStateChanged.listen((value) {
        if (active) setState(() => playing = value == PlayerState.playing);
      }),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (ModalRoute.isCurrentOf(context) == false) {
      playbackGeneration++;
      unawaited(player.pause());
    }
  }

  @override
  void didUpdateWidget(SpeakingResultAudio oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.path != widget.path) {
      playbackGeneration++;
      unawaited(player.stop());
      position = duration = Duration.zero;
      segmentEndMs = null;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
    if (!foreground) {
      playbackGeneration++;
      unawaited(player.pause());
    }
  }

  Future<void> playSegment(double startMs, double lengthMs) async {
    if (!canPlay ||
        startMs < 0 ||
        lengthMs <= 0 ||
        startMs + lengthMs > 30000) {
      return;
    }
    final generation = ++playbackGeneration;
    try {
      await player.stop();
      if (!canPlay || generation != playbackGeneration) return;
      segmentEndMs = startMs + lengthMs;
      await player.play(
        DeviceFileSource(widget.path),
        position: Duration(milliseconds: startMs.round()),
      );
      if (!canPlay || generation != playbackGeneration) await player.pause();
    } catch (_) {
      if (active) {
        setState(() => error = 'Không phát được bản thu. Vui lòng thử lại.');
      }
    }
  }

  Future<void> toggle() async {
    if (!canPlay) return;
    final generation = ++playbackGeneration;
    segmentEndMs = null;
    try {
      if (playing) {
        await player.pause();
      } else {
        await player.play(
          DeviceFileSource(widget.path),
          position: position >= duration ? Duration.zero : position,
        );
        if (!canPlay || generation != playbackGeneration) await player.pause();
      }
    } catch (_) {
      if (active) {
        setState(() => error = 'Không phát được bản thu. Vui lòng thử lại.');
      }
    }
  }

  @override
  void dispose() {
    playbackGeneration++;
    WidgetsBinding.instance.removeObserver(this);
    for (final subscription in subscriptions) {
      unawaited(subscription.cancel());
    }
    unawaited(player.dispose());
    super.dispose();
  }

  String time(Duration value) =>
      '${value.inMinutes.toString().padLeft(2, '0')}:${(value.inSeconds % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: AppColors.grey100),
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            IconButton(
              key: const Key('speakingResultPlayback'),
              tooltip: playing ? 'Tạm dừng bản thu' : 'Nghe bản thu',
              onPressed: active ? toggle : null,
              style: IconButton.styleFrom(
                backgroundColor: AppColors.primary25,
                foregroundColor: AppColors.primary700,
              ),
              icon: Icon(
                playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Nghe lại bản thu',
                    style: designText(14, weight: FontWeight.w600),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${time(position)} / ${time(duration)}',
                    style: designText(12, color: AppColors.grey800),
                  ),
                ],
              ),
            ),
          ],
        ),
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            trackHeight: 3,
            thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
          ),
          child: Slider(
            value: position.inMilliseconds.toDouble().clamp(
              0,
              duration.inMilliseconds.toDouble(),
            ),
            max: duration.inMilliseconds > 0
                ? duration.inMilliseconds.toDouble()
                : 1,
            onChanged:
                duration.inMilliseconds == 0 || player.source == null || !active
                ? null
                : (value) {
                    segmentEndMs = null;
                    unawaited(
                      player.seek(Duration(milliseconds: value.round())),
                    );
                  },
          ),
        ),
        if (error != null)
          Text(error!, style: designText(12, color: AppColors.error200)),
      ],
    ),
  );
}
