import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'learning_widgets.dart';
import 'sample_audio.dart';
import 'word_library.dart';

/// Local practice only. The legacy rating keys remain compatible with saved decks.
class SrsReviewPage extends StatefulWidget {
  const SrsReviewPage({
    super.key,
    required this.library,
    required this.deckId,
    this.onNavigate,
  });
  final WordLibrary library;
  final String deckId;
  final ValueChanged<int>? onNavigate;
  @override
  State<SrsReviewPage> createState() => _SrsReviewPageState();
}

class _SrsReviewPageState extends State<SrsReviewPage>
    with SingleTickerProviderStateMixin {
  late final ratingMotion = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 260),
  );
  String? selectedRating;
  bool enteringCard = false;
  late final deck = widget.library.decks.firstWhere(
    (d) => d.id == widget.deckId,
  );
  late List<PreviewWord> words = widget.library.due(deck);
  final answer = TextEditingController();
  final difficulties = <String, String>{};
  final savedIds = <String>{}, skippedIds = <String>{};
  int index = 0, stage = 0;
  bool checked = false, busy = false;
  double dragOffset = 0;
  bool dragging = false;
  String? inputError;
  bool get complete => index >= words.length;
  PreviewWord get word => words[index];
  String get difficulty => difficulties[word.id] ?? 'hard';
  bool get correct =>
      answer.text.trim().toLowerCase() == word.word.trim().toLowerCase();

  @override
  void dispose() {
    ratingMotion.dispose();
    answer.dispose();
    super.dispose();
  }

  void resetCard() {
    stage = 0;
    checked = false;
    inputError = null;
    answer.clear();
    dragOffset = 0;
    dragging = false;
  }

  void replay() {
    if (busy || deck.words.isEmpty) return;
    FocusScope.of(context).unfocus();
    setState(() {
      words = List<PreviewWord>.of(deck.words);
      index = 0;
      difficulties.clear();
      savedIds.clear();
      skippedIds.clear();
      resetCard();
    });
  }

  void returnToWords() {
    if (widget.onNavigate != null) {
      widget.onNavigate!(2);
    } else {
      Navigator.pop(context);
    }
  }

  void previous() {
    if (busy) return;
    FocusScope.of(context).unfocus();
    setState(() {
      if (stage > 0) {
        stage--;
        checked = false;
        inputError = null;
      } else if (index > 0) {
        index--;
        resetCard();
      }
    });
  }

  void skip() {
    if (busy || complete) return;
    FocusScope.of(context).unfocus();
    setState(() {
      if (!savedIds.contains(word.id)) skippedIds.add(word.id);
      index++;
      resetCard();
    });
  }

  void reviewLater() {
    if (busy || complete) return;
    FocusScope.of(context).unfocus();
    setState(() {
      // Keep visited cards available to Back; append exactly one future turn.
      if (index < words.length - 1) {
        words.add(word);
        index++;
      }
      resetCard();
    });
    previewMessage(context, 'Đã đưa từ xuống cuối hàng đợi để ôn lại.');
  }

  void endDrag(DragEndDetails details, double width) {
    if (busy || complete) return;
    final threshold = (width * .25).clamp(72.0, 110.0);
    final velocity = details.primaryVelocity ?? 0;
    final committed =
        dragOffset.abs() >= threshold ||
        (dragOffset.abs() >= 32 &&
            velocity.abs() >= 650 &&
            velocity.sign == dragOffset.sign);
    if (committed) {
      dragOffset < 0 ? skip() : reviewLater();
    } else {
      setState(() {
        dragging = false;
        dragOffset = 0;
      });
    }
  }

  Future<void> next() async {
    if (busy || complete) return;
    if (stage < 2) {
      setState(() => stage++);
      return;
    }
    if (answer.text.trim().isEmpty) {
      setState(() => inputError = 'Nhập từ tiếng Anh trước khi kiểm tra.');
      return;
    }
    FocusScope.of(context).unfocus();
    if (!checked) {
      setState(() => checked = true);
      return;
    }
    await rateAndAdvance(correct ? difficulty : 'forgot');
  }

  Future<void> rateAndAdvance(String rating, {bool quick = false}) async {
    if (busy || complete) return;
    final reviewedWord = word;
    FocusScope.of(context).unfocus();
    setState(() {
      busy = true;
      selectedRating = quick ? rating : null;
      enteringCard = false;
      dragging = false;
      dragOffset = 0;
    });
    try {
      await Future.wait([
        widget.library.rate(reviewedWord, rating),
        if (quick) Future<void>.delayed(const Duration(milliseconds: 1500)),
      ], eagerError: true);
      if (!mounted) return;
      final animate = quick && !MediaQuery.disableAnimationsOf(context);
      if (animate) await ratingMotion.forward().orCancel;
      if (!mounted) return;
      setState(() {
        difficulties[reviewedWord.id] = rating;
        savedIds.add(reviewedWord.id);
        skippedIds.remove(reviewedWord.id);
        index++;
        resetCard();
        selectedRating = null;
        enteringCard = true;
      });
      if (animate) await ratingMotion.reverse().orCancel;
    } catch (_) {
      if (mounted) {
        previewMessage(context, 'Không lưu được lượt ôn. Vui lòng thử lại.');
      }
    } finally {
      if (mounted) {
        ratingMotion.value = 0;
        setState(() {
          busy = false;
          selectedRating = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => PreviewSurface(
    child: FigmaPage(
      title: deck.name,
      titleStyle: designHeading(18),
      headerHeight: complete ? 42 : 52,
      leading: IconButton(
        tooltip: 'Quay lại bộ từ',
        onPressed: busy ? null : () => Navigator.pop(context),
        icon: const FigmaAsset('intro/imgVuesaxLinearArrowLeft', size: 24),
      ),
      bottom: complete ? _completionActions() : _toolbar(),
      child: _ratingTransition(
        complete
            ? _completion()
            : ListView(
                key: ValueKey('word-practice-$index'),
                padding: const EdgeInsets.all(16),
                children: [
                  if (stage == 2)
                    _recall()
                  else ...[
                    LayoutBuilder(
                      builder: (context, bounds) => Semantics(
                        button: true,
                        label: stage == 0
                            ? 'Lật thẻ xem nghĩa'
                            : 'Xem mặt trước',
                        customSemanticsActions: busy
                            ? null
                            : {
                                CustomSemanticsAction(label: 'Bỏ qua từ này'):
                                    skip,
                                CustomSemanticsAction(
                                  label: 'Ôn lại từ này sau',
                                ): reviewLater,
                              },
                        child: GestureDetector(
                          key: const Key('srsFlashcard'),
                          onHorizontalDragStart: busy
                              ? null
                              : (_) => setState(() => dragging = true),
                          onHorizontalDragUpdate: busy
                              ? null
                              : (details) => setState(() {
                                  dragOffset = (dragOffset + details.delta.dx)
                                      .clamp(-bounds.maxWidth, bounds.maxWidth);
                                }),
                          onHorizontalDragEnd: busy
                              ? null
                              : (details) => endDrag(details, bounds.maxWidth),
                          onHorizontalDragCancel: () => setState(() {
                            dragging = false;
                            dragOffset = 0;
                          }),
                          onTap: busy
                              ? null
                              : () =>
                                    setState(() => stage = stage == 0 ? 1 : 0),
                          child: AnimatedContainer(
                            key: const Key('flashcardSwipeTransform'),
                            duration:
                                dragging ||
                                    MediaQuery.disableAnimationsOf(context)
                                ? Duration.zero
                                : const Duration(milliseconds: 180),
                            curve: Curves.easeOutCubic,
                            transformAlignment: Alignment.bottomCenter,
                            transform:
                                Matrix4.translationValues(dragOffset, 0, 0)
                                  ..rotateZ(
                                    MediaQuery.disableAnimationsOf(context)
                                        ? 0
                                        : (dragOffset / bounds.maxWidth * .28)
                                              .clamp(-.14, .14),
                                  ),
                            child: Stack(
                              fit: StackFit.passthrough,
                              children: [
                                TweenAnimationBuilder<double>(
                                  key: ValueKey(word.id),
                                  tween: Tween(end: stage == 0 ? 0 : 1),
                                  duration:
                                      MediaQuery.disableAnimationsOf(context)
                                      ? Duration.zero
                                      : const Duration(milliseconds: 320),
                                  curve: Curves.easeInOutCubic,
                                  builder: (context, value, _) {
                                    final back = value > .5;
                                    return Transform(
                                      alignment: Alignment.center,
                                      transform: Matrix4.identity()
                                        ..setEntry(3, 2, .001)
                                        ..rotateY(value * math.pi),
                                      child: Transform(
                                        alignment: Alignment.center,
                                        transform: Matrix4.rotationY(
                                          back ? math.pi : 0,
                                        ),
                                        child: back
                                            ? _meaningCard()
                                            : _frontCard(),
                                      ),
                                    );
                                  },
                                ),
                                if (dragOffset != 0)
                                  _swipeFeedback(bounds.maxWidth),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    _difficultyChoices(),
                    const SizedBox(height: 12),
                    Text(
                      dragging && dragOffset.abs() > 16
                          ? (dragOffset < 0
                                ? '← Bỏ qua từ này'
                                : 'Ôn lại sau →')
                          : '← Bỏ qua  ·  Ôn lại sau →',
                      key: const Key('flashcardSwipeHint'),
                      textAlign: TextAlign.center,
                      style: designText(12, color: AppColors.grey800),
                    ),
                  ],
                ],
              ),
      ),
    ),
  );

  Widget _ratingTransition(Widget child) => AnimatedBuilder(
    animation: ratingMotion,
    child: child,
    builder: (context, child) {
      final progress = Curves.easeInOutCubic.transform(ratingMotion.value);
      return Opacity(
        key: const Key('ratingCardFade'),
        opacity: 1 - progress,
        child: Transform.translate(
          offset: Offset((enteringCard ? 1 : -1) * progress * 48, 0),
          child: child,
        ),
      );
    },
  );

  Widget _swipeFeedback(double width) {
    final skipWord = dragOffset < 0;
    final color = skipWord ? const Color(0xFFDC2626) : const Color(0xFF16A34A);
    final progress = (dragOffset.abs() / (width * .25)).clamp(0.0, 1.0);
    return Positioned.fill(
      child: IgnorePointer(
        child: ExcludeSemantics(
          child: Opacity(
            key: const Key('flashcardSwipeFeedback'),
            opacity: progress,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: color.withValues(alpha: .14),
                border: Border.all(color: color, width: 2),
                borderRadius: BorderRadius.circular(16),
              ),
              alignment: skipWord ? Alignment.topRight : Alignment.topLeft,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: .95),
                  border: Border.all(color: color, width: 2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  skipWord ? '← Bỏ qua' : 'Ôn lại sau →',
                  key: const Key('flashcardSwipeLabel'),
                  style: designText(18, weight: FontWeight.w600, color: color),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  PreviewWord? get fixture => sampleWordDecks
      .expand((d) => d.words)
      .where((w) => w.id == word.id)
      .firstOrNull;
  String get phonetic {
    // Only recover known fixture metadata for older saved decks, not custom words.
    final part = word.partOfSpeech.isNotEmpty
        ? word.partOfSpeech
        : fixture?.partOfSpeech ?? '';
    return [word.phonetic, part].where((s) => s.isNotEmpty).join(' · ');
  }

  String get translation => word.translation.isNotEmpty
      ? word.translation
      : fixture?.example == word.example
      ? fixture?.translation ?? ''
      : '';

  Widget _frontCard() => Container(
    height: 400,
    padding: const EdgeInsets.all(16),
    decoration: BoxDecoration(
      color: AppColors.grey5,
      border: Border.all(color: AppColors.grey100),
      borderRadius: BorderRadius.circular(16),
      boxShadow: const [
        BoxShadow(
          color: Color(0x0F0D2249),
          blurRadius: 2,
          offset: Offset(0, 1),
        ),
      ],
    ),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          word.word,
          textAlign: TextAlign.center,
          style: designHeading(36, height: 1),
        ),
        if (phonetic.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            phonetic,
            textAlign: TextAlign.center,
            style: designText(
              18,
              weight: FontWeight.w500,
              color: AppColors.grey800,
            ),
          ),
        ],
        const SizedBox(height: 16),
        _audio(),
      ],
    ),
  );

  Widget _meaningCard() => ConstrainedBox(
    constraints: const BoxConstraints(minHeight: 400),
    child: Center(
      child: FigmaCard(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (word.word.toLowerCase() == 'mother') ...[
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: SizedBox(
                  height: 180,
                  width: double.infinity,
                  child: LayoutBuilder(
                    builder: (context, bounds) => OverflowBox(
                      alignment: Alignment.topCenter,
                      maxHeight: 329,
                      child: FigmaAsset(
                        'vocabulary-word/imgImage59',
                        width: bounds.maxWidth,
                        height: 329,
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(word.word, style: designHeading(36, height: 1)),
                      if (phonetic.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text(
                          phonetic,
                          style: designText(
                            18,
                            weight: FontWeight.w500,
                            color: AppColors.grey800,
                          ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      Text(
                        'Định nghĩa : ${word.meaning}',
                        style: designText(18, weight: FontWeight.w500),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _audio(),
              ],
            ),
            if (word.example.isNotEmpty) ...[
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Divider(height: 1, color: AppColors.grey100),
              ),
              _example(),
              if (translation.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  translation,
                  style: designText(
                    18,
                    weight: FontWeight.w500,
                    color: AppColors.grey800,
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    ),
  );

  Widget _example() {
    final offset = word.example.toLowerCase().indexOf(word.word.toLowerCase());
    return Text.rich(
      TextSpan(
        style: designText(18, weight: FontWeight.w500),
        children: offset < 0
            ? [TextSpan(text: word.example)]
            : [
                TextSpan(
                  text: word.example.substring(0, offset + word.word.length),
                  style: const TextStyle(
                    color: AppColors.primary500,
                    decoration: TextDecoration.underline,
                  ),
                ),
                TextSpan(
                  text: word.example.substring(offset + word.word.length),
                ),
              ],
      ),
    );
  }

  Widget _audio() {
    final key = word.word.toLowerCase();
    if (const [
      'mother',
      'father',
      'sister',
      'brother',
      'parents',
      'grandmother',
      'grandfather',
      'daughter',
      'son',
      'family',
    ].contains(key)) {
      return SampleAudio(
        key: ValueKey('review-audio-${word.id}-$stage'),
        asset: key,
        label: 'Nghe ${word.word}',
        dark: true,
      );
    }
    return IconButton(
      tooltip: 'Nghe ${word.word}',
      onPressed: () =>
          previewMessage(context, 'Từ này chưa có audio trong bản mẫu.'),
      style: IconButton.styleFrom(
        backgroundColor: AppColors.grey900,
        fixedSize: const Size(48, 48),
      ),
      icon: const FigmaAsset(
        'vocabulary-word/imgVuesaxLinearVolumeHigh',
        size: 20,
      ),
    );
  }

  Widget _difficultyChoices() => Wrap(
    alignment: WrapAlignment.center,
    spacing: 12,
    runSpacing: 8,
    children: [
      for (final item in [
        (
          'Dễ',
          'remember',
          const Color(0xFF0A5D21),
          const Color(0xFFEDFAF0),
          const Color(0xFF93F3AA),
        ),
        (
          'Trung bình',
          'hard',
          const Color(0xFFCA8A04),
          const Color(0xFFFFF7EA),
          const Color(0xFFF4DFB2),
        ),
        (
          'Khó',
          'forgot',
          const Color(0xFF861C13),
          const Color(0xFFFDF4F3),
          const Color(0xFFFCD0CC),
        ),
      ])
        Semantics(
          selected: selectedRating == item.$2,
          child: OutlinedButton(
            key: Key('srs-${item.$2}'),
            onPressed: busy ? null : () => rateAndAdvance(item.$2, quick: true),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 40),
              padding: const EdgeInsets.symmetric(horizontal: 20),
              backgroundColor: selectedRating == item.$2 ? item.$3 : item.$4,
              disabledBackgroundColor: selectedRating == item.$2
                  ? item.$3
                  : item.$4,
              foregroundColor: item.$3,
              disabledForegroundColor: selectedRating == item.$2
                  ? Colors.white
                  : item.$3,
              side: BorderSide(
                color: selectedRating == item.$2 ? item.$3 : item.$5,
                width: selectedRating == item.$2 ? 2 : 1,
              ),
            ),
            child: Text(
              item.$1,
              style: designText(
                14,
                weight: selectedRating == item.$2
                    ? FontWeight.w700
                    : FontWeight.w500,
                color: selectedRating == item.$2 ? Colors.white : item.$3,
              ),
            ),
          ),
        ),
    ],
  );

  Widget _recall() => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      FigmaCard(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            _audio(),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (phonetic.isNotEmpty)
                    Text(
                      phonetic,
                      style: designText(
                        18,
                        weight: FontWeight.w500,
                        color: AppColors.grey800,
                      ),
                    ),
                  const SizedBox(height: 8),
                  Text(
                    'Định nghĩa : ${word.meaning}',
                    style: designText(18, weight: FontWeight.w500),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 32),
      Text('Viết lại từ', style: designHeading(18)),
      const SizedBox(height: 24),
      TextField(
        key: const Key('wordRecallAnswer'),
        controller: answer,
        enabled: !busy,
        autocorrect: false,
        enableSuggestions: false,
        textInputAction: TextInputAction.done,
        minLines: 4,
        maxLines: 4,
        style: designText(14),
        onChanged: (_) => setState(() {
          checked = false;
          inputError = null;
        }),
        onSubmitted: (_) => next(),
        decoration: InputDecoration(
          hintText: 'Đáp án của bạn....',
          hintStyle: designText(14, color: AppColors.grey800),
          errorText: inputError,
          filled: true,
          fillColor: const Color(0xFFEDF1F6),
          contentPadding: const EdgeInsets.all(12),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: AppColors.primary500),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: AppColors.primary500),
          ),
        ),
      ),
      if (checked) ...[
        const SizedBox(height: 16),
        Semantics(
          liveRegion: true,
          child: Text(
            correct ? 'Chính xác!' : 'Chưa đúng. Đáp án: ${word.word}',
            style: designText(
              16,
              weight: FontWeight.w500,
              color: correct ? AppColors.primary600 : const Color(0xFF861C13),
            ),
          ),
        ),
      ],
    ],
  );

  Widget _toolbar() => Row(
    children: [
      SizedBox(
        width: 48,
        height: 48,
        child: OutlinedButton(
          key: const Key('wordPracticeBack'),
          onPressed: busy || (index == 0 && stage == 0) ? null : previous,
          style: OutlinedButton.styleFrom(
            padding: EdgeInsets.zero,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            backgroundColor: Colors.white,
          ),
          child: const FigmaAsset('intro/imgVuesaxLinearArrowLeft', size: 20),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: _action(
          'Bỏ từ này',
          skip,
          secondary: true,
          key: const Key('skipPracticeWord'),
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: _action('Tiếp theo', next, key: const Key('wordPracticeNext')),
      ),
    ],
  );

  Widget _action(
    String text,
    VoidCallback onTap, {
    bool secondary = false,
    Key? key,
  }) => SizedBox(
    height: 48,
    child: FilledButton(
      key: key,
      onPressed: busy ? null : onTap,
      style: FilledButton.styleFrom(
        backgroundColor: secondary ? Colors.white : AppColors.grey900,
        foregroundColor: secondary ? AppColors.grey900 : Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        side: secondary ? const BorderSide(color: AppColors.grey200) : null,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      child: Text(
        text,
        style: designText(
          18,
          weight: FontWeight.w500,
          color: secondary ? AppColors.grey900 : Colors.white,
        ),
      ),
    ),
  );

  Widget _completion() => ListView(
    padding: const EdgeInsets.all(16),
    children: [
      FigmaCard(
        key: const Key('wordReviewCompletion'),
        child: Column(
          children: [
            Text(
              deck.words.isEmpty ? 'Bộ từ chưa có từ vựng' : 'Bạn đã ôn hết từ',
              textAlign: TextAlign.center,
              style: designHeading(28, height: 1),
            ),
            const SizedBox(height: 12),
            Text(
              deck.words.isEmpty
                  ? 'Thêm từ vào bộ từ để bắt đầu ôn tập.'
                  : 'Không còn từ vựng mới để ôn tập nữa',
              textAlign: TextAlign.center,
              style: designText(
                18,
                weight: FontWeight.w500,
                color: AppColors.grey800,
              ),
            ),
          ],
        ),
      ),
    ],
  );

  Widget _completionActions() => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      CustomAppButton(
        key: const Key('replayWordDeck'),
        text: 'Ôn lại tiếp',
        onPressed: busy || deck.words.isEmpty ? null : replay,
      ),
      const SizedBox(height: 16),
      CustomAppButton(
        key: const Key('returnToMyWords'),
        text: 'Quay về trang từ vựng',
        isSecondary: true,
        onPressed: busy ? null : returnToWords,
      ),
    ],
  );
}
