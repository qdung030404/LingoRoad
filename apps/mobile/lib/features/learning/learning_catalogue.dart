import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/app_button.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/learning_media_image.dart';
import '../grammar/grammar_controller.dart';
import 'learning_controller.dart';
import 'learning_pages.dart';
import 'learning_repository.dart';
import 'learning_widgets.dart';

String learningKindLabel(String kind) => switch (kind) {
  'GRAMMAR' => 'Ngữ pháp',
  'VOCABULARY' => 'Từ vựng',
  'READING' => 'Đọc',
  'LISTENING' => 'Nghe',
  'SPEAKING' => 'Nói',
  'WRITING' => 'Viết',
  _ => kind,
};

class LearningCatalogue extends StatefulWidget {
  const LearningCatalogue({
    super.key,
    required this.controller,
    required this.kinds,
    this.onOpenHistory,
    this.placementCefr,
    this.showPreviousLevels = false,
    this.onTogglePreviousLevels,
    this.asSliver = false,
  });
  final LearningController controller;
  final List<String> kinds;
  final VoidCallback? onOpenHistory;
  final String? placementCefr;
  final bool showPreviousLevels;
  final VoidCallback? onTogglePreviousLevels;
  final bool asSliver;

  @override
  State<LearningCatalogue> createState() => _LearningCatalogueState();
}

class _LearningCatalogueState extends State<LearningCatalogue> {
  String? selectedLevel;

