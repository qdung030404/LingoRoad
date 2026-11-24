import 'dart:async';
import 'package:flip_card/flip_card_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_card_swiper/flutter_card_swiper.dart';
import 'vocabulary_flip_card_item.dart';
import 'package:mobile/core/theme/app_spacing.dart';
import 'package:mobile/features/vocabulary/vocabulary_models.dart';

class VocabularyFlashcardDeck extends StatefulWidget {
  const VocabularyFlashcardDeck({
    super.key,
    required this.attempt,
    required this.swiperController,
    required this.onSwipedDirection,
    required this.onFlipStateChanged,
    required this.disabled,
  });

  final VocabularyReviewAttempt attempt;
  final CardSwiperController swiperController;
  final Future<bool> Function(CardSwiperDirection direction) onSwipedDirection;
  final ValueChanged<bool> onFlipStateChanged;
  final bool disabled;

  @override
  State<VocabularyFlashcardDeck> createState() =>
      VocabularyFlashcardDeckState();
}

class VocabularyFlashcardDeckState extends State<VocabularyFlashcardDeck> {
  final Map<String, FlipCardController> _flipControllers = {};
  List<VocabularyReviewItem> _deckItems = [];
  int _deckIndex = 0;
  int _swiperGeneration = 0;
  int _pendingSwipes = 0;

  FlipCardController _controllerFor(String id) {
    return _flipControllers.putIfAbsent(id, () => FlipCardController());
  }

  void toggleCurrentCard() {
    final currentId = widget.attempt.current?.id;
    if (currentId == null) return;
    _flipControllers[currentId]?.toggleCard();
  }

  List<VocabularyReviewItem> _buildQueueItems(VocabularyReviewAttempt attempt) {
    final current = attempt.current;
    if (current == null) return const [];
    final items = <VocabularyReviewItem>[current];
    final itemMap = attempt.itemMap;
    for (final id in attempt.queue) {
      if (id != current.id) {
        final match = itemMap[id];
        if (match != null) items.add(match);
      }
    }
    return items;
  }

  bool _isAlignedWithAttempt() {
    final current = widget.attempt.current;
    if (current == null) return _deckItems.isEmpty;
    if (_deckIndex < 0 || _deckIndex >= _deckItems.length) return false;
    if (_deckItems[_deckIndex].id != current.id) return false;
    final remaining = _deckItems.sublist(_deckIndex);
    final queue = widget.attempt.queue;
    if (remaining.length != queue.length) return false;
    for (var i = 0; i < queue.length; i++) {
      if (remaining[i].id != queue[i]) return false;
    }
    return true;
  }

  void _resetDeck() {
    _deckItems = _buildQueueItems(widget.attempt);
    _deckIndex = 0;
    _swiperGeneration++;
  }

  @override
  void initState() {
    super.initState();
    _deckItems = _buildQueueItems(widget.attempt);
  }

  @override
  void didUpdateWidget(covariant VocabularyFlashcardDeck oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.attempt.id != oldWidget.attempt.id) {
      _flipControllers.clear();
      _pendingSwipes = 0;
      _resetDeck();
      return;
    }
    if (_pendingSwipes == 0 && !_isAlignedWithAttempt()) {
      _resetDeck();
    }
  }

  @override
  void dispose() {
    _flipControllers.clear();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final current = widget.attempt.current;
    if (current == null || _deckItems.isEmpty) {
      return const SizedBox.shrink();
    }

    final cardHeight =
        (MediaQuery.sizeOf(context).height * 0.54).clamp(390.0, 520.0);

    return SizedBox(
      key: const Key('vocabularyFlashcard'),
      height: cardHeight + AppSpacing.lg,
      width: double.infinity,
      child: CardSwiper(
        key: ValueKey('swiper-${widget.attempt.id}-$_swiperGeneration'),
        controller: widget.swiperController,
        cardsCount: _deckItems.length,
        numberOfCardsDisplayed: _deckItems.length.clamp(1, 3),
        backCardOffset: const Offset(0, 14),
        scale: 0.94,
        isLoop: false,
        isDisabled: widget.disabled,
        allowedSwipeDirection: const AllowedSwipeDirection.only(
          left: true,
          right: true,
          up: true,
          down: false,
        ),
        onSwipe: (previousIndex, currentIndex, direction) {
          _pendingSwipes++;
          _deckIndex = currentIndex ?? _deckItems.length;
          widget.onFlipStateChanged(true);
          unawaited(() async {
            try {
              final success = await widget.onSwipedDirection(direction);
              if (!success && mounted) {
                _deckIndex = previousIndex;
                widget.swiperController.undo();
              }
            } finally {
              _pendingSwipes--;
              if (mounted && _pendingSwipes == 0 && !_isAlignedWithAttempt()) {
                setState(_resetDeck);
              }
            }
          }());
          return true;
        },
        cardBuilder: (context, index, percentX, percentY) {
          if (index < 0 || index >= _deckItems.length) return null;
          final item = _deckItems[index];
          final flipCtrl = _controllerFor(item.id);

          return VocabularyFlipCardItem(
            key: ValueKey('flashcard-${item.id}'),
            item: item,
            controller: flipCtrl,
            cardHeight: cardHeight,
            onFlipDone: (isFront) {
              if (item.id == widget.attempt.current?.id) {
                widget.onFlipStateChanged(isFront);
              }
            },
          );
        },
      ),
    );
  }
}
