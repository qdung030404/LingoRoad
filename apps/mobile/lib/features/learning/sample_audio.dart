import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';
import 'learning_widgets.dart';

/// Bundled synthetic examples, not a user's recording or microphone input.
class SampleAudio extends StatefulWidget {
  const SampleAudio({
    super.key,
    required this.asset,
    this.label = 'Nghe mẫu',
    this.player = false,
    this.dark = false,
  });
  final String asset, label;
  final bool player, dark;
  @override
  State<SampleAudio> createState() => _SampleAudioState();
}

class _SampleAudioState extends State<SampleAudio> with WidgetsBindingObserver {
  final audio = AudioPlayer();
  final subscriptions = <StreamSubscription<dynamic>>[];
  bool playing = false, busy = false;
  Duration position = Duration.zero, duration = Duration.zero;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    subscriptions.add(
      audio.onPlayerStateChanged.listen((s) {
        if (mounted) setState(() => playing = s == PlayerState.playing);
      }),
    );
    subscriptions.add(
      audio.onPositionChanged.listen((p) {
        if (mounted) setState(() => position = p);
      }),
    );
    subscriptions.add(
      audio.onDurationChanged.listen((d) {
        if (mounted) setState(() => duration = d);
      }),
    );
  }

  @override
  void didUpdateWidget(SampleAudio old) {
    super.didUpdateWidget(old);
    if (old.asset != widget.asset) {
      audio.stop();
      position = Duration.zero;
      duration = Duration.zero;
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) audio.pause();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    for (final s in subscriptions) {
      s.cancel();
    }
    audio.dispose();
    super.dispose();
  }

  Future<void> toggle() async {
    if (busy) return;
    setState(() => busy = true);
    try {
      if (playing) {
        await audio.pause();
      } else if (audio.state == PlayerState.paused) {
        await audio.resume();
      } else {
        await audio.play(AssetSource('audio/preview/${widget.asset}.wav'));
      }
      final loadedDuration = await audio.getDuration();
      if (mounted && loadedDuration != null) {
        setState(() => duration = loadedDuration);
      }
    } catch (_) {
      if (mounted) {
        previewMessage(context, 'Không phát được audio mẫu. Hãy thử lại.');
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  String time(Duration d) =>
      '${d.inMinutes.toString().padLeft(2, '0')}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
  @override
  Widget build(BuildContext context) {
    final icon = playing
        ? const FigmaAsset('listening-playing/imgVuesaxLinearPause', size: 20)
        : FigmaAsset(
            widget.player
                ? 'speaking-recorded/imgVuesaxLinearPlay'
                : 'speaking/imgVuesaxLinearVolumeHigh',
            size: 20,
          );
    final button = Tooltip(
      message: playing ? 'Tạm dừng audio mẫu' : widget.label,
      child: InkWell(
        onTap: busy ? null : toggle,
        borderRadius: BorderRadius.circular(99),
        child: Container(
          width: 48,
          height: 48,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: widget.dark ? AppColors.grey900 : Colors.white,
            border: Border.all(color: AppColors.grey200),
          ),
          child: widget.dark
              ? const FigmaAsset(
                  'vocabulary-word/imgVuesaxLinearVolumeHigh',
                  size: 20,
                )
              : icon,
        ),
      ),
    );
    if (!widget.player) {
      if (widget.dark) return button;
      return Tooltip(
        message: playing ? 'Tạm dừng audio mẫu' : widget.label,
        child: Material(
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(99),
            side: const BorderSide(color: AppColors.grey200),
          ),
          child: InkWell(
            onTap: busy ? null : toggle,
            borderRadius: BorderRadius.circular(99),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  icon,
                  const SizedBox(width: 8),
                  Text(
                    widget.label,
                    style: designText(16, weight: FontWeight.w500),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }
    return Row(
      children: [
        button,
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            children: [
              LinearProgressIndicator(
                key: const Key('sampleAudioProgress'),
                value: duration.inMilliseconds == 0
                    ? 0
                    : (position.inMilliseconds / duration.inMilliseconds).clamp(
                        0,
                        1,
                      ),
                minHeight: 4,
                color: AppColors.primary500,
                backgroundColor: AppColors.grey200,
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    time(position),
                    style: designText(12, color: AppColors.grey600),
                  ),
                  Text(
                    time(duration),
                    style: designText(12, color: AppColors.grey600),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
