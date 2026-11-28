import 'package:flutter/material.dart';
import '../../core/theme/app_borders.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../shared/app_button.dart';
import '../learning/learning_controller.dart';
import '../learning/learning_pages.dart' show LearningError;
import '../learning/learning_widgets.dart' show previewPush;
import 'grammar_controller.dart';
import 'grammar_repository.dart';
import 'grammar_topic_detail_page.dart';

const double _kCompactWidthBreakpoint = 340.0;

IconData _groupIcon(String code) {
  if (code.contains('tenses')) return Icons.schedule_rounded;
  if (code.contains('questions')) return Icons.help_outline_rounded;
  if (code.contains('quantifiers')) return Icons.pie_chart_outline_rounded;
  if (code.contains('comparatives')) return Icons.compare_arrows_rounded;
  if (code.contains('verb_forms')) return Icons.bolt_rounded;
  if (code.contains('conditionals')) return Icons.call_split_rounded;
  if (code.contains('clauses')) return Icons.account_tree_outlined;
  if (code.contains('discourse')) return Icons.school_outlined;
  return Icons.menu_book_outlined;
}

class GrammarCatalogueView extends StatefulWidget {
  const GrammarCatalogueView({
    super.key,
    required this.controller,
    this.learningController,
    this.placementCefr,
    this.showPreviousLevels = false,
    this.onTogglePreviousLevels,
    this.asSliver = false,
  });

  final GrammarController controller;
  final LearningController? learningController;
  final String? placementCefr;
  final bool showPreviousLevels;
  final VoidCallback? onTogglePreviousLevels;
  final bool asSliver;

  @override
  State<GrammarCatalogueView> createState() => _GrammarCatalogueViewState();
}

sealed class _GrammarListEntry {
  const _GrammarListEntry();
}

class _GrammarGroupHeaderEntry extends _GrammarListEntry {
  const _GrammarGroupHeaderEntry({
    required this.filteredGroup,
    required this.expanded,
    required this.topGap,
  });
  final GrammarFilteredGroup filteredGroup;
  final bool expanded;
  final double topGap;
}

class _GrammarTopicRowEntry extends _GrammarListEntry {
  const _GrammarTopicRowEntry({
    required this.topic,
    required this.isFirst,
    required this.isLast,
  });
  final GrammarTreeNode topic;
  final bool isFirst;
  final bool isLast;
}

class _GrammarCatalogueViewState extends State<GrammarCatalogueView> {
  final TextEditingController _searchTextController = TextEditingController();

  bool get _hidingPreviousLevels =>
      !widget.showPreviousLevels &&
      GrammarController.cefrRank(widget.placementCefr) > 0;

  void _syncMinimumVisibleCefr() {
    final String? target = _hidingPreviousLevels ? widget.placementCefr : null;
    widget.controller.setMinimumVisibleCefr(target, notify: false);
  }

  @override
  void initState() {
    super.initState();
    _syncMinimumVisibleCefr();
    widget.controller.load();
  }

