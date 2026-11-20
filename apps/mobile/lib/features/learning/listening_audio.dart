import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/figma_widgets.dart';
import 'learning_repository.dart';

/// Native audio boundary, injectable so timing and interrupted loads can be tested.
abstract class ListeningAudioEngine {
  Stream<Duration> get positions;
  Stream<Duration> get durations;
  Stream<PlayerState> get states;
  Future<void> load(String url);
  Future<void> resume();
  Future<void> pause();
  Future<void> seek(Duration position);
  Future<void> setRate(double rate);
  Future<void> dispose();
}

class NativeListeningAudioEngine implements ListeningAudioEngine {
  final AudioPlayer player = AudioPlayer();
  @override
  Stream<Duration> get positions => player.onPositionChanged;
  @override
  Stream<Duration> get durations => player.onDurationChanged;
  @override
  Stream<PlayerState> get states => player.onPlayerStateChanged;
  @override
  Future<void> load(String url) async {
    await player.setReleaseMode(ReleaseMode.stop);
    await player.setSource(UrlSource(url));
  }

  @override
  Future<void> resume() => player.resume();
  @override
  Future<void> pause() => player.pause();
  @override
  Future<void> seek(Duration position) => player.seek(position);
  @override
  Future<void> setRate(double rate) => player.setPlaybackRate(rate);
  @override
  Future<void> dispose() => player.dispose();
}

/// One owner per attempt and per mode (practice/review), independent of questions.
class ListeningAudioController extends ChangeNotifier {
  ListeningAudioController({
    required this.url,
    required this.isCurrent,
    ListeningAudioEngine? engine,
    this.onProgress,
    this.onStopped,
    int? durationMs,
  }) : engine = engine ?? NativeListeningAudioEngine(),
       duration = Duration(milliseconds: durationMs ?? 0) {
    _subscriptions.add(this.engine.positions.listen(_position));
    _subscriptions.add(
      this.engine.durations.listen((value) {
        if (!active) return;
        duration = value;
        notifyListeners();
      }),
    );
    _subscriptions.add(
      this.engine.states.listen((state) {
        if (!active) return;
        playing = state == PlayerState.playing;
        completed = state == PlayerState.completed;
        if (!playing) onStopped?.call();
        notifyListeners();
      }),
    );
    _accountGuard = Timer.periodic(const Duration(milliseconds: 200), (_) {
      if (!_disposed && !isCurrent()) dispose();
    });
  }
  final String url;
  final bool Function() isCurrent;
  final ListeningAudioEngine engine;
  final VoidCallback? onProgress, onStopped;
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  Timer? _accountGuard;
  Duration position = Duration.zero, duration;
  double rate = 1;
  bool busy = false, loaded = false, playing = false, completed = false;
  bool _disposed = false, _advancing = false;
  int _playEpoch = 0;
  String? error;
  List<Json> _queue = [];
  Set<String> evidenceIds = {};
  DateTime _ignoreProgressUntil = DateTime.fromMillisecondsSinceEpoch(0);
  bool get active => !_disposed && isCurrent();
  void _position(Duration value) {
    if (!active) return;
    if (playing &&
        value > position &&
        value - position < const Duration(seconds: 3) &&
        DateTime.now().isAfter(_ignoreProgressUntil)) {
      onProgress?.call();
    }
    position = value;
    if (_queue.isNotEmpty &&
        playing &&
        !_advancing &&
        value.inMilliseconds >= (_queue.first['endMs'] as num).toInt()) {
      unawaited(_nextSegment());
    }
    notifyListeners();
  }

  Future<void> _run(
    Future<void> Function(int epoch) action,
    String failure,
  ) async {
    if (!active || busy || _advancing) return;
    busy = true;
    error = null;
    final epoch = _playEpoch;
    notifyListeners();
    try {
      await action(epoch);
    } catch (_) {
      if (active) {
        error = failure;
      }
    } finally {
      if (active) {
        busy = false;
        notifyListeners();
      }
    }
  }

  Future<bool> _load() async {
    if (!loaded) {
      await engine.load(url);
      if (!active) return false;
      await engine.setRate(rate);
      if (!active) return false;
      loaded = true;
    }
    return active;
  }

  Future<void> toggle() => _run((epoch) async {
    if (playing) {
      await pause();
      return;
    }
    if (!await _load() || epoch != _playEpoch) return;
    if (completed || (duration > Duration.zero && position >= duration)) {
      await _seek(Duration.zero);
      completed = false;
    }
    await _resumeIfCurrent(epoch);
  }, 'Không tải được audio. Bấm phát để thử lại.');

