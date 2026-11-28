import 'dart:async';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_shadows.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../learning/learning_widgets.dart';
import '../learning/learning_pages.dart' show LearningError;
import '../learning/vocabulary_summary.dart';
import 'vocabulary_batch_add_page.dart';
import 'vocabulary_controller.dart';
import 'vocabulary_models.dart';
import 'vocabulary_review_page.dart';
import 'vocabulary_word_card.dart';
import 'vocabulary_word_edit_dialog.dart';

part 'vocabulary_deck_and_history_pages.dart';

sealed class _ReviewLaunchOutcome {
  const _ReviewLaunchOutcome();
}

class _ReviewLaunchCompleted extends _ReviewLaunchOutcome {
  const _ReviewLaunchCompleted();
}

class _ReviewLaunchEmpty extends _ReviewLaunchOutcome {
  const _ReviewLaunchEmpty();
}

class _ReviewLaunchFailed extends _ReviewLaunchOutcome {
  const _ReviewLaunchFailed(this.error);
  final Object error;
}

class _VocabularyReviewLauncherPage extends StatefulWidget {
  const _VocabularyReviewLauncherPage({
    required this.controller,
    required this.loader,
  });

  final VocabularyController controller;
  final Future<VocabularyReviewAttempt?> Function() loader;

  @override
  State<_VocabularyReviewLauncherPage> createState() =>
      _VocabularyReviewLauncherPageState();
}

class _VocabularyReviewLauncherPageState
    extends State<_VocabularyReviewLauncherPage> {
  VocabularyReviewAttempt? _attempt;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  Future<void> _resolve() async {
    try {
      final attempt = await widget.loader();
      if (!mounted) return;
      if (!widget.controller.active || attempt == null) {
        Navigator.of(context).pop(const _ReviewLaunchEmpty());
        return;
      }
      setState(() {
        _attempt = attempt;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      Navigator.of(context).pop(_ReviewLaunchFailed(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _attempt == null) {
      return const FigmaPage(
        title: 'Ôn từ vựng',
        child: Center(child: CircularProgressIndicator()),
      );
    }
    return PopScope<_ReviewLaunchOutcome>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          Navigator.of(context).pop(const _ReviewLaunchCompleted());
        }
      },
      child: VocabularyReviewPage(
        controller: widget.controller,
        attemptId: _attempt!.id,
        initialAttempt: _attempt,
      ),
    );
  }
}

Future<void> openVocabularyReview(
  BuildContext context,
  VocabularyController controller,
  String deckId, {
  String scope = 'NEEDS_REVIEW',
}) async {
  final beforeMutation = controller.mutationVersion;
  final beforeSummary = controller.summaryRefreshVersion;
  final outcome = await previewPush<_ReviewLaunchOutcome>(
    context,
    _VocabularyReviewLauncherPage(
      controller: controller,
      loader: () => controller.startReview(deckId, scope: scope),
    ),
  );
  if (!context.mounted || !controller.active) return;
  if (outcome is _ReviewLaunchFailed) {
    previewMessage(context, controller.message(outcome.error));
    return;
  }
  if (outcome is _ReviewLaunchEmpty) {
    if (scope == 'ALL') {
      previewMessage(context, 'Bộ từ chưa có từ để ôn.');
      if (controller.stale) await controller.refresh();
      return;
    }
    final all = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Không còn từ cần ôn'),
        content: const Text('Bạn có thể ôn lại tất cả từ trong bộ này.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Đóng'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Ôn tất cả'),
          ),
        ],
      ),
    );
    if (all == true && context.mounted) {
      await openVocabularyReview(context, controller, deckId, scope: 'ALL');
    }
    return;
  }
  if (controller.active &&
      (controller.mutationVersion != beforeMutation ||
          controller.summaryRefreshVersion != beforeSummary ||
          controller.stale)) {
    await controller.refresh();
  }
}

Future<void> openActiveVocabularyReview(
  BuildContext context,
  VocabularyController controller, {
  required VoidCallback onNoActiveReview,
}) async {
  final beforeMutation = controller.mutationVersion;
  final beforeSummary = controller.summaryRefreshVersion;
  final outcome = await previewPush<_ReviewLaunchOutcome>(
    context,
    _VocabularyReviewLauncherPage(
      controller: controller,
      loader: controller.findActiveReview,
    ),
  );
  if (!controller.active || !context.mounted) return;
  if (outcome is _ReviewLaunchFailed) {
    previewMessage(context, controller.message(outcome.error));
    return;
  }
  if (outcome is _ReviewLaunchEmpty) {
    onNoActiveReview();
    return;
  }
  if (controller.active &&
      (controller.mutationVersion != beforeMutation ||
          controller.summaryRefreshVersion != beforeSummary ||
          controller.stale)) {
    await controller.refresh();
  }
}

