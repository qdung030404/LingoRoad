part of 'daily_pages.dart';

Future<void> showDailyPreferencesSheet(
  BuildContext context,
  LearningController learning,
) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => DailyPreferencesSheet(learning: learning),
  );
}

class DailyPreferencesSheet extends StatefulWidget {
  const DailyPreferencesSheet({super.key, required this.learning});
  final LearningController learning;

  @override
  State<DailyPreferencesSheet> createState() => _DailyPreferencesSheetState();
}

class _DailyPreferencesSheetState extends State<DailyPreferencesSheet> {
  static const _skillOrder = [
    'GRAMMAR',
    'VOCABULARY',
    'READING',
    'LISTENING',
    'SPEAKING',
    'WRITING',
  ];

  static List<String> _dedupeKinds(Iterable<String> raw) {
    final seen = <String>{};
    return [
      for (final k in raw)
        if (seen.add(k)) k,
    ];
  }

  DailyLearningController get daily => widget.learning.daily!;
  late List<String> kinds = _dedupeKinds(
    (daily.preferences!['preferredKinds'] as List).cast<String>(),
  );
  bool busy = false;
  String? error;

  IconData _kindIcon(String kind) => switch (kind) {
    'GRAMMAR' => Icons.spellcheck_rounded,
    'VOCABULARY' => Icons.style_outlined,
    'READING' => Icons.menu_book_rounded,
    'LISTENING' => Icons.headphones_rounded,
    'SPEAKING' => Icons.mic_rounded,
    'WRITING' => Icons.edit_note_rounded,
    _ => Icons.school_outlined,
  };

