import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../core/theme/app_borders.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../grammar/grammar_controller.dart';
import '../grammar/grammar_repository.dart';
import '../grammar/grammar_topic_detail_page.dart';
import 'daily_learning.dart';
import 'learning_controller.dart';
import 'learning_pages.dart' show LearningError, openLearningLesson;
import 'learning_repository.dart';
import 'learning_widgets.dart' show previewMessage, previewPush;

enum _MilestoneFilter { all, grammar, listening, reading }

class _CompletionSnapshot {
  const _CompletionSnapshot({
    required this.grammarStatuses,
    required this.grammarCompleted,
    required this.lessonStates,
    required this.summaryCompleted,
    required this.dailyTotalsCompleted,
  });
  final Map<String, String?> grammarStatuses;
  final int? grammarCompleted;
  final Map<String, String> lessonStates;
  final int? summaryCompleted;
  final int? dailyTotalsCompleted;

  bool hasChangedComparedTo(_CompletionSnapshot other) =>
      grammarCompleted != other.grammarCompleted ||
      summaryCompleted != other.summaryCompleted ||
      dailyTotalsCompleted != other.dailyTotalsCompleted ||
      !mapEquals(grammarStatuses, other.grammarStatuses) ||
      !mapEquals(lessonStates, other.lessonStates);
}

/// Objective CEFR milestone detail view showing Grammar, Listening, and Reading lessons.
class CefrMilestoneDetailPage extends StatefulWidget {
  const CefrMilestoneDetailPage({
    super.key,
    required this.milestoneCefr,
    this.placementCefr,
    this.learningController,
    this.grammarController,
    this.dailyController,
  });
  final String milestoneCefr;
  final String? placementCefr;
  final LearningController? learningController;
  final GrammarController? grammarController;
  final DailyLearningController? dailyController;

  @override
  State<CefrMilestoneDetailPage> createState() => _CefrMilestoneDetailPageState();
}

class _CefrMilestoneDetailPageState extends State<CefrMilestoneDetailPage> {
  _MilestoneFilter _filter = _MilestoneFilter.all;
  int _epoch = 0;

  bool get _isSample => widget.learningController == null && widget.grammarController == null;

  @override
  void initState() {
    super.initState();
    _loadInitial();
  }

  @override
  void dispose() {
    _epoch++;
    super.dispose();
  }

  Future<void> _loadInitial() async {
    final int epoch = ++_epoch;
    final List<Future<void>> tasks = [
      if (widget.grammarController != null) widget.grammarController!.load(),
      if (widget.learningController != null) widget.learningController!.loadCatalogue(),
    ];
    if (tasks.isEmpty) return;
    await Future.wait<void>(tasks);
    if (!mounted || epoch != _epoch) return;
    setState(() {});
  }

  List<GrammarTreeNode> _grammarTopics() =>
      widget.grammarController?.topicsForLevel(widget.milestoneCefr) ?? const [];

  List<LearningLesson> _objectiveLessons(String kind) =>
      (widget.learningController?.lessons ?? const <LearningLesson>[])
          .where((l) => l.kind == kind && l.cefrLevel == widget.milestoneCefr)
          .toList();

  _CompletionSnapshot _captureSnapshot() {
    final topics = _grammarTopics();
    final listening = _objectiveLessons('LISTENING');
    final reading = _objectiveLessons('READING');
    return _CompletionSnapshot(
      grammarStatuses: {for (final t in topics) t.code: t.learnerStatus},
      grammarCompleted: widget.grammarController?.completedCountForLevel(widget.milestoneCefr),
      lessonStates: {for (final l in [...listening, ...reading]) l.id: l.state},
      summaryCompleted: (widget.learningController?.summary['completedLessonCount'] as num?)?.toInt(),
      dailyTotalsCompleted: (widget.dailyController?.progress?['totals']?['completedLessonCount'] as num?)?.toInt(),
    );
  }

  Future<void> _syncIfCompletionChanged(_CompletionSnapshot before) async {
    if (!mounted) return;
    final lc = widget.learningController;
    if (lc != null && !lc.catalogueLoaded && lc.usesHomeApi) {
      await lc.loadCatalogue();
      if (!mounted) return;
    }
    if (!before.hasChangedComparedTo(_captureSnapshot())) return;
    widget.dailyController?.invalidateDetails();
    final tasks = <Future<void>>[
      if (widget.dailyController != null) widget.dailyController!.loadDetails(),
      if (lc != null) lc.refresh(),
      if (widget.grammarController != null) widget.grammarController!.load(force: true),
    ];
    if (tasks.isNotEmpty) await Future.wait<void>(tasks);
    if (mounted) setState(() {});
  }

