import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';
import 'conversation_assessment.dart';
import 'conversation_audio.dart';
import 'conversation_recording_store.dart';
import 'speaking_controller.dart';

class ConversationResultPage extends StatefulWidget {
  const ConversationResultPage({
    super.key,
    required this.controller,
    required this.conversation,
    required this.audio,
  });

  final SpeakingController controller;
  final Json conversation;
  final ConversationAudio audio;

  @override
  State<ConversationResultPage> createState() => _ConversationResultPageState();
}

class _ConversationResultPageState extends State<ConversationResultPage> {
  late bool saved = widget.conversation['historyStatus'] != 'PENDING';
  bool saving = false;
  late final audioPath = widget.audio.path;
  late final audioSegments = List<Json>.of(widget.audio.segments);
  late final recording = widget.audio.readForReview().then((bytes) {
    if (bytes == null || audioSegments.isEmpty) return null;
    return ConversationRecording(bytes, audioSegments);
  });

  Future<void> saveHistory() async {
    if (saved || saving || !widget.controller.active) return;
    setState(() => saving = true);
    try {
      final id = widget.conversation['id'] as String;
      final capture = await recording;
      if (!widget.controller.active) return;
      if (audioSegments.isNotEmpty) {
        try {
          if (capture == null) throw StateError('Missing recording');
          await widget.controller.conversationRecordings.save(
            widget.controller.accountId,
            id,
            capture,
          );
        } catch (_) {
          throw const ApiFailure(
            'Chưa lưu được bản thu trên thiết bị. Hãy thử lại.',
          );
        }
      }
      if (!widget.controller.active) return;
      await widget.controller.repository.chooseConversationHistory(
        id,
        save: true,
      );
      if (mounted && widget.controller.active) setState(() => saved = true);
    } catch (error) {
      if (!mounted || !widget.controller.active) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error is ApiFailure
                ? error.message
                : 'Chưa lưu được hội thoại. Hãy thử lại.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFF4F7FB),
    appBar: AppBar(
      centerTitle: true,
      backgroundColor: AppColors.grey25,
      title: Text('Kết quả hội thoại', style: designHeading(18)),
    ),
    body: SafeArea(
      top: false,
      child: ConversationAssessment(
        controller: widget.controller,
        conversation: widget.conversation,
        audioPath: audioPath,
        audioSegments: audioSegments,
        autoStart: true,
        fullPage: true,
        reviewRecording: recording,
        onAudioConsumed: widget.audio.releaseCapture,
      ),
    ),
    bottomNavigationBar: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 6, 12, 8),
        child: Row(
          children: [
            IconButton.outlined(
              tooltip: 'Quay lại',
              onPressed: () => Navigator.of(context).pop(),
              style: IconButton.styleFrom(
                backgroundColor: Colors.white,
                minimumSize: const Size(48, 48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              icon: const Icon(Icons.chevron_left),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.grey900,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(48),
                  textStyle: designText(18, weight: FontWeight.w500),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onPressed: saving || saved || !widget.controller.active
                    ? null
                    : saveHistory,
                icon: Icon(
                  saved ? Icons.check_rounded : Icons.bookmark_add_outlined,
                ),
                label: Text(
                  saved
                      ? 'Đã lưu lịch sử trò chuyện'
                      : saving
                      ? 'Đang lưu…'
                      : 'Lưu lịch sử trò chuyện',
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