  @override
  void didUpdateWidget(covariant GrammarCatalogueView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      _syncMinimumVisibleCefr();
      widget.controller.load();
    } else if (oldWidget.placementCefr != widget.placementCefr ||
        oldWidget.showPreviousLevels != widget.showPreviousLevels) {
      _syncMinimumVisibleCefr();
    }
  }

  @override
  void dispose() {
    _searchTextController.dispose();
    super.dispose();
  }

  Future<void> _openTopic(GrammarTreeNode topic) async {
    if (topic.learnerStatus == 'LOCKED') {
      final List<GrammarTreeNode> prereqs = widget.controller
          .uncompletedPrerequisites(
            topic,
            minimumBlockingCefr: widget.placementCefr,
          );
      if (prereqs.isNotEmpty) {
        final GrammarTreeNode? target = await showGrammarLockedDialog(
          context: context,
          prerequisites: prereqs,
        );
        if (!mounted || target == null) return;
        _pushDetail(target.code, target.titleVi, target.cefrLevel);
        return;
      }
    }
    _pushDetail(topic.code, topic.titleVi, topic.cefrLevel);
  }

  void _pushDetail(String code, String titleVi, String cefrLevel) {
    previewPush<void>(
      context,
      GrammarTopicDetailPage(
        controller: widget.controller,
        topicCode: code,
        initialTitleVi: titleVi,
        initialCefrLevel: cefrLevel,
        learningController: widget.learningController,
        placementCefr: widget.placementCefr,
      ),
    );
  }

  List<_GrammarListEntry> _flattenEntries(
    BuildContext context,
    GrammarController ctrl,
    List<GrammarFilteredGroup> groups,
  ) {
    final double gap = AppSpacing.item(context);
    final List<_GrammarListEntry> entries = <_GrammarListEntry>[];
    for (int gIndex = 0; gIndex < groups.length; gIndex++) {
      final GrammarFilteredGroup fg = groups[gIndex];
      final bool expanded = ctrl.isGroupExpanded(fg.group.code);
      entries.add(
        _GrammarGroupHeaderEntry(
          filteredGroup: fg,
          expanded: expanded,
          topGap: gIndex > 0 ? gap : 0,
        ),
      );
      if (expanded) {
        for (int tIndex = 0; tIndex < fg.topics.length; tIndex++) {
          entries.add(
            _GrammarTopicRowEntry(
              topic: fg.topics[tIndex],
              isFirst: tIndex == 0,
              isLast: tIndex == fg.topics.length - 1,
            ),
          );
        }
      }
    }
    return entries;
  }

  Widget _buildEntryWidget(GrammarController ctrl, _GrammarListEntry entry) {
    return switch (entry) {
      _GrammarGroupHeaderEntry(:final filteredGroup, :final expanded, :final topGap) =>
        Padding(
          padding: EdgeInsets.only(top: topGap),
          child: _GrammarGroupHeaderBox(
            filteredGroup: filteredGroup,
            expanded: expanded,
            onToggle: () => ctrl.toggleGroup(filteredGroup.group.code),
          ),
        ),
      _GrammarTopicRowEntry(:final topic, :final isFirst, :final isLast) =>
        _GrammarGroupTopicBox(
          topic: topic,
          isFirst: isFirst,
          isLast: isLast,
          onTap: () => _openTopic(topic),
        ),
    };
  }

  Widget _buildControlsColumn(GrammarController ctrl) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        _buildHeader(ctrl),
        AppSpacing.gapMd,
        _buildSearchInput(ctrl),
        AppSpacing.gapMd,
        _buildCefrFilterBar(ctrl),
        if (GrammarController.cefrRank(widget.placementCefr) > 0 &&
            widget.onTogglePreviousLevels != null) ...<Widget>[
          AppSpacing.gapMd,
          CustomAppButton(
            key: const Key('grammarTogglePreviousLevels'),
            text: widget.showPreviousLevels
                ? 'Ẩn các bậc trước đó'
                : 'Xem các bậc trước đó',
            isSecondary: true,
            icon: Icon(
              widget.showPreviousLevels
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined,
              color: AppColors.grey900,
            ),
            onPressed: widget.onTogglePreviousLevels,
          ),
        ],
        AppSpacing.gapMd,
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (BuildContext context, _) {
        final GrammarController ctrl = widget.controller;

        if (ctrl.loading && !ctrl.loaded) {
          const loadingBox = Padding(
            padding: AppSpacing.allLg,
            child: Center(
              child: CircularProgressIndicator(color: AppColors.primary500),
            ),
          );
          return widget.asSliver
              ? const SliverToBoxAdapter(child: loadingBox)
              : loadingBox;
        }

        if (ctrl.error != null && ctrl.totalLeafCount == 0) {
          final errorBox = LearningError(
            ctrl.error!,
            retry: () => ctrl.load(force: true),
          );
          return widget.asSliver
              ? SliverToBoxAdapter(child: errorBox)
              : errorBox;
        }

        if (ctrl.loaded && ctrl.totalLeafCount == 0) {
          final emptyBox = Container(
            width: double.infinity,
            padding: AppSpacing.allLg,
            decoration: BoxDecoration(
              color: AppColors.surfaceLight,
              borderRadius: AppRadius.cardRadius,
              border: AppBorders.hairline(),
            ),
            child: Column(
              children: <Widget>[
                const Text(
                  'Chưa có dữ liệu cấu trúc ngữ pháp.',
                  style: AppTextStyles.body,
                  textAlign: TextAlign.center,
                ),
                AppSpacing.gapMd,
                CustomAppButton(
                  text: 'Tải lại',
                  isSecondary: true,
                  onPressed: () => ctrl.load(force: true),
                ),
              ],
            ),
          );
          return widget.asSliver
              ? SliverToBoxAdapter(child: emptyBox)
              : emptyBox;
        }

        final List<GrammarFilteredGroup> groups = ctrl.visibleGroups;
        final controls = _buildControlsColumn(ctrl);

        if (groups.isEmpty) {
          final emptyFilter = _buildEmptyFilterState(ctrl);
          if (widget.asSliver) {
            return SliverMainAxisGroup(
              slivers: <Widget>[
                SliverToBoxAdapter(child: controls),
                SliverToBoxAdapter(child: emptyFilter),
              ],
            );
          }
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[controls, emptyFilter],
          );
        }

        final List<_GrammarListEntry> entries = _flattenEntries(
          context,
          ctrl,
          groups,
        );

        if (widget.asSliver) {
          return SliverMainAxisGroup(
            slivers: <Widget>[
              SliverToBoxAdapter(child: controls),
              SliverList.builder(
                itemCount: entries.length,
                itemBuilder: (BuildContext context, int index) =>
                    _buildEntryWidget(ctrl, entries[index]),
              ),
            ],
          );
        }

        final bool hasAncestorScroll = Scrollable.maybeOf(context) != null;
        if (hasAncestorScroll) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              controls,
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                padding: EdgeInsets.zero,
                itemCount: entries.length,
                itemBuilder: (BuildContext context, int index) =>
                    _buildEntryWidget(ctrl, entries[index]),
              ),
            ],
          );
        }

        return CustomScrollView(
          slivers: <Widget>[
            SliverToBoxAdapter(child: controls),
            SliverList.builder(
              itemCount: entries.length,
              itemBuilder: (BuildContext context, int index) =>
                  _buildEntryWidget(ctrl, entries[index]),
            ),
          ],
        );
      },
    );
  }

  Widget _buildHeader(GrammarController ctrl) {
    final Widget countChip = Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: AppColors.primary25,
        borderRadius: AppRadius.tagRadius,
        border: Border.all(color: AppColors.primary100),
      ),
      child: Text(
        '${ctrl.visibleLeafCount} cấu trúc',
        style: AppTextStyles.caption.copyWith(
          color: AppColors.primary800,
          fontWeight: FontWeight.w700,
        ),
      ),
    );

    final String rangeLabel = _hidingPreviousLevels
        ? 'từ ${widget.placementCefr} đến C2'
        : 'từ A1 đến C2';

    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        final bool compact = constraints.maxWidth < _kCompactWidthBreakpoint;
        final Widget titleColumn = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            const Text(
              'Cấu trúc ngữ pháp CEFR',
              style: AppTextStyles.heading2,
            ),
            AppSpacing.gapXs,
            Text(
              'Tra cứu công thức, cách dùng và lộ trình $rangeLabel',
              style: AppTextStyles.caption.copyWith(color: AppColors.grey700),
            ),
          ],
        );

        if (compact) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              titleColumn,
              AppSpacing.gapSm,
              countChip,
            ],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(child: titleColumn),
            AppSpacing.gapSm,
            countChip,
          ],
        );
      },
    );
  }

  Widget _buildSearchInput(GrammarController ctrl) {
    return TextField(
      key: const ValueKey<String>('grammar-search-input'),
      controller: _searchTextController,
      onChanged: (String value) => ctrl.setSearchQuery(value, debounce: true),
      style: AppTextStyles.body,
      decoration: InputDecoration(
        hintText: 'Tìm cấu trúc (VD: Hiện tại hoàn thành, Đảo ngữ...)',
        hintStyle: AppTextStyles.body.copyWith(color: AppColors.grey500),
        prefixIcon: const Icon(Icons.search_rounded, color: AppColors.grey500),
        suffixIcon: ValueListenableBuilder<TextEditingValue>(
          valueListenable: _searchTextController,
          builder: (BuildContext context, TextEditingValue value, _) =>
              value.text.isEmpty
              ? const SizedBox.shrink()
              : IconButton(
                  onPressed: () {
                    _searchTextController.clear();
                    ctrl.setSearchQuery('');
                  },
                  icon: const Icon(Icons.close_rounded, color: AppColors.grey600),
                ),
        ),
        filled: true,
        fillColor: AppColors.surfaceLight,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadius.inputRadius,
          borderSide: AppBorders.hairlineSide(),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.inputRadius,
          borderSide: AppBorders.hairlineSide(),
        ),
        focusedBorder: const OutlineInputBorder(
          borderRadius: AppRadius.inputRadius,
          borderSide: BorderSide(color: AppColors.primary500),
        ),
      ),
    );
  }

  String _levelLabel(GrammarController ctrl, String level) {
    final int total = ctrl.countForLevel(level);
    final int? completed = ctrl.completedCountForLevel(level);
    if (completed != null && completed > 0) {
      return '$level ($completed/$total)';
    }
    return '$level ($total)';
  }

  Widget _buildCefrFilterBar(GrammarController ctrl) {
    final int minRank = _hidingPreviousLevels
        ? GrammarController.cefrRank(widget.placementCefr)
        : 0;
    final List<String> visibleLevels = kCefrLevels
        .where((String level) => GrammarController.cefrRank(level) >= minRank)
        .toList();

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: <Widget>[
        _CefrFilterButton(
          key: const ValueKey<String>('grammar-filter-ALL'),
          label: 'Tất cả',
          selected: ctrl.selectedCefr == null,
          onTap: () => ctrl.setSelectedCefr(null),
        ),
        for (final String level in visibleLevels)
          _CefrFilterButton(
            key: ValueKey<String>('grammar-filter-$level'),
            label: _levelLabel(ctrl, level),
            selected: ctrl.selectedCefr == level,
            onTap: () => ctrl.setSelectedCefr(
              ctrl.selectedCefr == level ? null : level,
            ),
          ),
      ],
    );
  }

  Widget _buildEmptyFilterState(GrammarController ctrl) {
    return Container(
      width: double.infinity,
      padding: AppSpacing.allLg,
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: AppRadius.cardRadius,
        border: AppBorders.hairline(),
      ),
      child: Column(
        children: <Widget>[
          const Text(
            'Không tìm thấy cấu trúc ngữ pháp phù hợp bộ lọc.',
            style: AppTextStyles.body,
            textAlign: TextAlign.center,
          ),
          AppSpacing.gapMd,
          CustomAppButton(
            text: 'Xóa bộ lọc',
            isSecondary: true,
            onPressed: () {
              _searchTextController.clear();
              ctrl.clearFilters();
            },
          ),
        ],
      ),
    );
  }
}

