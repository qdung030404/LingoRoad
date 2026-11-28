part of 'learning_lesson_intro_page.dart';

class _LessonIntroTopBar extends StatelessWidget {
  const _LessonIntroTopBar({
    required this.title,
    required this.canPop,
    required this.onBack,
  });

  final String title;
  final bool canPop;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: 52,
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      child: Row(
        children: [
          SizedBox(
            width: 48,
            height: 48,
            child: canPop
                ? IconButton(
                    tooltip: 'Quay lại',
                    padding: EdgeInsets.zero,
                    onPressed: onBack,
                    icon: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: const Color(0x30FFFFFF),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0x45FFFFFF)),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.chevron_left_rounded,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                  )
                : null,
          ),
          Expanded(
            child: Text(
              title,
              textAlign: TextAlign.center,
              style: designText(
                17.5,
                weight: FontWeight.w700,
                color: Colors.white,
              ).copyWith(letterSpacing: -0.3),
            ),
          ),
          const SizedBox(width: 48, height: 48),
        ],
      ),
    ),
  );
}

class _LessonCoverHeroBackdrop extends StatelessWidget {
  const _LessonCoverHeroBackdrop({
    required this.imageKey,
    required this.coverImageUrl,
    required this.photoHeight,
  });

  final Key imageKey;
  final String coverImageUrl;
  final double photoHeight;

  static const double _dissolveHeight = 190;

  @override
  Widget build(BuildContext context) => SizedBox(
    height: photoHeight + _dissolveHeight - 1,
    width: double.infinity,
    child: Stack(
      children: [
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: photoHeight,
          child: Stack(
            fit: StackFit.expand,
            children: [
              LearningMediaImage(
                key: imageKey,
                imageUrl: coverImageUrl,
                width: double.infinity,
                height: photoHeight,
                fit: BoxFit.cover,
                semanticLabel: 'Ảnh minh họa bài học',
              ),
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0x7A0C2215),
                      Color(0x0A0C2215),
                      Color(0x3D133620),
                      Color(0xBD1B4B2E),
                      Color(0xF2215937),
                      Color(0xFF245E3A),
                    ],
                    stops: [0.0, 0.24, 0.48, 0.70, 0.88, 1.0],
                  ),
                ),
              ),
            ],
          ),
        ),
        Positioned(
          top: photoHeight - 1,
          left: 0,
          right: 0,
          height: _dissolveHeight,
          child: const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xFF245E3A),
                  Color(0xFF337A4B),
                  Color(0xFF53A46B),
                  Color(0xFF8CC89E),
                  Color(0xFFC7E6D1),
                  Color(0xFFE7F3ED),
                  AppColors.grey25,
                ],
                stops: [0.0, 0.20, 0.40, 0.58, 0.75, 0.89, 1.0],
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

class _LessonFallbackHeroBackdrop extends StatelessWidget {
  const _LessonFallbackHeroBackdrop();

  @override
  Widget build(BuildContext context) => const Stack(
    fit: StackFit.expand,
    children: [
      DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Color(0xFF1B3F26),
              Color(0xFF255B37),
              Color(0xFF357D4C),
              Color(0xFF54A56C),
              Color(0xFF8EC99F),
              Color(0xFFC8E6D2),
              Color(0xFFE7F3ED),
              AppColors.grey25,
            ],
            stops: [0.0, 0.24, 0.43, 0.57, 0.71, 0.84, 0.93, 1.0],
          ),
        ),
      ),
      DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0.72, -0.82),
            radius: 0.72,
            colors: [Color(0x36A6F0C0), Color(0x00A6F0C0)],
          ),
        ),
      ),
    ],
  );
}

/// Curriculum audio only: reopen paused at zero; no microphone or play counter.
class LearningAudio extends StatefulWidget {
  const LearningAudio({
    super.key,
    required this.url,
    this.onProgress,
    this.onStopped,
  });
  final String url;
  final VoidCallback? onProgress, onStopped;
  @override
  State<LearningAudio> createState() => _LearningAudioState();
}

class _LearningAudioState extends State<LearningAudio>
    with WidgetsBindingObserver {
  final player = AudioPlayer();
  final subscriptions = <StreamSubscription<dynamic>>[];
  Duration position = Duration.zero, duration = Duration.zero;
  bool busy = false, playing = false;
  String? error;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    subscriptions.add(
      player.onPositionChanged.listen((p) {
        if (playing &&
            p > position &&
            p - position < const Duration(seconds: 3)) {
          widget.onProgress?.call();
        }
        if (mounted) setState(() => position = p);
      }),
    );
    subscriptions.add(
      player.onDurationChanged.listen((d) {
        if (mounted) setState(() => duration = d);
      }),
    );
    subscriptions.add(
      player.onPlayerStateChanged.listen((s) {
        if (s != PlayerState.playing) widget.onStopped?.call();
        if (mounted) setState(() => playing = s == PlayerState.playing);
      }),
    );
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) player.pause();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.onStopped?.call();
    for (final s in subscriptions) {
      s.cancel();
    }
    player.dispose();
    super.dispose();
  }

  Future<void> toggle() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (playing) {
        await player.pause();
      } else if (player.state == PlayerState.paused) {
        await player.resume();
      } else {
        await player.play(UrlSource(widget.url));
      }
      final d = await player.getDuration();
      if (mounted && d != null) setState(() => duration = d);
    } catch (_) {
      if (mounted) {
        setState(() => error = 'Không tải được audio. Bấm phát để thử lại.');
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Row(
        children: [
          IconButton(
            tooltip: playing ? 'Tạm dừng' : 'Phát audio',
            onPressed: busy ? null : toggle,
            icon: Icon(
              playing ? Icons.pause_circle : Icons.play_circle,
              size: 40,
              color: AppColors.grey900,
            ),
          ),
          Expanded(
            child: Slider(
              value: position.inMilliseconds.toDouble().clamp(
                0,
                duration.inMilliseconds.toDouble(),
              ),
              max: duration.inMilliseconds > 0
                  ? duration.inMilliseconds.toDouble()
                  : 1,
              onChanged: busy || duration == Duration.zero
                  ? null
                  : (value) async {
                      try {
                        await player.seek(
                          Duration(milliseconds: value.round()),
                        );
                      } catch (_) {
                        if (mounted) {
                          setState(
                            () => error = 'Không tua được audio. Hãy thử lại.',
                          );
                        }
                      }
                    },
            ),
          ),
          Text(
            '${position.inSeconds}s / ${duration.inSeconds}s',
            style: designText(12),
          ),
        ],
      ),
      if (error != null) Text(error!, style: designText(12)),
    ],
  );
}

