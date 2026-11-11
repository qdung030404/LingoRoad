import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../learning/learning_widgets.dart';
import '../learning/learning_pages.dart' show LearningError;
import 'vocabulary_controller.dart';
import 'vocabulary_models.dart';
import 'vocabulary_review_controller.dart';

class VocabularyReviewPage extends StatefulWidget {
  const VocabularyReviewPage({
    super.key,
    required this.controller,
    required this.attemptId,
  });
  final VocabularyController controller;
  final String attemptId;
  @override
  State<VocabularyReviewPage> createState() => _VocabularyReviewPageState();
}

class _VocabularyReviewPageState extends State<VocabularyReviewPage>
    with WidgetsBindingObserver {
  late final review = VocabularyReviewController(owner: widget.controller);
  final input = TextEditingController();
  double drag = 0;
  bool dragging = false, submitting = false, leaving = false;
  String? lastItem;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    review.addListener(changed);
    review.load(widget.attemptId);
  }

  void changed() {
    if (!mounted) return;
    if (lastItem != review.attempt?.current?.id) {
      lastItem = review.attempt?.current?.id;
      drag = 0;
      dragging = false;
    }
    if (input.text != review.draft) {
      input.value = TextEditingValue(
        text: review.draft,
        selection: TextSelection.collapsed(offset: review.draft.length),
      );
    }
    setState(() {});
    final attempt = review.attempt;
    if (attempt != null &&
        !attempt.finished &&
        attempt.queue.isEmpty &&
        !review.busy &&
        !review.unsynced &&
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
      unawaited(checkpoint());
    } else if (review.attempt != null && !review.busy) {
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
    review.removeListener(changed);
    review.dispose();
    input.dispose();
    super.dispose();
  }

  bool get disabled => review.busy || review.unsynced || review.loading;
  Future<void> action(Future<bool> Function() callback) async {
    FocusScope.of(context).unfocus();
    try {
      await callback();
    } catch (e) {
      if (mounted) previewMessage(context, widget.controller.message(e));
    }
    if (mounted) {
      setState(() {
        drag = 0;
        dragging = false;
      });
    }
  }

  Future<void> endDrag(DragEndDetails details, double width) async {
    if (disabled) return;
    final velocity = details.primaryVelocity ?? 0;
    final committed =
        drag.abs() >= (width * .25).clamp(72, 110) ||
        (drag.abs() >= 32 &&
            velocity.abs() >= 650 &&
            velocity.sign == drag.sign);
    if (committed) {
      await action(drag < 0 ? review.skip : review.requeue);
    } else {
      setState(() {
        drag = 0;
        dragging = false;
      });
    }
  }

  Future<void> next() async {
    if (disabled) return;
    if (review.phase == 'FRONT') {
      await review.setPhase('MEANING');
    } else if (review.phase == 'MEANING') {
      await review.setPhase('RECALL');
    } else if (review.attempt!.current!.checked) {
      await action(review.advance);
    } else {
      await action(review.check);
    }
  }

  Future<void> previous() async {
    if (disabled) return;
    if (review.attempt?.current?.checked != true && review.phase != 'FRONT') {
      await review.setPhase(review.phase == 'RECALL' ? 'MEANING' : 'FRONT');
      return;
    }
    await details(processedOnly: true);
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

  Future<void> details({bool processedOnly = false}) async {
    final items = review.attempt!.items
        .where((i) => !processedOnly || i.state != 'PENDING')
        .toList();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * .7,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              learningHeading('Chi tiết lượt ôn', size: 24),
              const Text(
                'Kết quả đã lưu chỉ đọc. Mở lượt mới để đánh giá lại.',
              ),
              if (items.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('Chưa có từ đã xử lý.'),
                ),
              for (final item in items) ...[
                const SizedBox(height: 12),
                LearningCard(
                  children: [
                    learningHeading(item.word.english, size: 22),
                    Text(item.word.meaning),
                    Text(
                      item.state == 'REVIEWED'
                          ? 'Đã ôn'
                          : item.state == 'SKIPPED'
                          ? 'Đã bỏ qua'
                          : 'Chưa xác nhận',
                    ),
                    if (item.rating != null)
                      Text('Mức độ: ${ratingLabel(item.rating!)}'),
                    if (item.checked)
                      Text('Đã nhập: ${item.checkedAnswer ?? ''}'),
                    if (item.checked)
                      Text(
                        item.isCorrect == true ? 'Điền đúng' : 'Điền chưa đúng',
                      ),
                    if (item.json['resultSource'] == 'SELF_REPORT')
                      const Text('Tự đánh giá'),
                    if (item.json['resultSource'] == 'RECALL_AFTER_REVEAL')
                      const Text('Điền từ sau khi xem đáp án'),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
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
                onSelected: (_) => abandon(),
                itemBuilder: (_) => const [
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
            : toolbar(),
        child: attempt == null
            ? ListView(
                padding: const EdgeInsets.all(16),
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
                padding: const EdgeInsets.all(16),
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
                    const SizedBox(height: 40),
                    const Center(child: CircularProgressIndicator()),
                    const Text('Đang lưu tổng kết lượt ôn…'),
                    if (review.error != null && !review.unsynced)
                      TextButton(
                        onPressed: () => action(review.submit),
                        child: const Text('Lưu tổng kết'),
                      ),
                  ] else ...[
                    if ((attempt.json['remainingEligibleCount'] as num? ?? 0) >
                        0)
                      Text(
                        'Lượt này có ${attempt.json['selectedCount']} từ · còn ${attempt.json['remainingEligibleCount']} từ ngoài lượt.',
                      ),
                    Text(
                      '${attempt.count('reviewedCount')}/${attempt.count('totalCount')} từ đã ôn',
                      style: designText(14),
                    ),
                    const SizedBox(height: 12),
                    AnimatedSwitcher(
                      duration: MediaQuery.disableAnimationsOf(context)
                          ? Duration.zero
                          : const Duration(milliseconds: 260),
                      transitionBuilder: (child, animation) => FadeTransition(
                        opacity: animation,
                        child: SlideTransition(
                          position: Tween<Offset>(
                            begin: const Offset(.12, 0),
                            end: Offset.zero,
                          ).animate(animation),
                          child: child,
                        ),
                      ),
                      child: KeyedSubtree(
                        key: ValueKey('${attempt.current!.id}:${review.phase}'),
                        child: review.phase == 'RECALL'
                            ? recall(attempt.current!)
                            : flashcard(attempt.current!),
                      ),
                    ),
                  ],
                ],
              ),
      ),
    );
  }

  Widget flashcard(VocabularyReviewItem item) => Column(
    children: [
      LayoutBuilder(
        builder: (context, bounds) {
          final progress = (drag.abs() / (bounds.maxWidth * .25)).clamp(
            0.0,
            1.0,
          );
          final color = drag < 0
              ? const Color(0xFFDC2626)
              : const Color(0xFF16A34A);
          return Semantics(
            button: true,
            label: review.phase == 'FRONT'
                ? 'Lật thẻ xem nghĩa'
                : 'Xem mặt trước',
            customSemanticsActions: disabled
                ? null
                : {
                    CustomSemanticsAction(label: 'Bỏ qua từ này'): () =>
                        action(review.skip),
                    CustomSemanticsAction(label: 'Ôn lại sau'): () =>
                        action(review.requeue),
                  },
            child: GestureDetector(
              key: const Key('vocabularyFlashcard'),
              onTap: disabled
                  ? null
                  : () => review.setPhase(
                      review.phase == 'FRONT' ? 'MEANING' : 'FRONT',
                    ),
              onHorizontalDragStart: disabled
                  ? null
                  : (_) => setState(() => dragging = true),
              onHorizontalDragUpdate: disabled
                  ? null
                  : (event) => setState(
                      () => drag = (drag + event.delta.dx).clamp(
                        -bounds.maxWidth,
                        bounds.maxWidth,
                      ),
                    ),
              onHorizontalDragEnd: disabled
                  ? null
                  : (event) => endDrag(event, bounds.maxWidth),
              onHorizontalDragCancel: () => setState(() {
                drag = 0;
                dragging = false;
              }),
              child: AnimatedContainer(
                key: const Key('vocabularySwipeTransform'),
                duration: dragging || MediaQuery.disableAnimationsOf(context)
                    ? Duration.zero
                    : const Duration(milliseconds: 180),
                transformAlignment: Alignment.bottomCenter,
                transform: Matrix4.translationValues(drag, 0, 0)
                  ..rotateZ(
                    MediaQuery.disableAnimationsOf(context)
                        ? 0
                        : (drag / bounds.maxWidth * .28).clamp(-.14, .14),
                  ),
                child: Stack(
                  children: [
                    Container(
                      width: double.infinity,
                      constraints: const BoxConstraints(minHeight: 380),
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        border: Border.all(color: const Color(0xFFE1E7EF)),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(height: 72),
                          Text(
                            item.word.english,
                            key: const Key('vocabularyCurrentEnglish'),
                            textAlign: TextAlign.center,
                            style: designHeading(36),
                          ),
                          if (item.word.field('phonetic').isNotEmpty)
                            Text(
                              item.word.field('phonetic'),
                              style: designText(18),
                            ),
                          if (item.word.field('partOfSpeech').isNotEmpty)
                            Text(
                              item.word.field('partOfSpeech'),
                              style: designText(16),
                            ),
                          if (review.phase == 'MEANING') ...[
                            const SizedBox(height: 24),
                            Text(
                              item.word.meaning,
                              textAlign: TextAlign.center,
                              style: designText(22),
                            ),
                            if (item.word.field('example').isNotEmpty) ...[
                              const SizedBox(height: 16),
                              Text(
                                item.word.field('example'),
                                style: designText(16),
                              ),
                            ],
                            if (item.word.field('translation').isNotEmpty)
                              Text(
                                item.word.field('translation'),
                                style: designText(14),
                              ),
                          ],
                          const SizedBox(height: 32),
                          const Tooltip(
                            message: 'Từ này chưa có phát âm',
                            child: Icon(
                              Icons.volume_off_outlined,
                              color: Color(0xFF8A8C91),
                            ),
                          ),
                          const SizedBox(height: 72),
                        ],
                      ),
                    ),
                    if (drag != 0)
                      Positioned.fill(
                        child: IgnorePointer(
                          child: Opacity(
                            opacity: progress,
                            child: Container(
                              key: const Key('vocabularySwipeFeedback'),
                              alignment: drag < 0
                                  ? Alignment.topRight
                                  : Alignment.topLeft,
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: color.withValues(alpha: .14),
                                border: Border.all(color: color, width: 2),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Text(
                                drag < 0 ? '← Bỏ qua' : 'Ôn lại sau →',
                                style: designText(
                                  22,
                                  color: color,
                                  weight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
      const SizedBox(height: 16),
      difficulty(),
      const SizedBox(height: 16),
      Text('← Bỏ qua · Ôn lại sau →', style: designText(12)),
    ],
  );
  Widget difficulty() => Wrap(
    alignment: WrapAlignment.center,
    spacing: 12,
    runSpacing: 8,
    children: [
      for (final option in [
        ('EASY', const Color(0xFF15803D)),
        ('MEDIUM', const Color(0xFFCA8A04)),
        ('HARD', const Color(0xFFB91C1C)),
      ])
        OutlinedButton(
          key: Key('vocabularyRate${option.$1}'),
          onPressed: disabled
              ? null
              : () => action(() => review.rate(option.$1)),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, 48),
            backgroundColor: review.selectedRating == option.$1
                ? option.$2
                : option.$2.withValues(alpha: .05),
            foregroundColor: review.selectedRating == option.$1
                ? Colors.white
                : option.$2,
            disabledForegroundColor: review.selectedRating == option.$1
                ? Colors.white
                : option.$2,
            side: BorderSide(
              color: option.$2,
              width: review.selectedRating == option.$1 ? 2 : 1,
            ),
          ),
          child: Text(
            ratingLabel(option.$1),
            style: TextStyle(
              fontWeight: review.selectedRating == option.$1
                  ? FontWeight.bold
                  : FontWeight.w500,
            ),
          ),
        ),
    ],
  );
  Widget recall(VocabularyReviewItem item) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      LearningCard(
        children: [
          learningHeading('Định nghĩa', size: 18),
          Text(item.word.meaning, style: designText(20)),
        ],
      ),
      const SizedBox(height: 24),
      learningHeading('Viết lại từ', size: 20),
      const SizedBox(height: 12),
      TextField(
        key: const Key('vocabularyRecallAnswer'),
        controller: input,
        enabled: !disabled && !item.checked,
        autocorrect: false,
        enableSuggestions: false,
        minLines: 3,
        maxLines: 4,
        onChanged: review.changeDraft,
        decoration: InputDecoration(
          hintText: 'Đáp án của bạn…',
          filled: true,
          fillColor: const Color(0xFFEDF1F6),
          contentPadding: const EdgeInsets.all(16),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFFE1E7EF)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xFF59B070), width: 1.5),
          ),
        ),
      ),
      if (item.checked) ...[
        const SizedBox(height: 16),
        Semantics(
          liveRegion: true,
          child: Text(
            item.isCorrect == true
                ? 'Chính xác!'
                : 'Chưa đúng. Đáp án: ${item.word.english}',
            style: designText(
              18,
              color: item.isCorrect == true
                  ? const Color(0xFF15803D)
                  : const Color(0xFFB91C1C),
            ),
          ),
        ),
        if (item.isCorrect == true) ...[
          const SizedBox(height: 12),
          const Text('Chọn độ khó. Tiếp theo giữ mức Trung bình.'),
          const SizedBox(height: 12),
          difficulty(),
        ],
      ],
    ],
  );
  Widget toolbar() => Row(
    children: [
      SizedBox(
        width: 48,
        child: OutlinedButton(
          key: const Key('vocabularyPrevious'),
          onPressed: disabled ? null : previous,
          style: OutlinedButton.styleFrom(padding: EdgeInsets.zero),
          child: const Icon(Icons.chevron_left),
        ),
      ),
      const SizedBox(width: 8),
      if (review.phase != 'RECALL') ...[
        Expanded(
          child: CustomAppButton(
            text: 'Bỏ từ này',
            isSecondary: true,
            onPressed: disabled ? null : () => action(review.skip),
          ),
        ),
        const SizedBox(width: 8),
      ],
      Expanded(
        child: CustomAppButton(
          key: const Key('vocabularyNext'),
          text:
              review.phase == 'RECALL' &&
                  review.attempt?.current?.checked != true
              ? 'Kiểm tra'
              : 'Tiếp theo',
          onPressed: disabled || review.attempt?.current == null ? null : next,
        ),
      ),
    ],
  );
  Widget completion() {
    final attempt = review.attempt!;
    return LearningCard(
      key: const Key('vocabularyReviewComplete'),
      children: [
        learningHeading(
          attempt.status == 'ABANDONED'
              ? 'Đã dừng lượt ôn'
              : 'Đã kết thúc lượt',
          size: 28,
        ),
        Text(
          '${attempt.count('reviewedCount')} từ đã ôn · ${attempt.count('skippedCount')} bỏ qua · ${attempt.count('uncheckedCount')} chưa xử lý',
          style: designText(18),
        ),
        Text(
          attempt.count('checkedCount') == 0
              ? 'Chưa có câu điền từ được chấm.'
              : 'Điền đúng ${attempt.count('correctCount')}/${attempt.count('checkedCount')} câu.',
        ),
        const Text('Độ khó là tự đánh giá. Kết quả điền từ được lưu riêng.'),
        TextButton(
          onPressed: () => details(),
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
      const SizedBox(height: 12),
      CustomAppButton(
        key: const Key('vocabularyReturn'),
        text: 'Quay về trang từ vựng',
        isSecondary: true,
        onPressed: exit,
      ),
    ],
  );
}

String ratingLabel(String value) => switch (value) {
  'EASY' => 'Dễ',
  'MEDIUM' => 'Trung bình',
  'HARD' => 'Khó',
  _ => value,
};
