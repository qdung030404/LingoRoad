import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import 'conversation_assessment.dart';
import 'conversation_audio.dart';
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

  Future<void> saveHistory() async {
    if (saved || saving || !widget.controller.active) return;
    setState(() => saving = true);
    try {
      await widget.controller.repository.chooseConversationHistory(
        widget.conversation['id'] as String,
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
    appBar: AppBar(title: const Text('Kết quả hội thoại')),
    body: SafeArea(
      top: false,
      child: ConversationAssessment(
        controller: widget.controller,
        conversation: widget.conversation,
        audioPath: widget.audio.path,
        audioSegments: widget.audio.segments,
        autoStart: true,
        fullPage: true,
        onAudioConsumed: widget.audio.clear,
        resultFooter: Padding(
          padding: const EdgeInsets.only(top: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.grey900,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: saving || saved ? null : saveHistory,
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
              const SizedBox(height: 8),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                ),
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Quay lại'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