  Widget _levelDropdown(List<String> levels, String? level) {
    final foreground = level == null ? AppColors.grey900 : Colors.white;
    return PopupMenuButton<String>(
      key: const ValueKey('practice-level-dropdown'),
      tooltip: 'Chọn cấp độ',
      position: PopupMenuPosition.under,
      offset: const Offset(0, 6),
      color: AppColors.grey0,
      shape: const RoundedRectangleBorder(borderRadius: AppRadius.cardSm),
      borderRadius: AppRadius.tagRadius,
      initialValue: level ?? '',
      onSelected: (value) =>
          setState(() => selectedLevel = value.isEmpty ? null : value),
      itemBuilder: (context) => [
        for (final option in <String?>[null, ...levels])
          CheckedPopupMenuItem<String>(
            value: option ?? '',
            checked: option == level,
            child: Text(option ?? 'Tất cả cấp độ'),
          ),
      ],
      child: Ink(
        decoration: BoxDecoration(
          color: level == null ? AppColors.grey0 : AppColors.primary700,
          borderRadius: AppRadius.tagRadius,
          border: Border.all(
            color: level == null ? AppColors.grey200 : AppColors.primary700,
          ),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              spacing: 8,
              children: [
                Icon(Icons.tune_rounded, size: 18, color: foreground),
                Flexible(
                  child: Text(
                    level == null ? 'Tất cả cấp độ' : 'Cấp độ $level',
                    overflow: TextOverflow.ellipsis,
                    style: designText(
                      14,
                      weight: FontWeight.w600,
                      color: foreground,
                    ),
                  ),
                ),
                Icon(Icons.expand_more_rounded, size: 18, color: foreground),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLessonItem(
    LearningLesson lesson, {
    required bool isListening,
    required bool isReading,
  }) {
    final controller = widget.controller;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: isListening || isReading
          ? _practiceLessonCard(lesson, isReading: isReading)
          : LearningCard(
              key: ValueKey('learning-lesson-${lesson.id}'),
              onTap: () {
                if (lesson.kind == 'GRAMMAR' &&
                    lesson.state != 'COMPLETED' &&
                    controller.grammar != null) {
                  openUncompletedGrammarCard(
                    context,
                    controller,
                    lessonId: lesson.id,
                    lessonCode: lesson.code,
                    grammarTopicCode: lesson.grammarTopicCode,
                    title: lesson.title,
                  );
                  return;
                }
                openLearningLesson(context, controller, lessonId: lesson.id);
              },
              children: [
                learningHeading(lesson.title),
                learningBody(lesson.description),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    LearningPill(learningKindLabel(lesson.kind), small: true),
                    LearningPill('${lesson.minutes} phút', small: true),
                    LearningPill(
                      lesson.state == 'COMPLETED' ? 'Hoàn thành' : 'Chưa học',
                      small: true,
                      selected: lesson.state == 'COMPLETED',
                    ),
                  ],
                ),
                if (lesson.json['latestResult'] case final Map result)
                  learningBody(
                    'Lần gần nhất: ${result['correctCount']}/${result['totalQuestions']} câu đúng',
                    size: 14,
                  ),
              ],
            ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final int placementRank = GrammarController.cefrRank(widget.placementCefr);
    final bool filterBelowPlacement = placementRank > 0 && !widget.showPreviousLevels;
    final List<LearningLesson> allKindLessons = controller.lessons
        .where((lesson) => widget.kinds.contains(lesson.kind))
        .toList();
    final bool hasPreviousLessons =
        placementRank > 0 &&
        allKindLessons.any((lesson) {
          final int r = GrammarController.cefrRank(lesson.cefrLevel);
          return r >= 0 && r < placementRank;
        });
    final List<LearningLesson> lessons = filterBelowPlacement
        ? allKindLessons.where((lesson) {
            final int r = GrammarController.cefrRank(lesson.cefrLevel);
            return r < 0 || r >= placementRank;
          }).toList()
        : allKindLessons;
    final isReading =
        widget.kinds.length == 1 && widget.kinds.single == 'READING';
    final isListening =
        widget.kinds.length == 1 && widget.kinds.single == 'LISTENING';
    final levels = isReading || isListening
        ? (lessons
              .map((lesson) => lesson.cefrLevel)
              .whereType<String>()
              .toSet()
              .toList()
            ..sort())
        : <String>[];
    final level = levels.contains(selectedLevel) ? selectedLevel : null;
    final List<LearningLesson> visible = level == null
        ? lessons
        : lessons.where((lesson) => lesson.cefrLevel == level).toList();

    final topChildren = <Widget>[
      if (controller.catalogueError != null)
        LearningError(
          controller.catalogueError!,
          retry: controller.loadCatalogue,
        )
      else if (controller.error != null)
        LearningError(controller.error!, retry: controller.refresh),
      if (levels.isNotEmpty || widget.onOpenHistory != null) ...[
        Row(
          children: [
            Expanded(
              child: Align(
                alignment: AlignmentDirectional.centerStart,
                child: levels.isEmpty
                    ? const SizedBox.shrink()
                    : _levelDropdown(levels, level),
              ),
            ),
            if (widget.onOpenHistory case final openHistory?) ...[
              const SizedBox(width: 8),
              IconButton.filledTonal(
                key: const ValueKey('practice-history'),
                tooltip: 'Lịch sử làm bài',
                onPressed: openHistory,
                icon: const Icon(Icons.history_rounded, size: 24),
                style: IconButton.styleFrom(
                  backgroundColor: AppColors.primary25,
                  foregroundColor: AppColors.primary800,
                  minimumSize: const Size.square(48),
                  padding: EdgeInsets.zero,
                  shape: RoundedRectangleBorder(
                    borderRadius: AppRadius.tagRadius,
                    side: const BorderSide(color: AppColors.primary100),
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 12),
      ],
      if ((controller.catalogueLoading || controller.loading) &&
          controller.lessons.isEmpty &&
          controller.catalogueError == null &&
          controller.error == null)
        const Center(child: CircularProgressIndicator()),
    ];

    final bottomChildren = <Widget>[
      if (allKindLessons.isEmpty &&
          controller.catalogueLoaded &&
          !controller.catalogueLoading &&
          !controller.loading &&
          controller.catalogueError == null &&
          controller.error == null)
        learningBody('Chưa có bài học được xuất bản.'),
      if (allKindLessons.isNotEmpty && lessons.isEmpty && hasPreviousLessons) ...[
        learningBody(
          'Chưa có bài học từ bậc ${widget.placementCefr} trở lên. Nhấn "Xem các bậc trước đó" để ôn lại.',
        ),
        AppSpacing.gapSm,
      ],
      if ((isListening || isReading) && lessons.isNotEmpty && visible.isEmpty)
        learningBody(
          isReading
              ? 'Chưa có bài đọc ở cấp độ này.'
              : 'Chưa có bài nghe ở cấp độ này.',
        ),
      if (hasPreviousLessons && widget.onTogglePreviousLevels != null)
        CustomAppButton(
          key: const Key('catalogueTogglePreviousLevels'),
          text: widget.showPreviousLevels
              ? 'Ẩn các bậc trước đó'
              : 'Xem các bậc trước đó',
          isSecondary: true,
          onPressed: widget.onTogglePreviousLevels,
        ),
    ];

    if (widget.asSliver) {
      return SliverMainAxisGroup(
        slivers: [
          if (topChildren.isNotEmpty)
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: topChildren,
              ),
            ),
          if (visible.isNotEmpty)
            SliverList.builder(
              itemCount: visible.length,
              itemBuilder: (context, index) => _buildLessonItem(
                visible[index],
                isListening: isListening,
                isReading: isReading,
              ),
            ),
          if (bottomChildren.isNotEmpty)
            SliverToBoxAdapter(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: bottomChildren,
              ),
            ),
        ],
      );
    }

    final hasAncestorScroll = Scrollable.maybeOf(context) != null;
    if (hasAncestorScroll) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ...topChildren,
          if (visible.isNotEmpty)
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              padding: EdgeInsets.zero,
              itemCount: visible.length,
              itemBuilder: (context, index) => _buildLessonItem(
                visible[index],
                isListening: isListening,
                isReading: isReading,
              ),
            ),
          ...bottomChildren,
        ],
      );
    }

    return CustomScrollView(
      slivers: [
        if (topChildren.isNotEmpty)
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: topChildren,
            ),
          ),
        if (visible.isNotEmpty)
          SliverList.builder(
            itemCount: visible.length,
            itemBuilder: (context, index) => _buildLessonItem(
              visible[index],
              isListening: isListening,
              isReading: isReading,
            ),
          ),
        if (bottomChildren.isNotEmpty)
          SliverToBoxAdapter(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: bottomChildren,
            ),
          ),
      ],
    );
  }

  Widget _practiceLessonCard(LearningLesson lesson, {required bool isReading}) {
    final complete = lesson.state == 'COMPLETED';
    final inProgress = lesson.state == 'IN_PROGRESS';
    final levelBadge = lesson.cefrLevel ?? (isReading ? 'Đọc' : null);
    return Material(
      color: AppColors.grey5,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.cardRadius,
        side: const BorderSide(color: AppColors.grey100),
      ),
      child: InkWell(
        key: ValueKey('learning-lesson-${lesson.id}'),
        borderRadius: AppRadius.cardRadius,
        onTap: () =>
            openLearningLesson(context, widget.controller, lessonId: lesson.id),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (lesson.coverImageUrl case final String cover
                      when cover.trim().isNotEmpty) ...[
                    LearningMediaImage(
                      imageUrl: cover,
                      width: 68,
                      height: 68,
                      borderRadius: BorderRadius.circular(12),
                      semanticLabel: lesson.title,
                    ),
                    const SizedBox(width: 14),
                  ],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        learningHeading(lesson.title, size: 20),
                        if (lesson.description.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          learningBody(lesson.description, size: 15),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        if (!complete)
                          LearningPill(
                            inProgress ? 'Đang học' : 'Chưa học',
                            small: true,
                            fill: inProgress ? AppColors.warning0 : null,
                            color: inProgress
                                ? const Color(0xFFE28A00)
                                : AppColors.grey900,
                          ),
                        LearningPill(
                          '${lesson.minutes} phút',
                          small: true,
                          icon: const FigmaAsset(
                            'practice/imgVuesaxLinearTimer',
                            size: 18,
                          ),
                        ),
                        if (levelBadge case final String level)
                          LearningPill(
                            level,
                            small: true,
                            fill: AppColors.primary25,
                            color: AppColors.primary700,
                          ),
                        if (lesson.json['latestResult'] case final Map result)
                          LearningPill(
                            '${result['correctCount']}/${result['totalQuestions']} câu đúng',
                            small: true,
                            color: AppColors.grey800,
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (complete)
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: AppColors.primary600,
                          width: 2.4,
                        ),
                      ),
                      child: CustomPaint(painter: _BoldCheckPainter()),
                    )
                  else
                    FigmaAsset(
                      'practice/imgFrame${inProgress ? 75 : 76}',
                      size: 28,
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

class _BoldCheckPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.primary600
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final path = Path()
      ..moveTo(size.width * 0.28, size.height * 0.52)
      ..lineTo(size.width * 0.44, size.height * 0.67)
      ..lineTo(size.width * 0.72, size.height * 0.35);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class LearningError extends StatelessWidget {
  const LearningError(this.message, {super.key, required this.retry});
  final String message;
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(message, style: designText(14, color: AppColors.grey800)),
        TextButton(onPressed: retry, child: const Text('Thử lại')),
      ],
    ),
  );
}
