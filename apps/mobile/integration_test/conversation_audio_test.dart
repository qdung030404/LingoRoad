import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mobile/features/speaking/conversation_audio.dart';
import 'package:mobile/features/speaking/speaking_recorder.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'captures existing WebRTC microphone as bounded PCM WAV and deletes it',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: Text('Kiểm tra micro hội thoại')),
        ),
      );
      await tester.runAsync(() async {
        final peer = await createPeerConnection({});
        final receiver = await createPeerConnection({});
        final audio = ConversationAudio();
        MediaStream? stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            'audio': true,
            'video': false,
          });
          final track = stream.getAudioTracks().single;
          await peer.addTrack(track, stream);
          await peer.setLocalDescription(await peer.createOffer());
          await Future<void>.delayed(const Duration(seconds: 2));
          await receiver.setRemoteDescription(
            (await peer.getLocalDescription())!,
          );
          await receiver.setLocalDescription(await receiver.createAnswer());
          await Future<void>.delayed(const Duration(seconds: 2));
          await peer.setRemoteDescription(
            (await receiver.getLocalDescription())!,
          );
          await Future<void>.delayed(const Duration(seconds: 2));
          await audio.start(track.id!);
          await Future<void>.delayed(const Duration(milliseconds: 500));
          await audio.speech(true, itemId: 'user-turn-1');
          await Future<void>.delayed(const Duration(seconds: 1));
          await audio.speech(false);
          final path = await audio.stop();
          expect(path, isNotNull);
          expect(audio.segments.single['itemId'], 'user-turn-1');
          final file = File(path!);
          final bytes = await file.readAsBytes();
          expect(bytes.length, greaterThan(32000));
          expect(limitSpeakingWav(bytes, maxSeconds: 180), bytes);
          await audio.clear();
          expect(await file.exists(), isFalse);
          // No provider is called. These checks cover capture and cleanup, not speech quality.
        } finally {
          await audio.clear();
          for (final track in stream?.getTracks() ?? <MediaStreamTrack>[]) {
            await track.stop();
          }
          await stream?.dispose();
          await peer.close();
          await peer.dispose();
          await receiver.close();
          await receiver.dispose();
        }
      });
    },
  );
}
