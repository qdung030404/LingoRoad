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
import 'conversation_live_view.dart';
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
    this.skipPreparation = false,
  });
  final SpeakingController controller;
  final Json topic;
  final bool skipPreparation;
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
  bool recording = false;
  Stream<double>? amplitudes;
  final drafts = <String, String>{};
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

  Future<void> openSettings() async {
    if (settingsOpen || connecting || ending || !widget.controller.active) {
      return;
    }
    if (!connected && requestId != null) return;
    final live = connected;
    setState(() => settingsOpen = true);
    final choice = await showDialog<ConversationSettings>(
      context: context,
      barrierColor: AppColors.grey900.withValues(alpha: 0.5),
      barrierDismissible: false,
      builder: (_) => ConversationSettingsDialog(
        initial: settings,
        onApplyLive: live ? applyLiveSettings : null,
      ),
    );
    if (!mounted) return;
    setState(() => settingsOpen = false);
    if (choice == null || !widget.controller.active || live) return;
    settings = choice;
  }

  void setMicEnabled(bool enabled) {
    if (enabled) {
      unawaited(audio.mute(false).catchError((Object _) {}));
    }
    for (final track in microphone?.getAudioTracks() ?? <MediaStreamTrack>[]) {
      track.enabled = enabled;
    }
    if (!enabled) {
      unawaited(audio.mute(true).catchError((Object _) {}));
    }
  }

  void toggleRecording() {
    if (!connected || ending || microphone == null) return;
    setState(() {
      recording = !recording;
      amplitudes = recording ? audio.amplitudes() : null;
      drafts.clear();
    });
    setMicEnabled(recording);
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
    preparing = !widget.skipPreparation;
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
    recording = false;
    amplitudes = null;
    drafts.clear();
    setMicEnabled(false);
    final update = settingsUpdate;
    if (update != null && !update.isCompleted) update.complete(false);
    timer?.cancel();
    final id = conversationId;
    var finishFailed = false;
    if (connected && reason == 'user_finished' && widget.controller.active) {
      // Keep the control socket open while Azure finalizes the last reply.
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
      drafts.clear();
      seconds = 0;
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
      final input = stream.getAudioTracks().single;
      input.enabled = false;
      try {
        await audio.start(input.id!, muted: true);
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
        final type = event['type'];
        final itemId = event['item_id'];
        if (type == 'input_audio_buffer.speech_started') {
          if (itemId is String &&
              !turns.any((turn) => turn['itemId'] == itemId)) {
            pendingTranscripts.add(itemId);
          }
          unawaited(captureSpeech(true, itemId: event['item_id']?.toString()));
          socket?.add(
            jsonEncode({'type': 'timeline', 'itemId': event['item_id']}),
          );
        }
        if (type == 'input_audio_buffer.speech_stopped') {
          unawaited(captureSpeech(false));
        }
        if (type == 'conversation.item.input_audio_transcription.delta' &&
            recording &&
            itemId is String &&
            pendingTranscripts.contains(itemId) &&
            event['delta'] is String) {
          setState(
            () => drafts.update(
              itemId,
              (previous) => previous + (event['delta'] as String),
              ifAbsent: () => event['delta'] as String,
            ),
          );
        }
        if (type == 'conversation.item.input_audio_transcription.failed') {
          pendingTranscripts.remove(itemId);
          if (drafts.containsKey(itemId)) setState(() => drafts.remove(itemId));
        }
        if (type == 'response.output_item.added') {
          socket?.add(
            jsonEncode({
              'type': 'timeline',
              'itemId': (event['item'] as Map?)?['id'],
            }),
          );
          if (!ending) setState(() => status = 'Lingo đang trả lời');
        }
        if (type == 'response.done' && !ending) {
          setState(() => status = 'Sẵn sàng');
        }
      };
      data.onDataChannelState = (state) {
        if (state == RTCDataChannelState.RTCDataChannelOpen &&
            current == generation &&
            !ending &&
            !connected &&
            mounted) {
          setState(() {
            connected = true;
            connecting = false;
            status = 'Sẵn sàng';
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
            if (text.isNotEmpty || drafts.containsKey(itemId)) {
              setState(() {
                drafts.remove(itemId);
                if (text.isEmpty ||
                    turns.any((turn) => turn['itemId'] == itemId)) {
                  return;
                }
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
        },
      );
    }
    final canStart = widget.controller.active && !ending && !settingsOpen;
    final ended = !connected && !connecting && conversationId != null;
    final hasReply =
        hasPersistedUserTurns || turns.any((turn) => turn['isUser'] == true);
    return Scaffold(
      backgroundColor: AppColors.grey25,
      appBar: AppBar(
        centerTitle: true,
        automaticallyImplyLeading: false,
        leading: IconButton(
          tooltip: MaterialLocalizations.of(context).backButtonTooltip,
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const ConversationLiveIcon('back'),
        ),
        actions: [
          IconButton(
            tooltip: 'Cài đặt trò chuyện',
            icon: ConversationLiveIcon(
              'settings',
              color: canStart && !connecting && (connected || requestId == null)
                  ? null
                  : AppColors.grey500,
            ),
            onPressed:
                canStart && !connecting && (connected || requestId == null)
                ? openSettings
                : null,
          ),
        ],
        title: Text(
          'Hội thoại AI',
          style: designText(18, weight: FontWeight.w500),
        ),
        backgroundColor: AppColors.grey25,
        scrolledUnderElevation: 0,
      ),
      body: SafeArea(
        top: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            ConversationCallHeader(
              topic:
                  (preparedTopic ?? widget.topic)['text']?.toString() ??
                  'Hội thoại AI',
              seconds: seconds,
              status: recording ? 'Đang ghi âm' : status,
              active: connected && !ending,
            ),
            Expanded(
              child: turns.isEmpty
                  ? const ConversationWelcome()
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
            if (ended)
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 4),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (hasReply)
                      FilledButton(
                        style: conversationPrimaryAction(18),
                        onPressed: canStart && !openingAssessment
                            ? showAssessment
                            : null,
                        child: Text(
                          openingAssessment
                              ? 'Đang mở kết quả…'
                              : 'Chấm điểm hội thoại',
                        ),
                      ),
                    TextButton(
                      onPressed: ending || openingAssessment
                          ? null
                          : returnToTalk,
                      child: const Text('Quay lại màn hình trò chuyện'),
                    ),
                  ],
                ),
              )
            else
              ConversationCallActions(
                connected: connected,
                recording: recording,
                engaged: connected || connecting,
                amplitudes: amplitudes,
                draft: drafts.isEmpty ? '' : drafts.values.last,
                onToggleMic: ending ? null : toggleRecording,
                onAction: !canStart
                    ? null
                    : connected || connecting
                    ? end
                    : start,
                actionLabel: ending
                    ? 'Đang kết thúc…'
                    : connecting
                    ? 'Hủy kết nối'
                    : connected
                    ? 'Kết thúc'
                    : 'Bắt đầu hội thoại',
              ),
          ],
        ),
      ),
    );
  }
}
