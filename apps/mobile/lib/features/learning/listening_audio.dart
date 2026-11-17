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
  Future<void> playWhole() async {
    _queue = [];
    evidenceIds = {};
    if (!playing) await toggle();
    if (active) notifyListeners();
  }

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
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                tooltip: 'Lùi 5 giây',
                onPressed: c.busy || !c.loaded ? null : () => c.skip(-5),
                icon: const Icon(Icons.replay_5),
              ),
              IconButton.filled(
                tooltip: c.playing ? 'Tạm dừng' : 'Phát audio',
                onPressed: c.busy ? null : c.toggle,
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.grey900,
                  foregroundColor: AppColors.grey0,
                  disabledBackgroundColor: AppColors.grey900,
                  disabledForegroundColor: AppColors.grey0,
                  fixedSize: const Size(52, 52),
                ),
                icon: c.busy
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          semanticsLabel: 'Đang tải audio',
                          strokeWidth: 2,
                          color: AppColors.grey0,
                        ),
                      )
                    : Icon(
                        c.playing ? Icons.pause : Icons.play_arrow,
                        size: 28,
                      ),
              ),
              IconButton(
                tooltip: 'Tiến 5 giây',
                onPressed: c.busy || !c.loaded ? null : () => c.skip(5),
                icon: const Icon(Icons.forward_5),
              ),
              const Spacer(),
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
                    minHeight: 48,
                  ),
                  child: Center(
                    child: DecoratedBox(
                      decoration: const BoxDecoration(
                        color: AppColors.grey50,
                        borderRadius: AppRadius.tagRadius,
                      ),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 7,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
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
              ),
            ],
          ),
          Row(
            children: [
              Text(
                _time(c.position),
                style: designText(12, color: AppColors.grey800),
              ),
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      trackHeight: 3,
                      activeTrackColor: AppColors.primary500,
                      inactiveTrackColor: AppColors.grey200,
                      thumbColor: AppColors.primary500,
                      overlayColor: AppColors.primary25,
                      thumbShape: const RoundSliderThumbShape(
                        enabledThumbRadius: 5,
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
              ),
              Text(
                _time(c.duration),
                style: designText(12, color: AppColors.grey800),
              ),
            ],
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
  final ListeningAudioController controller;
  final Json content;
  @override
  State<ListeningTranscript> createState() => _ListeningTranscriptState();
}

class _ListeningTranscriptState extends State<ListeningTranscript> {
  bool translated = false;
  @override
  Widget build(BuildContext context) {
    final segments = learningItems(widget.content['transcriptSegments']);
    return AnimatedBuilder(
      animation: widget.controller,
      builder: (context, _) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Bản chép lời', style: designHeading(20)),
          if (segments.isEmpty)
            Text(
              widget.content['transcript'] as String? ?? '',
              style: designText(16),
            )
          else ...[
            Material(
              type: MaterialType.transparency,
              child: SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Hiện bản dịch tiếng Việt'),
                value: translated,
                onChanged: (value) => setState(() => translated = value),
              ),
            ),
            TextButton(
              onPressed: widget.controller.busy
                  ? null
                  : widget.controller.playWhole,
              child: const Text('Phát toàn bài'),
            ),
            for (final segment in segments)
              Builder(
                builder: (context) {
                  final ms = widget.controller.position.inMilliseconds;
                  final current =
                      ms >= (segment['startMs'] as num) &&
                      ms < (segment['endMs'] as num);
                  final evidence = widget.controller.evidenceIds.contains(
                    segment['id'],
                  );
                  return Card(
                    color: current ? AppColors.primary25 : null,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(
                        color: evidence
                            ? AppColors.primary500
                            : AppColors.grey200,
                      ),
                    ),
                    child: InkWell(
                      onTap: widget.controller.busy
                          ? null
                          : () => widget.controller.playSegments([segment]),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${segment['speaker']} · ${ListeningAudioControls._time(Duration(milliseconds: (segment['startMs'] as num).toInt()))}',
                              style: designText(14, weight: FontWeight.w600),
                            ),
                            Text(
                              segment['text'] as String,
                              style: designText(16),
                            ),
                            if (translated)
                              Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Text(
                                  segment['translationVi'] as String? ?? '',
                                  style: designText(14),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
          ],
        ],
      ),
    );
  }
}
