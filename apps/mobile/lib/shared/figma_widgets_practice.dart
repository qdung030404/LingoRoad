part of 'figma_widgets.dart';

class KeyVocabularySection extends StatelessWidget {
  const KeyVocabularySection({
    super.key,
    required this.items,
    this.header,
    this.compact = false,
    this.savedWordKeysListenable,
    this.savingWordKeysListenable,
    this.onSaveWord,
  });

  final List<Map<String, dynamic>> items;
  final Widget? header;
  final bool compact;
  final ValueListenable<Set<String>>? savedWordKeysListenable;
  final ValueListenable<Set<String>>? savingWordKeysListenable;
  final Future<void> Function(Map<String, dynamic> word)? onSaveWord;

  @override
  Widget build(BuildContext context) {
    final listenables = <Listenable>[
      ?savedWordKeysListenable,
      ?savingWordKeysListenable,
    ];
    if (listenables.isEmpty) return _buildList(context);
    return ListenableBuilder(
      listenable: Listenable.merge(listenables),
      builder: (context, _) => _buildList(context),
    );
  }

  Widget _buildList(BuildContext context) {
    final savedKeys = savedWordKeysListenable?.value ?? const <String>{};
    final savingKeys = savingWordKeysListenable?.value ?? const <String>{};
    return FigmaCard(
      padding: header != null
          ? EdgeInsets.fromLTRB(16, compact ? 14 : 16, 16, compact ? 14 : 16)
          : const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (header != null) ...[header!, SizedBox(height: compact ? 12 : 14)],
          for (final (index, item) in items.indexed) ...[
            if (index > 0) SizedBox(height: compact ? 8 : 10),
            _buildWordTile(context, item, savedKeys, savingKeys),
          ],
        ],
      ),
    );
  }

  Widget _buildWordTile(
    BuildContext context,
    Map<String, dynamic> item,
    Set<String> savedKeys,
    Set<String> savingKeys,
  ) {
    final id = item['id']?.toString() ?? '';
    final word = (item['word'] as String? ?? '').trim();
    final phonetic = (item['phonetic'] as String? ?? '').trim();
    final meaning = (item['meaning'] as String? ?? '').trim();
    final example = (item['example'] as String? ?? '').trim();
    final saveKey = readingWordSaveKey(word, meaning);
    final saved = savedKeys.contains(saveKey);
    final saving = savingKeys.contains(saveKey);

    return PracticeVocabularyCard(
      word: word,
      phonetic: phonetic,
      meaning: meaning,
      example: example,
      imageUrl: item['imageUrl'] as String?,
      compact: compact,
      highlighted: saved,
      trailing: onSaveWord == null
          ? null
          : _buildSaveWordButton(
              id: id,
              word: word,
              saved: saved,
              saving: saving,
              item: item,
            ),
    );
  }

  Widget _buildSaveWordButton({
    required String id,
    required String word,
    required bool saved,
    required bool saving,
    required Map<String, dynamic> item,
  }) {
    final key = ValueKey('reading-save-word-${id.isNotEmpty ? id : word}');
    final buttonShape = RoundedRectangleBorder(borderRadius: AppRadius.pill);
    const buttonPadding = EdgeInsets.symmetric(horizontal: 10, vertical: 6);
    if (saved) {
      return OutlinedButton.icon(
        key: key,
        onPressed: null,
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFF0A5D21),
          disabledForegroundColor: const Color(0xFF0A5D21),
          side: const BorderSide(color: AppColors.primary200),
          backgroundColor: AppColors.primary25,
          padding: buttonPadding,
          minimumSize: const Size(0, 32),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          shape: buttonShape,
        ),
        icon: const Icon(Icons.check_rounded, size: 15),
        label: Text(
          'Đã lưu',
          style: designText(
            12,
            weight: FontWeight.w600,
            color: const Color(0xFF0A5D21),
          ),
        ),
      );
    }
    return OutlinedButton.icon(
      key: key,
      onPressed: saving ? null : () => onSaveWord!(item),
      style: OutlinedButton.styleFrom(
        foregroundColor: AppColors.primary700,
        side: const BorderSide(color: AppColors.primary200),
        backgroundColor: AppColors.grey0,
        padding: buttonPadding,
        minimumSize: const Size(0, 32),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: buttonShape,
      ),
      icon: saving
          ? const SizedBox(
              width: 13,
              height: 13,
              child: CircularProgressIndicator(strokeWidth: 1.8),
            )
          : const Icon(Icons.bookmark_add_outlined, size: 15),
      label: Text(
        saving ? 'Đang lưu...' : 'Lưu',
        style: designText(
          12,
          weight: FontWeight.w600,
          color: AppColors.primary700,
        ),
      ),
    );
  }
}

