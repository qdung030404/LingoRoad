import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../common.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';

class AudioControls extends StatefulWidget {
  const AudioControls({super.key, required this.url});
  final String url;
  @override
  State<AudioControls> createState() => _AudioControlsState();
}

class _AudioControlsState extends State<AudioControls>
    with WidgetsBindingObserver {
  final player = AudioPlayer();
  StreamSubscription<PlayerState>? subscription;
  StreamSubscription<Duration>? positionSubscription, durationSubscription;
  Duration position = Duration.zero, duration = Duration.zero;
  bool playing = false;
  bool loading = false;
  bool loaded = false;
  String? error;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    subscription = player.onPlayerStateChanged.listen(
      (state) {
        if (mounted) setState(() => playing = state == PlayerState.playing);
      },
      onError: (Object _) {
        if (mounted) {
          setState(() {
            loading = false;
            error = 'Không phát được audio. Hãy thử lại.';
          });
        }
      },
    );
    positionSubscription = player.onPositionChanged.listen((value) {
      if (mounted) setState(() => position = value);
    });
    durationSubscription = player.onDurationChanged.listen((value) {
      if (mounted) setState(() => duration = value);
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) unawaited(player.pause());
  }

  Future<void> play({bool replay = false}) async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      if (replay) await player.stop();
      if (playing && !replay) {
        await player.pause();
      } else if (loaded && !replay && player.state == PlayerState.paused) {
        await player.resume();
      } else {
        await player
            .play(UrlSource(widget.url))
            .timeout(const Duration(seconds: 15));
        loaded = true;
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => error = 'Không tải được audio. Kiểm tra kết nối và thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(subscription?.cancel());
    unawaited(positionSubscription?.cancel());
    unawaited(durationSubscription?.cancel());
    unawaited(player.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      FigmaCard(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            SizedBox(
              width: 48,
              height: 48,
              child: IconButton(
                tooltip: playing ? 'Tạm dừng' : 'Nghe audio',
                style: IconButton.styleFrom(
                  backgroundColor: Colors.white,
                  side: const BorderSide(color: AppColors.grey200),
                ),
                onPressed: loading ? null : play,
                icon: loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : FigmaAsset(
                        playing
                            ? 'listening-playing/imgVuesaxLinearPause'
                            : 'listening/imgVuesaxLinearPlay',
                        size: 20,
                      ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(
                      key: const Key('audioProgress'),
                      minHeight: 4,
                      value: duration.inMilliseconds > 0
                          ? (position.inMilliseconds / duration.inMilliseconds)
                                .clamp(0, 1)
                          : 0,
                      color: AppColors.primary500,
                      backgroundColor: AppColors.grey200,
                      semanticsLabel:
                          'Tiến độ audio, ${_time(position)} trên ${_time(duration)}',
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        _time(position),
                        style: designText(12, color: AppColors.grey600),
                      ),
                      Text(
                        _time(duration),
                        style: designText(12, color: AppColors.grey600),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      if (loaded && !playing)
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: loading ? null : () => play(replay: true),
            child: const Text('Nghe lại từ đầu'),
          ),
        ),
      if (error != null) ErrorNotice(error!, onRetry: () => play(replay: true)),
    ],
  );
  String _time(Duration value) =>
      '${value.inMinutes.toString().padLeft(2, '0')}:${(value.inSeconds % 60).toString().padLeft(2, '0')}';
}