  Future<void> _openGrammarTopic(GrammarTreeNode topic) async {
    final GrammarController? ctrl = widget.grammarController;
    if (ctrl == null) return;
    final _CompletionSnapshot snapshot = _captureSnapshot();
    GrammarTreeNode target = topic;
    if (topic.learnerStatus == 'LOCKED') {
      final prereqs = ctrl.uncompletedPrerequisites(topic, minimumBlockingCefr: widget.placementCefr);
      if (prereqs.isNotEmpty) {
        final chosen = await showGrammarLockedDialog(context: context, prerequisites: prereqs);
        if (!mounted || chosen == null) return;
        target = chosen;
      }
    }
    await previewPush<void>(
      context,
      GrammarTopicDetailPage(
        controller: ctrl,
        topicCode: target.code,
        initialTitleVi: target.titleVi,
        initialCefrLevel: target.cefrLevel,
        learningController: widget.learningController,
        placementCefr: widget.placementCefr,
      ),
    );
    await _syncIfCompletionChanged(snapshot);
  }

  Future<void> _openObjectiveLesson(LearningLesson lesson) async {
    final lc = widget.learningController;
    if (lc == null) return;
    final snapshot = _captureSnapshot();
    await openLearningLesson(context, lc, lessonId: lesson.id);
    await _syncIfCompletionChanged(snapshot);
  }

  List<(String, String, String, bool)> _sampleItems(_MilestoneFilter skill) {
    final String lvl = widget.milestoneCefr;
    return switch (skill) {
      _MilestoneFilter.grammar => [
        ('g1', 'Cấu trúc trọng tâm $lvl · Phần 1', 'Ngữ pháp chuẩn $lvl kèm bài tập', lvl == 'A1'),
        ('g2', 'Cấu trúc trọng tâm $lvl · Phần 2', 'Mở rộng mẫu câu trình độ $lvl', false),
      ],
      _MilestoneFilter.listening => [('l1', 'Nghe hiểu ngữ cảnh $lvl', 'Hội thoại thực tế và trắc nghiệm', false)],
      _MilestoneFilter.reading => [('r1', 'Đọc hiểu đoạn văn $lvl', 'Đọc hiểu ý chính trình độ $lvl', lvl == 'A1')],
      _MilestoneFilter.all => const [],
    };
  }