class PracticeAnswerTile extends StatelessWidget {
  const PracticeAnswerTile({
    super.key,
    required this.index,
    required this.text,
    this.selected = false,
    this.correct = false,
    this.wrong = false,
    this.showSelectionCheck = true,
    this.label,
    this.onTap,
  });

  final int index;
  final String text;
  final bool selected, correct, wrong, showSelectionCheck;
  final String? label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tone = wrong
        ? const Color(0xFFCA8A04)
        : correct
        ? const Color(0xFF0A5D21)
        : selected
        ? AppColors.primary500
        : AppColors.grey900;
    final borderColor = wrong
        ? const Color(0xFFFFCC01)
        : correct
        ? const Color(0xFF049228)
        : selected
        ? AppColors.primary500
        : AppColors.grey100;
    final fillColor = wrong
        ? AppColors.warning0
        : correct
        ? AppColors.primary25
        : selected
        ? AppColors.grey0
        : AppColors.grey5;
    final circleFill = wrong
        ? const Color(0xFFF4DFB2)
        : correct
        ? AppColors.primary100
        : selected
        ? AppColors.primary25
        : AppColors.grey25;
    final circleBorder = wrong
        ? const Color(0xFFFFCC01)
        : correct
        ? const Color(0xFF049228)
        : selected
        ? AppColors.primary100
        : AppColors.grey100;
    final letter = String.fromCharCode(65 + index);
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(99),
      side: BorderSide(color: borderColor),
    );
    return Semantics(
      button: onTap != null,
      selected: selected,
      label: 'Đáp án $letter',
      child: Material(
        shape: shape,
        color: fillColor,
        child: InkWell(
          customBorder: shape,
          onTap: onTap,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 60),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 9, 16, 9),
              child: Row(
                children: [
                  Container(
                    constraints: const BoxConstraints(
                      minWidth: 42,
                      minHeight: 42,
                    ),
                    padding: const EdgeInsets.all(4),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: circleFill,
                      border: Border.all(color: circleBorder),
                    ),
                    child: Text(letter, style: designHeading(18, color: tone)),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          text,
                          style: designText(
                            15,
                            weight: FontWeight.w500,
                            color: tone,
                            height: 1.35,
                          ),
                        ),
                        if (label != null)
                          Text(
                            label!,
                            style: designText(
                              12,
                              color: tone,
                              weight: FontWeight.w600,
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (correct || wrong) ...[
                    const SizedBox(width: 8),
                    FigmaAsset(
                      wrong
                          ? 'review/imgVuesaxLinearInfoCircle'
                          : 'review/imgVuesaxLinearTickCircle',
                      size: 20,
                    ),
                  ] else if (showSelectionCheck && selected) ...[
                    const SizedBox(width: 8),
                    const FigmaAsset('listening/imgCheck', size: 20),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class AnswerOption extends StatelessWidget {
  const AnswerOption({
    super.key,
    required this.index,
    required this.text,
    this.selected = false,
    this.onTap,
    this.correct,
    this.chosen = false,
    this.showSelectionCheck = true,
    this.compact = false,
  });
  final int index;
  final String text;
  final bool selected, chosen;
  final bool showSelectionCheck, compact;
  final bool? correct;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    if (compact) {
      return PracticeAnswerTile(
        index: index,
        text: text,
        selected: selected,
        correct: correct == true,
        wrong: correct == false && chosen,
        showSelectionCheck: showSelectionCheck,
        label: correct == true
            ? 'Đúng'
            : correct == false && chosen
            ? 'Sai'
            : null,
        onTap: onTap,
      );
    }
    final tone = correct == true
        ? const Color(0xFF0A5D21)
        : correct == false && chosen
        ? const Color(0xFFCA8A04)
        : selected
        ? AppColors.primary500
        : AppColors.grey900;
    final border = correct == true
        ? const Color(0xFF049228)
        : correct == false && chosen
        ? const Color(0xFFFFCC01)
        : selected
        ? AppColors.primary500
        : AppColors.grey100;
    final fill = correct == true
        ? AppColors.primary25
        : correct == false && chosen
        ? const Color(0xFFFFF7EA)
        : selected
        ? Colors.white
        : AppColors.grey5;
    return Semantics(
      button: onTap != null,
      selected: selected,
      child: Material(
        color: fill,
        shape: RoundedRectangleBorder(
          side: BorderSide(color: border),
          borderRadius: AppRadius.buttonRadius,
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.buttonRadius,
          child: ConstrainedBox(
            constraints: const BoxConstraints(minHeight: 72),
            child: Padding(
              padding: EdgeInsets.fromLTRB(
                12,
                12,
                correct == null ? 12 : 24,
                12,
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: correct == false && chosen
                          ? const Color(0xFFF4DFB2)
                          : correct == true
                          ? AppColors.primary100
                          : selected
                          ? AppColors.primary25
                          : AppColors.grey25,
                      border: Border.all(
                        color: correct == false && chosen
                            ? const Color(0xFFFFCC01)
                            : correct == true
                            ? const Color(0xFF049228)
                            : selected
                            ? AppColors.primary100
                            : AppColors.grey100,
                      ),
                    ),
                    child: Text(
                      String.fromCharCode(65 + index),
                      style: designText(
                        20,
                        weight: FontWeight.w600,
                        color: tone,
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      text,
                      style: designText(
                        16,
                        weight: FontWeight.w500,
                        color: tone,
                        height: 1.35,
                      ),
                    ),
                  ),
                  if (showSelectionCheck && selected && correct == null)
                    const Padding(
                      padding: EdgeInsets.only(left: 8),
                      child: FigmaAsset('reading/imgCheck'),
                    ),
                  if (correct != null && (chosen || correct == true))
                    Padding(
                      padding: const EdgeInsets.only(left: 8),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          FigmaAsset(
                            correct == true
                                ? 'review/imgVuesaxLinearTickCircle'
                                : 'review/imgVuesaxLinearInfoCircle',
                            size: 20,
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Text(
                            correct == true ? 'Đáp án' : 'Bạn chọn',
                            style: designText(16, color: tone),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class SectionProgress extends StatelessWidget {
  const SectionProgress({super.key, required this.index});
  final int index;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      for (var part = 0; part < 2; part++) ...[
        if (part != 0) const SizedBox(width: 12),
        Expanded(
          child: ClipRRect(
            borderRadius: AppRadius.pill,
            child: LinearProgressIndicator(
              minHeight: 4,
              value: ((index - part * 5) / 5).clamp(0, 1),
              color: AppColors.primary500,
              backgroundColor: AppColors.grey200,
              semanticsLabel: part == 0
                  ? 'Tiến độ phần Đọc'
                  : 'Tiến độ phần Nghe',
            ),
          ),
        ),
      ],
    ],
  );
}

bool hasVisualImageOptions(List<Map<String, dynamic>> options) =>
    options.length == 4 &&
    options.every(
      (option) => (option['imageUrl'] as String?)?.trim().isNotEmpty == true,
    );

/// 2x2 visual MCQ option grid rendered inside vertical scrolling lists without
/// triggering GridView unbounded viewport height errors.
class PracticeImageAnswerGrid extends StatelessWidget {
  const PracticeImageAnswerGrid({
    super.key,
    required this.options,
    required this.checked,
    this.selectedOptionId,
    this.correctOptionId,
    this.onSelect,
    this.keyPrefix = 'learning-option-',
    this.showReviewLabels = false,
  });

  final List<Map<String, dynamic>> options;
  final bool checked;
  final String? selectedOptionId;
  final String? correctOptionId;
  final ValueChanged<String>? onSelect;
  final String keyPrefix;
  final bool showReviewLabels;

  @override
  Widget build(BuildContext context) {
    final rows = <List<int>>[
      [for (var i = 0; i < math.min(2, options.length); i++) i],
      if (options.length > 2)
        [for (var i = 2; i < math.min(4, options.length); i++) i],
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final (rowIndex, row) in rows.indexed) ...[
          if (rowIndex > 0) const SizedBox(height: 10),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (final (colIndex, optIndex) in row.indexed) ...[
                  if (colIndex > 0) const SizedBox(width: 10),
                  Expanded(child: _buildOptionCard(optIndex, options[optIndex])),
                ],
                if (row.length == 1) const Expanded(child: SizedBox.shrink()),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildOptionCard(int index, Map<String, dynamic> option) {
    final optionId = option['id'] as String;
    final text = option['text'] as String? ?? '';
    final imageUrl = option['imageUrl'] as String?;
    final selected = selectedOptionId == optionId;
    final correct = checked && correctOptionId == optionId;
    final wrong = checked && selected && correctOptionId != optionId;
    final letter = String.fromCharCode(65 + index);
    final label = showReviewLabels
        ? switch ((correct, selected)) {
            (true, true) => 'Đáp án đúng · Bạn chọn',
            (true, false) => 'Đáp án đúng',
            (false, true) => 'Bạn chọn',
            _ => null,
          }
        : correct
        ? 'Đúng'
        : wrong
        ? 'Sai'
        : null;

    final borderColor = wrong
        ? const Color(0xFFFFCC01)
        : correct
        ? const Color(0xFF049228)
        : selected
        ? AppColors.primary500
        : AppColors.grey100;
    final fillColor = wrong
        ? AppColors.warning0
        : correct
        ? AppColors.primary25
        : selected
        ? AppColors.grey0
        : AppColors.grey5;
    final badgeFill = wrong
        ? const Color(0xFFF4DFB2)
        : correct
        ? AppColors.primary100
        : selected
        ? AppColors.primary25
        : AppColors.grey25;
    final tone = wrong
        ? const Color(0xFFCA8A04)
        : correct
        ? const Color(0xFF0A5D21)
        : selected
        ? AppColors.primary600
        : AppColors.grey900;

    return Semantics(
      button: onSelect != null,
      selected: selected,
      label: 'Đáp án $letter: $text',
      child: Material(
        color: fillColor,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.cardRadius,
          side: BorderSide(
            color: borderColor,
            width: selected || correct ? 1.5 : 1,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          key: ValueKey('$keyPrefix$optionId'),
          onTap: onSelect == null ? null : () => onSelect!(optionId),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Stack(
                  children: [
                    ClipRRect(
                      borderRadius: AppRadius.cardSm,
                      child: AspectRatio(
                        aspectRatio: 4 / 3,
                        child: LearningMediaImage(
                          imageUrl: imageUrl,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          semanticLabel: text,
                        ),
                      ),
                    ),
                    Positioned(
                      top: 6,
                      left: 6,
                      child: Container(
                        width: 26,
                        height: 26,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: badgeFill,
                          border: Border.all(color: borderColor),
                        ),
                        child: Text(
                          letter,
                          style: designText(
                            12,
                            weight: FontWeight.w700,
                            color: tone,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  text,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: designText(
                    14,
                    weight: FontWeight.w600,
                    color: AppColors.grey900,
                    height: 1.3,
                  ),
                ),
                if (label != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    label,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: designText(
                      12,
                      weight: FontWeight.w600,
                      color: tone,
                      height: 1.25,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

