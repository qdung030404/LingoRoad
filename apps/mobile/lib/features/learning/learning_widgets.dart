import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';

void previewMessage(BuildContext context, String text) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(text)));
}

Future<T?> previewPush<T>(BuildContext context, Widget page) =>
    Navigator.of(context).push<T>(MaterialPageRoute(builder: (_) => page));

class PreviewSurface extends StatelessWidget {
  const PreviewSurface({
    super.key,
    required this.child,
    this.showSampleLabel = true,
  });
  final Widget child;
  final bool showSampleLabel;

  @override
  Widget build(BuildContext context) => !showSampleLabel
      ? child
      : Stack(
          children: [
            child,
            Positioned(
              top: MediaQuery.paddingOf(context).top + 5,
              right: 16,
              child: IgnorePointer(
                child: Material(
                  color: Colors.transparent,
                  child: Text(
                    'Dữ liệu mẫu',
                    style: designText(10, color: AppColors.grey800),
                  ),
                ),
              ),
            ),
          ],
        );
}

class LearningCard extends StatelessWidget {
  const LearningCard({
    super.key,
    required this.children,
    this.gap = 16,
    this.onTap,
    this.onLongPress,
  });
  final List<Widget> children;
  final double gap;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;
  @override
  Widget build(BuildContext context) {
    final card = FigmaCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) SizedBox(height: gap),
            children[i],
          ],
        ],
      ),
    );
    return onTap == null && onLongPress == null
        ? card
        : Semantics(
            button: true,
            child: InkWell(
              onTap: onTap,
              onLongPress: onLongPress,
              borderRadius: AppRadius.cardRadius,
              child: card,
            ),
          );
  }
}

