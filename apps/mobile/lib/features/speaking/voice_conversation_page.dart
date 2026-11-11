import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';
import 'speaking_controller.dart';
import 'speaking_repository.dart';
import 'conversation_message.dart';
import 'conversation_audio.dart';
import 'conversation_result_page.dart';
import 'conversation_settings_dialog.dart';
import 'conversation_timeline.dart';
import 'conversation_preparation.dart';

class VoiceConversationPage extends StatefulWidget {
  const VoiceConversationPage({
    super.key,
    required this.controller,
    required this.topic,
    this.showSettingsOnEntry = false,
  });
  final SpeakingController controller;
  final Json topic;
  final bool showSettingsOnEntry;
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
  final pendingTranscripts = <String>{};
  final audio = ConversationAudio();
  bool openingAssessment = false;
  bool hasPersistedUserTurns = false;
  bool settingsOpen = false;
  String? settingsUpdateId;
  Completer<bool>? settingsUpdate;
  ConversationSettings settings = const ConversationSettings();
  bool preparing = true;
  Json? preparedTopic;

  Future<void> captureSpeech(bool started, {String? itemId}) async {
    try {
      await audio.speech(started, itemId: itemId);
    } catch (_) {
      // A capture failure must not terminate the live conversation.
    }
  }

  Future<void> openSettings({bool startOnConfirm = true}) async {
    if (settingsOpen || connecting || ending || !widget.controller.active) {
      return;
    }
    if (!connected && requestId != null) {
      // Retry an unacknowledged request with its original preferences.
      if (startOnConfirm) await start();
      return;
    }
    final live = connected;
    setState(() => settingsOpen = true);
    final choice = await showDialog<ConversationSettings>(
      context: context,
      barrierDismissible: !live,
      builder: (_) => ConversationSettingsDialog(
        initial: settings,
        startOnConfirm: startOnConfirm && !live,
        onApplyLive: live ? applyLiveSettings : null,
      ),
    );
    if (!mounted) return;
    setState(() => settingsOpen = false);
    if (choice == null || !widget.controller.active || live) return;
    settings = choice;
    if (startOnConfirm) await start();
  }

  Future<void> applyLiveSettings(ConversationSettings choice) async {
    final relay = socket;
    if (!connected || ending || relay == null || settingsUpdate != null) {
      throw const ApiFailure('Cuộc gọi không còn sẵn sàng để cập nhật.');
    }
    final id = speakingRequestId();
    final reply = Completer<bool>();
    settingsUpdateId = id;
    settingsUpdate = reply;
    try {
      relay.add(
        jsonEncode({
          'type': 'settings.update',
          'requestId': id,
          'turnPause': choice.turnPause.name,
          'speechRate': choice.speechRate.name,
        }),
      );
      final applied = await reply.future.timeout(
        const Duration(seconds: 7),
        onTimeout: () => false,
      );
      if (!applied) {
        throw const ApiFailure('Chưa cập nhật được cài đặt. Hãy thử lại.');
      }
      settings = choice;
    } finally {
      settingsUpdateId = null;
      settingsUpdate = null;
    }
  }

  void returnToTalk() {
    if (ending || openingAssessment) return;
    unawaited(audio.clear().catchError((Object _) {}));
    setState(() {
      conversationId = null;
      turns.clear();
      hasPersistedUserTurns = false;
      seconds = 0;
      status = 'Sẵn sàng';
    });
  }

  void rememberUserTurns(Json row) {
    hasPersistedUserTurns = speakingItems(row['turns']).any(
      (turn) =>
          turn['role'] == 'USER' &&
          (turn['transcript'] as String? ?? '').trim().isNotEmpty,
    );
  }

