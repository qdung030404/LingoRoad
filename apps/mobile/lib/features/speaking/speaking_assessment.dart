import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';
import '../learning/learning_widgets.dart';
import 'speaking_repository.dart';
import 'assessment_details.dart';
import 'speaking_result_audio.dart';
import 'assessment_annotation.dart';
import 'assessment_circle_heading.dart';
import 'conversation_score_details.dart';
import 'conversation_score_summary.dart';
import 'speaking_content_feedback.dart';
import 'speaking_review_widgets.dart';

class SpeakingAssessment extends StatefulWidget {
  const SpeakingAssessment({
    super.key,
    required this.result,
    this.referenceText,
    this.audioPath,
    this.isCurrent,
    this.detailsOnly = false,
    this.showDetails = true,
    this.showContent = true,
    this.inlineDetails = false,
    this.useSharedScoreLayout = false,
    this.contentAction,
    this.onSample,
    this.onWordAudio,
    this.onSheetClosed,
  });
  final Json result;
  final String? referenceText;
  final String? audioPath;
  final bool Function()? isCurrent;
  final bool detailsOnly;
  final bool showDetails;
  final bool showContent;
  final bool inlineDetails;
  final bool useSharedScoreLayout;
  final Widget? contentAction;
  final Future<void> Function(String)? onSample;
  final Future<void> Function(num, num)? onWordAudio;
  final Future<void> Function()? onSheetClosed;
  @override
  State<SpeakingAssessment> createState() => _SpeakingAssessmentState();
}

class _SpeakingAssessmentState extends State<SpeakingAssessment> {
  Json get result => widget.result;
  bool get isTopic => result['mode'] == 'TOPIC';
  bool get compactAnnotations =>
      widget.inlineDetails || widget.useSharedScoreLayout;
  final audioKey = GlobalKey<SpeakingResultAudioState>();

  double? score(String key) {
    final value = result[key];
    return assessmentScore(value);
  }