class LearningPill extends StatelessWidget {
  const LearningPill(
    this.text, {
    super.key,
    this.selected = false,
    this.onTap,
    this.icon,
    this.color,
    this.fill,
    this.small = false,
  });
  final String text;
  final bool selected, small;
  final VoidCallback? onTap;
  final Widget? icon;
  final Color? color, fill;
  @override
  Widget build(BuildContext context) => Material(
    color: fill ?? (selected ? AppColors.primary25 : Colors.white),
    shape: RoundedRectangleBorder(
      borderRadius: small ? AppRadius.tagRadius : AppRadius.buttonRadius,
      side: BorderSide(
        color: selected ? AppColors.primary500 : (fill ?? AppColors.grey200),
      ),
    ),
    child: InkWell(
      onTap: onTap,
      borderRadius: small ? AppRadius.tagRadius : AppRadius.buttonRadius,
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: small ? 12 : 20,
          vertical: small ? 9 : 11,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[icon!, const SizedBox(width: 8)],
            Text(
              text,
              style: designText(
                14,
                weight: FontWeight.w500,
                color:
                    color ??
                    (selected ? AppColors.primary500 : AppColors.grey900),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class PreviewLevelBadge extends StatelessWidget {
  const PreviewLevelBadge({super.key, this.onTap, this.label = 'A1'});
  final VoidCallback? onTap;
  final String label;
  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: const BorderRadius.all(Radius.circular(AppRadius.xs)),
    child: Container(
      height: 40,
      width: 40,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.primary25,
        border: Border.all(color: AppColors.primary200),
        borderRadius: const BorderRadius.all(Radius.circular(AppRadius.xs)),
      ),
      child: Text(
        label,
        maxLines: 1,
        softWrap: false,
        style: designText(14, color: AppColors.primary500),
      ),
    ),
  );
}

Widget learningHeading(String value, {double size = 20}) =>
    Text(value, style: designHeading(size, height: size >= 28 ? 1 : 1.2));
Widget learningBody(String value, {double size = 16}) =>
    Text(value, style: designText(size, color: AppColors.grey800));

class PreviewToolbar extends StatelessWidget {
  const PreviewToolbar({
    super.key,
    required this.index,
    required this.total,
    this.onBack,
    required this.onNext,
    this.onGrid,
    this.nextLabel = 'Tiếp theo',
  });
  final int index, total;
  final VoidCallback? onBack, onNext, onGrid;
  final String nextLabel;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      SizedBox(
        width: 48,
        child: CustomAppButton(
          text: '',
          isSecondary: true,
          onPressed: onBack,
          borderRadius: AppRadius.tagRadius,
          icon: const FigmaAsset(
            'vocabulary-word/imgVuesaxLinearArrowLeft1',
            size: 20,
          ),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: CustomAppButton(
          text: '${index + 1}/$total',
          isSecondary: true,
          onPressed:
              onGrid ??
              () => previewMessage(context, 'Câu ${index + 1} trên $total'),
          borderRadius: AppRadius.tagRadius,
          icon: const FigmaAsset(
            'vocabulary-word/imgVuesaxBoldCategory',
            size: 20,
          ),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: CustomAppButton(
          key: const Key('previewNext'),
          text: nextLabel,
          onPressed: onNext,
          borderRadius: AppRadius.tagRadius,
        ),
      ),
    ],
  );
}

class PreviewProgress extends StatelessWidget {
  const PreviewProgress({
    super.key,
    required this.index,
    required this.total,
    required this.label,
    this.sections = false,
  });
  final int index, total;
  final String label;
  final bool sections;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      if (sections)
        Row(
          children: [
            Expanded(
              child: LinearProgressIndicator(
                value: index / total,
                minHeight: 4,
                color: AppColors.primary500,
                backgroundColor: AppColors.grey200,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: Container(height: 4, color: AppColors.grey200)),
          ],
        )
      else
        ClipRRect(
          borderRadius: AppRadius.pill,
          child: LinearProgressIndicator(
            value: (index + 1) / total,
            minHeight: 4,
            backgroundColor: AppColors.grey200,
            color: AppColors.primary500,
          ),
        ),
      const SizedBox(height: 12),
      Text(
        label,
        style: designText(
          16,
          weight: FontWeight.w500,
          color: AppColors.grey800,
          height: 1.5,
        ),
      ),
      const SizedBox(height: 12),
    ],
  );
}

DateTime vietnamNow([DateTime? now]) =>
    (now ?? DateTime.now()).toUtc().add(const Duration(hours: 7));

const String learningHomeRouteName = 'learning-home';

class DashboardCard extends StatelessWidget {
  const DashboardCard({
    super.key,
    required this.child,
    this.padding = EdgeInsets.zero,
    this.radius,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final BorderRadiusGeometry? radius;
  @override
  Widget build(BuildContext context) => Container(
    clipBehavior: Clip.antiAlias,
    padding: padding,
    decoration: BoxDecoration(
      color: Colors.white,
      borderRadius: radius ?? AppRadius.dialogRadius,
      border: Border.all(color: AppColors.grey100),
      boxShadow: AppShadows.level1,
    ),
    child: child,
  );
}

class LearningGradientBackdrop extends StatelessWidget {
  const LearningGradientBackdrop({
    super.key,
    required this.scroll,
    this.scrollKey,
  });
  final ScrollController scroll;
  final Key? scrollKey;

  @override
  Widget build(BuildContext context) => Positioned(
    left: 0,
    right: 0,
    top: 0,
    height: 532,
    child: AnimatedBuilder(
      animation: scroll,
      child: Stack(
        fit: StackFit.expand,
        children: [
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment(-.3, -1),
                end: Alignment(.3, 1),
                colors: [
                  Color(0xFF1F452A),
                  Color(0xFF53AC69),
                  AppColors.grey25,
                ],
                stops: [.14353, .45387, .70454],
              ),
            ),
          ),
          Image.asset('assets/figma/home_v2_glow_3x.png', fit: BoxFit.fill),
        ],
      ),
      builder: (context, child) => Transform.translate(
        key: scrollKey,
        offset: Offset(0, scroll.hasClients ? -scroll.offset : 0),
        child: child,
      ),
    ),
  );
}

class LevelCupBadge extends StatelessWidget {
  const LevelCupBadge({super.key, required this.label, this.onTap});
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => InkWell(
    onTap: onTap,
    borderRadius: AppRadius.pill,
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.primary25,
        borderRadius: AppRadius.pill,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const FigmaAsset('home-v3/cup', size: 22),
          const SizedBox(width: 4),
          Text(
            label,
            style: designText(
              18,
              weight: FontWeight.w600,
              color: AppColors.primary600,
            ),
          ),
        ],
      ),
    ),
  );
}

/// Strips redundant AI heading labels (e.g. `**Giải thích:**`) and converts
/// Markdown list prefixes into clean bullets before rendering.
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

class _FeedbackStatusPill extends StatelessWidget {
  const _FeedbackStatusPill({
    required this.label,
    required this.backgroundColor,
    required this.borderColor,
    required this.textColor,
    required this.icon,
  });

  final String label;
  final Color backgroundColor, borderColor, textColor;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
    decoration: BoxDecoration(
      color: backgroundColor,
      borderRadius: AppRadius.pill,
      border: Border.all(color: borderColor),
    ),
    child: Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 15, color: textColor),
        const SizedBox(width: 5),
        Text(
          label,
          style: designText(12, weight: FontWeight.w600, color: textColor),
        ),
      ],
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

