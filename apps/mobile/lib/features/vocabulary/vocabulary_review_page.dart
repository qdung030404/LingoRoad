import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_card_swiper/flutter_card_swiper.dart';
import 'package:mobile/core/theme/app_colors.dart';
import 'package:mobile/core/theme/app_spacing.dart';
import 'package:mobile/shared/app_button.dart';
import 'package:mobile/shared/figma_widgets.dart';
import 'package:mobile/features/learning/learning_widgets.dart';
import 'package:mobile/features/learning/learning_pages.dart' show LearningError;
import 'vocabulary_controller.dart';
import 'vocabulary_models.dart';
import 'vocabulary_review_controller.dart';
import 'widgets/vocabulary_flashcard_deck.dart';
import 'widgets/vocabulary_review_bottom_bar.dart';
import 'widgets/vocabulary_review_sheet.dart';
import 'widgets/vocabulary_srs_rating_bar.dart';

class VocabularyReviewPage extends StatefulWidget {
  const VocabularyReviewPage({
    super.key,
    required this.controller,
    required this.attemptId,
    this.initialAttempt,
  });

  final VocabularyController controller;
  final String attemptId;
  final VocabularyReviewAttempt? initialAttempt;

  @override
  State<VocabularyReviewPage> createState() => _VocabularyReviewPageState();
}