  @override
  Widget build(BuildContext context) {
    final listenables = [
      if (widget.grammarController != null) widget.grammarController!,
      if (widget.learningController != null) widget.learningController!,
    ];
    return Scaffold(
      backgroundColor: AppColors.backgroundLight,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceLight,
        surfaceTintColor: AppColors.surfaceLight,
        elevation: 0,
        title: Text('Mốc ${widget.milestoneCefr}', style: AppTextStyles.heading2),
        actions: [
          Padding(padding: const EdgeInsets.only(right: AppSpacing.md), child: GrammarCefrBadge(level: widget.milestoneCefr)),
        ],
      ),
      body: SafeArea(
        child: ListenableBuilder(listenable: Listenable.merge(listenables), builder: (context, _) => _buildBody(context)),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    final GrammarController? gc = widget.grammarController;
    final LearningController? lc = widget.learningController;
    final List<GrammarTreeNode> grammarTopics = _grammarTopics();
    final List<LearningLesson> listeningLessons = _objectiveLessons('LISTENING');
    final List<LearningLesson> readingLessons = _objectiveLessons('READING');

    final int grammarCount = _isSample
        ? _sampleItems(_MilestoneFilter.grammar).length
        : grammarTopics.length;
    final int listeningCount = _isSample
        ? _sampleItems(_MilestoneFilter.listening).length
        : listeningLessons.length;
    final int readingCount = _isSample
        ? _sampleItems(_MilestoneFilter.reading).length
        : readingLessons.length;
    final int totalCount = grammarCount + listeningCount + readingCount;

    final bool waitingGrammar = gc != null && gc.loading && !gc.loaded;
    final bool waitingLearning =
        lc != null && lc.catalogueLoading && !lc.catalogueLoaded;
    final bool isInitialLoading =
        !_isSample && (waitingGrammar || waitingLearning) && totalCount == 0;

    return ListView(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacing.horizontal(context),
        vertical: AppSpacing.md,
      ),
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final (int idx, (_MilestoneFilter f, Key k, String lbl))
                  in [
                    (_MilestoneFilter.all, const Key('milestoneFilterAll'), 'Tất cả ($totalCount)'),
                    (_MilestoneFilter.grammar, const Key('milestoneFilterGrammar'), 'Ngữ pháp ($grammarCount)'),
                    (_MilestoneFilter.listening, const Key('milestoneFilterListening'), 'Nghe ($listeningCount)'),
                    (_MilestoneFilter.reading, const Key('milestoneFilterReading'), 'Đọc ($readingCount)'),
                  ].indexed) ...[
                if (idx > 0) AppSpacing.gapSm,
                _FilterChipButton(key: k, label: lbl, selected: _filter == f, onTap: () => setState(() => _filter = f)),
              ],
            ],
          ),
        ),
        AppSpacing.gapMd,
        if (gc?.error != null) ...[
          LearningError(gc!.error!, retry: () => gc.load(force: true)),
          AppSpacing.gapSm,
        ],
        if (lc?.catalogueError != null) ...[
          LearningError(lc!.catalogueError!, retry: lc.loadCatalogue),
          AppSpacing.gapSm,
        ],
        if (isInitialLoading)
          const Padding(
            padding: AppSpacing.allLg,
            child: Center(child: CircularProgressIndicator(color: AppColors.primary500)),
          )
        else ...[
          if (_filter == _MilestoneFilter.all || _filter == _MilestoneFilter.grammar)
            _buildSection(
              title: 'Ngữ pháp',
              count: grammarCount,
              emptyMessage: 'Chưa có chủ điểm ngữ pháp ở mốc ${widget.milestoneCefr}.',
              tiles: _isSample
                  ? _sampleTiles(context, _MilestoneFilter.grammar)
                  : [
                      for (final t in grammarTopics)
                        _MilestoneItemTile(
                          tileKey: Key('milestoneGrammar_${t.code}'),
                          cefrLevel: t.cefrLevel,
                          status: t.learnerStatus,
                          title: t.titleVi,
                          subtitle: t.titleEn,
                          subtitleIsAccent: true,
                          locked: t.learnerStatus == 'LOCKED',
                          onTap: () => _openGrammarTopic(t),
                        ),
                    ],
            ),
          if (_filter == _MilestoneFilter.all || _filter == _MilestoneFilter.listening) ...[
            if (_filter == _MilestoneFilter.all) AppSpacing.gapMd,
            _buildLessonSection(context, 'Nghe', 'Chưa có bài nghe ở mốc ${widget.milestoneCefr}.', listeningLessons, _MilestoneFilter.listening),
          ],
          if (_filter == _MilestoneFilter.all || _filter == _MilestoneFilter.reading) ...[
            if (_filter == _MilestoneFilter.all) AppSpacing.gapMd,
            _buildLessonSection(context, 'Đọc', 'Chưa có bài đọc ở mốc ${widget.milestoneCefr}.', readingLessons, _MilestoneFilter.reading),
          ],
        ],
        AppSpacing.gapLg,
      ],
    );
  }

  List<Widget> _sampleTiles(BuildContext context, _MilestoneFilter skill) => [
    for (final (code, title, sub, done) in _sampleItems(skill))
      _MilestoneItemTile(
        tileKey: Key('milestoneSample_$code'),
        cefrLevel: widget.milestoneCefr,
        status: done ? 'COMPLETED' : 'AVAILABLE',
        title: title,
        subtitle: sub,
        onTap: () => previewMessage(context, 'Nội dung minh họa cho mốc ${widget.milestoneCefr}.'),
      ),
  ];

  Widget _buildLessonSection(
    BuildContext context,
    String title,
    String emptyMessage,
    List<LearningLesson> lessons,
    _MilestoneFilter skill,
  ) => _buildSection(
    title: title,
    count: _isSample ? _sampleItems(skill).length : lessons.length,
    emptyMessage: emptyMessage,
    tiles: _isSample
        ? _sampleTiles(context, skill)
        : [
            for (final l in lessons)
              _MilestoneItemTile(
                tileKey: Key('milestoneLesson_${l.id}'),
                cefrLevel: l.cefrLevel ?? widget.milestoneCefr,
                status: l.state == 'COMPLETED' || l.state == 'IN_PROGRESS' ? l.state : 'NOT_STARTED',
                minutes: l.minutes > 0 ? l.minutes : null,
                title: l.title,
                subtitle: l.description,
                onTap: () => _openObjectiveLesson(l),
              ),
          ],
  );

  Widget _buildSection({
    required String title,
    required int count,
    required String emptyMessage,
    required List<Widget> tiles,
  }) => Container(
    width: double.infinity,
    padding: AppSpacing.cardPadding,
    decoration: BoxDecoration(
      color: AppColors.surfaceLight,
      borderRadius: AppRadius.cardRadius,
      border: AppBorders.hairline(),
      boxShadow: AppShadows.level1,
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text(title, style: AppTextStyles.heading2)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
              decoration: const BoxDecoration(color: AppColors.grey50, borderRadius: AppRadius.tagRadius),
              child: Text('$count bài', style: AppTextStyles.caption.copyWith(color: AppColors.grey800, fontWeight: FontWeight.w600)),
            ),
          ],
        ),
        AppSpacing.gapMd,
        if (tiles.isEmpty)
          Container(
            width: double.infinity,
            padding: AppSpacing.allMd,
            decoration: BoxDecoration(color: AppColors.grey25, borderRadius: AppRadius.cardSm, border: AppBorders.hairline()),
            child: Text(emptyMessage, style: AppTextStyles.body.copyWith(color: AppColors.grey700)),
          )
        else
          for (int i = 0; i < tiles.length; i++) ...[
            if (i > 0) AppSpacing.gapSm,
            tiles[i],
          ],
      ],
    ),
  );
}