/// Synchronized question review card used in lesson completion and history detail screens.
class LearningResultQuestionCard extends StatelessWidget {
  const LearningResultQuestionCard({
    super.key,
    required this.index,
    required this.prompt,
    required this.options,
    required this.answer,
  });

  final int index;
  final String prompt;
  final List<Map<String, dynamic>> options;
  final Map<String, dynamic>? answer;

  @override
  Widget build(BuildContext context) {
    final checked = answer?['checked'] == true;
    final isCorrect = answer?['isCorrect'] == true;
    final explanation = (answer?['explanation'] as String? ?? '').trim();
    final evidence = (answer?['evidence'] as String? ?? '').trim();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardRadius,
        border: Border.all(
          color: !checked
              ? AppColors.grey100
              : isCorrect
              ? AppColors.primary200
              : AppColors.error25,
        ),
        boxShadow: AppShadows.level1,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: AppColors.grey25,
                  borderRadius: AppRadius.pill,
                  border: Border.all(color: AppColors.grey200),
                ),
                child: Text(
                  'Câu ${index + 1}',
                  style: designText(
                    12,
                    weight: FontWeight.w600,
                    color: AppColors.grey800,
                  ),
                ),
              ),
              const Spacer(),
              if (checked)
                _FeedbackStatusPill(
                  label: isCorrect ? 'Chính xác' : 'Chưa chính xác',
                  backgroundColor: isCorrect
                      ? AppColors.primary25
                      : AppColors.error0,
                  borderColor: isCorrect
                      ? AppColors.primary200
                      : AppColors.error25,
                  textColor: isCorrect
                      ? AppColors.primary700
                      : AppColors.error200,
                  icon: isCorrect
                      ? Icons.check_circle_rounded
                      : Icons.cancel_rounded,
                )
              else
                const _FeedbackStatusPill(
                  label: 'Chưa trả lời',
                  backgroundColor: AppColors.grey50,
                  borderColor: AppColors.grey200,
                  textColor: AppColors.grey600,
                  icon: Icons.help_outline_rounded,
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            prompt,
            style: designText(
              16,
              weight: FontWeight.w600,
              color: AppColors.grey900,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 12),
          for (final (optIndex, option) in options.indexed) ...[
            if (optIndex > 0) const SizedBox(height: 8),
            _ReviewOptionRow(
              letter: String.fromCharCode(65 + optIndex),
              text: option['text'] as String,
              chosen: option['id'] == answer?['optionId'],
              correct: checked && option['id'] == answer?['correctOptionId'],
            ),
          ],
          if (explanation.isNotEmpty) ...[
            const SizedBox(height: 12),
            ReadingFormattedText(
              explanation,
              style: designText(14, color: AppColors.grey800, height: 1.5),
            ),
          ],
          if (evidence.isNotEmpty) ...[
            const SizedBox(height: 12),
            ReadingEvidenceQuote(evidence),
          ],
        ],
      ),
    );
  }
}

class _ReviewOptionRow extends StatelessWidget {
  const _ReviewOptionRow({
    required this.letter,
    required this.text,
    required this.chosen,
    required this.correct,
  });

  final String letter;
  final String text;
  final bool chosen;
  final bool correct;

  @override
  Widget build(BuildContext context) {
    final wrongChoice = chosen && !correct;
    final bg = correct
        ? AppColors.primary25
        : wrongChoice
        ? AppColors.error0
        : AppColors.grey5;
    final border = correct
        ? AppColors.primary200
        : wrongChoice
        ? AppColors.error25
        : AppColors.grey100;
    final tone = correct
        ? AppColors.primary800
        : wrongChoice
        ? AppColors.error200
        : AppColors.grey800;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: AppRadius.cardSm,
        border: Border.all(color: border),
      ),
      child: Row(
        children: [
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: Colors.white,
              border: Border.all(color: border),
            ),
            child: Text(
              letter,
              style: designText(12, weight: FontWeight.w600, color: tone),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: designText(
                14,
                weight: (correct || chosen) ? FontWeight.w500 : FontWeight.w400,
                color: tone,
                height: 1.35,
              ),
            ),
          ),
          if (correct || wrongChoice) ...[
            const SizedBox(width: 8),
            Text(
              correct ? 'Đáp án' : 'Bạn chọn',
              style: designText(12, weight: FontWeight.w600, color: tone),
            ),
          ],
        ],
      ),
    );
  }
}
