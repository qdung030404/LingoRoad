import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/figma_widgets.dart';
import 'assessment_details.dart';
import 'speaking_repository.dart';

void showSpeakingScoringPolicyDialog(
  BuildContext context, {
  required bool isTopic,
  required Map policy,
}) {
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

void showCompactWordSheet(
  BuildContext context, {
  required Json word,
  required Set<String> issues,
  required bool isIpa,
  required bool inlineDetails,
  required bool useSharedScoreLayout,
  required bool canPlayLocal,
  Future<void> Function(String)? onSample,
  Future<void> Function(num, num)? onWordAudio,
  Future<void> Function()? onSheetClosed,
  Future<void> Function(num, num)? onPlayLocalSegment,
  Future<void> Function()? onStopLocalSegment,
}) {
  final offset = word['offsetMs'], duration = word['durationMs'];
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
  final learner = onWordAudio ?? onPlayLocalSegment;
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
      (onWordAudio != null || canPlayLocal);
  final showPlayback = inlineDetails || learner != null || onSample != null;
  final playbackStyle = designText(14, weight: FontWeight.w500);
  final learnerButton = OutlinedButton.icon(
    onPressed: canPlayWord ? () => learner(wordStart, wordLength) : null,
    icon: const FigmaAsset('conversation-review-play.svg', size: 20),
    label: const Text('Giọng của bạn'),
    style: OutlinedButton.styleFrom(
      textStyle: playbackStyle,
      minimumSize: const Size(0, 40),
      padding: const EdgeInsets.symmetric(horizontal: 8),
      side: const BorderSide(color: AppColors.grey100),
    ),
  );
  final sampleButton = FilledButton.icon(
    onPressed: onSample == null ? null : () => onSample(wordText),
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
    barrierColor: AppColors.grey900.withValues(alpha: 0.4),
    builder: (context) => SafeArea(
      top: false,
      child: Container(
        margin: const EdgeInsets.all(8),
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * .8,
        ),
        child: Material(
          color: AppColors.grey5,
          borderRadius: AppRadius.dialogRadius,
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
                if (useSharedScoreLayout && !isIpa && phonemes.isNotEmpty)
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
                      if (canFit && onSample != null) {
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
                          if (onSample != null) sampleButton,
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
    await onSheetClosed?.call();
    await onStopLocalSegment?.call();
  });
}

void showLegacyWordSheet(
  BuildContext context, {
  required Json word,
  required Set<String> issues,
  required bool isIpa,
  required bool canPlay,
  Future<void> Function(double, double)? onPlaySegment,
}) {
  final offset = word['offsetMs'], duration = word['durationMs'];
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
            if (canPlay && onPlaySegment != null)
              OutlinedButton.icon(
                onPressed: () => onPlaySegment(
                  (offset as num).toDouble(),
                  (duration as num).toDouble(),
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
            _detailUnits(
              'Âm tiết',
              speakingItems(word['syllables']),
              'syllable',
              isIpa: isIpa,
            ),
            const SizedBox(height: 16),
            _detailUnits(
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

Widget _detailUnits(
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
    borderRadius: AppRadius.cardSm,
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
            decoration: const BoxDecoration(
              color: AppColors.grey50,
              borderRadius: AppRadius.cardRadius,
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
                borderRadius: AppRadius.xsRadius,
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
          borderRadius: AppRadius.tagRadius,
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
