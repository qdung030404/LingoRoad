import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import 'speaking_controller.dart';
import 'speaking_assessment.dart';
import 'speaking_repository.dart';
import '../../shared/figma_widgets.dart';
import 'assessment_annotation.dart';
import 'conversation_score_summary.dart';

class ConversationAssessment extends StatefulWidget {
  const ConversationAssessment({
    super.key,
    required this.controller,
    required this.conversation,
    this.audioPath,
    this.audioSegments = const [],
    this.onAudioConsumed,
    this.autoStart = false,
    this.fullPage = false,
    this.resultHeader,
    this.resultFooter,
  });
  final SpeakingController controller;
  final Json conversation;
  final String? audioPath;
  final List<Json> audioSegments;
  final Future<void> Function()? onAudioConsumed;
  final bool autoStart;
  final bool fullPage;
  final Widget? resultHeader, resultFooter;
  @override
  State<ConversationAssessment> createState() => _ConversationAssessmentState();
}

class _ConversationAssessmentState extends State<ConversationAssessment> {
  late Json row = widget.conversation;
  bool busy = false;
  bool refreshing = false;
  String? error;
  Timer? poll;
  Timer? identityWatch;
  bool get processing => row['assessmentStatus'] == 'PROCESSING';
  bool get unassessed =>
      row['assessmentStatus'] == null ||
      row['assessmentStatus'] == 'UNASSESSED';
  @override
  void initState() {
    super.initState();
    identityWatch = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!widget.controller.active) {
        poll?.cancel();
        identityWatch?.cancel();
        if (mounted) setState(() => row = {});
      }
    });
    if (processing) schedulePoll();
    if (widget.autoStart && unassessed) unawaited(assess());
  }

  void schedulePoll() {
    poll?.cancel();
    poll = Timer(const Duration(seconds: 2), () => unawaited(refresh()));
  }

  Future<void> refresh() async {
    if (!mounted || !widget.controller.active || refreshing) return;
    setState(() => refreshing = true);
    try {
      final updated = await widget.controller.repository.conversationSummary(
        row['id'] as String,
      );
      if (!mounted || !widget.controller.active) return;
      setState(() {
        row = updated;
        error = null;
      });
      if (processing) {
        schedulePoll();
      } else if (row['assessment'] != null) {
        await widget.onAudioConsumed?.call();
      }
    } catch (_) {
      if (mounted && widget.controller.active) {
        setState(() => error = 'Chưa tải được kết quả. Hãy kiểm tra lại.');
      }
    } finally {
      if (mounted) setState(() => refreshing = false);
    }
  }

  Future<void> assess() async {
    if (busy || !widget.controller.active) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      // Recover a lost upload ACK before attempting another request.
      final current = await widget.controller.repository.conversationSummary(
        row['id'] as String,
      );
      if (!mounted || !widget.controller.active) return;
      final updated =
          current['assessmentStatus'] == 'UNASSESSED' ||
              current['assessmentStatus'] == null
          ? widget.audioPath != null && widget.audioSegments.isNotEmpty
                ? await widget.controller.repository.assessConversationSegments(
                    row['id'] as String,
                    widget.audioPath!,
                    widget.audioSegments,
                  )
                : await widget.controller.repository.assessConversation(
                    row['id'] as String,
                    audioPath: widget.audioPath,
                  )
          : current;
      if (!mounted || !widget.controller.active) return;
      setState(() => row = updated);
      if (processing) {
        schedulePoll();
      } else if (row['assessment'] != null) {
        await widget.onAudioConsumed?.call();
      }
    } catch (failure) {
      if (mounted && widget.controller.active) {
        setState(
          () => error = failure is ApiFailure
              ? failure.message
              : 'Chưa gửi được bài chấm. Hãy thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> retryContent() async {
    if (busy || !widget.controller.active) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final updated = await widget.controller.repository
          .retryConversationContent(row['id'] as String);
      if (!mounted || !widget.controller.active) return;
      setState(() => row = updated);
      if (processing) schedulePoll();
    } catch (_) {
      if (mounted) {
        setState(() => error = 'Chưa chấm lại được nội dung. Hãy thử lại.');
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    poll?.cancel();
    identityWatch?.cancel();
    super.dispose();
  }

  Widget waitingView() {
    final failed = error != null && !refreshing;
    final child = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 72,
          height: 72,
          alignment: Alignment.center,
          decoration: const BoxDecoration(
            color: AppColors.primary25,
            shape: BoxShape.circle,
          ),
          child: failed
              ? const Icon(
                  Icons.cloud_off_outlined,
                  color: AppColors.primary700,
                )
              : const SizedBox.square(
                  dimension: 32,
                  child: CircularProgressIndicator(
                    color: AppColors.primary700,
                    strokeWidth: 3,
                    semanticsLabel: 'Đang chấm',
                  ),
                ),
        ),
        const SizedBox(height: 24),
        Text(
          failed ? 'Chưa tải được kết quả' : 'Đang chấm hội thoại',
          style: designHeading(24),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        Text(
          failed
              ? 'Kiểm tra kết nối rồi thử lại.'
              : row['historyStatus'] == 'PENDING'
              ? 'Kết quả sẽ có trong lịch sử sau khi bạn lưu hội thoại.'
              : 'Bạn có thể quay lại và xem kết quả trong lịch sử.',
          textAlign: TextAlign.center,
          style: designText(15, color: AppColors.grey800, height: 1.45),
        ),
        if (failed) ...[
          const SizedBox(height: 16),
          OutlinedButton(
            onPressed: refresh,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
            ),
            child: const Text('Kiểm tra kết quả'),
          ),
        ],
      ],
    );
    if (!widget.fullPage) {
      return Padding(padding: const EdgeInsets.all(24), child: child);
    }
    return SafeArea(
      top: false,
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: child,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.controller.active) {
      return const Text('Phiên đăng nhập đã thay đổi.');
    }
    if (busy || processing) return waitingView();
    final assessment = row['assessment'] is Map
        ? Map<String, dynamic>.from(row['assessment'] as Map)
        : null;
    final pronunciation = assessment?['pronunciation'];
    final replies = speakingItems(assessment?['turns']);
    if (replies.isEmpty && assessment != null) {
      String question = '';
      for (final turn in speakingItems(row['turns'])) {
        if (turn['role'] == 'ASSISTANT') {
          question = turn['transcript']?.toString() ?? '';
        } else if (turn['role'] == 'USER') {
          replies.add({
            'itemId': turn['providerItemId'],
            'question': question,
            'answer': turn['transcript'],
          });
        }
      }
    }
    final content = assessment?['content'] is Map
        ? Map<String, dynamic>.from(assessment!['content'] as Map)
        : <String, dynamic>{};
    final results = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (unassessed) ...[
          Text(
            widget.audioPath == null
                ? 'Bản thu của phiên này đã được dọn. Bạn có thể chấm nội dung từ lời thoại đã lưu.'
                : 'Nhận điểm phát âm và phản hồi nội dung từ phần bạn đã nói.',
            style: const TextStyle(color: Color(0xFF5B6574), height: 1.5),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: busy || !widget.controller.active ? null : assess,
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF1A2029),
              foregroundColor: Colors.white,
              minimumSize: const Size.fromHeight(48),
            ),
            icon: const Icon(Icons.fact_check_outlined),
            label: Text(
              busy
                  ? 'Đang gửi…'
                  : widget.audioPath == null
                  ? 'Chấm nội dung hội thoại'
                  : 'Chấm điểm hội thoại',
            ),
          ),
        ],
        if (assessment != null) ...[
          ConversationScoreSummary(
            pronunciation: pronunciation is Map
                ? Map<String, dynamic>.from(pronunciation)
                : null,
          ),
          const SizedBox(height: 16),
          SpeakingContentAssessment(
            data: content,
            showOverall: false,
            circularHeading: true,
          ),
          if (!processing && content['status'] != 'succeeded') ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: busy ? null : retryContent,
              icon: const Icon(Icons.refresh_rounded),
              label: Text(busy ? 'Đang gửi…' : 'Chấm lại nội dung'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
              ),
            ),
          ],
          const SizedBox(height: 16),
          if (pronunciation == null)
            const Text('Chưa có điểm phát âm cho phiên này.')
          else if (row['assessmentStatus'] == 'PARTIAL' &&
              replies.isNotEmpty &&
              replies.any((turn) => turn['pronunciation'] == null))
            const Text('Một số lượt chưa có điểm phát âm.'),
          if (assessment['schemaVersion'] != 2 && pronunciation != null)
            const Text(
              'Chi tiết phát âm theo từng lượt có ở cuộc gọi mới. Bạn có thể chấm lại nội dung của phiên này.',
            ),
          if (replies.isNotEmpty) ...[
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E7EF)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('Chi tiết hội thoại', style: designHeading(20)),
                  const SizedBox(height: 4),
                  Text(
                    'Chạm vào từ để xem điểm và âm vị.',
                    style: designText(12, color: const Color(0xFF5B6574)),
                  ),
                  const SizedBox(height: 16),
                  const AssessmentAnnotation(compact: true),
                  const Divider(height: 24, color: Color(0xFFE2E7EF)),
                  for (var index = 0; index < replies.length; index++) ...[
                    if (index > 0)
                      const Divider(height: 24, color: Color(0xFFE2E7EF)),
                    ConversationAnswerAssessment(
                      answer: replies[index],
                      index: index,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ] else if (!unassessed && !processing)
          const Text(
            'Lần chấm bị gián đoạn. Hãy bắt đầu hội thoại mới để chấm lại.',
          ),
        if (error != null) ...[
          const SizedBox(height: 12),
          Text(error!, style: const TextStyle(color: Color(0xFFB34B29))),
          if (!unassessed)
            TextButton(
              onPressed: refresh,
              child: const Text('Kiểm tra kết quả'),
            ),
        ],
      ],
    );
    if (!widget.fullPage) return results;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (widget.resultHeader != null) widget.resultHeader!,
        results,
        if (widget.resultFooter != null) widget.resultFooter!,
      ],
    );
  }
}

class ConversationAnswerAssessment extends StatelessWidget {
  const ConversationAnswerAssessment({
    super.key,
    required this.answer,
    required this.index,
  });
  final Json answer;
  final int index;
  @override
  Widget build(BuildContext context) {
    final pronunciation = answer['pronunciation'] is Map
        ? Map<String, dynamic>.from(answer['pronunciation'] as Map)
        : null;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 28,
                height: 28,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFFEDF1F6),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  (index + 1).toString().padLeft(2, '0'),
                  style: designText(12, weight: FontWeight.w600),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  answer['question']?.toString() ?? 'Lượt trả lời ${index + 1}',
                  style: designText(
                    14,
                    color: const Color(0xFF5B6574),
                    height: 1.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (pronunciation != null)
            SpeakingAssessment(
              result: pronunciation,
              detailsOnly: true,
              inlineDetails: true,
            )
          else
            Text(
              answer['answer']?.toString() ?? '',
              style: designText(18, height: 1.6),
            ),
        ],
      ),
    );
  }
}
