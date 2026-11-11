import 'dart:io';
import 'package:flutter/services.dart';

/// Uses the microphone already owned by WebRTC, with no second recorder.
class ConversationAudio {
  static const _channel = MethodChannel('lingoroad/conversation_audio');
  String? path;
  List<Map<String, dynamic>> segments = [];
  bool _started = false;
  Future<void> start(String trackId) async {
    await clear();
    if (!Platform.isAndroid) return;
    await _channel.invokeMethod<void>('start', {'trackId': trackId});
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

  Future<String?> stop() async {
    if (!_started) return path;
    _started = false;
    final result = await _channel.invokeMapMethod<String, dynamic>('stop');
    path = result?['path'] as String?;
    segments = (result?['segments'] as List? ?? [])
        .map((value) => Map<String, dynamic>.from(value as Map))
        .toList();
    return path;
  }

  Future<void> clear() async {
    if (_started) {
      _started = false;
      await _channel.invokeMethod<void>('cancel');
    }
    final previous = path;
    path = null;
    segments = [];
    if (previous != null) {
      try {
        await File(previous).delete();
      } on PathNotFoundException {
        // Startup/session cleanup can remove the same owned temporary file.
      }
    }
  }
}