  @override
  Widget build(BuildContext context) {
    final weighted =
        result.containsKey('overall') && result['scoringPolicy'] is Map;
    final overall = score(weighted ? 'overall' : 'pronunciation');
    final feedback = (result['feedbackVi']?.toString() ?? '').replaceAll(
      RegExp(r'\bAzure\b', caseSensitive: false),
      'lingoRoad',
    );
    final words = speakingItems(result['words']);
    if (widget.detailsOnly) return referenceCard(words, feedback);
    final flagged = words
        .where(
          (word) => [
            'Omission',
            'Insertion',
            'Mispronunciation',
          ].contains(word['errorType']),
        )
        .length;
    if (widget.useSharedScoreLayout) {
      return sharedScoreLayout(overall, weighted, flagged, words, feedback);
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          key: const Key('speaking-summary'),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.primary25,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (weighted)
                      InkWell(
                        key: const Key('speakingScorePolicy'),
                        onTap: showScoringPolicy,
                        borderRadius: BorderRadius.circular(8),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(minHeight: 48),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  'Điểm tổng lingoRoad',
                                  style: designHeading(18),
                                ),
                              ),
                              const SizedBox(width: 4),
                              const Icon(
                                Icons.info_outline_rounded,
                                size: 18,
                                color: AppColors.primary700,
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      Text('Kết quả phát âm', style: designHeading(18)),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: flagged > 0
                            ? AppColors.warning0
                            : AppColors.primary100,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '$flagged từ cần luyện',
                        style: designText(
                          13,
                          weight: FontWeight.w600,
                          color: flagged > 0
                              ? AppColors.warning300
                              : AppColors.primary700,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              SizedBox(
                key: const Key('speaking-summary-circle'),
                width: 92,
                height: 92,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    SizedBox.expand(
                      child: CircularProgressIndicator(
                        value: (overall ?? 0) / 100,
                        strokeWidth: 7,
                        strokeCap: StrokeCap.round,
                        color: scoreColor(overall),
                        backgroundColor: AppColors.primary100,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              overall?.toStringAsFixed(1) ?? '—',
                              style: designHeading(
                                28,
                                color: scoreColor(overall),
                              ),
                            ),
                            Text(
                              '/ 100',
                              style: designText(
                                12,
                                color: AppColors.primary700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.grey100),
          ),
          child: Column(
            children: [
              for (final entry
                  in const {
                    'accuracy': 'Độ chính xác',
                    'fluency': 'Độ trôi chảy',
                    'completeness': 'Mức độ đọc đủ',
                    'prosody': 'Ngữ điệu',
                  }.entries.where(
                    (entry) => !isTopic || entry.key != 'completeness',
                  ))
                Container(
                  key: ValueKey('speaking-score-${entry.key}'),
                  constraints: const BoxConstraints(minHeight: 48),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ConstrainedBox(
                        constraints: const BoxConstraints(minHeight: 28),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                entry.value,
                                style: designText(14, color: AppColors.grey800),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                assessmentScoreText(result[entry.key]),
                                key: ValueKey(
                                  'speaking-score-value-${entry.key}',
                                ),
                                textAlign: TextAlign.right,
                                style: score(entry.key) == null
                                    ? designText(12, color: AppColors.grey800)
                                    : designHeading(
                                        18,
                                        color: scoreColor(score(entry.key)),
                                      ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          key: ValueKey('speaking-score-bar-${entry.key}'),
                          value: (score(entry.key) ?? 0) / 100,
                          minHeight: 6,
                          color: scoreColor(score(entry.key)),
                          backgroundColor: AppColors.grey50,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (result['assessmentCompleteness'] == 'partial') ...[
          Text(
            'Đánh giá chưa đầy đủ',
            style: designText(
              14,
              weight: FontWeight.w600,
              color: AppColors.warning300,
            ),
          ),
          const SizedBox(height: 12),
        ],
        if (result['schemaVersion'] != 2 && result['schemaVersion'] != 3) ...[
          Text(
            'Kết quả theo phiên bản đánh giá trước',
            style: designText(12, color: AppColors.grey800),
          ),
          const SizedBox(height: 12),
        ],
        if (widget.audioPath != null) ...[
          resultAudio(),
          const SizedBox(height: 16),
        ],
        if (isTopic && widget.showContent) ...[
          SpeakingContentAssessment(
            data: result['content'] is Map
                ? Map<String, dynamic>.from(result['content'] as Map)
                : {},
          ),
          if (widget.contentAction != null) widget.contentAction!,
          const SizedBox(height: 16),
        ],
        if (widget.showDetails) referenceCard(words, feedback),
      ],
    );
  }

  Widget sharedScoreLayout(
    double? overall,
    bool weighted,
    int flagged,
    List<Json> words,
    String feedback,
  ) {
    final rawContent = result['content'];
    final content = isTopic && widget.showContent
        ? (rawContent is Map ? Json.from(rawContent) : <String, dynamic>{})
        : null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        SpeakingScoreSummary(
          score: overall,
          title: 'Điểm phát âm',
          scoreLabel: weighted ? 'Điểm phát âm tổng hợp' : 'Điểm phát âm',
          description: flagged > 0 ? '$flagged từ cần luyện' : null,
          showDecimal: true,
          metrics: [
            if (content != null)
              (
                title: 'Nội dung',
                value: content['status'] == 'succeeded'
                    ? assessmentScore(content['overall'])
                    : null,
              ),
          ],
          partial: result['assessmentCompleteness'] == 'partial',
          onScoringPolicy: weighted ? showScoringPolicy : null,
        ),
        ConversationScoreDetails(
          pronunciation: result,
          content: content,
          includeCompleteness: !isTopic,
          insufficientContentMessage:
              'Hãy nói ít nhất 10 giây và khoảng 20 từ để nhận phản hồi nội dung.',
        ),
        if (content != null && widget.contentAction != null)
          widget.contentAction!,
        if (result['schemaVersion'] != 2 && result['schemaVersion'] != 3)
          Text(
            'Kết quả theo phiên bản đánh giá trước',
            style: designText(12, color: AppColors.grey800),
          ),
        if (widget.audioPath != null) resultAudio(),
        if (widget.showDetails) referenceCard(words, feedback),
      ],
    );
  }

  Widget resultAudio() => SpeakingResultAudio(
    key: audioKey,
    path: widget.audioPath!,
    isCurrent: widget.isCurrent,
    durationSeconds: (result['durationSeconds'] as num?)?.toDouble(),
  );

  void showScoringPolicy() {
    final policy = result['scoringPolicy'] as Map;
    final weights = policy['weights'] as Map? ?? {};
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cách tính điểm tổng'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                isTopic
                    ? 'Điểm phát âm tổng hợp theo tỷ lệ ba tiêu chí bên dưới.'
                    : 'Điểm tổng lingoRoad là tổng điểm của bốn tiêu chí nhân với trọng số bên dưới.',
              ),
              const SizedBox(height: 16),
              for (final entry
                  in const {
                    'accuracy': 'Độ chính xác',
                    'fluency': 'Độ trôi chảy',
                    'prosody': 'Ngữ điệu',
                    'completeness': 'Mức độ đọc đủ',
                  }.entries.where(
                    (entry) => !isTopic || entry.key != 'completeness',
                  ))
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Expanded(child: Text(entry.value)),
                      const SizedBox(width: 12),
                      Text(
                        '${isTopic ? ((weights[entry.key] as num? ?? 0) / 90 * 100).toStringAsFixed(1) : weights[entry.key]}%',
                      ),
                    ],
                  ),
                ),
              const SizedBox(height: 12),
              Text(
                isTopic
                    ? 'Điểm tổng sẵn sàng khi có đủ ba tiêu chí.'
                    : 'Điểm tổng sẵn sàng khi có đủ bốn tiêu chí.',
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
  }

  Widget wordChip(Json word, int index) {
    final error = word['errorType']?.toString() ?? 'None';
    final needsPractice = [
      'Omission',
      'Insertion',
      'Mispronunciation',
    ].contains(error);
    final background = needsPractice ? AppColors.warning0 : AppColors.primary25;
    final foreground = needsPractice
        ? AppColors.warning300
        : AppColors.primary700;
    final value = word['accuracy'];
    final detail = switch (error) {
      'Omission' => 'Bỏ sót',
      'Insertion' => 'Đọc thêm',
      _ => assessmentScoreText(value),
    };
    return InkWell(
      key: ValueKey('speaking-word-$index'),
      onTap: () => showWord(word, index),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        constraints: const BoxConstraints(minHeight: 48),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (needsPractice) ...[
              Icon(Icons.info_outline_rounded, size: 16, color: foreground),
              const SizedBox(width: 6),
            ],
            Flexible(
              child: Text(
                '${word['word']}',
                style: designText(
                  15,
                  weight: FontWeight.w500,
                  color: foreground,
                ),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              detail,
              style: designText(
                13,
                weight: FontWeight.w600,
                color: assessmentScore(value) == null
                    ? foreground
                    : scoreColor(assessmentScore(value)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget referenceCard(List<Json> words, String feedback) {
    final monotone = words.any(
      (word) => speakingWordIssues(word).contains('Monotone'),
    );
    final reference =
        (isTopic
                ? (result['transcript']?.toString().isNotEmpty == true
                      ? result['transcript']
                      : widget.referenceText ?? '')
                : result['referenceText'] ?? widget.referenceText ?? '')
            .toString();
    final transcript = result['transcript']?.toString() ?? '';
    String normalized(String text) => RegExp(
      r"[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*",
      unicode: true,
    ).allMatches(text.toLowerCase()).map((match) => match.group(0)).join(' ');
    final showTranscript =
        transcript.isNotEmpty &&
        normalized(transcript) != normalized(reference);
    final tokens = assessmentReferenceTokens(reference, words);
    final annotatedText = reference.isEmpty
        ? Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (var i = 0; i < words.length; i++) wordChip(words[i], i),
            ],
          )
        : LayoutBuilder(
            builder: (context, bounds) => Text.rich(
              TextSpan(
                children: [
                  for (final token in tokens)
                    if (token.wordIndex == null)
                      TextSpan(text: token.text)
                    else
                      WidgetSpan(
                        alignment: compactAnnotations
                            ? PlaceholderAlignment.baseline
                            : PlaceholderAlignment.middle,
                        baseline: TextBaseline.alphabetic,
                        child: referenceWord(
                          token,
                          words[token.wordIndex!],
                          bounds.maxWidth,
                        ),
                      ),
                ],
              ),
              style: compactAnnotations
                  ? designHeading(20)
                  : designText(18, height: 1.6),
            ),
          );
    final title = isTopic ? 'Chi tiết bài nói' : 'Chi tiết bài đọc';
    final recognizedText = Text(transcript, style: designText(16, height: 1.5));
    if (widget.useSharedScoreLayout) {
      return SpeakingReviewCard(
        title: title,
        annotation: AssessmentAnnotation(
          reading: !isTopic,
          compact: true,
          showMonotone: monotone,
        ),
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: speakingReviewSpeechDecoration,
            child: annotatedText,
          ),
          if (showTranscript) ...[
            const SizedBox(height: 8),
            SpeakingReviewExpansionTile(
              key: const Key('speakingTranscript'),
              title: 'Xem lời nhận diện',
              icon: Icons.short_text_rounded,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: speakingReviewSpeechDecoration,
                  child: recognizedText,
                ),
              ],
            ),
          ],
        ],
      );
    }
    final hasProsody = words.any(
      (word) =>
          word['prosody'] is Map &&
          (word['prosody'] as Map).values.any((value) => value != null),
    );
    final children = <Widget>[
      if (!widget.inlineDetails) ...[
        Text(title, style: designHeading(18)),
        AssessmentAnnotation(reading: !isTopic),
      ],
      if (!hasProsody && !widget.inlineDetails)
        Text(
          'Chi tiết ngữ điệu · Chưa có dữ liệu',
          style: designText(12, color: AppColors.grey800),
        ),
      annotatedText,
      if (!widget.inlineDetails)
        Text(
          'Chạm vào từ để xem điểm và âm vị.',
          style: designText(12, color: AppColors.grey800),
        ),
      if (monotone)
        Text(
          compactAnnotations ? '≈ Giọng đều' : '~ Giọng đều',
          style: designText(12, color: const Color(0xFF70539A)),
        ),
      if (showTranscript)
        ExpansionTile(
          key: const Key('speakingTranscript'),
          tilePadding: EdgeInsets.zero,
          shape: const Border(),
          collapsedShape: const Border(),
          title: Text(
            'Xem lời nhận diện',
            style: designText(14, color: AppColors.grey800),
          ),
          children: [
            Align(alignment: Alignment.centerLeft, child: recognizedText),
          ],
        ),
      if (feedback.isNotEmpty && !widget.inlineDetails)
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.grey25,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(
                Icons.lightbulb_outline_rounded,
                color: AppColors.primary700,
                size: 20,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  feedback,
                  style: designText(14, height: 1.5, color: AppColors.grey800),
                ),
              ),
            ],
          ),
        ),
    ];
    if (widget.inlineDetails) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      );
    }
    return LearningCard(gap: 12, children: children);
  }

  Widget referenceWord(AssessmentToken token, Json word, double maxWidth) {
    final issues = speakingWordIssues(word).difference({'Monotone'});
    final omission = issues.contains('Omission');
    final insertion = issues.contains('Insertion');
    final marked = issues.intersection({
      'Mispronunciation',
      'Omission',
      'Insertion',
    }).isNotEmpty;
    final color = insertion
        ? AppColors.error200
        : omission
        ? AppColors.grey800
        : AppColors.warning300;
    final breakIssues = issues.intersection({
      'UnexpectedBreak',
      'MissingBreak',
    });
    return Semantics(
      label:
          '${token.text} ${issues.map((issue) => speakingIssueLabels[issue]).join(', ')}',
      child: InkWell(
        key: ValueKey('speaking-reference-${token.wordIndex}'),
        onTap: () => showWord(word, token.wordIndex!),
        borderRadius: BorderRadius.circular(4),
        child: Container(
          constraints: BoxConstraints(minHeight: 48, maxWidth: maxWidth),
          padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 8),
          decoration: BoxDecoration(
            color: marked
                ? (insertion
                      ? AppColors.error0
                      : omission
                      ? AppColors.grey50
                      : AppColors.warning0)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text.rich(
            TextSpan(
              children: [
                if (breakIssues.contains('UnexpectedBreak'))
                  TextSpan(
                    text: compactAnnotations ? '| ' : '│ ',
                    style: designText(18, color: const Color(0xFFB66A00)),
                  ),
                if (breakIssues.contains('MissingBreak'))
                  TextSpan(
                    text: compactAnnotations ? '~ ' : '⌁ ',
                    style: designText(
                      18,
                      color: compactAnnotations
                          ? AppColors.primary700
                          : const Color(0xFF70539A),
                    ),
                  ),
                TextSpan(
                  text: token.text,
                  style:
                      (compactAnnotations
                              ? designHeading(
                                  20,
                                  color: marked ? color : AppColors.grey900,
                                )
                              : designText(
                                  18,
                                  color: marked ? color : AppColors.grey900,
                                ))
                          .copyWith(
                            decoration: insertion
                                ? TextDecoration.lineThrough
                                : omission
                                ? TextDecoration.underline
                                : null,
                          ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void showWord(Json word, int index) {
    final issues = speakingWordIssues(word);
    final config = result['assessmentConfig'];
    final isIpa = config is Map && config['phonemeAlphabet'] == 'IPA';
    final offset = word['offsetMs'], duration = word['durationMs'];
    final canPlay =
        widget.audioPath != null &&
        offset is num &&
        duration is num &&
        offset.isFinite &&
        duration.isFinite &&
        offset >= 0 &&
        duration > 0 &&
        offset + duration <= ((result['durationSeconds'] as num? ?? 30) * 1000);
    if (compactAnnotations) {
      final wordText = word['word']?.toString() ?? '';
      final phonemes = speakingItems(word['phonemes']);
      final syllables = speakingItems(word['syllables']);
      final issueText = issues
          .where(
            (issue) => !const {
              'UnexpectedBreak',
              'MissingBreak',
              'Monotone',
            }.contains(issue),
          )
          .map((issue) => speakingIssueLabels[issue])
          .join(' · ');
      final wordScore = assessmentScore(word['accuracy']);
      final ipa = isIpa ? phonemes.map((p) => p['phoneme'] ?? '').join() : '';
      final onClose = widget.onSheetClosed;
      final sample = widget.onSample;
      final localAudio = audioKey.currentState;
      final learner =
          widget.onWordAudio ??
          (localAudio == null
              ? null
              : (num start, num length) => localAudio.playSegment(
                  start.toDouble(),
                  length.toDouble(),
                ));
      final wordStart = offset is num && offset.isFinite && offset >= 0
          ? offset
          : null;
      final wordLength = duration is num && duration.isFinite && duration > 0
          ? duration
          : null;
      final canPlayWord =
          learner != null &&
          wordStart != null &&
          wordLength != null &&
          (widget.onWordAudio != null || canPlay);
      final showPlayback =
          widget.inlineDetails || learner != null || sample != null;
      final playbackStyle = designText(14, weight: FontWeight.w500);
      final learnerButton = OutlinedButton.icon(
        onPressed: canPlayWord ? () => learner(wordStart, wordLength) : null,
        icon: const FigmaAsset('conversation-review-play.svg', size: 20),
        label: const Text('Giọng của bạn'),
        style: OutlinedButton.styleFrom(
          textStyle: playbackStyle,
          minimumSize: const Size(0, 40),
          padding: const EdgeInsets.symmetric(horizontal: 8),
          side: BorderSide(color: AppColors.grey100),
        ),
      );
      final sampleButton = FilledButton.icon(
        onPressed: sample == null ? null : () => sample(wordText),
        icon: const FigmaAsset('conversation-review-sample.svg', size: 20),
        label: const Text('Nghe mẫu'),
        style: FilledButton.styleFrom(
          textStyle: playbackStyle,
          backgroundColor: AppColors.grey900,
          foregroundColor: Colors.white,
          minimumSize: const Size(0, 40),
          padding: const EdgeInsets.symmetric(horizontal: 8),
        ),
      );
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        barrierColor: const Color(0x661A2029),
        builder: (context) => SafeArea(
          top: false,
          child: Container(
            margin: const EdgeInsets.all(8),
            constraints: BoxConstraints(
              maxHeight: MediaQuery.sizeOf(context).height * .8,
            ),
            child: Material(
              color: AppColors.grey5,
              borderRadius: BorderRadius.circular(24),
              clipBehavior: Clip.antiAlias,
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Align(
                      alignment: Alignment.centerRight,
                      child: IconButton(
                        tooltip: 'Đóng chi tiết',
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close, size: 20),
                      ),
                    ),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            wordText,
                            style: designText(
                              28,
                              weight: FontWeight.w500,
                              height: 1,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          wordScore?.toStringAsFixed(1) ?? '—',
                          style: designText(
                            28,
                            weight: FontWeight.w500,
                            height: 1,
                            color: wordScore != null && wordScore >= 80
                                ? AppColors.primary600
                                : scoreColor(wordScore),
                          ),
                        ),
                      ],
                    ),
                    if (ipa.isNotEmpty)
                      Text(
                        '/$ipa/ · Anh-Mỹ',
                        style: designText(14, color: AppColors.grey800),
                      ),
                    if (widget.useSharedScoreLayout &&
                        !isIpa &&
                        phonemes.isNotEmpty)
                      Text(
                        'Ký hiệu phiên âm cũ (SAPI)',
                        style: designText(12, color: AppColors.grey800),
                      ),
                    if (issueText.isNotEmpty)
                      Text(
                        issueText,
                        style: designText(13, color: AppColors.grey800),
                      ),
                    if (showPlayback) ...[
                      const SizedBox(height: 18),
                      LayoutBuilder(
                        builder: (context, constraints) {
                          final canFit =
                              constraints.maxWidth >= 280 &&
                              MediaQuery.textScalerOf(context).scale(14) <= 18;
                          if (canFit && sample != null) {
                            return Row(
                              children: [
                                Expanded(child: sampleButton),
                                const SizedBox(width: 8),
                                Expanded(child: learnerButton),
                              ],
                            );
                          }
                          return Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            children: [
                              if (sample != null) sampleButton,
                              learnerButton,
                            ],
                          );
                        },
                      ),
                      if (!canPlayWord)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            learner == null
                                ? 'Phiên này không còn bản thu để nghe lại.'
                                : 'Từ này chưa có mốc thời gian để nghe riêng.',
                            style: designText(12, color: AppColors.grey800),
                          ),
                        ),
                    ],
                    _ConversationWordSounds(
                      word: word,
                      syllables: syllables,
                      phonemes: phonemes,
                      issues: issues,
                      isIpa: isIpa,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ).whenComplete(() async {
        await onClose?.call();
        await localAudio?.stopSegment();
      });
      return;
    }
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (context) => FractionallySizedBox(
        heightFactor: .85,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      word['word']?.toString() ?? '',
                      style: designHeading(26),
                    ),
                  ),
                  IconButton(
                    tooltip: 'Đóng chi tiết',
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              Text(
                assessmentScoreText(word['accuracy']),
                style: designHeading(
                  24,
                  color: scoreColor(assessmentScore(word['accuracy'])),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                issues.isEmpty
                    ? 'Đã đọc'
                    : issues
                          .map((issue) => speakingIssueLabels[issue])
                          .join(' · '),
                style: designText(14),
              ),
              if (canPlay)
                OutlinedButton.icon(
                  onPressed: () => audioKey.currentState?.playSegment(
                    offset.toDouble(),
                    duration.toDouble(),
                  ),
                  icon: const Icon(Icons.volume_up_outlined),
                  label: const Text('Nghe đoạn của từ'),
                ),
              const SizedBox(height: 16),
              Text(
                isIpa ? 'Phiên âm IPA · Anh-Mỹ' : 'Ký hiệu phiên âm cũ (SAPI)',
                style: designText(12, color: AppColors.grey800),
              ),
              const SizedBox(height: 8),
              detailUnits(
                'Âm tiết',
                speakingItems(word['syllables']),
                'syllable',
                isIpa: isIpa,
              ),
              const SizedBox(height: 16),
              detailUnits(
                'Âm vị',
                speakingItems(word['phonemes']),
                'phoneme',
                isIpa: isIpa,
              ),
              const SizedBox(height: 16),
              Text('Ngữ điệu', style: designHeading(18)),
              const SizedBox(height: 8),
              Text(
                issues.intersection({
                      'UnexpectedBreak',
                      'MissingBreak',
                      'Monotone',
                    }).isEmpty
                    ? (word['prosody'] is Map &&
                              (word['prosody'] as Map).values.any(
                                (value) => value != null,
                              )
                          ? 'Chưa ghi nhận lỗi ngữ điệu'
                          : 'Chưa có dữ liệu')
                    : issues
                          .intersection({
                            'UnexpectedBreak',
                            'MissingBreak',
                            'Monotone',
                          })
                          .map((issue) => speakingIssueLabels[issue])
                          .join(' · '),
                style: designText(14),
              ),
              if (offset is num && duration is num)
                Text(
                  '${(offset / 1000).toStringAsFixed(2)}–${((offset + duration) / 1000).toStringAsFixed(2)} giây',
                  style: designText(12, color: AppColors.grey800),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget detailUnits(
    String title,
    List<Json> units,
    String field, {
    required bool isIpa,
  }) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AppColors.grey0,
      border: Border.all(color: AppColors.grey100),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: designHeading(14, color: AppColors.grey800)),
        const SizedBox(height: 8),
        if (units.isEmpty)
          Text(
            'Chưa có dữ liệu',
            style: designText(14, color: AppColors.grey800),
          )
        else
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final unit in units)
                _PronunciationUnit(
                  symbol: unit[field]?.toString() ?? '',
                  score: assessmentScore(unit['accuracy']),
                  isIpa: isIpa,
                ),
            ],
          ),
      ],
    ),
  );
}

class _ConversationWordSounds extends StatelessWidget {
  const _ConversationWordSounds({
    required this.word,
    required this.syllables,
    required this.phonemes,
    required this.issues,
    required this.isIpa,
  });

  final Json word;
  final List<Json> syllables;
  final List<Json> phonemes;
  final Set<String> issues;
  final bool isIpa;

  @override
  Widget build(BuildContext context) {
    final sounds = groupWordPhonemes(syllables, phonemes);
    final timing = spokenTiming(word);
    final prosody = word['prosody'];
    final prosodyIssues = issues.intersection({
      'UnexpectedBreak',
      'MissingBreak',
      'Monotone',
    });
    final hasProsody =
        prosody is Map && prosody.values.any((value) => value != null);
    final showProsody =
        timing != null || hasProsody || prosodyIssues.isNotEmpty;
    final prosodyText = prosodyIssues.isNotEmpty
        ? prosodyIssues.map((issue) => speakingIssueLabels[issue]).join(' · ')
        : hasProsody
        ? 'Chưa ghi nhận lỗi ngữ điệu'
        : 'Chưa có dữ liệu ngữ điệu';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (syllables.isNotEmpty || phonemes.isNotEmpty) ...[
          const SizedBox(height: 20),
          Text(
            'Âm tiết & âm vị',
            style: designText(18, weight: FontWeight.w500),
          ),
          const SizedBox(height: 12),
          for (final (index, syllable) in syllables.indexed) ...[
            _WordSoundBar(unit: syllable, isIpa: isIpa, syllable: true),
            if (sounds.groups[index].isNotEmpty)
              Container(
                margin: const EdgeInsets.only(left: 14, bottom: 4),
                padding: const EdgeInsets.only(left: 16),
                decoration: const BoxDecoration(
                  border: Border(left: BorderSide(color: AppColors.grey200)),
                ),
                child: Column(
                  children: [
                    for (final phoneme in sounds.groups[index])
                      _WordSoundBar(unit: phoneme, isIpa: isIpa),
                  ],
                ),
              ),
          ],
          if (sounds.unassigned.isNotEmpty) ...[
            if (syllables.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(
                  'Âm vị',
                  style: designText(14, color: AppColors.grey800),
                ),
              ),
            for (final phoneme in sounds.unassigned)
              _WordSoundBar(unit: phoneme, isIpa: isIpa),
          ],
        ],
        if (showProsody) ...[
          const SizedBox(height: 20),
          Text('Ngữ điệu', style: designText(18, weight: FontWeight.w500)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.grey50,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              spacing: 8,
              children: [
                const Icon(
                  Icons.timer_outlined,
                  size: 32,
                  color: AppColors.primary600,
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: 4,
                    children: [
                      Text(
                        prosodyText,
                        style: designText(16, weight: FontWeight.w500),
                      ),
                      if (timing != null)
                        Text(
                          '${(timing.start / 1000).toStringAsFixed(2)} – ${(timing.end / 1000).toStringAsFixed(2)} giây',
                          style: designText(14, color: AppColors.grey800),
                        ),
                    ],
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

class _WordSoundBar extends StatelessWidget {
  const _WordSoundBar({
    required this.unit,
    required this.isIpa,
    this.syllable = false,
  });
  final Json unit;
  final bool isIpa;
  final bool syllable;

  @override
  Widget build(BuildContext context) {
    final symbol = unit[syllable ? 'syllable' : 'phoneme']?.toString() ?? '';
    final label = symbol.isEmpty
        ? '—'
        : isIpa
        ? '/$symbol/'
        : symbol;
    final score = assessmentScore(unit['accuracy']);
    final barColor = score == null
        ? AppColors.grey300
        : score >= 80
        ? AppColors.primary600
        : score >= 60
        ? const Color(0xFFCA8A04)
        : scoreColor(score);
    final scoreColorForText = score == null
        ? AppColors.grey800
        : score >= 60 && score < 80
        ? const Color(0xFF955800)
        : scoreColor(score);
    final size = syllable ? 16.0 : 14.0;
    final scaler = MediaQuery.textScalerOf(context);
    return Semantics(
      excludeSemantics: true,
      label:
          '${syllable ? 'Âm tiết' : 'Âm vị'} $label, ${score == null ? 'chưa có điểm' : '${score.toStringAsFixed(1)} trên 100'}',
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          spacing: 8,
          children: [
            SizedBox(
              width: scaler.scale(syllable ? 48 : 40),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: AlignmentDirectional.centerStart,
                child: Text(
                  label,
                  maxLines: 1,
                  softWrap: false,
                  style: designText(
                    syllable ? 18 : 16,
                    weight: syllable ? FontWeight.w500 : FontWeight.w400,
                  ),
                ),
              ),
            ),
            Expanded(
              child: LinearProgressIndicator(
                value: (score ?? 0) / 100,
                minHeight: 6,
                borderRadius: BorderRadius.circular(6),
                color: barColor,
                backgroundColor: AppColors.grey100,
              ),
            ),
            SizedBox(
              width: scaler.scale(30),
              child: Text(
                score?.round().toString() ?? '—',
                textAlign: TextAlign.right,
                style: designText(
                  size,
                  weight: FontWeight.w500,
                  color: scoreColorForText,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PronunciationUnit extends StatelessWidget {
  const _PronunciationUnit({
    required this.symbol,
    required this.score,
    required this.isIpa,
  });

  final String symbol;
  final double? score;
  final bool isIpa;

  @override
  Widget build(BuildContext context) {
    final value = score;
    final label = symbol.isEmpty
        ? '—'
        : isIpa
        ? '/$symbol/'
        : symbol;
    final background = switch (value) {
      null => AppColors.grey50,
      < 60 => AppColors.error0,
      < 80 => AppColors.warning0,
      _ => AppColors.primary25,
    };
    final color = switch (value) {
      null => AppColors.grey800,
      >= 60 && < 80 => const Color(0xFF955800),
      _ => scoreColor(value),
    };
    return Semantics(
      excludeSemantics: true,
      label:
          '$label, ${value == null ? 'chưa có điểm' : '${value.toStringAsFixed(1)} trên 100'}',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Wrap(
          spacing: 8,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(label, style: designText(16, weight: FontWeight.w500)),
            Text(
              value?.toStringAsFixed(1) ?? '—',
              style: designText(13, weight: FontWeight.w600, color: color),
            ),
          ],
        ),
      ),
    );
  }
}

class SpeakingContentAssessment extends StatelessWidget {
  const SpeakingContentAssessment({
    super.key,
    required this.data,
    this.showOverall = true,
    this.circularHeading = false,
  });
  final Json data;
  final bool showOverall;
  final bool circularHeading;
  @override
  Widget build(BuildContext context) {
    final status = data['status'];
    return LearningCard(
      gap: showOverall ? 16 : 8,
      children: [
        if (circularHeading)
          AssessmentCircleHeading(
            title: 'Nội dung',
            value: data['overall'],
            circleKey: 'content-score-circle',
          )
        else
          learningHeading('Nội dung bài nói', size: 20),
        if (status != 'succeeded')
          learningBody(
            status == 'insufficient_data'
                ? 'Hãy nói ít nhất 10 giây và khoảng 20 từ để nhận phản hồi nội dung.'
                : status == 'processing'
                ? 'Đang đánh giá nội dung…'
                : 'Phản hồi nội dung tạm thời chưa khả dụng.',
          )
        else ...[
          if (showOverall && !circularHeading)
            Text(
              'Điểm nội dung ${assessmentScoreText(data['overall'])} / 100',
              style: designHeading(20),
            ),
          for (final entry in const {
            'vocabulary': 'Từ vựng',
            'grammar': 'Ngữ pháp',
            'topic': 'Đúng chủ đề',
          }.entries)
            Padding(
              padding: EdgeInsets.symmetric(vertical: showOverall ? 8 : 4),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(entry.value)),
                      Text(assessmentScoreText(data[entry.key])),
                    ],
                  ),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: (assessmentScore(data[entry.key]) ?? 0) / 100,
                    minHeight: 6,
                    color: scoreColor(assessmentScore(data[entry.key])),
                    backgroundColor: AppColors.grey50,
                  ),
                ],
              ),
            ),
          if ((data['strengths'] as List? ?? []).isNotEmpty ||
              (data['improvements'] as List? ?? []).isNotEmpty)
            SpeakingContentFeedback(
              strengths: (data['strengths'] as List? ?? [])
                  .map((item) => item.toString())
                  .toList(),
              improvements: speakingItems(data['improvements']),
            ),
        ],
      ],
    );
  }
}
