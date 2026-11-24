import 'dart:async';
import 'dart:io';
import 'dart:typed_data';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_tts/flutter_tts.dart';
import '../../core/api/api_client.dart';

/// Playback for the open review, including learner audio when available locally.
class ConversationReviewAudio with WidgetsBindingObserver {
  ConversationReviewAudio(this.isCurrent, {this.fetchSample}) {
    WidgetsBinding.instance.addObserver(this);
  }
  final bool Function() isCurrent;
  final Future<Uint8List> Function(String)? fetchSample;
  final _samples = <String, Future<Uint8List>>{};
  Uint8List? _wav;
  AudioPlayer? _player;
  FlutterTts? _voice;
  int _generation = 0;
  bool _disposed = false;

  void setRecording(Uint8List? bytes) {
    if (!_disposed && isCurrent()) _wav = bytes;
  }

  bool hasTurn(List<Json> segments, String? id) =>
      _wav != null && id != null && segments.any((s) => s['itemId'] == id);

  Future<void> playSample(String text) async {
    final generation = ++_generation;
    await _player?.stop();
    if (!_active(generation)) return;
    var useSystemVoice = true;
    try {
      await _playSystemSample(
        text,
        () => useSystemVoice && _active(generation),
      ).timeout(const Duration(seconds: 5));
    } catch (_) {
      useSystemVoice = false;
      if (!_active(generation)) return;
      final load = fetchSample;
      if (load == null) rethrow;
      final request = _samples.putIfAbsent(text, () => load(text));
      if (_samples.length > 12) _samples.remove(_samples.keys.first);
      final Uint8List bytes;
      try {
        bytes = await request;
      } catch (_) {
        if (identical(_samples[text], request)) _samples.remove(text);
        if (!_active(generation)) return;
        rethrow;
      }
      if (!_active(generation)) return;
      final player = _player ??= AudioPlayer();
      await player.play(BytesSource(bytes, mimeType: 'audio/mpeg'));
    }
  }

  Future<void> _playSystemSample(String text, bool Function() isActive) async {
    final voice = _voice ?? FlutterTts();
    if (Platform.isAndroid) {
      final engines = await voice.getEngines.timeout(
        const Duration(seconds: 4),
      );
      if (engines is! List || engines.isEmpty) {
        throw const FormatException('No TTS engine');
      }
    }
    if (!isActive()) return;
    _voice = voice;
    await voice.stop();
    if (!isActive()) return;
    if (await voice.isLanguageAvailable('en-US') != true) {
      throw const FormatException('English voice unavailable');
    }
    await voice.setLanguage('en-US');
    if (isActive() && await voice.speak(text) != 1) {
      throw StateError('Sample playback failed');
    }
  }

  Future<void> playTurn(
    List<Json> segments,
    String id, {
    num? offset,
    num? duration,
  }) async {
    final clip = conversationClip(
      _wav!,
      segments.where((s) => s['itemId'] == id),
      offset: offset,
      duration: duration,
    );
    final generation = ++_generation;
    await _voice?.stop();
    if (!_active(generation)) return;
    final player = _player ??= AudioPlayer();
    await player.stop();
    if (_active(generation)) {
      await player.play(BytesSource(clip, mimeType: 'audio/wav'));
    }
  }

  bool _active(int generation) =>
      !_disposed && isCurrent() && _generation == generation;

  Future<void> stop() async {
    if (_disposed) return;
    _generation++;
    await Future.wait([
      if (_player != null) _player!.stop(),
      if (_voice != null) _voice!.stop(),
    ]);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) unawaited(stop());
  }

  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _wav = null;
    _samples.clear();
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_player?.dispose());
    _voice?.stop();
  }
}

/// The Android capture writes a 44-byte WAV header and mono 16 kHz PCM.
/// Word offsets refer to the joined segments of this reply, as on the server.
Uint8List conversationClip(
  Uint8List wav,
  Iterable<Json> segments, {
  num? offset,
  num? duration,
}) {
  final pcm = BytesBuilder(copy: false);
  for (final segment in segments) {
    final start = 44 + ((segment['offsetMs'] as num) * 32).round();
    final end = start + ((segment['durationMs'] as num) * 32).round();
    pcm.add(Uint8List.sublistView(wav, start, end));
  }
  final joined = pcm.takeBytes();
  final start = ((offset ?? 0) * 16).round() * 2;
  final end = duration == null
      ? joined.length
      : (start + (duration * 16).round() * 2).clamp(0, joined.length);
  if (start < 0 || start >= end) {
    throw const FormatException('Invalid audio interval');
  }
  final clip = Uint8List(44 + end - start)
    ..setRange(0, 44, wav)
    ..setRange(44, 44 + end - start, joined, start);
  ByteData.sublistView(clip)
    ..setUint32(4, clip.length - 8, Endian.little)
    ..setUint32(40, clip.length - 44, Endian.little);
  return clip;
}
