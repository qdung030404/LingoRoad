import 'dart:io';
import 'dart:typed_data';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

Future<void> _deleteSpeakingFile(File file) async {
  try {
    await file.delete();
  } on PathNotFoundException {
    // Another session cleanup may already have removed this temporary file.
  }
}

/// Keep only complete PCM frames and cap the actual WAV, not just the UI timer.
Uint8List limitSpeakingWav(Uint8List bytes, {int maxSeconds = 30}) {
  if (bytes.length < 44) throw const FormatException('Invalid WAV');
  final input = ByteData.sublistView(bytes);
  String tag(int offset) =>
      String.fromCharCodes(bytes.sublist(offset, offset + 4));
  if (tag(0) != 'RIFF' || tag(8) != 'WAVE') {
    throw const FormatException('Invalid WAV');
  }
  int? start, size;
  bool validFormat = false;
  for (var pos = 12; pos + 8 <= bytes.length;) {
    final length = input.getUint32(pos + 4, Endian.little);
    final end = pos + 8 + length;
    if (end > bytes.length) throw const FormatException('Truncated WAV');
    if (tag(pos) == 'fmt ' && length >= 16) {
      validFormat =
          input.getUint16(pos + 8, Endian.little) == 1 &&
          input.getUint16(pos + 10, Endian.little) == 1 &&
          input.getUint32(pos + 12, Endian.little) == 16000 &&
          input.getUint16(pos + 22, Endian.little) == 16;
    }
    if (tag(pos) == 'data') {
      start = pos + 8;
      size = length;
      break;
    }
    pos = end + (length.isOdd ? 1 : 0);
  }
  if (!validFormat || start == null || size == null || size < 2) {
    throw const FormatException('Expected PCM16 mono 16kHz WAV');
  }
  final length = size.clamp(0, maxSeconds * 16000 * 2) ~/ 2 * 2;
  final out = Uint8List(44 + length);
  final header = ByteData.sublistView(out);
  out.setRange(0, 4, 'RIFF'.codeUnits);
  header.setUint32(4, 36 + length, Endian.little);
  out.setRange(8, 16, 'WAVEfmt '.codeUnits);
  header.setUint32(16, 16, Endian.little);
  header.setUint16(20, 1, Endian.little);
  header.setUint16(22, 1, Endian.little);
  header.setUint32(24, 16000, Endian.little);
  header.setUint32(28, 32000, Endian.little);
  header.setUint16(32, 2, Endian.little);
  header.setUint16(34, 16, Endian.little);
  out.setRange(36, 40, 'data'.codeUnits);
  header.setUint32(40, length, Endian.little);
  out.setRange(44, out.length, bytes, start);
  return out;
}

/// Called once before runApp, when no recorder can be active.
Future<void> cleanStaleSpeakingAudio({Directory? temporaryDirectory}) async {
  final temporary = temporaryDirectory ?? await getTemporaryDirectory();
  await cleanSharedSpeakingAudio(temporaryDirectory: temporary);
  final owned = Directory('${temporary.path}/lingoroad-speaking');
  if (!await owned.exists()) return;
  await for (final entity in owned.list(recursive: true, followLinks: false)) {
    if (entity is File &&
        (entity.path.endsWith('.wav') ||
            entity.uri.pathSegments.last.startsWith(
                  'lingoroad-speaking-result-',
                ) &&
                entity.path.endsWith('.json'))) {
      await _deleteSpeakingFile(entity);
    }
  }
}

/// share_plus copies exported WAVs here on Android. Only our named files belong
/// to Speaking, so other features' shared files stay outside this cleanup.
Future<void> cleanSharedSpeakingAudio({Directory? temporaryDirectory}) async {
  final temporary = temporaryDirectory ?? await getTemporaryDirectory();
  final shared = Directory('${temporary.path}/share_plus');
  if (!await shared.exists()) return;
  await for (final file in shared.list(followLinks: false)) {
    final name = file.uri.pathSegments.last;
    if (file is File &&
        name.startsWith('lingoroad-speaking-') &&
        (name.endsWith('.wav') || name.endsWith('.json'))) {
      await _deleteSpeakingFile(file);
    }
  }
}

abstract class SpeakingRecorder {
  Stream<double> get amplitudes;
  Future<bool> hasPermission();
  Future<void> start();
  Future<String?> stop();
  Future<void> clear();
  Future<void> dispose();
}

class DeviceSpeakingRecorder implements SpeakingRecorder {
  DeviceSpeakingRecorder(this.accountId);
  final String accountId;
  int maxSeconds = 30;
  AudioRecorder? _native;
  AudioRecorder get _recorder => _native ??= AudioRecorder();
  @override
  Stream<double> get amplitudes => _recorder
      .onAmplitudeChanged(const Duration(milliseconds: 80))
      .map((amplitude) => amplitude.current);
  Directory? _directory;
  bool _recording = false;
  Future<Directory> _folder() async {
    if (_directory != null) return _directory!;
    final root = await getTemporaryDirectory();
    final id = accountId.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    return _directory = await Directory(
      '${root.path}/lingoroad-speaking/$id',
    ).create(recursive: true);
  }

  @override
  Future<bool> hasPermission() => _recorder.hasPermission();
  @override
  Future<void> start() async {
    await clear();
    final directory = await _folder();
    await _recorder.start(
      const RecordConfig(
        encoder: AudioEncoder.wav,
        sampleRate: 16000,
        numChannels: 1,
      ),
      path:
          '${directory.path}/lingoroad-speaking-${DateTime.now().microsecondsSinceEpoch}.wav',
    );
    _recording = true;
  }

  @override
  Future<String?> stop() async {
    if (!_recording) return null;
    _recording = false;
    final path = await _recorder.stop();
    if (path != null) {
      final file = File(path);
      final wav = limitSpeakingWav(
        await file.readAsBytes(),
        maxSeconds: maxSeconds,
      );
      await file.writeAsBytes(wav, flush: true);
    }
    return path;
  }

  @override
  Future<void> clear() async {
    if (_recording) {
      await _recorder.cancel();
      _recording = false;
    }
    final directory = _directory;
    if (directory == null) return;
    await cleanSharedSpeakingAudio();
    await for (final file in directory.list(followLinks: false)) {
      if (file is File &&
          (file.path.endsWith('.wav') ||
              file.uri.pathSegments.last.startsWith(
                    'lingoroad-speaking-result-',
                  ) &&
                  file.path.endsWith('.json'))) {
        await _deleteSpeakingFile(file);
      }
    }
  }

  @override
  Future<void> dispose() async {
    await clear();
    await _native?.dispose();
  }
}