  Future<void> pause() async {
    _playEpoch++;
    try {
      await engine.pause();
      if (active) {
        playing = false;
        onStopped?.call();
      }
    } catch (_) {
      if (active) error = 'Không tạm dừng được audio. Hãy thử lại.';
    }
    if (active) notifyListeners();
  }

  Future<void> _resumeIfCurrent(int epoch) async {
    if (!active || epoch != _playEpoch) return;
    await engine.resume();
    if (!active || epoch != _playEpoch) {
      try {
        await engine.pause();
      } catch (_) {
        /* Source was disposed. */
      }
    }
  }

  Future<void> _seek(Duration target) async {
    _ignoreProgressUntil = DateTime.now().add(
      const Duration(milliseconds: 500),
    );
    final max = duration.inMilliseconds;
    final ms = target.inMilliseconds.clamp(0, max > 0 ? max : 0);
    await engine.seek(Duration(milliseconds: ms));
    if (active) {
      position = Duration(milliseconds: ms);
      completed = false;
    }
  }

  Future<void> seek(Duration target) => _run((_) async {
    _queue = [];
    await _seek(target);
  }, 'Không tua được audio. Hãy thử lại.');
  Future<void> skip(int seconds) => seek(position + Duration(seconds: seconds));
  Future<void> setRate(double value) => _run((_) async {
    if (loaded) await engine.setRate(value);
    if (active) rate = value;
  }, 'Không đổi được tốc độ. Hãy thử lại.');

  Future<void> playSegments(List<Json> segments) => _run((epoch) async {
    if (segments.isEmpty || !await _load() || epoch != _playEpoch) return;
    _queue = List.of(segments)
      ..sort((a, b) => (a['startMs'] as num).compareTo(b['startMs'] as num));
    evidenceIds = segments.map((s) => s['id'] as String).toSet();
    await _seek(
      Duration(milliseconds: (_queue.first['startMs'] as num).toInt()),
    );
    await _resumeIfCurrent(epoch);
  }, 'Không phát được đoạn nghe. Hãy thử lại.');
  Future<void> stopEvidence() async {
    if (evidenceIds.isEmpty && !busy) return;
    _queue = [];
    evidenceIds = {};
    await pause();
  }

  Future<void> playWhole() => _run((epoch) async {
    if (!await _load() || epoch != _playEpoch) return;
    _queue = [];
    evidenceIds = {};
    await _seek(Duration.zero);
    if (!playing) await _resumeIfCurrent(epoch);
  }, 'Không phát được audio. Hãy thử lại.');

  Future<void> _nextSegment() async {
    _advancing = true;
    final epoch = _playEpoch;
    try {
      _queue.removeAt(0);
      if (_queue.isEmpty) {
        await pause();
      } else {
        await _seek(
          Duration(milliseconds: (_queue.first['startMs'] as num).toInt()),
        );
        await _resumeIfCurrent(epoch);
      }
    } catch (_) {
      if (active) {
        error = 'Không phát được đoạn nghe. Hãy thử lại.';
        await pause();
      }
    } finally {
      _advancing = false;
      if (active) notifyListeners();
    }
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _playEpoch++;
    _accountGuard?.cancel();
    onStopped?.call();
    for (final s in _subscriptions) {
      unawaited(s.cancel());
    }
    unawaited(engine.dispose().catchError((_) {}));
    super.dispose();
  }
}

