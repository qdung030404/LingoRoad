import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
import '../../shared/figma_widgets.dart';

String formatAiExplanationText(String raw) {
  final normalized = raw.replaceAll('\r\n', '\n').trim();
  if (normalized.isEmpty) return '';
  final standaloneHeader = RegExp(
    r'^\s*(?:\*{1,2})?(?:giải thích(?:\s+ai)?|lời giải)(?:\*{1,2})?\s*:?\s*(?:\*{1,2})?\s*$',
    caseSensitive: false,
  );
  final inlineHeader = RegExp(
    r'^\s*(?:\*{1,2})?(?:giải thích(?:\s+ai)?|lời giải)(?:\*{1,2})?\s*:\s*(?:\*{1,2})?\s*',
    caseSensitive: false,
  );
  final cleanedLines = <String>[];
  for (var line in normalized.split('\n')) {
    if (standaloneHeader.hasMatch(line)) continue;
    line = line.replaceFirst(inlineHeader, '');
    line = line.replaceFirst(RegExp(r'^\s*[-*]\s+'), '• ');
    cleanedLines.add(line);
  }
  return cleanedLines.join('\n').replaceAll(RegExp(r'\n{3,}'), '\n\n').trim();
}

/// Renders reading explanations with lightweight inline **bold** support
/// so LLM output never leaks raw Markdown asterisks in the UI.
class ReadingFormattedText extends StatelessWidget {
  const ReadingFormattedText(this.text, {super.key, required this.style});

  final String text;
  final TextStyle style;

  static final RegExp _boldPattern = RegExp(r'\*\*(.+?)\*\*');

  @override
  Widget build(BuildContext context) {
    final cleaned = formatAiExplanationText(text);
    final matches = _boldPattern.allMatches(cleaned).toList();
    if (matches.isEmpty) {
      return Text(cleaned, style: style);
    }
    final spans = <InlineSpan>[];
    var cursor = 0;
    for (final match in matches) {
      if (match.start > cursor) {
        spans.add(TextSpan(text: cleaned.substring(cursor, match.start)));
      }
      spans.add(
        TextSpan(
          text: match.group(1),
          style: style.copyWith(
            fontWeight: FontWeight.w600,
            color: AppColors.grey900,
          ),
        ),
      );
      cursor = match.end;
    }
    if (cursor < cleaned.length) {
      spans.add(TextSpan(text: cleaned.substring(cursor)));
    }
    return Text.rich(TextSpan(style: style, children: spans));
  }
}

/// Highlighted passage quotation box reused across active feedback and review history.
class ReadingEvidenceQuote extends StatelessWidget {
  const ReadingEvidenceQuote(this.evidence, {super.key});

  final String evidence;

  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.fromLTRB(12, 12, 14, 12),
    decoration: BoxDecoration(
      color: const Color(0xFFFFFBEB),
      borderRadius: AppRadius.cardSm,
      border: Border.all(color: const Color(0xFFFDE68A)),
    ),
    child: IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            width: 3,
            decoration: const BoxDecoration(
              color: AppColors.warning200,
              borderRadius: BorderRadius.all(
                Radius.circular(AppRadius.xxs / 2),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.format_quote_rounded,
                      size: 15,
                      color: AppColors.warning300,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Dẫn chứng trong bài',
                      style: designText(
                        12,
                        weight: FontWeight.w600,
                        color: AppColors.warning300,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '"${evidence.trim()}"',
                  style: designText(14, color: AppColors.grey900, height: 1.5),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

/// Primary grading & curriculum explanation card shown immediately after checking an answer.
class ReadingAnswerFeedbackCard extends StatelessWidget {
  const ReadingAnswerFeedbackCard({
    super.key,
    required this.isCorrect,
    required this.explanation,
    this.evidence,
  });

  final bool isCorrect;
  final String explanation;
  final String? evidence;

  @override
  Widget build(BuildContext context) {
    final trimmedExplanation = explanation.trim();
    final trimmedEvidence = evidence?.trim() ?? '';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardRadius,
        border: Border.all(
          color: isCorrect ? AppColors.primary200 : AppColors.error25,
        ),
        boxShadow: AppShadows.level1,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isCorrect ? AppColors.primary25 : AppColors.error0,
                  border: Border.all(
                    color: isCorrect ? AppColors.primary200 : AppColors.error25,
                  ),
                ),
                child: Icon(
                  isCorrect ? Icons.check_rounded : Icons.close_rounded,
                  size: 18,
                  color: isCorrect ? AppColors.primary700 : AppColors.error200,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  isCorrect ? 'Chính xác!' : 'Chưa chính xác',
                  style: designHeading(
                    18,
                    color: isCorrect
                        ? AppColors.primary800
                        : AppColors.error200,
                  ),
                ),
              ),
            ],
          ),
          if (trimmedExplanation.isNotEmpty) ...[
            const SizedBox(height: 12),
            ReadingFormattedText(
              trimmedExplanation,
              style: designText(15, color: AppColors.grey800, height: 1.5),
            ),
          ],
          if (trimmedEvidence.isNotEmpty) ...[
            const SizedBox(height: 12),
            ReadingEvidenceQuote(trimmedEvidence),
          ],
        ],
      ),
    );
  }
}

/// On-demand AI explanation alongside the curriculum answer feedback.
class PracticeAiExplainCard extends StatelessWidget {
  const PracticeAiExplainCard({
    super.key,
    required this.questionId,
    required this.originalExplanation,
    required this.ai,
    required this.explaining,
    required this.errorText,
    required this.onExplain,
    this.listening = false,
  });

