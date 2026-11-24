import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import 'speaking_controller.dart';
import 'speaking_assessment.dart';
import 'speaking_repository.dart';
import '../../shared/figma_widgets.dart';
import 'assessment_annotation.dart';
import 'conversation_score_details.dart';
import 'conversation_score_summary.dart';
import 'conversation_review_audio.dart';
import 'conversation_recording_store.dart';
import 'assessment_details.dart';
import 'speaking_review_widgets.dart';

class ConversationAssessment extends StatefulWidget {
  const ConversationAssessment({
    super.key,
    required this.controller,
    required this.conversation,
    this.audioPath,
    this.audioSegments = const [],
    this.onAudioConsumed,
    this.reviewRecording,
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
  final Future<ConversationRecording?>? reviewRecording;
  final bool autoStart;
  final bool fullPage;
  final Widget? resultHeader, resultFooter;
  @override
  State<ConversationAssessment> createState() => _ConversationAssessmentState();
}

class _ConversationAssessmentState extends State<ConversationAssessment> {
  late Json row = widget.conversation;
  late final reviewAudio = ConversationReviewAudio(
    () => mounted && widget.controller.active,
    fetchSample: (text) => widget.controller.repository.conversationSample(
      widget.conversation['id'] as String,
      text,
    ),
  );
  List<Json> segments = const [];
  late final Future<void> recording;
  ConversationRecording? retryRecording;
  bool busy = false;
  bool refreshing = false;
  String? error;
  Timer? poll;
  Timer? identityWatch;
  int nextPollSeconds = 2;
  bool get processing => row['assessmentStatus'] == 'PROCESSING';
  bool get unassessed =>
      row['assessmentStatus'] == null ||
      row['assessmentStatus'] == 'UNASSESSED';
  @override
  void initState() {
    super.initState();
    recording =
        widget.reviewRecording?.then((capture) {
          if (capture == null || !mounted || !widget.controller.active) return;
          setState(() {
            retryRecording = capture;
            segments = capture.segments;
            reviewAudio.setRecording(capture.wav);
          });
        }) ??
        Future.value();
    identityWatch = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!widget.controller.active) {
        poll?.cancel();
        identityWatch?.cancel();
        reviewAudio.dispose();
        if (mounted) setState(() => row = {});
      }
    });
    if (processing) schedulePoll();
    if (widget.autoStart && unassessed) unawaited(assess());
  }

  void schedulePoll() {
    poll?.cancel();
    poll = Timer(
      Duration(seconds: nextPollSeconds),
      () => unawaited(refresh()),
    );
  }

  Future<void> refresh() async {
    if (!mounted || !widget.controller.active || refreshing) return;
    poll?.cancel();
    var shouldPoll = false;
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
      nextPollSeconds = 2;
      shouldPoll = processing;
      if (!processing && row['assessment'] != null) {
        await recording;
        await widget.onAudioConsumed?.call();
      }
    } catch (failure) {
      if (mounted && widget.controller.active) {
        setState(() => error = 'Chưa tải được kết quả. Hãy kiểm tra lại.');
        final status = failure is ApiFailure ? failure.status : null;
        shouldPoll =
            processing &&
            (status == null || status == 408 || status == 429 || status >= 500);
        nextPollSeconds = (nextPollSeconds * 2).clamp(2, 30);
      }
    } finally {
      if (mounted) {
        setState(() => refreshing = false);
        if (shouldPoll && widget.controller.active) schedulePoll();
      }
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
        await recording;
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

  Future<void> retryPronunciation() async {
    final capture = retryRecording;
    if (busy || refreshing || capture == null || !widget.controller.active) {
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final updated = await widget.controller.repository
          .retryConversationPronunciation(
            row['id'] as String,
            capture.wav,
            capture.segments,
          );
      if (!mounted || !widget.controller.active) return;
      setState(() => row = updated);
      if (processing) {
        nextPollSeconds = 2;
        schedulePoll();
      }
    } catch (failure) {
      if (mounted && widget.controller.active) {
        setState(
          () => error = failure is ApiFailure
              ? failure.message
              : 'Chưa chấm lại được phát âm. Hãy thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    poll?.cancel();
    identityWatch?.cancel();
    reviewAudio.dispose();
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
              ? 'App sẽ tự kiểm tra lại nếu kết nối bị gián đoạn. Bạn cũng có thể kiểm tra ngay.'
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
    final pronunciationData = assessment?['pronunciation'];
    final pronunciation = pronunciationData is Map
        ? Map<String, dynamic>.from(pronunciationData)
        : null;
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
    final recordedTurns = segments.map((segment) => segment['itemId']).toSet();
    final canRetryPronunciation =
        retryRecording != null &&
        row['supportsPronunciationRetry'] == true &&
        !unassessed &&
        assessment?['pronunciationScope'] != 'whole_audio' &&
        (replies.isEmpty ||
            replies.any(
              (turn) =>
                  turn['pronunciation'] == null &&
                  recordedTurns.contains(turn['itemId']),
            ));
    // Older reviews can contain improvements only at conversation level.
    final quotedSuggestions = <int, List<String>>{};
    if (content['status'] == 'succeeded') {
      for (final item in speakingItems(content['improvements'])) {
        final quote = item['quote']?.toString().trim().toLowerCase() ?? '';
        final suggestion = item['suggestion']?.toString().trim() ?? '';
        if (quote.isEmpty || suggestion.isEmpty) continue;
        final matches = replies.indexed.where(
          (entry) => (entry.$2['answer']?.toString().toLowerCase() ?? '')
              .contains(quote),
        );
        if (matches.length == 1) {
          quotedSuggestions
              .putIfAbsent(matches.single.$1, () => [])
              .add(suggestion);
        }
      }
    }
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
            content: content,
            pronunciation: pronunciation,
          ),
          const SizedBox(height: 12),
          ConversationScoreDetails(
            pronunciation: pronunciation,
            content: content,
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
          if (replies.isNotEmpty)
            SpeakingReviewCard(
              title: 'Chi tiết hội thoại',
              annotation: AssessmentAnnotation(
                compact: true,
                showMonotone: replies.any((reply) {
                  final result = reply['pronunciation'];
                  return result is Map &&
                      speakingItems(
                        result['words'],
                      ).any((w) => speakingWordIssues(w).contains('Monotone'));
                }),
              ),
              children: [
                for (var index = 0; index < replies.length; index++) ...[
                  if (index > 0)
                    const Divider(height: 24, color: AppColors.grey100),
                  ConversationAnswerAssessment(
                    answer: replies[index],
                    quotedSuggestions: quotedSuggestions[index] ?? const [],
                    audio: reviewAudio,
                    segments: segments,
                    index: index,
                  ),
                ],
              ],
            ),
        ] else if (!unassessed && !processing)
          const Text('Lần chấm bị gián đoạn.'),
        if (canRetryPronunciation) ...[
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: refreshing ? null : retryPronunciation,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Chấm lại phát âm'),
          ),
        ],
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
    this.audio,
    this.segments = const [],
    this.quotedSuggestions = const [],
  });
  final Json answer;
  final int index;
  final ConversationReviewAudio? audio;
  final List<Json> segments;
  final List<String> quotedSuggestions;

  @override
  Widget build(BuildContext context) {
    final pronunciation = answer['pronunciation'] is Map
        ? Map<String, dynamic>.from(answer['pronunciation'] as Map)
        : null;
    final words = speakingItems(pronunciation?['words']);
    final issues = words.map(speakingWordIssues).toList();
    final count =
        issues.fold<int>(
          0,
          (sum, item) => sum + item.difference({'Monotone'}).length,
        ) +
        (issues.any((item) => item.contains('Monotone')) ? 1 : 0);
    final content = answer['content'];
    final turnSuggestions = content is Map && content['status'] == 'succeeded'
        ? speakingItems(
            content['improvements'],
          ).map((e) => e['suggestion']?.toString() ?? '')
        : const <String>[];
    final suggestion = [
      ...turnSuggestions,
      ...quotedSuggestions,
    ].map(conversationSuggestionSentence).nonNulls.firstOrNull;
    final id = answer['itemId'] as String?;
    final canPlay = audio?.hasTurn(segments, id) ?? false;
    final question = answer['question']?.toString().trim() ?? '';
    Future<void> play(Future<void> Function() action) async {
      try {
        await action();
      } catch (_) {
        if (context.mounted) {
          await showDialog<void>(
            context: context,
            builder: (context) => AlertDialog(
              content: const Text('Chưa phát được bản thu. Hãy thử lại.'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Đóng'),
                ),
              ],
            ),
          );
        }
      }
    }

    Future<void> playSample(String text) async {
      try {
        await audio!.playSample(text);
      } catch (_) {
        if (!context.mounted) return;
        await showDialog<void>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Chưa phát được giọng mẫu'),
            content: const Text('Kiểm tra kết nối mạng rồi thử lại.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Đóng'),
              ),
            ],
          ),
        );
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Câu ${index + 1}',
                style: designText(
                  16,
                  weight: FontWeight.w500,
                  color: AppColors.grey800,
                ),
              ),
            ),
            if (words.isNotEmpty)
              Text(
                '$count lỗi',
                style: designText(
                  14,
                  weight: FontWeight.w500,
                  color: count == 0
                      ? AppColors.primary700
                      : const Color(0xff955800),
                ),
              ),
          ],
        ),
        if (question.isNotEmpty) ...[
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 15,
                backgroundColor: AppColors.primary25,
                child: Text(
                  'AI',
                  style: designText(
                    14,
                    color: AppColors.primary700,
                    weight: FontWeight.w500,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  question,
                  style: designText(16, height: 1.5, color: AppColors.grey800),
                ),
              ),
            ],
          ),
        ],
        const SizedBox(height: 12),
        Container(
          decoration: speakingReviewSpeechDecoration,
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Bạn nói',
                style: designText(
                  16,
                  weight: FontWeight.w500,
                  height: 1.5,
                  color: AppColors.grey800,
                ),
              ),
              const SizedBox(height: 6),
              if (pronunciation != null && words.isNotEmpty)
                SpeakingAssessment(
                  result: pronunciation,
                  referenceText: answer['answer']?.toString(),
                  detailsOnly: true,
                  inlineDetails: true,
                  onSample: audio == null ? null : playSample,
                  onWordAudio: canPlay
                      ? (start, length) => play(
                          () => audio!.playTurn(
                            segments,
                            id!,
                            offset: start,
                            duration: length,
                          ),
                        )
                      : null,
                  onSheetClosed: audio?.stop,
                )
              else
                Text(
                  answer['answer']?.toString() ?? '',
                  style: designHeading(20),
                ),
              if (canPlay)
                Align(
                  alignment: Alignment.centerLeft,
                  child: OutlinedButton.icon(
                    onPressed: () => play(() => audio!.playTurn(segments, id!)),
                    icon: const FigmaAsset(
                      'conversation-review-play.svg',
                      width: 16,
                      height: 16,
                    ),
                    label: Text(
                      'Giọng của bạn',
                      style: designText(12, weight: FontWeight.w500),
                    ),
                  ),
                ),
            ],
          ),
        ),
        if (suggestion != null) ...[
          const SizedBox(height: 8),
          Container(
            decoration: speakingReviewSpeechDecoration,
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Câu gợi ý',
                        style: designText(
                          16,
                          weight: FontWeight.w500,
                          height: 1.5,
                          color: AppColors.primary700,
                        ),
                      ),
                    ),
                    if (audio != null)
                      IconButton(
                        tooltip: 'Nghe câu gợi ý',
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.white,
                          side: const BorderSide(color: AppColors.grey100),
                        ),
                        icon: const FigmaAsset(
                          'conversation-review-suggestion.svg',
                          width: 16,
                          height: 16,
                        ),
                        onPressed: () => playSample(suggestion),
                      ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppColors.primary25,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    suggestion,
                    style: designHeading(20, color: AppColors.primary700),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