class ListeningAudioControls extends StatelessWidget {
  const ListeningAudioControls({super.key, required this.controller});
  final ListeningAudioController controller;
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) {
      final c = controller;
      final skipStyle = IconButton.styleFrom(
        backgroundColor: AppColors.grey25,
        foregroundColor: AppColors.grey900,
        disabledBackgroundColor: AppColors.grey25,
        minimumSize: const Size(40, 36),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.tagRadius),
      );
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton.outlined(
                tooltip: c.playing ? 'Tạm dừng' : 'Phát audio',
                onPressed: c.busy ? null : c.toggle,
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.grey0,
                  foregroundColor: AppColors.grey900,
                  disabledBackgroundColor: AppColors.grey0,
                  side: const BorderSide(color: AppColors.grey200),
                  fixedSize: const Size(48, 48),
                ),
                icon: c.busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          semanticsLabel: 'Đang tải audio',
                          strokeWidth: 2,
                          color: AppColors.primary700,
                        ),
                      )
                    : FigmaAsset(
                        c.playing
                            ? 'listening-playing/imgVuesaxLinearPause'
                            : 'listening/imgVuesaxLinearPlay',
                        size: 20,
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    SizedBox(
                      height: 32,
                      child: SliderTheme(
                        data: SliderTheme.of(context).copyWith(
                          trackHeight: 4,
                          activeTrackColor: AppColors.primary500,
                          inactiveTrackColor: AppColors.grey200,
                          thumbColor: AppColors.primary500,
                          overlayColor: AppColors.primary25,
                          thumbShape: const RoundSliderThumbShape(
                            enabledThumbRadius: 6,
                          ),
                          overlayShape: const RoundSliderOverlayShape(
                            overlayRadius: 14,
                          ),
                          trackShape: const RoundedRectSliderTrackShape(),
                        ),
                        child: Slider(
                          semanticFormatterCallback: (v) =>
                              '${(v / 1000).round()} giây',
                          value: c.position.inMilliseconds.toDouble().clamp(
                            0,
                            c.duration.inMilliseconds.toDouble(),
                          ),
                          max: c.duration.inMilliseconds > 0
                              ? c.duration.inMilliseconds.toDouble()
                              : 1,
                          onChanged: c.busy || !c.loaded
                              ? null
                              : (v) => c.seek(Duration(milliseconds: v.round())),
                        ),
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          _time(c.position),
                          style: designText(12, color: AppColors.grey600),
                        ),
                        Text(
                          _time(c.duration),
                          style: designText(12, color: AppColors.grey600),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Divider(height: 1, color: AppColors.grey100),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              alignment: WrapAlignment.spaceBetween,
              spacing: 8,
              runSpacing: 4,
              children: [
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      tooltip: 'Lùi 5 giây',
                      onPressed: c.busy || !c.loaded ? null : () => c.skip(-5),
                      style: skipStyle,
                      icon: const Icon(Icons.replay_5_rounded, size: 20),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      tooltip: 'Tiến 5 giây',
                      onPressed: c.busy || !c.loaded ? null : () => c.skip(5),
                      style: skipStyle,
                      icon: const Icon(Icons.forward_5_rounded, size: 20),
                    ),
                  ],
                ),
                PopupMenuButton<double>(
                  key: const Key('listeningSpeed'),
                  tooltip: 'Tốc độ phát',
                  enabled: !c.busy,
                  initialValue: c.rate,
                  onSelected: c.setRate,
                  color: AppColors.grey0,
                  shape: const RoundedRectangleBorder(
                    borderRadius: AppRadius.cardSm,
                  ),
                  itemBuilder: (_) => [
                    for (final speed in [0.75, 1.0])
                      PopupMenuItem(
                        value: speed,
                        child: Text(
                          '${speed == 1 ? '1' : '0.75'}×',
                          style: designText(14, weight: FontWeight.w500),
                        ),
                      ),
                  ],
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(
                      minWidth: 64,
                      minHeight: 36,
                    ),
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        color: AppColors.grey0,
                        borderRadius: AppRadius.tagRadius,
                        border: Border.all(color: AppColors.grey200),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 7,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              '${c.rate == 1 ? '1' : '0.75'}×',
                              style: designText(13, weight: FontWeight.w600),
                            ),
                            const SizedBox(width: 4),
                            const Icon(Icons.keyboard_arrow_down, size: 16),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (c.error != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                c.error!,
                style: designText(12, color: AppColors.error200),
              ),
            ),
        ],
      );
    },
  );
  static String _time(Duration d) =>
      '${d.inMinutes}:${(d.inSeconds % 60).toString().padLeft(2, '0')}';
}

class ListeningTranscript extends StatefulWidget {
  const ListeningTranscript({
    super.key,
    required this.controller,
    required this.content,
  });
  final ListeningAudioController? controller;
  final Json content;

  @override
  State<ListeningTranscript> createState() => _ListeningTranscriptState();
}