  final String questionId;
  final String originalExplanation;
  final Map<String, dynamic>? ai;
  final bool explaining;
  final String? errorText;
  final VoidCallback onExplain;
  final bool listening;

  @override
  Widget build(BuildContext context) {
    final actionKey = ValueKey('learning-ai-explain-$questionId');
    if (ai == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (errorText != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.error0,
                borderRadius: AppRadius.cardSm,
                border: Border.all(color: AppColors.error25),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    size: 16,
                    color: AppColors.error200,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      errorText!,
                      style: designText(
                        13,
                        color: AppColors.error200,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],
          Material(
            color: explaining ? AppColors.grey50 : AppColors.primary25,
            shape: RoundedRectangleBorder(
              borderRadius: AppRadius.cardRadius,
              side: BorderSide(
                color: explaining ? AppColors.grey200 : AppColors.primary200,
              ),
            ),
            child: InkWell(
              key: actionKey,
              onTap: explaining ? null : onExplain,
              borderRadius: AppRadius.cardRadius,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: AppRadius.tagRadius,
                        border: Border.all(
                          color: explaining
                              ? AppColors.grey200
                              : AppColors.primary100,
                        ),
                      ),
                      child: explaining
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: AppColors.primary600,
                              ),
                            )
                          : const Icon(
                              Icons.auto_awesome_rounded,
                              size: 20,
                              color: AppColors.primary600,
                            ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            explaining
                                ? 'Đang giải thích...'
                                : 'Hỏi AI giải thích thêm',
                            style: designText(
                              15,
                              weight: FontWeight.w600,
                              color: explaining
                                  ? AppColors.grey700
                                  : AppColors.primary900,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            explaining
                                ? (listening
                                      ? 'Trợ giảng AI đang đối chiếu bản chép lời…'
                                      : 'Trợ giảng AI đang đối chiếu bài đọc...')
                                : 'Phân tích chi tiết dựa trên đáp án bạn chọn',
                            style: designText(
                              13,
                              color: explaining
                                  ? AppColors.grey600
                                  : AppColors.primary700,
                              height: 1.35,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (!explaining) ...[
                      const SizedBox(width: 8),
                      const Icon(
                        Icons.chevron_right_rounded,
                        size: 22,
                        color: AppColors.primary600,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ],
      );
    }

    final text = formatAiExplanationText(ai!['explanation'] as String? ?? '');
    final originalClean = formatAiExplanationText(originalExplanation);
    final showExtraText = text.isNotEmpty && text != originalClean;

    if (ai!['source'] == 'AI') {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFF3FBF6),
          borderRadius: AppRadius.cardRadius,
          border: Border.all(color: AppColors.primary200),
          boxShadow: AppShadows.level1,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: AppRadius.tagRadius,
                    border: Border.all(color: AppColors.primary200),
                  ),
                  child: const Icon(
                    Icons.auto_awesome_rounded,
                    size: 17,
                    color: AppColors.primary600,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Giải thích AI',
                    style: designHeading(16, color: AppColors.primary900),
                  ),
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primary100,
                      borderRadius: AppRadius.pill,
                    ),
                    child: Text(
                      listening ? 'Theo bài nghe' : 'Theo bài đọc',
                      textAlign: TextAlign.center,
                      style: designText(
                        11,
                        weight: FontWeight.w600,
                        color: AppColors.primary800,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            if (showExtraText) ...[
              const SizedBox(height: 12),
              ReadingFormattedText(
                text,
                style: designText(15, color: AppColors.grey900, height: 1.55),
              ),
            ],
          ],
        ),
      );
    }

    final retryable = ai!['retryable'] != false;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.warning0,
        borderRadius: AppRadius.cardRadius,
        border: Border.all(color: AppColors.warning25),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 30,
                height: 30,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: AppRadius.tagRadius,
                  border: Border.all(color: AppColors.warning25),
                ),
                child: const Icon(
                  Icons.menu_book_rounded,
                  size: 17,
                  color: AppColors.warning300,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Giải thích từ học liệu',
                  style: designHeading(16, color: AppColors.grey900),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            retryable
                ? 'AI tạm thời chưa phản hồi. Bạn có thể giữ lời giải trên hoặc thử lại.'
                : (listening
                      ? 'Chưa đủ dẫn chứng để tạo giải thích AI. Bạn có thể xem lời giải của bài nghe.'
                      : 'Câu hỏi này cần toàn bộ ngữ cảnh bài đọc nên dùng lời giải từ học liệu.'),
            style: designText(14, color: AppColors.grey800, height: 1.45),
          ),
          if (showExtraText) ...[
            const SizedBox(height: 8),
            ReadingFormattedText(
              text,
              style: designText(14, color: AppColors.grey900, height: 1.5),
            ),
          ],
          if (errorText != null) ...[
            const SizedBox(height: 8),
            Text(
              errorText!,
              style: designText(13, color: AppColors.error200, height: 1.4),
            ),
          ],
          if (retryable) ...[
            const SizedBox(height: 12),
            OutlinedButton.icon(
              key: actionKey,
              onPressed: explaining ? null : onExplain,
              style: OutlinedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppColors.grey900,
                side: const BorderSide(color: AppColors.warning200),
                shape: const RoundedRectangleBorder(
                  borderRadius: AppRadius.buttonRadius,
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
              ),
              icon: explaining
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.refresh_rounded, size: 18),
              label: Text(
                explaining ? 'Đang giải thích...' : 'Thử lại giải thích AI',
                style: designText(
                  14,
                  weight: FontWeight.w600,
                  color: AppColors.grey900,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
