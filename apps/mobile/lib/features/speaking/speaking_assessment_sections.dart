part of 'speaking_assessment.dart';

extension _SpeakingAssessmentWordSheet on _SpeakingAssessmentState {
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
    final localAudio = audioKey.currentState;
    if (compactAnnotations) {
      showCompactWordSheet(
        context,
        word: word,
        issues: issues,
        isIpa: isIpa,
        inlineDetails: widget.inlineDetails,
        useSharedScoreLayout: widget.useSharedScoreLayout,
        canPlayLocal: canPlay,
        onSample: widget.onSample,
        onWordAudio: widget.onWordAudio,
        onSheetClosed: widget.onSheetClosed,
        onPlayLocalSegment: localAudio == null
            ? null
            : (num start, num length) =>
                  localAudio.playSegment(start.toDouble(), length.toDouble()),
        onStopLocalSegment: localAudio?.stopSegment,
      );
      return;
    }
    showLegacyWordSheet(
      context,
      word: word,
      issues: issues,
      isIpa: isIpa,
      canPlay: canPlay,
      onPlaySegment: localAudio?.playSegment,
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

