import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:integration_test/integration_test.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets(
    'real Voice Live Android microphone and remote audio',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Center(child: Text('lingoRoad · Kiểm chứng hội thoại AI')),
          ),
        ),
      );
      await tester.runAsync(() async {
        const token = String.fromEnvironment('VOICE_LIVE_DEVICE_TOKEN');
        expect(token, isNotEmpty);
        final peer = await createPeerConnection({});
        MediaStream? microphone;
        WebSocket? socket;
        StreamSubscription<dynamic>? subscription;
        final answer = Completer<String>();
        final channelOpen = Completer<void>();
        final errors = <String>[];
        try {
          microphone = await navigator.mediaDevices.getUserMedia({
            'audio': {'echoCancellation': true, 'noiseSuppression': true},
            'video': false,
          });
          expect(microphone.getAudioTracks(), hasLength(1));
          for (final track in microphone.getTracks()) {
            await peer.addTrack(track, microphone);
          }
          final channel = await peer.createDataChannel(
            'voice-live-events',
            RTCDataChannelInit(),
          );
          channel.onDataChannelState = (state) {
            if (state == RTCDataChannelState.RTCDataChannelOpen &&
                !channelOpen.isCompleted) {
              channelOpen.complete();
            }
          };
          channel.onMessage = (message) {
            final event = jsonDecode(message.text) as Map;
            if (event['type'] == 'error') {
              errors.add('data_channel_provider_error');
            }
          };
          socket = await WebSocket.connect('ws://127.0.0.1:8767/$token');
          subscription = socket.listen((dynamic raw) {
            final event = jsonDecode(raw as String) as Map;
            if (event['type'] == 'rtc.call.sdp.created' &&
                !answer.isCompleted) {
              answer.complete(event['sdp_answer'] as String);
            }
            if (event['type'] == 'error') {
              errors.add(
                (event['error'] as Map?)?['code']?.toString() ??
                    'provider_error',
              );
            }
          });
          final offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          await Future<void>.delayed(const Duration(seconds: 3));
          final local = await peer.getLocalDescription();
          socket.add(
            jsonEncode({
              'type': 'rtc.call.sdp.create',
              'sdp_offer': local!.sdp,
            }),
          );
          final remote = await answer.future.timeout(
            const Duration(seconds: 40),
          );
          await peer.setRemoteDescription(
            RTCSessionDescription(remote, 'answer'),
          );
          await channelOpen.future.timeout(const Duration(seconds: 30));
          socket.add(jsonEncode({'type': 'response.create'}));
          num inboundBytes = 0;
          num outboundBytes = 0;
          for (var attempt = 0; attempt < 25; attempt++) {
            await Future<void>.delayed(const Duration(seconds: 1));
            for (final report in await peer.getStats()) {
              if (report.type == 'inbound-rtp') {
                inboundBytes =
                    (report.values['bytesReceived'] as num?) ?? inboundBytes;
              }
              if (report.type == 'outbound-rtp') {
                outboundBytes =
                    (report.values['bytesSent'] as num?) ?? outboundBytes;
              }
            }
            if (inboundBytes > 0 && outboundBytes > 0) break;
          }
          expect(errors, isEmpty);
          expect(
            outboundBytes,
            greaterThan(0),
            reason: 'Android microphone RTP must leave device',
          );
          expect(
            inboundBytes,
            greaterThan(0),
            reason: 'Real provider audio RTP must reach device',
          );
          // Bytes verify transport. Human listening and pronunciation quality need a separate acceptance run.
        } finally {
          await subscription?.cancel();
          await socket?.close();
          for (final track in microphone?.getTracks() ?? <MediaStreamTrack>[]) {
            await track.stop();
          }
          await microphone?.dispose();
          await peer.close();
          await peer.dispose();
        }
      });
    },
    timeout: const Timeout(Duration(minutes: 3)),
  );
}
