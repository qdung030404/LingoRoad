import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/history_controls.dart';
import '../learning/learning_widgets.dart';
import 'speaking_repository.dart';

class SpeakingHistoryEntry {
  const SpeakingHistoryEntry({
    required this.id,
    required this.title,
    required this.date,
    required this.details,
    required this.canHide,
  });

  final String id, title;
  final String? date;
  final List<String> details;
  final bool canHide;

  String dateLabel({bool compact = false}) =>
      formatSpeakingHistoryDate(date, compact: compact);
}

String formatSpeakingHistoryDate(String? value, {bool compact = false}) {
  final date = DateTime.tryParse(value ?? '')?.toLocal();
  if (date == null) return '';
  String two(int value) => value.toString().padLeft(2, '0');
  final day = '${two(date.day)}/${two(date.month)}';
  final time = '${two(date.hour)}:${two(date.minute)}';
  return compact ? '$day · $time' : '$day/${date.year}, $time';
}

class SpeakingHistoryList extends StatefulWidget {
  const SpeakingHistoryList({
    super.key,
    required this.title,
    required this.emptyMessage,
    required this.active,
    required this.loadPage,
    required this.hide,
    required this.describe,
    required this.open,
    this.errorMessage = 'Chưa tải được lịch sử. Hãy thử lại.',
    this.filter,
    this.onBack,
  });

  final String title, emptyMessage, errorMessage;
  final bool Function() active;
  final Future<Json> Function(String? cursor) loadPage;
  final Future<void> Function(List<String>) hide;
  final SpeakingHistoryEntry Function(Json) describe;
  final Future<void> Function(String) open;
  final Widget Function(bool enabled)? filter;
  final VoidCallback? onBack;

  @override
  State<SpeakingHistoryList> createState() => _SpeakingHistoryListState();
}