class _ListeningTranscriptState extends State<ListeningTranscript> {
  final _scroll = ScrollController();
  late final _playback = Listenable.merge([widget.controller]);
  bool _translated = false;

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final audio = widget.controller;
    final segments = learningItems(widget.content['transcriptSegments']);
    final hasTranslation = segments.any(
      (segment) => (segment['translationVi'] as String? ?? '').isNotEmpty,
    );
    return PopScope(
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) unawaited(audio?.pause());
      },
      child: FigmaPage(
        title: 'Bản chép lời',
        titleStyle: designHeading(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (audio != null || hasTranslation)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: FigmaCard(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (audio != null)
                        ListenableBuilder(
                          listenable: audio,
                          builder: (context, _) {
                            final playingWhole =
                                audio.playing && audio.evidenceIds.isEmpty;
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                TextButton.icon(
                                  onPressed: audio.busy
                                      ? null
                                      : playingWhole
                                      ? audio.pause
                                      : audio.playWhole,
                                  style: TextButton.styleFrom(
                                    foregroundColor: AppColors.primary800,
                                    backgroundColor: playingWhole
                                        ? AppColors.primary25
                                        : AppColors.grey25,
                                    minimumSize: const Size(0, 44),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 8,
                                    ),
                                    shape: const StadiumBorder(),
                                  ),
                                  icon: Icon(
                                    playingWhole
                                        ? Icons.pause_rounded
                                        : Icons.play_arrow_rounded,
                                  ),
                                  label: Text(
                                    playingWhole
                                        ? 'Tạm dừng toàn bài'
                                        : 'Phát toàn bài',
                                  ),
                                ),
                                if (audio.error case final String error)
                                  Text(
                                    error,
                                    style: designText(
                                      13,
                                      color: AppColors.error200,
                                    ),
                                  ),
                              ],
                            );
                          },
                        ),
                      if (hasTranslation)
                        Material(
                          type: MaterialType.transparency,
                          child: SwitchListTile(
                            contentPadding: EdgeInsets.zero,
                            activeTrackColor: AppColors.primary500,
                            title: Text(
                              'Hiện bản dịch tiếng Việt',
                              style: designText(14, weight: FontWeight.w500),
                            ),
                            value: _translated,
                            onChanged: (value) =>
                                setState(() => _translated = value),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            Expanded(
              child: Scrollbar(
                controller: _scroll,
                child: ListView.separated(
                  key: const Key('listeningTranscriptMessages'),
                  controller: _scroll,
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
                  itemCount: segments.isEmpty ? 1 : segments.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    if (segments.isEmpty) {
                      return FigmaCard(
                        child: Text(
                          widget.content['transcript'] as String? ?? '',
                          style: designText(16, height: 1.5),
                        ),
                      );
                    }
                    final segment = segments[index];
                    final isFirstSpeaker =
                        segment['speaker'] == segments.first['speaker'];
                    return ListenableBuilder(
                      listenable: _playback,
                      builder: (context, _) =>
                          _message(segment, isFirstSpeaker),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _message(Json segment, bool isFirstSpeaker) {
    final audio = widget.controller;
    final start = (segment['startMs'] as num).toInt();
    final elapsed = audio?.position.inMilliseconds ?? 0;
    final highlighted =
        audio?.playing == true &&
        elapsed >= start &&
        elapsed < (segment['endMs'] as num);
    final translation = segment['translationVi'] as String? ?? '';
    const corner = Radius.circular(16);
    const speakerCorner = Radius.circular(4);
    final borderColor = highlighted
        ? AppColors.primary500
        : isFirstSpeaker
        ? AppColors.grey100
        : AppColors.primary100;
    final fillColor = highlighted
        ? AppColors.primary25
        : isFirstSpeaker
        ? AppColors.grey0
        : const Color(0xFFF3FBF6);
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.only(
        topLeft: isFirstSpeaker ? speakerCorner : corner,
        topRight: isFirstSpeaker ? corner : speakerCorner,
        bottomLeft: corner,
        bottomRight: corner,
      ),
      side: BorderSide(color: borderColor, width: highlighted ? 1.5 : 1),
    );
    return LayoutBuilder(
      builder: (context, constraints) => Align(
        alignment: isFirstSpeaker
            ? Alignment.centerLeft
            : Alignment.centerRight,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxWidth: constraints.maxWidth * .84),
          child: Material(
            key: ValueKey('listening-transcript-${segment['id']}'),
            color: fillColor,
            shape: shape,
            child: InkWell(
              customBorder: shape,
              onTap: audio == null || audio.busy
                  ? null
                  : () => audio.playSegments([segment]),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 4,
                  children: [
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Expanded(
                          child: Text(
                            "${segment['speaker']} · ${ListeningAudioControls._time(Duration(milliseconds: start))}",
                            style: designText(
                              13,
                              weight: FontWeight.w600,
                              color: highlighted
                                  ? AppColors.primary700
                                  : AppColors.grey800,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        Icon(
                          highlighted
                              ? Icons.volume_up_rounded
                              : Icons.play_circle_outline_rounded,
                          size: 16,
                          color: highlighted
                              ? AppColors.primary600
                              : AppColors.grey500,
                        ),
                      ],
                    ),
                    Text(
                      segment['text'] as String,
                      style: designText(
                        15,
                        weight: FontWeight.w500,
                        color: AppColors.grey900,
                        height: 1.45,
                      ),
                    ),
                    if (_translated && translation.isNotEmpty)
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(top: 4),
                        padding: const EdgeInsets.only(top: 6),
                        decoration: const BoxDecoration(
                          border: Border(
                            top: BorderSide(color: AppColors.grey100),
                          ),
                        ),
                        child: Text(
                          translation,
                          style: designText(
                            14,
                            color: AppColors.grey800,
                            height: 1.45,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