class VocabularyHomeSection extends StatelessWidget {
  const VocabularyHomeSection({
    super.key,
    required this.controller,
    required this.onWords,
    required this.onDeck,
    required this.onReview,
  });
  final VocabularyController controller;
  final VoidCallback onWords, onReview;
  final ValueChanged<String> onDeck;
  Future<void> review(BuildContext context) => openActiveVocabularyReview(
    context,
    controller,
    onNoActiveReview: onReview,
  );

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) {
      final data = controller.summary;
      if (data == null) {
        return LearningCard(
          children: [
            learningHeading('Từ của tôi', size: 24),
            if (controller.loading)
              const Center(child: CircularProgressIndicator()),
            if (controller.error != null)
              LearningError(controller.error!, retry: controller.refresh),
          ],
        );
      }
      final totals = vocabularyJson(data['totals']);
      return Column(
        children: [
          if (controller.stale)
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text('Dữ liệu đã lưu · chưa đồng bộ'),
            ),
          if (controller.error != null)
            LearningError(controller.error!, retry: controller.refresh),
          VocabularySummary(
            totalWords: (totals['totalWords'] as num).toInt(),
            rememberedWords: (totals['rememberedWords'] as num).toInt(),
            realData: true,
            onWords: onWords,
            onReview: () => review(context),
            decks: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          'Bộ từ gần đây',
                          style: designHeading(18),
                        ),
                      ),
                      InkWell(
                        borderRadius: BorderRadius.circular(8),
                        onTap: onWords,
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 6,
                          ),
                          child: Text(
                            'Xem tất cả →',
                            style: designText(
                              14.5,
                              weight: FontWeight.w700,
                              color: const Color(0xFF1E713B),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (vocabularyItems(data['decks']).isEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 16,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        children: [
                          Text(
                            'Chưa có bộ từ nào',
                            style: designText(
                              15,
                              weight: FontWeight.w700,
                              color: const Color(0xFF334155),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Bấm Xem tất cả để tạo bộ từ đầu tiên của bạn.',
                            textAlign: TextAlign.center,
                            style: designText(
                              13.5,
                              color: const Color(0xFF64748B),
                            ),
                          ),
                        ],
                      ),
                    ),
                  for (final (idx, row)
                      in vocabularyItems(data['decks']).take(3).indexed) ...[
                    if (idx > 0) const SizedBox(height: 10),
                    _CompactHomeVocabularyDeckRow(
                      deck: VocabularyDeck(row),
                      onTap: () => onDeck(row['id'] as String),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      );
    },
  );
}

class _CompactHomeVocabularyDeckRow extends StatelessWidget {
  const _CompactHomeVocabularyDeckRow({
    required this.deck,
    required this.onTap,
  });

  final VocabularyDeck deck;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final total = deck.totalWords;
    final remembered = deck.rememberedWords.clamp(0, total);
    final due = deck.needsReviewWords;
    final ratio = total > 0 ? (remembered / total).clamp(0.0, 1.0) : 0.0;
    final isActive = deck.activeAttemptId != null;

    return Material(
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFE6ECF2)),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        key: ValueKey('home-vocabulary-deck-${deck.id}'),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF8F2),
                  borderRadius: BorderRadius.circular(13),
                ),
                alignment: Alignment.center,
                child: const Icon(
                  Icons.style_rounded,
                  size: 22,
                  color: Color(0xFF1E713B),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            deck.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: designHeading(16.5),
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (isActive)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 3.5,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFECF9F0),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              'Đang học',
                              style: designText(
                                12,
                                weight: FontWeight.w700,
                                color: const Color(0xFF1E713B),
                              ),
                            ),
                          )
                        else if (due > 0)
                          Text(
                            '$due cần ôn',
                            style: designText(
                              13,
                              weight: FontWeight.w600,
                              color: const Color(0xFF64748B),
                            ).copyWith(
                              fontFeatures: const [
                                FontFeature.tabularFigures(),
                              ],
                            ),
                          )
                        else if (total > 0)
                          Text(
                            'Đã thuộc ✓',
                            style: designText(
                              13,
                              weight: FontWeight.w700,
                              color: const Color(0xFF1E713B),
                            ),
                          )
                        else
                          Text(
                            '0 từ',
                            style: designText(
                              13,
                              weight: FontWeight.w600,
                              color: const Color(0xFF64748B),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(999),
                            child: LinearProgressIndicator(
                              value: ratio,
                              minHeight: 6.5,
                              backgroundColor: const Color(0xFFEAEFF5),
                              color: const Color(0xFF48A860),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          '$remembered/$total từ',
                          style: designText(
                            13,
                            weight: FontWeight.w500,
                            color: const Color(0xFF657482),
                          ).copyWith(
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(
                Icons.chevron_right_rounded,
                size: 22,
                color: Color(0xFF94A3B8),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class VocabularyDeckCard extends StatelessWidget {
  const VocabularyDeckCard({
    super.key,
    required this.deck,
    required this.onTap,
  });
  final VocabularyDeck deck;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => LearningCard(
    children: [
      InkWell(
        key: ValueKey('vocabulary-deck-${deck.id}'),
        onTap: onTap,
        child: SizedBox(
          width: double.infinity,
          child: learningHeading(deck.name, size: 22),
        ),
      ),
      Row(
        children: [
          for (final metric in [
            ('Từ', deck.totalWords),
            ('Đã nhớ', deck.rememberedWords),
            ('Cần ôn', deck.needsReviewWords),
          ])
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    border: Border.all(color: const Color(0xFFE1E7EF)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(metric.$1, style: designText(12)),
                      const SizedBox(height: 8),
                      Text('${metric.$2}', style: designHeading(20)),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
      CustomAppButton(
        text: deck.activeAttemptId == null ? 'Luyện tập' : 'Tiếp tục học',
        onPressed: onTap,
      ),
    ],
  );
}

class VocabularyPendingNotice extends StatelessWidget {
  const VocabularyPendingNotice({
    super.key,
    required this.controller,
    this.onResolved,
  });
  final VocabularyController controller;
  final VoidCallback? onResolved;
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) => Column(
      children: [
        if (controller.stale)
          const Text('Đang xem dữ liệu đã lưu · chưa đồng bộ'),
        if (controller.pending != null)
          LearningCard(
            children: [
              Text(controller.error ?? 'Có thao tác đang chờ xác nhận.'),
              TextButton(
                onPressed: controller.busy
                    ? null
                    : () async {
                        try {
                          final result = await controller.retryPending();
                          if (!context.mounted || !controller.active) return;
                          onResolved?.call();
                          if (result['attempt'] is Map) {
                            await previewPush(
                              context,
                              VocabularyReviewPage(
                                controller: controller,
                                attemptId:
                                    (result['attempt'] as Map)['id'] as String,
                              ),
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            previewMessage(context, controller.message(e));
                          }
                        }
                      },
                child: const Text('Thử lại thao tác đang chờ'),
              ),
              if (controller.conflict)
                TextButton(
                  onPressed: controller.busy
                      ? null
                      : () async {
                          await controller.resolveConflict();
                          onResolved?.call();
                        },
                  child: const Text('Bỏ thao tác cũ và tải dữ liệu mới'),
                ),
            ],
          ),
      ],
    ),
  );
}

class VocabularyWordsTab extends StatefulWidget {
  const VocabularyWordsTab({super.key, required this.controller});
  final VocabularyController controller;
  @override
  State<VocabularyWordsTab> createState() => _VocabularyWordsTabState();
}

class _VocabularyWordsTabState extends State<VocabularyWordsTab> {
  final TextEditingController _searchController = TextEditingController();
  String search = '';
  String? error;
  bool loading = true;
  Timer? timer;
  int epoch = 0;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load({bool more = false}) async {
    final request = ++epoch;
    setState(() => loading = true);
    try {
      await widget.controller.loadDecks(
        query: search,
        cursor: more ? widget.controller.nextCursor : null,
      );
      if (mounted && request == epoch) setState(() => error = null);
    } catch (e) {
      if (mounted && request == epoch) {
        setState(() => error = widget.controller.message(e));
      }
    } finally {
      if (mounted && request == epoch) setState(() => loading = false);
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _openDeck(VocabularyDeck deck) async {
    final beforeMutation = widget.controller.mutationVersion;
    final beforeSummary = widget.controller.summaryRefreshVersion;
    final changed = await previewPush<bool>(
      context,
      VocabularyDeckPage(
        controller: widget.controller,
        deckId: deck.id,
      ),
    );
    if (mounted &&
        (changed == true ||
            widget.controller.mutationVersion != beforeMutation ||
            widget.controller.summaryRefreshVersion != beforeSummary)) {
      load();
    }
  }

  @override
  Widget build(BuildContext context) => FigmaPage(
    child: CustomScrollView(
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          sliver: SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Expanded(child: learningHeading('Từ của tôi', size: 32)),
                    IconButton(
                      key: const Key('vocabularyHistory'),
                      tooltip: 'Lịch sử ôn từ',
                      onPressed: () => previewPush(
                        context,
                        VocabularyHistoryPage(controller: widget.controller),
                      ),
                      icon: const Icon(Icons.history),
                    ),
                    AnimatedBuilder(
                      animation: widget.controller,
                      builder: (context, _) => IconButton(
                        key: const Key('vocabularyAddDeck'),
                        tooltip: 'Tạo bộ từ',
                        onPressed: widget.controller.busy
                            ? null
                            : () async {
                                final result = await showDialog<bool>(
                                  context: context,
                                  builder: (context) =>
                                      _DeckForm(controller: widget.controller),
                                );
                                if (result == true && mounted) load();
                              },
                        icon: const Icon(Icons.add_circle_outline),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                TextField(
                  key: const Key('vocabularySearch'),
                  controller: _searchController,
                  decoration: const InputDecoration(
                    hintText: 'Tìm bộ từ',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: (value) {
                    search = value;
                    timer?.cancel();
                    timer = Timer(
                      const Duration(milliseconds: 250),
                      () => load(),
                    );
                  },
                ),
                const SizedBox(height: 16),
                VocabularyPendingNotice(
                  controller: widget.controller,
                  onResolved: () => load(),
                ),
                if (error != null) LearningError(error!, retry: () => load()),
                if (loading) const Center(child: CircularProgressIndicator()),
              ],
            ),
          ),
        ),
        AnimatedBuilder(
          animation: widget.controller,
          builder: (context, _) {
            final decks = widget.controller.decks;
            return SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
              sliver: SliverMainAxisGroup(
                slivers: [
                  if (!loading && error == null && decks.isEmpty)
                    const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.all(24),
                        child: Text('Chưa có bộ từ phù hợp. Bấm + để tạo bộ từ.'),
                      ),
                    ),
                  if (decks.isNotEmpty)
                    SliverList.builder(
                      itemCount: decks.length,
                      itemBuilder: (context, index) {
                        final deck = decks[index];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: VocabularyDeckCard(
                            deck: deck,
                            onTap: () => _openDeck(deck),
                          ),
                        );
                      },
                    ),
                  if (widget.controller.nextCursor != null)
                    SliverToBoxAdapter(
                      child: TextButton(
                        onPressed: loading ? null : () => load(more: true),
                        child: const Text('Xem thêm bộ từ'),
                      ),
                    ),
                ],
              ),
            );
          },
        ),
      ],
    ),
  );
}

class _DeckForm extends StatefulWidget {
  const _DeckForm({required this.controller, this.deck});
  final VocabularyController controller;
  final VocabularyDeck? deck;
  @override
  State<_DeckForm> createState() => _DeckFormState();
}

class _DeckFormState extends State<_DeckForm> {
  late final name = TextEditingController(text: widget.deck?.name ?? '');
  String? error;
  bool busy = false;
  @override
  void dispose() {
    name.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (name.text.trim().isEmpty) {
      setState(() => error = 'Nhập tên bộ từ.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (widget.deck == null) {
        await widget.controller.createDeck(name.text.trim());
      } else {
        await widget.controller.updateDeck(widget.deck!, name.text.trim());
      }
      if (mounted && widget.controller.active) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) setState(() => error = widget.controller.message(e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    child: AlertDialog(
      title: Text(widget.deck == null ? 'Tạo bộ từ' : 'Đổi tên bộ từ'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              key: const Key('vocabularyDeckName'),
              controller: name,
              maxLength: 60,
              enabled: !busy,
              decoration: const InputDecoration(labelText: 'Tên bộ từ'),
            ),
            if (error != null)
              Text(error!, style: const TextStyle(color: Colors.red)),
            if (widget.controller.conflict)
              TextButton(
                onPressed: busy
                    ? null
                    : () async {
                        await widget.controller.resolveConflict();
                        if (context.mounted) Navigator.pop(context, true);
                      },
                child: const Text('Bỏ thao tác cũ và tải dữ liệu mới'),
              ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: busy ? null : () => Navigator.pop(context, false),
          child: const Text('Đóng'),
        ),
        TextButton(
          key: const Key('vocabularySaveDeck'),
          onPressed: busy ? null : save,
          child: Text(busy ? 'Đang lưu…' : 'Lưu'),
        ),
      ],
    ),
  );
}

