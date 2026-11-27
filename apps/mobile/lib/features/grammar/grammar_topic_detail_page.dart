import 'package:flutter/material.dart';
import '../../core/theme/app_borders.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';
import '../../shared/app_button.dart';
import '../learning/learning_controller.dart';
import '../learning/learning_pages.dart' show LearningError, openLearningLesson;
import '../learning/learning_widgets.dart' show previewPush;
import 'grammar_controller.dart';
import 'grammar_repository.dart';

Future<GrammarTreeNode?> showGrammarLockedDialog({
  required BuildContext context,
  required List<GrammarTreeNode> prerequisites,
}) {
  final String prereqNames = prerequisites
      .map((GrammarTreeNode p) => p.titleVi)
      .join(', ');
  return showDialog<GrammarTreeNode>(
    context: context,
    builder: (BuildContext dialogContext) {
      return Dialog(
        backgroundColor: AppColors.surfaceLight,
        shape: const RoundedRectangleBorder(
          borderRadius: AppRadius.dialogRadius,
        ),
        child: Padding(
          padding: AppSpacing.dialogPadding,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                'Bạn cần học cấu trúc: $prereqNames để mở khóa cấu trúc này',
                style: AppTextStyles.heading2,
              ),
              AppSpacing.gapLg,
              Row(
                children: <Widget>[
                  Expanded(
                    child: CustomAppButton(
                      key: const ValueKey<String>('grammar-locked-cancel'),
                      text: 'Hủy',
                      isSecondary: true,
                      onPressed: () => Navigator.of(dialogContext).pop(null),
                    ),
                  ),
                  AppSpacing.gapSm,
                  Expanded(
                    child: CustomAppButton(
                      key: const ValueKey<String>('grammar-locked-learn'),
                      text: 'Học',
                      onPressed: () =>
                          Navigator.of(dialogContext).pop(prerequisites.first),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    },
  );
}

class GrammarCefrBadge extends StatelessWidget {
  const GrammarCefrBadge({super.key, required this.level});

  final String level;

  (Color bg, Color fg) _palette() => switch (level) {
    'A1' || 'A2' => (AppColors.primary50, AppColors.primary800),
    'B1' || 'B2' => (AppColors.warning0, AppColors.warning300),
    'C1' || 'C2' => (AppColors.error0, AppColors.error200),
    _ => (AppColors.grey50, AppColors.grey800),
  };

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = _palette();
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: AppRadius.tagRadius,
        border: Border.all(color: fg.withValues(alpha: 0.25)),
      ),
      child: Text(
        level,
        style: AppTextStyles.caption.copyWith(
          color: fg,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class GrammarLearnerStatusBadge extends StatelessWidget {
  const GrammarLearnerStatusBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (String label, Color bg, Color fg) = switch (status) {
      'COMPLETED' => ('Đã hoàn thành', AppColors.success0, AppColors.success200),
      'IN_PROGRESS' => ('Đang học', AppColors.warning0, AppColors.warning300),
      'LOCKED' => ('Cần học bài trước', AppColors.grey50, AppColors.grey700),
      _ => ('Sẵn sàng', AppColors.primary25, AppColors.primary700),
    };

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: AppRadius.tagRadius,
      ),
      child: Text(
        label,
        style: AppTextStyles.caption.copyWith(
          color: fg,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class GrammarTopicDetailPage extends StatefulWidget {
  const GrammarTopicDetailPage({
    super.key,
    required this.controller,
    required this.topicCode,
    required this.initialTitleVi,
    required this.initialCefrLevel,
    this.learningController,
  });

  final GrammarController controller;
  final String topicCode;
  final String initialTitleVi;
  final String initialCefrLevel;
  final LearningController? learningController;

  @override
  State<GrammarTopicDetailPage> createState() => _GrammarTopicDetailPageState();
}

class _GrammarTopicDetailPageState extends State<GrammarTopicDetailPage> {
  GrammarTopicDetail? _detail;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch({bool force = false}) async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final GrammarTopicDetail res = await widget.controller.loadTopicDetail(
        widget.topicCode,
        force: force,
      );
      if (!mounted) return;
      setState(() {
        _detail = res;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = widget.controller.formatError(e);
        _loading = false;
      });
    }
  }

  Future<void> _openRelatedTopic(GrammarRelatedTopic related) async {
    if (related.learnerStatus == 'LOCKED') {
      final GrammarTreeNode? node =
          widget.controller.findTopicByCode(related.code);
      if (node != null) {
        final List<GrammarTreeNode> prereqs =
            widget.controller.uncompletedPrerequisites(node);
        if (prereqs.isNotEmpty) {
          final GrammarTreeNode? target = await showGrammarLockedDialog(
            context: context,
            prerequisites: prereqs,
          );
          if (!mounted || target == null) return;
          previewPush<void>(
            context,
            GrammarTopicDetailPage(
              controller: widget.controller,
              topicCode: target.code,
              initialTitleVi: target.titleVi,
              initialCefrLevel: target.cefrLevel,
              learningController: widget.learningController,
            ),
          );
          return;
        }
      }
    }
    previewPush<void>(
      context,
      GrammarTopicDetailPage(
        controller: widget.controller,
        topicCode: related.code,
        initialTitleVi: related.titleVi,
        initialCefrLevel: related.cefrLevel,
        learningController: widget.learningController,
      ),
    );
  }

  String _formulaBadgeLabel(GrammarFormula item) {
    if (item.labelVi.trim().isNotEmpty) return item.labelVi;
    return switch (item.form) {
      'AFFIRMATIVE' => 'Khẳng định (+)',
      'NEGATIVE' => 'Phủ định (-)',
      'QUESTION' => 'Nghi vấn (?)',
      _ => 'Lưu ý quy tắc',
    };
  }

  @override
  Widget build(BuildContext context) {
    final GrammarTopicDetail? detail = _detail;
    final double horizontalPad = AppSpacing.horizontal(context);

    return Scaffold(
      backgroundColor: AppColors.backgroundLight,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceLight,
        surfaceTintColor: AppColors.surfaceLight,
        elevation: 0,
        title: const Text('Chi tiết ngữ pháp', style: AppTextStyles.heading2),
        actions: <Widget>[
          Padding(
            padding: const EdgeInsets.only(right: AppSpacing.md),
            child: GrammarCefrBadge(
              level: detail?.cefrLevel ?? widget.initialCefrLevel,
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.primary500),
              )
            : _error != null
            ? Padding(
                padding: EdgeInsets.all(horizontalPad),
                child: LearningError(
                  _error!,
                  retry: () => _fetch(force: true),
                ),
              )
            : detail == null
            ? const SizedBox.shrink()
            : ListView(
                padding: EdgeInsets.symmetric(
                  horizontal: horizontalPad,
                  vertical: AppSpacing.md,
                ),
                children: <Widget>[
                  _buildHeaderCard(detail),
                  if (detail.formulas.isNotEmpty) ...<Widget>[
                    AppSpacing.gapMd,
                    _buildFormulasSection(detail.formulas),
                  ],
                  if (detail.usageNotes.isNotEmpty) ...<Widget>[
                    AppSpacing.gapMd,
                    _buildUsageSection(detail.usageNotes),
                  ],
                  if (detail.examples.isNotEmpty) ...<Widget>[
                    AppSpacing.gapMd,
                    _buildExamplesSection(detail.examples),
                  ],
                  if (detail.prerequisites.isNotEmpty) ...<Widget>[
                    AppSpacing.gapMd,
                    _buildRelatedSection(
                      title: 'Kiến thức cần nắm trước',
                      topics: detail.prerequisites,
                      icon: Icons.lock_open_rounded,
                    ),
                  ],
                  if (detail.dependents.isNotEmpty) ...<Widget>[
                    AppSpacing.gapMd,
                    _buildRelatedSection(
                      title: 'Cấu trúc mở rộng tiếp theo',
                      topics: detail.dependents,
                      icon: Icons.trending_up_rounded,
                    ),
                  ],
                  if (detail.lessons.isNotEmpty &&
                      widget.learningController != null) ...<Widget>[
                    AppSpacing.gapMd,
                    _buildLessonsSection(detail.lessons),
                  ],
                  AppSpacing.gapLg,
                ],
              ),
      ),
    );
  }

  Widget _buildHeaderCard(GrammarTopicDetail detail) {
    return Container(
      padding: AppSpacing.cardPadding,
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: AppRadius.cardRadius,
        border: AppBorders.hairline(),
        boxShadow: AppShadows.level1,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xs,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: <Widget>[
              GrammarCefrBadge(level: detail.cefrLevel),
              if (detail.parent != null)
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
                    detail.parent!.titleVi,
                    style: AppTextStyles.caption.copyWith(
                      color: AppColors.grey800,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              if (detail.learnerStatus != null && detail.lessons.isNotEmpty)
                GrammarLearnerStatusBadge(status: detail.learnerStatus!),
            ],
          ),
          AppSpacing.gapSm,
          Text(detail.titleVi, style: AppTextStyles.heading1),
          AppSpacing.gapXs,
          Text(
            detail.titleEn,
            style: AppTextStyles.bodyStrong.copyWith(
              color: AppColors.primary700,
            ),
          ),
          if (detail.summaryVi.isNotEmpty) ...<Widget>[
            AppSpacing.gapSm,
            Text(
              detail.summaryVi,
              style: AppTextStyles.body.copyWith(color: AppColors.grey800),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildFormulasSection(List<GrammarFormula> formulas) {
    return _SectionCard(
      title: 'Công thức cấu trúc',
      icon: Icons.functions_rounded,
      children: <Widget>[
        for (int i = 0; i < formulas.length; i++) ...<Widget>[
          if (i > 0) AppSpacing.gapSm,
          Container(
            width: double.infinity,
            padding: AppSpacing.allSm,
            decoration: BoxDecoration(
              color: AppColors.grey25,
              borderRadius: AppRadius.cardSm,
              border: AppBorders.hairline(),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  _formulaBadgeLabel(formulas[i]),
                  style: AppTextStyles.caption.copyWith(
                    color: AppColors.primary800,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                AppSpacing.gapXs,
                Text(formulas[i].structure, style: AppTextStyles.bodyStrong),
                if (formulas[i].noteVi != null) ...<Widget>[
                  AppSpacing.gapXs,
                  Text(
                    formulas[i].noteVi!,
                    style: AppTextStyles.caption.copyWith(
                      color: AppColors.grey700,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildUsageSection(List<GrammarUsageNote> notes) {
    return _SectionCard(
      title: 'Cách dùng & Lưu ý',
      icon: Icons.lightbulb_outline_rounded,
      children: <Widget>[
        for (int i = 0; i < notes.length; i++) ...<Widget>[
          if (i > 0) AppSpacing.gapMd,
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              const Padding(
                padding: EdgeInsets.only(top: AppSpacing.xs),
                child: Icon(
                  Icons.check_circle_outline_rounded,
                  color: AppColors.primary600,
                ),
              ),
              AppSpacing.gapSm,
              Expanded(
                child: Text(notes[i].useCaseVi, style: AppTextStyles.body),
              ),
            ],
          ),
          if (notes[i].signalWords.isNotEmpty) ...<Widget>[
            AppSpacing.gapSm,
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: <Widget>[
                Text(
                  'Dấu hiệu nhận biết:',
                  style: AppTextStyles.caption.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.grey800,
                  ),
                ),
                for (final String word in notes[i].signalWords)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.primary25,
                      borderRadius: AppRadius.tagRadius,
                    ),
                    child: Text(
                      word,
                      style: AppTextStyles.caption.copyWith(
                        color: AppColors.primary800,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ],
          if (notes[i].commonMistakeVi != null) ...<Widget>[
            AppSpacing.gapSm,
            Container(
              width: double.infinity,
              padding: AppSpacing.allSm,
              decoration: BoxDecoration(
                color: AppColors.warning0,
                borderRadius: AppRadius.cardSm,
                border: Border.all(
                  color: AppColors.warning200.withValues(alpha: 0.4),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'Lỗi thường gặp:',
                    style: AppTextStyles.caption.copyWith(
                      color: AppColors.warning300,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  AppSpacing.gapXs,
                  Text(
                    notes[i].commonMistakeVi!,
                    style: AppTextStyles.body.copyWith(
                      color: AppColors.grey900,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ],
    );
  }

  Widget _buildExamplesSection(List<GrammarExample> examples) {
    return _SectionCard(
      title: 'Ví dụ minh họa',
      icon: Icons.format_quote_rounded,
      children: <Widget>[
        for (int i = 0; i < examples.length; i++) ...<Widget>[
          if (i > 0) AppSpacing.gapSm,
          Container(
            width: double.infinity,
            padding: AppSpacing.allSm,
            decoration: BoxDecoration(
              color: AppColors.primary25.withValues(alpha: 0.6),
              borderRadius: AppRadius.cardSm,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(examples[i].sentenceEn, style: AppTextStyles.bodyStrong),
                AppSpacing.gapXs,
                Text(
                  examples[i].translationVi,
                  style: AppTextStyles.body.copyWith(color: AppColors.grey800),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildRelatedSection({
    required String title,
    required List<GrammarRelatedTopic> topics,
    required IconData icon,
  }) {
    return _SectionCard(
      title: title,
      icon: icon,
      children: <Widget>[
        for (int i = 0; i < topics.length; i++) ...<Widget>[
          if (i > 0) AppSpacing.gapSm,
          SizedBox(
            width: double.infinity,
            child: Material(
              color: AppColors.grey25,
              borderRadius: AppRadius.cardSm,
              child: InkWell(
                borderRadius: AppRadius.cardSm,
                onTap: () => _openRelatedTopic(topics[i]),
                child: Padding(
                  padding: AppSpacing.allMd,
                  child: Row(
                    children: <Widget>[
                      GrammarCefrBadge(level: topics[i].cefrLevel),
                      AppSpacing.gapSm,
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              topics[i].titleVi,
                              style: AppTextStyles.bodyStrong,
                            ),
                            AppSpacing.gapXs,
                            Text(
                              topics[i].titleEn,
                              style: AppTextStyles.caption,
                            ),
                          ],
                        ),
                      ),
                      AppSpacing.gapSm,
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: AppColors.grey500,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildLessonsSection(List<GrammarLinkedLesson> lessons) {
    final LearningController learningCtrl = widget.learningController!;
    return _SectionCard(
      title: 'Bài kiểm tra xác nhận hoàn thành',
      icon: Icons.menu_book_rounded,
      children: <Widget>[
        for (int i = 0; i < lessons.length; i++) ...<Widget>[
          if (i > 0) AppSpacing.gapSm,
          Container(
            width: double.infinity,
            padding: AppSpacing.allSm,
            decoration: BoxDecoration(
              color: AppColors.grey25,
              borderRadius: AppRadius.cardSm,
              border: AppBorders.hairline(),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.xs,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: <Widget>[
                    Text(lessons[i].title, style: AppTextStyles.bodyStrong),
                    if (lessons[i].state != null)
                      GrammarLearnerStatusBadge(
                        status: lessons[i].state == 'COMPLETED'
                            ? 'COMPLETED'
                            : lessons[i].state == 'IN_PROGRESS'
                            ? 'IN_PROGRESS'
                            : 'AVAILABLE',
                      ),
                  ],
                ),
                if (lessons[i].description.isNotEmpty) ...<Widget>[
                  AppSpacing.gapXs,
                  Text(lessons[i].description, style: AppTextStyles.caption),
                ],
                AppSpacing.gapSm,
                CustomAppButton(
                  text: lessons[i].state == 'COMPLETED'
                      ? 'Làm lại bài tập (${lessons[i].estimatedMinutes} phút)'
                      : 'Làm bài kiểm tra (${lessons[i].estimatedMinutes} phút)',
                  onPressed: () async {
                    await openLearningLesson(
                      context,
                      learningCtrl,
                      lessonId: lessons[i].id,
                      skipStudy: true,
                    );
                    if (!mounted) return;
                    await widget.controller.load(force: true);
                    if (!mounted) return;
                    await _fetch(force: true);
                  },
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.icon,
    required this.children,
  });

  final String title;
  final IconData icon;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: AppSpacing.cardPadding,
      decoration: BoxDecoration(
        color: AppColors.surfaceLight,
        borderRadius: AppRadius.cardRadius,
        border: AppBorders.hairline(),
        boxShadow: AppShadows.level1,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(icon, color: AppColors.primary700),
              AppSpacing.gapSm,
              Expanded(child: Text(title, style: AppTextStyles.heading2)),
            ],
          ),
          AppSpacing.gapMd,
          ...children,
        ],
      ),
    );
  }
}
