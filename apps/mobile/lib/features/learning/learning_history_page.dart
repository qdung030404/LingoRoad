import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/history_controls.dart';
import 'learning_controller.dart';
import 'learning_pages.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';

class LearningHistoryPage extends StatefulWidget {
  const LearningHistoryPage({super.key, required this.controller, this.kind});
  final LearningController controller;
  final String? kind;
  @override
  State<LearningHistoryPage> createState() => _LearningHistoryPageState();
}

class _LearningHistoryPageState extends State<LearningHistoryPage> {
  static const _maxSelection = 100;
  final items = <Json>[];
  final _selected = <String>{};
  String? cursor, error;
  bool loading = true, hasMore = true;
  bool _requesting = false;
  bool _hiding = false;
  bool _selecting = false;
  int _epoch = 0;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load({bool reset = false}) async {
    if (_requesting && !reset) return;
    final epoch = reset ? ++_epoch : _epoch;
    _requesting = true;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await widget.controller.repository.history(
        cursor: reset ? null : cursor,
        kind: widget.kind,
      );
      if (!mounted || !widget.controller.active || epoch != _epoch) return;
      setState(() {
        if (reset) items.clear();
        items.addAll(learningItems(result['items']));
        cursor = result['nextCursor'] as String?;
        hasMore = cursor != null;
      });
    } catch (e) {
      if (mounted && widget.controller.active && epoch == _epoch) {
        setState(
          () => error = e is ApiFailure ? e.message : 'Không tải được lịch sử.',
        );
      }
    } finally {
      if (mounted && epoch == _epoch) {
        _requesting = false;
        setState(() => loading = false);
      }
    }
  }

  void _endSelection() => setState(() {
    _selecting = false;
    _selected.clear();
  });

  void _toggleSelection(String id) {
    setState(() {
      if (!_selected.remove(id)) _selected.add(id);
    });
  }

  Future<void> _hideHistory(List<Json> targets, {bool batch = false}) async {
    final controller = widget.controller;
    if (_hiding || targets.isEmpty || !controller.active) return;
    final count = targets.length;
    final confirmed = await confirmHistoryHide(
      context,
      count: count,
      preview: [
        for (final item in targets.take(2))
          (title: _historyTitle(item), date: _historyDate(item, compact: true)),
      ],
    );
    if (confirmed != true || !mounted || !controller.active) return;

    final ids = targets.map((row) => row['id'] as String).toList();
    final removed = ids.toSet();
    setState(() => _hiding = true);
    try {
      if (batch) {
        await controller.repository.hideHistoryBatch(ids);
      } else {
        await controller.repository.hideHistory(ids.single);
      }
      if (!controller.active) return;
      controller.invalidateHome();
      unawaited(controller.loadCatalogue());
      if (!mounted) return;
      setState(() {
        items.removeWhere((row) => removed.contains(row['id']));
        _selected.clear();
        _selecting = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(historyHiddenMessage(count));
      await load(reset: true);
    } catch (e) {
      if (!mounted || !controller.active) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is ApiFailure
                ? e.message
                : 'Chưa xóa được lượt học. Hãy thử lại.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _hiding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final duration = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 180);
    final title = switch (widget.kind) {
      'LISTENING' => 'Lịch sử luyện nghe',
      'READING' => 'Lịch sử luyện đọc',
      _ => 'Lịch sử học tập',
    };
    return PopScope<void>(
      canPop: !_selecting && !_hiding,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _selecting && !_hiding) _endSelection();
      },
      child: FigmaPage(
        title: title,
        titleStyle: historyHeading(20),
        headerPadding: const EdgeInsets.symmetric(horizontal: 12),
        headerHeight:
            52 +
            (MediaQuery.textScalerOf(context).scale(20) - 20)
                    .clamp(0, double.infinity)
                    .toDouble() *
                2,
        leading: IconButton(
          tooltip: 'Quay lại',
          onPressed: _hiding ? null : () => Navigator.maybePop(context),
          icon: const HistoryIcon(HistoryIcon.back),
        ),
        trailing: HistorySelectionAction(
          selecting: _selecting,
          onPressed: _hiding
              ? null
              : _selecting
              ? _endSelection
              : !loading && items.any((item) => item['status'] == 'COMPLETED')
              ? () => setState(() => _selecting = true)
              : null,
        ),
        bottom: _selecting
            ? HistorySelectionBar(
                count: _selected.length,
                saving: _hiding,
                duration: duration,
                onDelete: () => _hideHistory(
                  items
                      .where((item) => _selected.contains(item['id']))
                      .toList(),
                  batch: true,
                ),
              )
            : null,
        child: RefreshIndicator(
          notificationPredicate: (notification) =>
              !_selecting && !_hiding && notification.depth == 0,
          onRefresh: () => load(reset: true),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              if (error != null) LearningError(error!, retry: load),
              for (final item in items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _card(item, duration),
                ),
              if (loading) const Center(child: CircularProgressIndicator()),
              if (!loading && error == null && items.isEmpty)
                learningBody('Chưa có lượt học nào trong lịch sử.'),
              if (!loading && hasMore && items.isNotEmpty)
                TextButton(
                  onPressed: _hiding ? null : load,
                  child: const Text('Xem thêm'),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _card(Json item, Duration duration) {
    final id = item['id'] as String;
    final title = _historyTitle(item);
    final completed = item['status'] == 'COMPLETED';
    final selected = _selected.contains(id);
    final allowToggle =
        !_hiding && completed && (selected || _selected.length < _maxSelection);
    final result = item['result'] as Map?;
    final score = completed
        ? '${result?['correctCount']}/${result?['totalQuestions']} câu đúng'
        : 'Đang học · Tiếp tục';
    return AnimatedContainer(
      key: ValueKey('learning-history-$id'),
      duration: duration,
      curve: Curves.easeOutCubic,
      constraints: const BoxConstraints(minHeight: 80),
      decoration: BoxDecoration(
        color: selected ? AppColors.primary25 : AppColors.grey5,
        borderRadius: AppRadius.cardRadius,
        border: Border.all(
          color: selected ? AppColors.primary200 : AppColors.grey100,
        ),
      ),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          borderRadius: AppRadius.cardRadius,
          excludeFromSemantics: _selecting,
          onLongPress: !_hiding && !_selecting && completed
              ? () => _hideHistory([item])
              : null,
          onTap: _hiding
              ? null
              : _selecting
              ? (allowToggle ? () => _toggleSelection(id) : null)
              : () async {
                  await openLearningLesson(
                    context,
                    widget.controller,
                    attemptId: id,
                  );
                  if (mounted) await load(reset: true);
                },
          child: Padding(
            padding: const EdgeInsets.all(15),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: historyHeading(18)),
                      const SizedBox(height: 6),
                      Text(
                        '$score  ·  ${_historyDate(item)}',
                        style: historyText(12, color: AppColors.grey800),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                SizedBox.square(
                  dimension: 24,
                  child: _selecting
                      ? (completed
                            ? HistorySelectionMark(
                                key: ValueKey('learning-history-select-$id'),
                                title: title,
                                selected: selected,
                                onTap: allowToggle
                                    ? () => _toggleSelection(id)
                                    : null,
                              )
                            : null)
                      : const HistoryIcon(
                          HistoryIcon.next,
                          color: AppColors.grey800,
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

String _historyTitle(Json item) => (item['lesson'] as Map)['title'] as String;

String _historyDate(Json item, {bool compact = false}) =>
    formatVietnamHistoryDate(
      item['submittedAt'] as String? ?? item['updatedAt'] as String?,
      compact: compact,
    );
