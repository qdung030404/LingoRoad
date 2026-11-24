import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';

import '../../core/api/api_client.dart';

class ConversationRecording {
  const ConversationRecording(this.wav, this.segments);

  final Uint8List wav;
  final List<Json> segments;
}

/// The WAV and its turn boundaries are committed together in app-private storage.
class ConversationRecordingStore {
  const ConversationRecordingStore();

  static const _channel = MethodChannel('lingoroad/conversation_audio');

  Future<Directory> _directory(String accountId, String conversationId) async {
    final root = await _channel.invokeMethod<String>('savedRecordingDirectory');
    if (root == null) {
      throw PlatformException(code: 'missing_recording_directory');
    }
    final account = base64Url.encode(utf8.encode(accountId));
    final conversation = base64Url.encode(utf8.encode(conversationId));
    return Directory('$root/account-$account/call-$conversation');
  }

  Future<void> save(
    String accountId,
    String conversationId,
    ConversationRecording recording,
  ) async {
    final directory = await _directory(accountId, conversationId);
    if (await directory.exists()) return;
    final parent = await directory.parent.create(recursive: true);
    final staged = await parent.createTemp('pending-');
    try {
      await File(
        '${staged.path}/recording.wav',
      ).writeAsBytes(recording.wav, flush: true);
      await File(
        '${staged.path}/segments.json',
      ).writeAsString(jsonEncode(recording.segments), flush: true);
      await staged.rename(directory.path);
    } on FileSystemException {
      // A repeated save for this conversation may have committed first.
      if (!await directory.exists()) rethrow;
    } finally {
      if (await staged.exists()) await staged.delete(recursive: true);
    }
  }

  Future<ConversationRecording?> read(
    String accountId,
    String conversationId,
  ) async {
    if (!Platform.isAndroid) return null;
    try {
      final directory = await _directory(accountId, conversationId);
      if (!await directory.exists()) return null;
      final wav = await File('${directory.path}/recording.wav').readAsBytes();
      final raw = await File('${directory.path}/segments.json').readAsString();
      final segments = jsonDecode(raw);
      if (wav.length <= 44 || segments is! List || segments.isEmpty) {
        return null;
      }
      final valid = <Json>[];
      for (final segment in segments) {
        if (segment is! Json) continue;
        final offset = segment['offsetMs'];
        final duration = segment['durationMs'];
        if (segment['itemId'] is String &&
            offset is num &&
            offset.isFinite &&
            offset >= 0 &&
            duration is num &&
            duration.isFinite &&
            duration > 0 &&
            offset + duration <= (wav.length - 44) / 32) {
          valid.add(segment);
        }
      }
      return valid.isEmpty ? null : ConversationRecording(wav, valid);
    } on FileSystemException {
      return null;
    } on FormatException {
      return null;
    } on PlatformException {
      return null;
    }
  }
}