class _VocabularyReviewPageState extends State<VocabularyReviewPage>
    with WidgetsBindingObserver {
  late final review = VocabularyReviewController(owner: widget.controller);
  final CardSwiperController _swiperController = CardSwiperController();
  final GlobalKey<VocabularyFlashcardDeckState> _deckKey =
      GlobalKey<VocabularyFlashcardDeckState>();
  final AudioPlayer _audioPlayer = AudioPlayer();
  StreamSubscription<void>? _audioCompleteSub;
  StreamSubscription<PlayerState>? _audioStateSub;
  Timer? _flipDebounceTimer;

  bool _isFront = true;
  bool _isPlayingAudio = false;
  bool _isFlipping = false;
  bool submitting = false;
  bool leaving = false;
  String? lastItem;
  String? _playingWordId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _audioCompleteSub = _audioPlayer.onPlayerComplete.listen((_) {
      if (mounted) {
        setState(() => _isPlayingAudio = false);
      }
    });
    _audioStateSub = _audioPlayer.onPlayerStateChanged.listen((state) {
      if (state == PlayerState.completed || state == PlayerState.stopped) {
        if (mounted && _isPlayingAudio) {
          setState(() => _isPlayingAudio = false);
        }
      }
    });
    review.addListener(changed);
    review.load(widget.attemptId, initialAttempt: widget.initialAttempt);
  }

  void changed() {
    if (!mounted) return;
    if (lastItem != review.attempt?.current?.id) {
      lastItem = review.attempt?.current?.id;
      _isFront = true;
      _playingWordId = null;
      if (_isPlayingAudio) {
        unawaited(_audioPlayer.stop());
        _isPlayingAudio = false;
      }
    }
    setState(() {});
    final attempt = review.attempt;
    if (attempt != null &&
        !attempt.finished &&
        attempt.queue.isEmpty &&
        !review.busy &&
        !review.isSyncing &&
        !review.hasUncommittedBatch &&
        !review.hasPendingSingleCommand &&
        !review.conflict &&
        review.error == null &&
        !submitting) {
      submitting = true;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        if (mounted) {
          await review.submit();
          if (mounted) setState(() => submitting = false);
        }
      });
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) {
      _playingWordId = null;
      if (_isPlayingAudio) {
        unawaited(_audioPlayer.stop());
        _isPlayingAudio = false;
      }
      unawaited(checkpoint());
    } else if (review.attempt != null && !review.busy && !review.isSyncing) {
      review.load(widget.attemptId);
    }
  }

  Future<void> checkpoint() async {
    try {
      await review.checkpoint();
    } catch (e) {
      if (mounted) previewMessage(context, widget.controller.message(e));
    }
  }

  Future<void> exit() async {
    if (leaving || review.busy) return;
    leaving = true;
    var saved = true;
    try {
      saved = await review.checkpoint();
    } catch (_) {
      saved = false;
    }
    if (!mounted) return;
    if (!saved) {
      final leave = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Chưa đồng bộ tiến trình'),
          content: const Text(
            'Bản nháp và thao tác chờ vẫn được giữ trên thiết bị. Bạn muốn thoát để tiếp tục sau?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Ở lại'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Thoát'),
            ),
          ],
        ),
      );
      if (leave != true) {
        leaving = false;
        return;
      }
    }
    if (mounted) Navigator.pop(context);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _flipDebounceTimer?.cancel();
    review.removeListener(changed);
    review.dispose();
    _swiperController.dispose();
    _audioCompleteSub?.cancel();
    _audioStateSub?.cancel();
    unawaited(_audioPlayer.stop());
    _audioPlayer.dispose();
    super.dispose();
  }

  bool get disabled =>
      review.busy ||
      review.hasPendingSingleCommand ||
      review.conflict ||
      review.loading;

  Future<bool> action(Future<bool> Function() callback) async {
    FocusScope.of(context).unfocus();
    try {
      return await callback();
    } catch (e) {
      if (mounted) previewMessage(context, widget.controller.message(e));
      return false;
    }
  }

  Future<bool> _handleSwipedDirection(CardSwiperDirection direction) async {
    if (direction == CardSwiperDirection.right) {
      return await action(() => review.rate('EASY'));
    } else if (direction == CardSwiperDirection.left) {
      return await action(() => review.rate('HARD'));
    } else {
      return await action(() => review.rate('MEDIUM'));
    }
  }

  Future<void> _onPrimaryAction() async {
    if (disabled || review.attempt?.current == null || _isFlipping) return;
    if (_isFront) {
      _isFlipping = true;
      _deckKey.currentState?.toggleCurrentCard();
      setState(() => _isFront = false);
      _flipDebounceTimer?.cancel();
      _flipDebounceTimer = Timer(const Duration(milliseconds: 350), () {
        if (mounted) _isFlipping = false;
      });
    } else {
      // Khi đã ở mặt sau, bấm Tiếp theo mặc định giữ mức Trung bình (MEDIUM) theo chuẩn FSRS.
      // Vuốt lên (CardSwiperDirection.top) kích hoạt rate('MEDIUM')
      _swiperController.swipe(CardSwiperDirection.top);
    }
  }

  Future<void> _playCurrentWordAudio() async {
    final current = review.attempt?.current;
    if (current == null || _isPlayingAudio) return;
    final word = current.word.english;
    final wordId = current.word.id;
    _playingWordId = wordId;

    setState(() => _isPlayingAudio = true);
    try {
      await _audioPlayer.stop();
      var audioUrl = current.word.audioUrl;
      if (audioUrl == null || audioUrl.isEmpty) {
        final lookup = await widget.controller.lookupWord(word);
        if (_playingWordId != wordId || !mounted) return;
        audioUrl = lookup?['audioUrl']?.toString();
      }
      if (_playingWordId != wordId || !mounted) return;
      if (audioUrl != null && audioUrl.isNotEmpty) {
        await _audioPlayer.play(UrlSource(audioUrl));
      } else {
        if (mounted) {
          setState(() => _isPlayingAudio = false);
          previewMessage(context, 'Từ vựng này chưa có dữ liệu âm thanh.');
        }
      }
    } catch (e) {
      if (mounted && _playingWordId == wordId) {
        setState(() => _isPlayingAudio = false);
        previewMessage(context, 'Không thể phát âm thanh: ${widget.controller.message(e)}');
      }
    }
  }

  Future<void> abandon() async {
    if (disabled) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Kết thúc lượt ôn sớm?'),
        content: const Text(
          'Kết quả đã lưu được giữ lại. Những từ chưa xử lý không được tính là đã ôn.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Tiếp tục ôn'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Kết thúc'),
          ),
        ],
      ),
    );
    if (confirmed == true) await action(review.abandon);
  }

  @override
  Widget build(BuildContext context) {
    final attempt = review.attempt;
    return PopScope(
      canPop: leaving,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) exit();
      },
      child: FigmaPage(
        title: attempt?.deckName ?? 'Ôn từ vựng',
        leading: IconButton(
          key: const Key('vocabularySaveExit'),
          tooltip: 'Lưu và thoát',
          onPressed: review.busy ? null : exit,
          icon: const Icon(Icons.arrow_back_ios_new),
        ),
        trailing: attempt == null || attempt.finished
            ? null
            : PopupMenuButton<String>(
                enabled: !disabled,
                tooltip: 'Tùy chọn lượt ôn',
                onSelected: (val) {
                  if (val == 'skip') {
                    action(review.skip);
                  } else if (val == 'abandon') {
                    abandon();
                  }
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(
                    value: 'skip',
                    child: Text('Bỏ qua từ này'),
                  ),
                  PopupMenuItem(
                    value: 'abandon',
                    child: Text('Kết thúc lượt sớm'),
                  ),
                ],
              ),
        bottom: attempt == null
            ? null
            : attempt.finished
                ? completionActions()
                : VocabularyReviewBottomBar(
                    isFront: _isFront,
                    isPlayingAudio: _isPlayingAudio,
                    disabled: disabled || attempt.current == null,
                    onOpenDetails: () => showVocabularyReviewDetailsSheet(
                      context,
                      attempt,
                    ),
                    onPrimaryAction: _onPrimaryAction,
                    onPlayAudio: _playCurrentWordAudio,
                  ),
        child: attempt == null
            ? ListView(
                padding: AppSpacing.allMd,
                children: [
                  if (review.loading)
                    const Center(child: CircularProgressIndicator()),
                  if (review.error != null)
                    LearningError(
                      review.error!,
                      retry: () => review.load(widget.attemptId),
                    ),
                ],
              )
            : ListView(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacing.horizontal(context),
                  vertical: AppSpacing.sm,
                ),
                children: [
                  if (review.error != null)
                    LearningError(
                      review.error!,
                      retry: () => review.unsynced
                          ? review.retryPending()
                          : review.load(widget.attemptId),
                    ),
                  if (review.conflict)
                    TextButton(
                      key: const Key('vocabularyResolveConflict'),
                      onPressed: review.busy ? null : review.resolveConflict,
                      child: const Text('Giữ bản nháp và tải tiến trình mới'),
                    ),
                  if (review.recoveredDraft != null &&
                      review.recoveredDraft!.isNotEmpty)
                    SelectableText(
                      'Bản nháp chưa đồng bộ của bạn: ${review.recoveredDraft}',
                    ),
                  if (review.busy) const LinearProgressIndicator(),

                  if (attempt.finished)
                    completion()
                  else if (attempt.current == null) ...[
                    const SizedBox(height: AppSpacing.xxl),
                    if (review.error != null) ...[
                      const Center(
                        child: Text('Chưa đồng bộ được tổng kết lượt ôn.'),
                      ),
                      AppSpacing.gapSm,
                      Center(
                        child: TextButton(
                          key: const Key('vocabularyRetryFinalSubmit'),
                          onPressed: () => action(review.submit),
                          child: const Text('Lưu tổng kết'),
                        ),
                      ),
                    ] else ...[
                      const Center(child: CircularProgressIndicator()),
                      AppSpacing.gapMd,
                      const Center(child: Text('Đang lưu tổng kết lượt ôn…')),
                    ],
                  ] else ...[
                    // Tiến trình ôn tập
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                      child: Text(
                        '${attempt.count('reviewedCount')}/${attempt.count('totalCount')} từ đã ôn',
                        style: designText(14, color: AppColors.grey600),
                      ),
                    ),
                    AppSpacing.gapSm,

                    // Khung Flashcard với flutter_card_swiper + flip_card
                    VocabularyFlashcardDeck(
                      key: _deckKey,
                      attempt: attempt,
                      swiperController: _swiperController,
                      disabled: disabled,
                      onSwipedDirection: _handleSwipedDirection,
                      onFlipStateChanged: (isFront) {
                        setState(() => _isFront = isFront);
                      },
                    ),

                    AppSpacing.gapMd,

                    // 3 Nút Đánh giá SRS (Dễ / Trung bình / Khó)
                    VocabularySrsRatingBar(
                      enabled: !disabled,
                      selectedRating: review.selectedRating,
                      onRateEasy: () =>
                          _swiperController.swipe(CardSwiperDirection.right),
                      onRateMedium: () =>
                          _swiperController.swipe(CardSwiperDirection.top),
                      onRateHard: () =>
                          _swiperController.swipe(CardSwiperDirection.left),
                    ),

                    AppSpacing.gapMd,
                  ],
                ],
              ),
      ),
    );
  }

  Widget completion() {
    final attempt = review.attempt!;
    return LearningCard(
      key: const Key('vocabularyReviewComplete'),
      children: [
        learningHeading(
          attempt.status == 'ABANDONED'
              ? 'Đã dừng lượt ôn'
              : 'Đã hoàn thành lượt ôn',
          size: 28,
        ),
        Text(
          '${attempt.count('reviewedCount')} từ đã ôn · ${attempt.count('skippedCount')} bỏ qua',
          style: designText(18),
        ),
        const Text('Kết quả đánh giá SRS đã được lưu tự động vào tiến trình học.'),
        TextButton(
          onPressed: () => showVocabularyReviewDetailsSheet(context, attempt),
          child: const Text('Xem chi tiết từng từ'),
        ),
      ],
    );
  }

  Widget completionActions() => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CustomAppButton(
            key: const Key('vocabularyReplay'),
            text: 'Ôn lại tiếp',
            onPressed: widget.controller.busy
                ? null
                : () async {
                    try {
                      final next = await widget.controller.startReview(
                        review.attempt!.deckId,
                        scope: 'ALL',
                      );
                      if (!mounted || !widget.controller.active) return;
                      if (next == null) {
                        previewMessage(context, 'Bộ từ không còn từ để ôn.');
                        return;
                      }
                      await Navigator.of(context).pushReplacement<void, void>(
                        MaterialPageRoute(
                          builder: (_) => VocabularyReviewPage(
                            controller: widget.controller,
                            attemptId: next.id,
                          ),
                        ),
                      );
                    } catch (e) {
                      if (mounted) {
                        previewMessage(context, widget.controller.message(e));
                      }
                    }
                  },
          ),
          AppSpacing.gapMd,
          CustomAppButton(
            key: const Key('vocabularyReturnHome'),
            text: 'Quay về trang từ vựng',
            isSecondary: true,
            onPressed: disabled ? null : exit,
          ),
        ],
      );
}