class _CefrFilterButton extends StatelessWidget {
  const _CefrFilterButton({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final Color bg = selected ? AppColors.primary700 : AppColors.grey100;
    final Color fg = selected ? AppColors.grey0 : AppColors.grey900;

    return Material(
      color: bg,
      borderRadius: AppRadius.buttonRadius,
      child: InkWell(
        borderRadius: AppRadius.buttonRadius,
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Text(
            label,
            style: AppTextStyles.bodyStrong.copyWith(color: fg),
          ),
        ),
      ),
    );
  }
}

class _GrammarGroupHeaderBox extends StatelessWidget {
  const _GrammarGroupHeaderBox({
    required this.filteredGroup,
    required this.expanded,
    required this.onToggle,
  });

  final GrammarFilteredGroup filteredGroup;
  final bool expanded;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final GrammarTreeNode group = filteredGroup.group;
    final List<GrammarTreeNode> topics = filteredGroup.topics;
    final BorderRadius cardRadius = expanded
        ? const BorderRadius.vertical(
            top: Radius.circular(AppRadius.md),
          )
        : AppRadius.cardRadius;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: cardRadius,
        border: Border(
          top: AppBorders.hairlineSide(),
          left: AppBorders.hairlineSide(),
          right: AppBorders.hairlineSide(),
          bottom: expanded ? BorderSide.none : AppBorders.hairlineSide(),
        ),
        boxShadow: expanded ? null : AppShadows.level1,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Material(
            color: AppColors.surfaceLight,
            borderRadius: cardRadius,
            child: InkWell(
              key: ValueKey<String>('grammar-group-${group.code}'),
              borderRadius: cardRadius,
              onTap: onToggle,
              child: Padding(
                padding: AppSpacing.cardPadding,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Container(
                      padding: AppSpacing.allSm,
                      decoration: BoxDecoration(
                        color: AppColors.primary25,
                        borderRadius: AppRadius.cardSm,
                      ),
                      child: Icon(
                        _groupIcon(group.code),
                        color: AppColors.primary700,
                      ),
                    ),
                    AppSpacing.gapSm,
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(group.titleVi, style: AppTextStyles.heading2),
                          if (group.summaryVi.isNotEmpty) ...<Widget>[
                            AppSpacing.gapXs,
                            Text(
                              group.summaryVi,
                              style: AppTextStyles.caption.copyWith(
                                color: AppColors.grey700,
                              ),
                            ),
                          ],
                          AppSpacing.gapSm,
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.sm,
                              vertical: AppSpacing.xs,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.grey50,
                              borderRadius: AppRadius.tagRadius,
                            ),
                            child: Text(
                              '${topics.length} chủ điểm',
                              style: AppTextStyles.caption.copyWith(
                                color: AppColors.grey800,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    AppSpacing.gapXs,
                    Icon(
                      expanded
                          ? Icons.expand_less_rounded
                          : Icons.expand_more_rounded,
                      color: AppColors.grey700,
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (expanded) const Divider(height: 1, color: AppColors.borderLight),
        ],
      ),
    );
  }
}

class _GrammarGroupTopicBox extends StatelessWidget {
  const _GrammarGroupTopicBox({
    required this.topic,
    required this.isFirst,
    required this.isLast,
    required this.onTap,
  });

