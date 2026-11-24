import 'dart:io';
import 'package:flutter/services.dart';

import 'speaking_recorder.dart';

/// Uses the microphone already owned by WebRTC, with no second recorder.
class ConversationAudio {
  static const _channel = MethodChannel('lingoroad/conversation_audio');
  String? path;
  Future<Uint8List?>? _reviewRecording;
  List<Map<String, dynamic>> segments = [];
  bool _started = false;
  Future<void> start(String trackId, {bool muted = false}) async {
    await clear();
    if (!Platform.isAndroid) return;
    await prepareSpeakingTemporaryAudio();
    await _channel.invokeMethod<void>('start', {
      'trackId': trackId,
      'muted': muted,
    });
    _started = true;
  }

  Future<void> speech(bool started, {String? itemId}) async {
    if (_started) {
      await _channel.invokeMethod<void>('speech', {
        'started': started,
        'itemId': itemId,
      });
    }
  }

  Future<void> mute(bool muted) async {
    if (_started) await _channel.invokeMethod<void>('mute', {'muted': muted});
  }

  Stream<double> amplitudes() async* {
    while (_started) {
      yield await _channel.invokeMethod<double>('amplitudeDb') ?? -60;
      await Future<void>.delayed(const Duration(milliseconds: 80));
    }
  }

  Future<String?> stop() async {
    if (!_started) return path;
    _started = false;
    final result = await _channel.invokeMapMethod<String, dynamic>('stop');
    _reviewRecording = null;
    path = result?['path'] as String?;
    segments = (result?['segments'] as List? ?? [])
        .map((value) => Map<String, dynamic>.from(value as Map))
        .toList();
    return path;
  }

  Future<Uint8List?> readForReview() => _reviewRecording ??= _readCapture(path);

  Future<Uint8List?> _readCapture(String? capturePath) async {
    if (capturePath == null) return null;
    try {
      return await File(capturePath).readAsBytes();
    } on FileSystemException {
      return null;
    }
  }

  Future<void> clear() async {
    if (_started) {
      _started = false;
      await _channel.invokeMethod<void>('cancel');
    }
    _reviewRecording = null;
    segments = [];
    await releaseCapture();
  }

  Future<void> releaseCapture() async {
    final previous = path;
    path = null;
    if (previous != null) {
      try {
        await File(previous).delete();
      } on PathNotFoundException {
        // Startup/session cleanup can remove the same owned temporary file.
      }
    }
  }
}
