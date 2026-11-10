import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:mobile/core/theme/app_theme.dart';

void main() => runApp(
  MaterialApp(theme: AppTheme.lightTheme, home: const VoiceLiveDevicePage()),
);

class VoiceLiveDevicePage extends StatefulWidget {
  const VoiceLiveDevicePage({super.key});
  @override
  State<VoiceLiveDevicePage> createState() => _VoiceLiveDevicePageState();
}

class _VoiceLiveDevicePageState extends State<VoiceLiveDevicePage>
    with WidgetsBindingObserver {
  RTCPeerConnection? peer;
  MediaStream? microphone;
  WebSocket? socket;
  StreamSubscription<dynamic>? subscription;
  Timer? timer;
  bool connecting = false;
  bool connected = false;
  bool muted = false;
  int seconds = 0;
  int generation = 0;
  String status = 'Sẵn sàng';
  final turns = <String>[];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) unawaited(end());
  }

  Future<void> end({bool updateUi = true}) async {
    generation++;
    timer?.cancel();
    final oldPeer = peer;
    final oldMicrophone = microphone;
    final oldSocket = socket;
    final oldSubscription = subscription;
    peer = null;
    microphone = null;
    socket = null;
    subscription = null;
    if (mounted && updateUi) {
      setState(() {
        connected = false;
        connecting = false;
        status = 'Đã kết thúc';
      });
    }
    await oldSubscription?.cancel();
    await oldSocket?.close();
    for (final track in oldMicrophone?.getTracks() ?? <MediaStreamTrack>[]) {
      await track.stop();
    }
    await oldMicrophone?.dispose();
    await oldPeer?.close();
    await oldPeer?.dispose();
  }

  Future<void> start() async {
    final current = ++generation;
    setState(() {
      connecting = true;
      status = 'Đang kết nối';
      turns.clear();
      seconds = 0;
      muted = false;
    });
    try {
      final connection = await createPeerConnection({});
      if (!mounted || current != generation) {
        await connection.dispose();
        return;
      }
      peer = connection;
      final stream = await navigator.mediaDevices.getUserMedia({
        'audio': {'echoCancellation': true, 'noiseSuppression': true},
        'video': false,
      });
      if (!mounted || current != generation) {
        for (final track in stream.getTracks()) {
          await track.stop();
        }
        await stream.dispose();
        return;
      }
      microphone = stream;
      for (final track in stream.getTracks()) {
        await connection.addTrack(track, stream);
      }
      final answer = Completer<String>();
      final data = await connection.createDataChannel(
        'voice-live-events',
        RTCDataChannelInit(),
      );
      data.onDataChannelState = (state) {
        if (state == RTCDataChannelState.RTCDataChannelOpen &&
            current == generation &&
            mounted) {
          setState(() {
            connected = true;
            connecting = false;
            status = 'Đang nghe · Bạn có thể nói';
          });
          socket?.add(jsonEncode({'type': 'response.create'}));
          timer = Timer.periodic(const Duration(seconds: 1), (_) {
            if (mounted) setState(() => seconds++);
            if (seconds >= 180) unawaited(end());
          });
        }
      };
      const token = String.fromEnvironment('VOICE_LIVE_DEVICE_TOKEN');
      final relay = await WebSocket.connect('ws://127.0.0.1:8767/$token');
      if (!mounted || current != generation) {
        await relay.close();
        return;
      }
      socket = relay;
      subscription = relay.listen(
        (dynamic raw) {
          if (!mounted || current != generation) return;
          final event = jsonDecode(raw as String) as Map;
          final type = event['type'];
          if (type == 'rtc.call.sdp.created' && !answer.isCompleted) {
            answer.complete(event['sdp_answer'] as String);
          }
          if (type == 'response.audio_transcript.done' ||
              type == 'conversation.item.input_audio_transcription.completed') {
            final text = event['transcript']?.toString() ?? '';
            if (text.isNotEmpty) {
              setState(
                () => turns.add(
                  '${type == 'response.audio_transcript.done' ? 'lingoRoad' : 'Bạn'}\n$text',
                ),
              );
            }
          }
          if (type == 'error') unawaited(fail());
        },
        onDone: () {
          if (current == generation) unawaited(end());
        },
        onError: (_) => unawaited(fail()),
      );
      await connection.setLocalDescription(await connection.createOffer());
      await Future<void>.delayed(const Duration(seconds: 3));
      if (current != generation) return;
      final local = await connection.getLocalDescription();
      relay.add(
        jsonEncode({'type': 'rtc.call.sdp.create', 'sdp_offer': local!.sdp}),
      );
      final remote = await answer.future.timeout(const Duration(seconds: 40));
      if (current != generation) return;
      await connection.setRemoteDescription(
        RTCSessionDescription(remote, 'answer'),
      );
    } catch (_) {
      if (current == generation) await fail();
    }
  }

  Future<void> fail() async {
    await end();
    if (mounted) setState(() => status = 'Chưa kết nối được. Hãy thử lại.');
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(end(updateUi: false));
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Hội thoại AI')),
    body: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            const Text(
              'Giới thiệu bản thân',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            const Text(
              'Phiên kiểm thử · Tối đa 3 phút',
              style: TextStyle(color: Color(0xFF5B6574)),
            ),
            const SizedBox(height: 16),
            Text(
              '$status · ${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}',
            ),
            const SizedBox(height: 12),
            Expanded(
              child: ListView(
                children: [
                  for (final turn in turns)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Text(turn, style: const TextStyle(fontSize: 16)),
                      ),
                    ),
                ],
              ),
            ),
            if (connected)
              OutlinedButton.icon(
                onPressed: () => setState(() {
                  muted = !muted;
                  for (final track in microphone!.getAudioTracks()) {
                    track.enabled = !muted;
                  }
                }),
                icon: Icon(muted ? Icons.mic_off : Icons.mic),
                label: Text(muted ? 'Bật micro' : 'Tắt micro'),
              ),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton(
                onPressed: connecting
                    ? null
                    : connected
                    ? end
                    : start,
                child: Text(
                  connecting
                      ? 'Đang kết nối…'
                      : connected
                      ? 'Kết thúc'
                      : 'Bắt đầu hội thoại',
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
