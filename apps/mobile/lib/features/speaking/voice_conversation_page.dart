import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../../core/api/api_client.dart';
import 'speaking_controller.dart';
import 'speaking_repository.dart';
import 'conversation_message.dart';

class VoiceConversationPage extends StatefulWidget {
  const VoiceConversationPage({
    super.key,
    required this.controller,
    required this.topic,
  });
  final SpeakingController controller;
  final Json topic;
  @override
  State<VoiceConversationPage> createState() => _VoiceConversationPageState();
}

class _VoiceConversationPageState extends State<VoiceConversationPage>
    with WidgetsBindingObserver {
  RTCPeerConnection? peer;
  MediaStream? microphone;
  WebSocket? socket;
  StreamSubscription<dynamic>? subscription;
  Timer? timer;
  Timer? identityWatch;
  String? conversationId;
  String? requestId;
  bool ending = false;
  String? remoteEndReason;
  SpeakingRepository get repository => widget.controller.repository;
  bool connecting = false;
  bool connected = false;
  bool muted = false;
  int seconds = 0;
  int generation = 0;
  String status = 'Sẵn sàng';
  final turns = <Json>[];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    identityWatch = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!widget.controller.active) {
        identityWatch?.cancel();
        turns.clear();
        unawaited(end());
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      unawaited(end());
    }
  }

  Future<void> end({
    bool updateUi = true,
    String reason = 'user_finished',
  }) async {
    if (ending) return;
    ending = true;
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
        final cause = remoteEndReason ?? reason;
        status = cause == 'time_limit'
            ? 'Đã hết 3 phút'
            : cause == 'user_finished'
            ? 'Đã kết thúc'
            : 'Phiên bị gián đoạn';
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
    final id = conversationId;
    if (id != null && widget.controller.active) {
      try {
        await repository.finishConversation(id);
        requestId = null;
      } catch (_) {
        if (mounted && updateUi) {
          setState(
            () => status =
                'Phiên đã dừng. Mở lịch sử để kiểm tra trạng thái lưu.',
          );
        }
      }
    }
    ending = false;
  }

  Future<void> start() async {
    if (!widget.controller.active || ending) return;
    conversationId = null;
    remoteEndReason = null;
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
      data.onMessage = (message) {
        if (!mounted || current != generation) return;
        final event = jsonDecode(message.text) as Map;
        if (event['type'] == 'input_audio_buffer.speech_started') {
          socket?.add(
            jsonEncode({'type': 'timeline', 'itemId': event['item_id']}),
          );
          setState(() => status = 'Đang nghe · Bạn có thể nói');
        }
        if (event['type'] == 'response.output_item.added') {
          socket?.add(
            jsonEncode({
              'type': 'timeline',
              'itemId': (event['item'] as Map?)?['id'],
            }),
          );
          setState(() => status = 'lingoRoad đang trả lời');
        }
        if (event['type'] == 'response.done') {
          setState(() => status = 'Đang nghe · Bạn có thể nói');
        }
      };
      data.onDataChannelState = (state) {
        if (state == RTCDataChannelState.RTCDataChannelOpen &&
            current == generation &&
            mounted) {
          setState(() {
            connected = true;
            connecting = false;
            status = 'Đang nghe · Bạn có thể nói';
          });
          socket?.add(jsonEncode({'type': 'ready'}));
          timer = Timer.periodic(const Duration(seconds: 1), (_) {
            if (mounted) setState(() => seconds++);
            if (seconds >= 180) unawaited(end());
          });
        }
      };
      requestId ??= speakingRequestId();
      final created = await repository.createConversation(
        widget.topic['id'] as String,
        requestId!,
      );
      final conversation = Map<String, dynamic>.from(
        created['conversation'] as Map,
      );
      conversationId = conversation['id'] as String;
      final ticket = created['connectTicket'];
      if (!mounted || current != generation || !widget.controller.active) {
        if (widget.controller.active) {
          await repository.finishConversation(conversationId!);
        }
        return;
      }
      if (ticket == null) {
        throw const ApiFailure(
          'Phiên đã kết thúc. Hãy mở lịch sử hoặc bắt đầu lại.',
        );
      }
      final relay = await WebSocket.connect(
        repository.conversationSocket.toString(),
      );
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
          if (type == 'conversation.ended') {
            remoteEndReason = event['reason']?.toString();
          }
          if (type == 'rtc.call.sdp.created' && !answer.isCompleted) {
            answer.complete(event['sdp_answer'] as String);
          }
          if (type == 'response.audio_transcript.done' ||
              type == 'conversation.item.input_audio_transcription.completed') {
            final text = event['transcript']?.toString() ?? '';
            if (text.isNotEmpty) {
              setState(() {
                final itemId = event['item_id']?.toString() ?? '';
                if (turns.any((turn) => turn['itemId'] == itemId)) return;
                turns.add({
                  'itemId': itemId,
                  'text': text,
                  'isUser':
                      type ==
                      'conversation.item.input_audio_transcription.completed',
                  'sequence': event['sequence'] ?? turns.length,
                });
                turns.sort(
                  (a, b) =>
                      (a['sequence'] as int).compareTo(b['sequence'] as int),
                );
              });
            }
          }
          if (type == 'error') unawaited(fail());
        },
        onDone: () {
          if (current == generation) unawaited(end(reason: 'connection_lost'));
        },
        onError: (_) => unawaited(fail()),
      );
      await connection.setLocalDescription(await connection.createOffer());
      await Future<void>.delayed(const Duration(seconds: 3));
      if (current != generation) return;
      final local = await connection.getLocalDescription();
      relay.add(jsonEncode({'ticket': ticket, 'sdp': local!.sdp}));
      final remote = await answer.future.timeout(const Duration(seconds: 40));
      if (current != generation) return;
      await connection.setRemoteDescription(
        RTCSessionDescription(remote, 'answer'),
      );
    } catch (error) {
      if (current == generation) {
        await fail();
        if (mounted && error is ApiFailure) {
          setState(() => status = error.message);
        }
      }
    }
  }

  Future<void> fail() async {
    await end();
    if (mounted) setState(() => status = 'Chưa kết nối được. Hãy thử lại.');
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    identityWatch?.cancel();
    unawaited(end(updateUi: false));
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF4F7FB),
    appBar: AppBar(
      title: const Text('Hội thoại AI'),
      backgroundColor: const Color(0xFFF4F7FB),
    ),
    body: SafeArea(
      child: Column(
        children: [
          Container(
            margin: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E7EF)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.forum_outlined,
                      color: Color(0xFF287C47),
                      size: 22,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        widget.topic['text']?.toString() ?? '',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')} / 3:00',
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF5B6574),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Container(
                      width: 7,
                      height: 7,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: connected
                            ? const Color(0xFF59B070)
                            : const Color(0xFF9CA6B4),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        muted && connected ? 'Micro đang tắt' : status,
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF5B6574),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: turns.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: const BoxDecoration(
                              color: Color(0xFFE6F5EC),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.record_voice_over_rounded,
                              size: 36,
                              color: Color(0xFF287C47),
                            ),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Cùng bắt đầu câu chuyện',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            'Trả lời từng câu hỏi bằng tiếng Anh. Chạm nút dịch dưới lời AI khi bạn cần hỗ trợ.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 15,
                              height: 1.5,
                              color: Color(0xFF5B6574),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    children: [
                      for (final turn in turns)
                        ConversationMessage(
                          key: ValueKey(turn['itemId']),
                          isUser: turn['isUser'] as bool,
                          text: turn['text'] as String,
                          onTranslate: turn['isUser'] == true
                              ? null
                              : () {
                                  if (!widget.controller.active ||
                                      conversationId == null) {
                                    throw const ApiFailure(
                                      'Phiên đăng nhập đã thay đổi.',
                                    );
                                  }
                                  return repository.translateConversationTurn(
                                    conversationId!,
                                    turn['itemId'] as String,
                                  );
                                },
                        ),
                    ],
                  ),
          ),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFE2E7EF))),
            ),
            child: Row(
              children: [
                if (connected) ...[
                  SizedBox(
                    height: 52,
                    width: 56,
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        padding: EdgeInsets.zero,
                        foregroundColor: const Color(0xFF287C47),
                      ),
                      onPressed: () => setState(() {
                        muted = !muted;
                        for (final track in microphone!.getAudioTracks()) {
                          track.enabled = !muted;
                        }
                      }),
                      child: Tooltip(
                        message: muted ? 'Bật micro' : 'Tắt micro',
                        child: Icon(muted ? Icons.mic_off : Icons.mic),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: SizedBox(
                    height: 52,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF1A2029),
                        foregroundColor: Colors.white,
                      ),
                      onPressed: !widget.controller.active
                          ? null
                          : connected || connecting
                          ? end
                          : start,
                      icon: Icon(
                        connected || connecting
                            ? Icons.call_end_rounded
                            : Icons.mic_rounded,
                      ),
                      label: Text(
                        connecting
                            ? 'Hủy kết nối'
                            : connected
                            ? 'Kết thúc'
                            : 'Bắt đầu hội thoại',
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}