  final GrammarTreeNode topic;
  final bool isFirst;
  final bool isLast;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final BorderRadius bottomRadius = isLast
        ? const BorderRadius.vertical(bottom: Radius.circular(AppRadius.md))
        : BorderRadius.zero;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: bottomRadius,
        border: Border(
          left: AppBorders.hairlineSide(),
          right: AppBorders.hairlineSide(),
          bottom: isLast ? AppBorders.hairlineSide() : BorderSide.none,
        ),
      ),
      padding: EdgeInsets.fromLTRB(
        AppSpacing.sm,
        isFirst ? AppSpacing.sm : AppSpacing.xs,
        AppSpacing.sm,
        isLast ? AppSpacing.sm : AppSpacing.xs,
      ),
      child: _GrammarLeafTile(topic: topic, onTap: onTap),
    );
  }
}

class _GrammarLeafTile extends StatelessWidget {
  const _GrammarLeafTile({
    required this.topic,
    required this.onTap,
  });

  final GrammarTreeNode topic;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.grey25,
      borderRadius: AppRadius.cardSm,
      child: InkWell(
        key: ValueKey<String>('grammar-topic-${topic.code}'),
        borderRadius: AppRadius.cardSm,
        onTap: onTap,
        child: Padding(
          padding: AppSpacing.allMd,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.xs,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: <Widget>[
                  GrammarCefrBadge(level: topic.cefrLevel),
                  if (topic.learnerStatus != null && topic.lessonCount > 0)
                    GrammarLearnerStatusBadge(status: topic.learnerStatus!),
                ],
              ),
              AppSpacing.gapSm,
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(topic.titleVi, style: AppTextStyles.bodyStrong),
                        AppSpacing.gapXs,
                        Text(
                          topic.titleEn,
                          style: AppTextStyles.caption.copyWith(
                            color: AppColors.primary700,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (topic.summaryVi.isNotEmpty) ...<Widget>[
                          AppSpacing.gapXs,
                          Text(
                            topic.summaryVi,
                            style: AppTextStyles.caption.copyWith(
                              color: AppColors.grey700,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  AppSpacing.gapSm,
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.grey600,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class GrammarRoadSection extends StatelessWidget {
  const GrammarRoadSection({
    super.key,
    required this.grammarController,
    this.learningController,
    this.placementCefr,
    this.showPreviousLevels = false,
    this.onTogglePreviousLevels,
    this.asSliver = false,
  });

  final GrammarController grammarController;
  final LearningController? learningController;
  final String? placementCefr;
  final bool showPreviousLevels;
  final VoidCallback? onTogglePreviousLevels;
  final bool asSliver;

  @override
  Widget build(BuildContext context) {
    return GrammarCatalogueView(
      controller: grammarController,
      learningController: learningController,
      placementCefr: placementCefr,
      showPreviousLevels: showPreviousLevels,
      onTogglePreviousLevels: onTogglePreviousLevels,
      asSliver: asSliver,
    );
  }
}