class _FilterChipButton extends StatelessWidget {
  const _FilterChipButton({super.key, required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: selected ? AppColors.primary700 : AppColors.surfaceLight,
    borderRadius: AppRadius.buttonRadius,
    child: InkWell(
      borderRadius: AppRadius.buttonRadius,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
        decoration: BoxDecoration(borderRadius: AppRadius.buttonRadius, border: selected ? null : AppBorders.hairline()),
        child: Text(label, style: AppTextStyles.bodyStrong.copyWith(color: selected ? AppColors.grey0 : AppColors.grey900)),
      ),
    ),
  );
}

class _MilestoneItemTile extends StatelessWidget {
  const _MilestoneItemTile({
    required this.tileKey,
    required this.cefrLevel,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.status,
    this.minutes,
    this.subtitleIsAccent = false,
    this.locked = false,
  });

  final Key tileKey;
  final String cefrLevel;
  final String? status;
  final int? minutes;
  final String title;
  final String subtitle;
  final bool subtitleIsAccent;
  final bool locked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Material(
    color: AppColors.grey25,
    borderRadius: AppRadius.cardSm,
    child: InkWell(
      key: tileKey,
      borderRadius: AppRadius.cardSm,
      onTap: onTap,
      child: Padding(
        padding: AppSpacing.allMd,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.xs,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      GrammarCefrBadge(level: cefrLevel),
                      if (status == 'NOT_STARTED')
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
                          decoration: const BoxDecoration(color: AppColors.grey50, borderRadius: AppRadius.tagRadius),
                          child: Text('Chưa học', style: AppTextStyles.caption.copyWith(color: AppColors.grey700, fontWeight: FontWeight.w600)),
                        )
                      else if (status != null)
                        GrammarLearnerStatusBadge(status: status!),
                      if (minutes != null)
                        Text('$minutes phút', style: AppTextStyles.caption.copyWith(color: AppColors.grey700)),
                    ],
                  ),
                  AppSpacing.gapSm,
                  Text(title, style: AppTextStyles.bodyStrong),
                  if (subtitle.isNotEmpty) ...[
                    AppSpacing.gapXs,
                    Text(
                      subtitle,
                      style: AppTextStyles.caption.copyWith(
                        color: subtitleIsAccent ? AppColors.primary700 : AppColors.grey700,
                        fontWeight: subtitleIsAccent ? FontWeight.w600 : FontWeight.w400,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            AppSpacing.gapSm,
            Icon(locked ? Icons.lock_outline_rounded : Icons.chevron_right_rounded, color: AppColors.grey600),
          ],
        ),
      ),
    ),
  );
}