  Future<void> showAssessment() async {
    final id = conversationId;
    if (id == null ||
        ending ||
        openingAssessment ||
        !widget.controller.active) {
      return;
    }
    setState(() => openingAssessment = true);
    try {
      final row = await repository.finishConversation(id);
      if (!mounted || !widget.controller.active) return;
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ConversationResultPage(
            controller: widget.controller,
            conversation: row,
            audio: audio,
          ),
        ),
      );
    } catch (error) {
      if (mounted && widget.controller.active) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              error is ApiFailure
                  ? error.message
                  : 'Chưa mở được bài chấm. Hãy thử lại.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => openingAssessment = false);
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (widget.showSettingsOnEntry) {
      preparing = false;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && widget.controller.active) unawaited(openSettings());
      });
    }
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
    if ((connected || connecting) &&
        (state == AppLifecycleState.paused ||
            state == AppLifecycleState.detached)) {
      unawaited(end());
    }
  }

  Future<void> end({
    bool updateUi = true,
    String reason = 'user_finished',
  }) async {
    if (ending) return;
    ending = true;
    final update = settingsUpdate;
    if (update != null && !update.isCompleted) update.complete(false);
    timer?.cancel();
    final id = conversationId;
    var finishFailed = false;
    if (connected && reason == 'user_finished' && widget.controller.active) {
      // Keep the control socket open while Azure finalizes the last reply.
      for (final track
          in microphone?.getAudioTracks() ?? <MediaStreamTrack>[]) {
        track.enabled = false;
      }
      if (mounted && updateUi) setState(() => status = 'Đang kết thúc');
      await Future<void>.delayed(const Duration(milliseconds: 1500));
      final wait = Stopwatch()..start();
      while (pendingTranscripts.isNotEmpty &&
          wait.elapsedMilliseconds < 1500 &&
          remoteEndReason == null) {
        await Future<void>.delayed(const Duration(milliseconds: 100));
      }
    }
    if (id != null && widget.controller.active && reason == 'user_finished') {
      try {
        final row = await repository
            .finishConversation(id)
            .timeout(const Duration(seconds: 5));
        rememberUserTurns(row);
        remoteEndReason ??= row['endReason']?.toString();
        requestId = null;
      } catch (_) {
        finishFailed = true;
      }
    }
    generation++;
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
        status = finishFailed
            ? 'Phiên đã dừng. Bạn có thể thử mở kết quả.'
            : cause == 'time_limit'
            ? 'Đã hết 3 phút'
            : cause == 'user_finished'
            ? 'Đã kết thúc'
            : 'Phiên bị gián đoạn';
      });
    }
    await oldSubscription?.cancel();
    await oldSocket?.close();
    try {
      await audio.stop();
    } catch (_) {
      await audio.clear();
    }
    if (!mounted || !widget.controller.active) await audio.clear();
    for (final track in oldMicrophone?.getTracks() ?? <MediaStreamTrack>[]) {
      await track.stop();
    }
    await oldMicrophone?.dispose();
    await oldPeer?.close();
    await oldPeer?.dispose();
    if (id != null && widget.controller.active && reason != 'user_finished') {
      try {
        final row = await repository
            .finishConversation(id)
            .timeout(const Duration(seconds: 5));
        rememberUserTurns(row);
        requestId = null;
      } catch (_) {
        // The server also closes interrupted calls on socket disconnect.
      }
    }
    pendingTranscripts.clear();
    ending = false;
    if (mounted && updateUi) setState(() {});
  }

  Future<void> start() async {
    if (!widget.controller.active || connecting || connected || ending) return;
    conversationId = null;
    hasPersistedUserTurns = false;
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
      try {
        await audio.start(stream.getAudioTracks().single.id!);
      } catch (_) {
        await audio.clear();
      }
      if (!mounted || current != generation) {
        await audio.clear();
        return;
      }
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
          final itemId = event['item_id'];
          if (itemId is String &&
              !turns.any((turn) => turn['itemId'] == itemId)) {
            pendingTranscripts.add(itemId);
          }
          unawaited(captureSpeech(true, itemId: event['item_id']?.toString()));
          socket?.add(
            jsonEncode({'type': 'timeline', 'itemId': event['item_id']}),
          );
          setState(() => status = 'Đang nghe · Bạn có thể nói');
        }
        if (event['type'] == 'input_audio_buffer.speech_stopped') {
          unawaited(captureSpeech(false));
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
            if (seconds >= 180) unawaited(end(reason: 'time_limit'));
          });
        }
      };
      requestId ??= speakingRequestId();
      final created = await repository.createConversation(
        widget.topic['id'] as String,
        requestId!,
        settings: settings,
      );
      final conversation = Map<String, dynamic>.from(
        created['conversation'] as Map,
      );
      final id = conversation['id'] as String;
      final ticket = created['connectTicket'];
      if (!mounted || current != generation || !widget.controller.active) {
        if (widget.controller.active) {
          await repository.finishConversation(id);
        }
        return;
      }
      conversationId = id;
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
          final update = settingsUpdate;
          if ((type == 'settings.updated' || type == 'settings.rejected') &&
              event['requestId'] == settingsUpdateId &&
              update != null &&
              !update.isCompleted) {
            update.complete(type == 'settings.updated');
          }
          if (type == 'conversation.ended') {
            remoteEndReason = event['reason']?.toString();
          }
          if (type == 'rtc.call.sdp.created' && !answer.isCompleted) {
            answer.complete(event['sdp_answer'] as String);
          }
          if (type == 'response.audio_transcript.done' ||
              type == 'conversation.item.input_audio_transcription.completed') {
            final text = event['transcript']?.toString() ?? '';
            final itemId = event['item_id']?.toString() ?? '';
            if (type ==
                'conversation.item.input_audio_transcription.completed') {
              pendingTranscripts.remove(itemId);
            }
            if (text.isNotEmpty) {
              setState(() {
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
    await end(reason: 'connection_lost');
    if (mounted) setState(() => status = 'Chưa kết nối được. Hãy thử lại.');
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    identityWatch?.cancel();
    unawaited(
      end(
        updateUi: false,
        reason: 'connection_lost',
      ).then((_) => audio.clear()),
    );
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (preparing) {
      return ConversationPreparation(
        controller: widget.controller,
        topicId: widget.topic['id'] as String,
        onStart: (topic) {
          if (!widget.controller.active || connecting || ending) return;
          setState(() {
            preparedTopic = topic;
            preparing = false;
          });
          unawaited(openSettings());
        },
      );
    }
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      appBar: AppBar(
        title: const Text('Hội thoại AI'),
        actions: [
          IconButton(
            tooltip: 'Cài đặt trò chuyện',
            icon: const Icon(Icons.settings_outlined),
            onPressed:
                widget.controller.active &&
                    !connecting &&
                    !ending &&
                    !settingsOpen &&
                    (connected || requestId == null)
                ? () => openSettings(startOnConfirm: false)
                : null,
          ),
        ],
        titleTextStyle: designHeading(18),
        backgroundColor: AppColors.grey25,
        scrolledUnderElevation: 0,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              margin: const EdgeInsets.fromLTRB(16, 8, 16, 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.grey5,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.grey100),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: AppColors.primary25,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.forum_outlined,
                          color: AppColors.primary700,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          (preparedTopic ?? widget.topic)['text']?.toString() ??
                              '',
                          style: designHeading(18),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')} / 3:00',
                        style: designText(
                          13,
                          color: AppColors.grey800,
                          weight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: (seconds / 180).clamp(0.0, 1.0),
                      minHeight: 4,
                      backgroundColor: AppColors.grey200,
                      color: AppColors.primary500,
                    ),
                  ),
                  const SizedBox(height: 12),
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
                      child: SingleChildScrollView(
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
                  : ConversationTimeline(
                      revision: turns.map((turn) => turn['itemId']).join('|'),
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
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (!connected && !connecting && conversationId != null) ...[
                    if (hasPersistedUserTurns ||
                        turns.any((turn) => turn['isUser'] == true))
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF1A2029),
                            foregroundColor: Colors.white,
                          ),
                          onPressed:
                              ending ||
                                  openingAssessment ||
                                  !widget.controller.active
                              ? null
                              : showAssessment,
                          icon: const Icon(Icons.fact_check_outlined),
                          label: Text(
                            openingAssessment
                                ? 'Đang mở kết quả…'
                                : 'Chấm điểm hội thoại',
                          ),
                        ),
                      ),
                    const SizedBox(height: 8),
                    TextButton(
                      style: TextButton.styleFrom(
                        minimumSize: const Size(48, 48),
                      ),
                      onPressed: ending || openingAssessment
                          ? null
                          : returnToTalk,
                      child: const Text('Quay lại màn hình trò chuyện'),
                    ),
                  ] else
                    Row(
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
                              onPressed: ending
                                  ? null
                                  : () => setState(() {
                                      muted = !muted;
                                      unawaited(
                                        audio
                                            .mute(muted)
                                            .catchError((Object _) {}),
                                      );
                                      for (final track
                                          in microphone!.getAudioTracks()) {
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
                              onPressed:
                                  !widget.controller.active ||
                                      ending ||
                                      settingsOpen
                                  ? null
                                  : connected || connecting
                                  ? end
                                  : openSettings,
                              icon: Icon(
                                connected || connecting
                                    ? Icons.call_end_rounded
                                    : Icons.mic_rounded,
                              ),
                              label: Text(
                                ending
                                    ? 'Đang kết thúc…'
                                    : connecting
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
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
