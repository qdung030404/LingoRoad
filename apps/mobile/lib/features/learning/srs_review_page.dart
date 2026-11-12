import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import 'learning_widgets.dart';
import 'sample_audio.dart';
import 'word_library.dart';

part 'srs_review_cards.dart';

/// Local practice & SRS review for preview mode.
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
  late final WordDeck deck = widget.library.decks.firstWhere(
    (d) => d.id == widget.deckId,
    orElse: () => widget.library.decks.isNotEmpty
        ? widget.library.decks.first
        : WordDeck(widget.deckId, 'Bộ từ vựng', const []),
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

  void updateState(VoidCallback fn) => setState(fn);

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
}