  Future<void> save() async {
    if (busy || kinds.isEmpty) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final currentMinutes =
          (daily.preferences!['dailyGoalMinutes'] as num).toInt();
      await daily.save(currentMinutes, List<String>.from(kinds));
      if (!daily.active) return;
      await widget.learning.refresh();
      if (mounted && daily.error == null) {
        Navigator.pop(context);
      } else if (mounted) {
        setState(() => error = daily.error);
      }
    } catch (e) {
      if (e is ApiFailure && e.status == 409) {
        await daily.refresh();
        if (mounted && daily.preferences != null) {
          kinds = _dedupeKinds(
            (daily.preferences!['preferredKinds'] as List).cast<String>(),
          );
        }
      }
      if (mounted) {
        setState(
          () => error = e is ApiFailure && e.status == 409
              ? 'Mục tiêu đã đổi trên thiết bị khác. Đã tải bản mới; hãy kiểm tra rồi lưu lại.'
              : e is ApiFailure
              ? e.message
              : 'Không lưu được kế hoạch. Hãy thử lại.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void _toggleKind(String kind) {
    if (busy) return;
    setState(() {
      error = null;
      if (kinds.contains(kind)) {
        kinds.remove(kind);
      } else {
        kinds.add(kind);
      }
    });
  }

  void _resetKinds() {
    if (busy) return;
    setState(() {
      error = null;
      kinds.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.90,
        ),
        child: DecoratedBox(
          key: const Key('dailyPreferencesSheet'),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
          ),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 12),
                Center(
                  child: Container(
                    width: 42,
                    height: 4.5,
                    decoration: BoxDecoration(
                      color: const Color(0xFFD5DDE7),
                      borderRadius: AppRadius.pill,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 16, 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Điều chỉnh lộ trình ngày',
                              style: designHeading(22),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Chọn kỹ năng ưu tiên cho lộ trình hôm nay',
                              style: designText(
                                14,
                                color: const Color(0xFF64748B),
                                height: 1.35,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Material(
                        color: const Color(0xFFF1F5F9),
                        shape: const CircleBorder(),
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: busy ? null : () => Navigator.pop(context),
                          child: const SizedBox(
                            width: 38,
                            height: 38,
                            child: Icon(
                              Icons.close_rounded,
                              size: 20,
                              color: Color(0xFF475569),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: Color(0xFFEEF2F6)),
                Flexible(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                'Nhóm bài ưu tiên',
                                style: designHeading(17),
                              ),
                            ),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Đã chọn ${kinds.length}/${_skillOrder.length}',
                                  style: designText(
                                    14,
                                    weight: FontWeight.w600,
                                    color: const Color(0xFF64748B),
                                  ).copyWith(
                                    fontFeatures: const [
                                      FontFeature.tabularFigures(),
                                    ],
                                  ),
                                ),
                                if (kinds.isNotEmpty) ...[
                                  const SizedBox(width: 10),
                                  InkWell(
                                    key: const Key('dailyResetKindOrder'),
                                    onTap: busy ? null : _resetKinds,
                                    borderRadius: BorderRadius.circular(8),
                                    child: Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 2,
                                      ),
                                      child: Text(
                                        'Đặt lại',
                                        style: designText(
                                          14,
                                          weight: FontWeight.w700,
                                          color: const Color(0xFF1E713B),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        LayoutBuilder(
                          builder: (context, constraints) {
                            if (constraints.maxWidth < 250) {
                              return Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  for (final (i, kind) in _skillOrder.indexed) ...[
                                    if (i > 0) const SizedBox(height: 10),
                                    _buildKindTile(kind),
                                  ],
                                ],
                              );
                            }
                            final rows = <Widget>[];
                            for (var i = 0; i < _skillOrder.length; i += 2) {
                              final left = _skillOrder[i];
                              final right = i + 1 < _skillOrder.length
                                  ? _skillOrder[i + 1]
                                  : null;
                              if (rows.isNotEmpty) {
                                rows.add(const SizedBox(height: 10));
                              }
                              rows.add(
                                IntrinsicHeight(
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      Expanded(child: _buildKindTile(left)),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: right != null
                                            ? _buildKindTile(right)
                                            : const SizedBox.shrink(),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }
                            return Column(children: rows);
                          },
                        ),
                        if (error != null) ...[
                          const SizedBox(height: 14),
                          LearningError(error!, retry: save),
                        ],
                      ],
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 18),
                  child: CustomAppButton(
                    key: const Key('dailySavePreferences'),
                    text: kinds.isEmpty
                        ? 'Chọn ít nhất 1 kỹ năng'
                        : 'Lưu lộ trình',
                    isLoading: busy,
                    onPressed: busy || kinds.isEmpty ? null : save,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildKindTile(String kind) {
    final rankIndex = kinds.indexOf(kind);
    final selected = rankIndex >= 0;
    final isPrimary = rankIndex == 0;
    return Material(
      key: ValueKey('daily-kind-$kind'),
      color: isPrimary
          ? const Color(0xFFF1FAF4)
          : selected
          ? const Color(0xFFF8FCFA)
          : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(
          color: isPrimary
              ? const Color(0xFF2F854A)
              : selected
              ? const Color(0xFF7BC494)
              : const Color(0xFFE2E8F0),
          width: isPrimary ? 1.6 : (selected ? 1.3 : 1.0),
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: busy ? null : () => _toggleKind(kind),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              Icon(
                _kindIcon(kind),
                size: 21,
                color: selected
                    ? const Color(0xFF1E713B)
                    : const Color(0xFF64748B),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  learningKindLabel(kind),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: designText(
                    15.5,
                    weight: selected ? FontWeight.w700 : FontWeight.w600,
                    color: selected
                        ? const Color(0xFF1E713B)
                        : AppColors.grey900,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Container(
                width: 26,
                height: 26,
                decoration: BoxDecoration(
                  color: isPrimary
                      ? const Color(0xFF2F854A)
                      : selected
                      ? const Color(0xFFE2F4EA)
                      : Colors.white,
                  shape: BoxShape.circle,
                  border: isPrimary
                      ? null
                      : Border.all(
                          color: selected
                              ? const Color(0xFF2F854A)
                              : const Color(0xFFCBD5E1),
                          width: 1.5,
                        ),
                ),
                alignment: Alignment.center,
                child: selected
                    ? Text(
                        '${rankIndex + 1}',
                        style: designText(
                          13.5,
                          weight: FontWeight.w800,
                          color: isPrimary
                              ? Colors.white
                              : const Color(0xFF1E713B),
                          height: 1.1,
                        ).copyWith(
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      )
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