class _SpeakingHistoryListState extends State<SpeakingHistoryList> {
  final _entries = <SpeakingHistoryEntry>[];
  final _selected = <String>{};
  String? _cursor, _error;
  bool _loading = false, _selecting = false, _hiding = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load({bool more = false}) async {
    if (!widget.active() || _loading || (more && _cursor == null)) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final page = await widget.loadPage(more ? _cursor : null);
      if (!mounted || !widget.active()) return;
      setState(() {
        if (!more) _entries.clear();
        _entries.addAll(speakingItems(page['items']).map(widget.describe));
        _cursor = page['nextCursor'] as String?;
      });
    } catch (_) {
      if (mounted && widget.active()) {
        setState(() => _error = widget.errorMessage);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _endSelection() => setState(() {
    _selecting = false;
    _selected.clear();
  });

  Future<void> _hide(List<SpeakingHistoryEntry> entries) async {
    if (entries.isEmpty || _loading || _hiding || !widget.active()) return;
    final count = entries.length;
    final confirmed = await confirmHistoryHide(
      context,
      count: count,
      retentionMessage: 'Điểm, tiến độ và bản thu đã lưu vẫn được giữ.',
      preview: [
        for (final entry in entries.take(2))
          (title: entry.title, date: entry.dateLabel(compact: true)),
      ],
    );
    if (confirmed != true || !mounted || !widget.active()) return;

    final ids = entries.map((entry) => entry.id).toSet();
    setState(() => _hiding = true);
    try {
      await widget.hide(ids.toList());
      if (!mounted || !widget.active()) return;
      setState(() {
        _entries.removeWhere((entry) => ids.contains(entry.id));
        _selected.clear();
        _selecting = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(historyHiddenMessage(count));
      await _load();
    } catch (error) {
      if (!mounted || !widget.active()) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error is ApiFailure
                ? error.message
                : 'Chưa xóa được lượt luyện. Hãy thử lại.',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _hiding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.active()) {
      return FigmaPage(
        title: widget.title,
        child: const Center(child: Text('Phiên đăng nhập đã thay đổi.')),
      );
    }
    final duration = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 180);
    final back = widget.onBack ?? () => Navigator.maybePop(context);
    return PopScope<void>(
      canPop: !_selecting && !_hiding,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _selecting && !_hiding) _endSelection();
      },
      child: FigmaPage(
        title: widget.title,
        titleStyle: historyHeading(20),
        headerHeight:
            64 +
            (MediaQuery.textScalerOf(context).scale(20) - 20)
                    .clamp(0, double.infinity)
                    .toDouble() *
                2,
        headerPadding: const EdgeInsets.symmetric(horizontal: 12),
        leading: IconButton(
          tooltip: 'Quay lại',
          icon: const HistoryIcon(HistoryIcon.back),
          onPressed: _hiding
              ? null
              : _selecting
              ? _endSelection
              : back,
        ),
        trailing: HistorySelectionAction(
          selecting: _selecting,
          onPressed: _hiding
              ? null
              : _selecting
              ? _endSelection
              : !_loading && _entries.any((entry) => entry.canHide)
              ? () => setState(() => _selecting = true)
              : null,
        ),
        bottom: _selecting
            ? HistorySelectionBar(
                count: _selected.length,
                saving: _hiding,
                duration: duration,
                onDelete: () => _hide(
                  _entries
                      .where((entry) => _selected.contains(entry.id))
                      .toList(),
                ),
              )
            : null,
        child: RefreshIndicator(
          notificationPredicate: (event) =>
              !_selecting && !_hiding && event.depth == 0,
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              if (widget.filter case final filter?)
                filter(!_selecting && !_loading && !_hiding),
              if (_error case final error?) ...[
                learningBody(error),
                TextButton(
                  onPressed: _hiding
                      ? null
                      : () => _load(more: _selecting && _cursor != null),
                  child: const Text('Thử lại'),
                ),
              ],
              if (!_loading && _error == null && _entries.isEmpty)
                learningBody(widget.emptyMessage),
              for (final entry in _entries)
                Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _card(entry, duration),
                ),
              if (_loading) const Center(child: CircularProgressIndicator()),
              if (!_loading && _cursor != null)
                TextButton(
                  onPressed: _hiding ? null : () => _load(more: true),
                  child: const Text('Xem thêm'),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _card(SpeakingHistoryEntry entry, Duration duration) {
    final selected = _selected.contains(entry.id);
    final canToggle =
        entry.canHide && !_hiding && (selected || _selected.length < 100);
    void toggle() => setState(() {
      if (!_selected.remove(entry.id)) _selected.add(entry.id);
    });
    final date = entry.dateLabel();
    final border = BorderRadius.circular(16);
    return AnimatedContainer(
      key: ValueKey('speaking-history-${entry.id}'),
      duration: duration,
      curve: Curves.easeOutCubic,
      constraints: const BoxConstraints(minHeight: 80),
      decoration: BoxDecoration(
        color: selected ? AppColors.primary25 : AppColors.grey5,
        borderRadius: border,
        border: Border.all(
          color: selected ? AppColors.primary200 : AppColors.grey100,
        ),
      ),
      child: Material(
        type: MaterialType.transparency,
        child: InkWell(
          borderRadius: border,
          excludeFromSemantics: _selecting,
          onLongPress: !_selecting && !_loading && !_hiding && entry.canHide
              ? () => _hide([entry])
              : null,
          onTap: _hiding
              ? null
              : _selecting
              ? (canToggle ? toggle : null)
              : () async {
                  if (!widget.active()) return;
                  await widget.open(entry.id);
                  if (mounted) await _load();
                },
          child: Padding(
            padding: const EdgeInsets.all(15),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(entry.title, style: historyHeading(18)),
                      for (final detail in [
                        ...entry.details,
                        if (date.isNotEmpty) date,
                      ])
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            detail,
                            style: historyText(12, color: AppColors.grey800),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                SizedBox.square(
                  dimension: 24,
                  child: _selecting
                      ? (entry.canHide
                            ? HistorySelectionMark(
                                key: ValueKey(
                                  'speaking-history-select-${entry.id}',
                                ),
                                title: entry.title,
                                selected: selected,
                                onTap: canToggle ? toggle : null,
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
