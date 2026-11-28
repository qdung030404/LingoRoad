import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_typography.dart';
import '../grammar/grammar_controller.dart';
import '../grammar/grammar_repository.dart';
import '../grammar/grammar_topic_detail_page.dart';
import 'learning_controller.dart';
import 'learning_lesson_intro_page.dart';
import 'learning_pages.dart' show LearningError, openLearningLesson;
import 'learning_widgets.dart' show previewPush;

String? _resolveGrammarTopicCode(
  LearningController controller, {
  String? lessonId,
  String? lessonCode,
  String? grammarTopicCode,
}) {
  if (grammarTopicCode != null && grammarTopicCode.isNotEmpty) {
    return grammarTopicCode;
  }
  if (lessonId != null) {
    for (final lesson in controller.lessons) {
      if (lesson.id == lessonId) {
        if (lesson.grammarTopicCode != null &&
            lesson.grammarTopicCode!.isNotEmpty) {
          return lesson.grammarTopicCode;
        }
        lessonCode ??= lesson.code;
        break;
      }
    }
  }
  if (lessonCode == 'grammar-pronouns-to-be') return 'grammar.pronouns';
  final GrammarController? grammar = controller.grammar;
  if (grammar != null &&
      lessonCode != null &&
      lessonCode.startsWith('qz-grammar-')) {
    for (final level in kCefrLevels) {
      for (final node in grammar.topicsForLevel(level)) {
        if ('qz-${node.code.replaceAll('.', '-')}' == lessonCode) {
          return node.code;
        }
      }
    }
  }
  return null;
}

/// Opens [GrammarTopicDetailPage] (with prerequisite lock check) for uncompleted grammar cards.
Future<void> openUncompletedGrammarCard(
  BuildContext context,
  LearningController controller, {
  required String lessonId,
  String? lessonCode,
  String? grammarTopicCode,
  String? title,
}) async {
  final GrammarController? grammar = controller.grammar;
  if (grammar == null) {
    await openLearningLesson(context, controller, lessonId: lessonId);
    return;
  }

  final int? beforeCompleted =
      (controller.summary['completedLessonCount'] as num?)?.toInt();
  final bool wasCatalogueLoaded = controller.catalogueLoaded;

  if (!grammar.loaded) {
    final ({String targetCode, String? beforeStatus})? launchResult =
        await previewPush<({String targetCode, String? beforeStatus})?>(
          context,
          _GrammarTopicLaunchPage(
            controller: controller,
            grammar: grammar,
            lessonId: lessonId,
            lessonCode: lessonCode,
            grammarTopicCode: grammarTopicCode,
            title: title,
          ),
        );
    if (controller.active) {
      await _refreshAfterGrammarVisit(
        controller: controller,
        grammar: grammar,
        targetCode: launchResult?.targetCode,
        beforeStatus: launchResult?.beforeStatus,
        beforeCompleted: beforeCompleted,
        wasCatalogueLoaded: wasCatalogueLoaded,
      );
    }
    return;
  }

  final String? resolvedCode = _resolveGrammarTopicCode(
    controller,
    lessonId: lessonId,
    lessonCode: lessonCode,
    grammarTopicCode: grammarTopicCode,
  );
  if (resolvedCode == null) {
    await openLearningLesson(context, controller, lessonId: lessonId);
    return;
  }

  final GrammarTreeNode? node = grammar.findTopicByCode(resolvedCode);
  final String? placementCefr =
      controller.daily?.progress?['placementCefr'] as String?;
  String targetCode = resolvedCode;
  String targetTitle = node?.titleVi ?? title ?? resolvedCode;
  String targetCefr = node?.cefrLevel ?? 'A1';

  if (node != null && node.learnerStatus == 'LOCKED') {
    final List<GrammarTreeNode> prereqs = grammar.uncompletedPrerequisites(
      node,
      minimumBlockingCefr: placementCefr,
    );
    if (prereqs.isNotEmpty) {
      final GrammarTreeNode? chosen = await showGrammarLockedDialog(
        context: context,
        prerequisites: prereqs,
      );
      if (!context.mounted || chosen == null) return;
      targetCode = chosen.code;
      targetTitle = chosen.titleVi;
      targetCefr = chosen.cefrLevel;
    }
  }

  final String? beforeStatus =
      grammar.findTopicByCode(targetCode)?.learnerStatus ?? node?.learnerStatus;

  await previewPush<void>(
    context,
    GrammarTopicDetailPage(
      controller: grammar,
      topicCode: targetCode,
      initialTitleVi: targetTitle,
      initialCefrLevel: targetCefr,
      learningController: controller,
      placementCefr: placementCefr,
    ),
  );
  if (controller.active) {
    await _refreshAfterGrammarVisit(
      controller: controller,
      grammar: grammar,
      targetCode: targetCode,
      beforeStatus: beforeStatus,
      beforeCompleted: beforeCompleted,
      wasCatalogueLoaded: wasCatalogueLoaded,
    );
  }
}

Future<void> _refreshAfterGrammarVisit({
  required LearningController controller,
  required GrammarController grammar,
  required String? targetCode,
  required String? beforeStatus,
  required int? beforeCompleted,
  required bool wasCatalogueLoaded,
}) async {
  final int? afterCompleted =
      (controller.summary['completedLessonCount'] as num?)?.toInt();
  final String? afterStatus = targetCode == null
      ? null
      : grammar.findTopicByCode(targetCode)?.learnerStatus;
  final bool catalogueInvalidated =
      wasCatalogueLoaded && !controller.catalogueLoaded;
  if (catalogueInvalidated ||
      afterCompleted != beforeCompleted ||
      afterStatus != beforeStatus) {
    controller.daily?.invalidateDetails();
    await Future.wait<void>([
      controller.refresh(),
      grammar.load(force: true),
    ]);
  }
}

class _GrammarTopicLaunchPage extends StatefulWidget {
  const _GrammarTopicLaunchPage({
    required this.controller,
    required this.grammar,
    required this.lessonId,
    this.lessonCode,
    this.grammarTopicCode,
    this.title,
  });

  final LearningController controller;
  final GrammarController grammar;
  final String lessonId;
  final String? lessonCode;
  final String? grammarTopicCode;
  final String? title;

  @override
  State<_GrammarTopicLaunchPage> createState() =>
      _GrammarTopicLaunchPageState();
}

class _GrammarTopicLaunchPageState extends State<_GrammarTopicLaunchPage> {
  String? _error;
  bool _loading = true;
  bool _fallbackToLessonIntro = false;
  String? _targetCode;
  String? _targetTitle;
  String? _targetCefr;
  String? _placementCefr;
  String? _beforeStatus;

  @override
  void initState() {
    super.initState();
    _prepare();
  }

  Future<void> _prepare({bool force = false}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await widget.grammar.load(force: force);
      if (!mounted) return;
      if (!widget.controller.active) {
        Navigator.of(context).pop();
        return;
      }
      if (widget.grammar.error != null && widget.grammar.totalLeafCount == 0) {
        setState(() {
          _error = widget.grammar.error;
          _loading = false;
        });
        return;
      }

      final String? resolvedCode = _resolveGrammarTopicCode(
        widget.controller,
        lessonId: widget.lessonId,
        lessonCode: widget.lessonCode,
        grammarTopicCode: widget.grammarTopicCode,
      );
      if (resolvedCode == null) {
        setState(() {
          _fallbackToLessonIntro = true;
          _loading = false;
        });
        return;
      }

      final GrammarTreeNode? node = widget.grammar.findTopicByCode(resolvedCode);
      final String? placementCefr =
          widget.controller.daily?.progress?['placementCefr'] as String?;
      String targetCode = resolvedCode;
      String targetTitle = node?.titleVi ?? widget.title ?? resolvedCode;
      String targetCefr = node?.cefrLevel ?? 'A1';

      if (node != null && node.learnerStatus == 'LOCKED') {
        final List<GrammarTreeNode> prereqs = widget.grammar
            .uncompletedPrerequisites(
              node,
              minimumBlockingCefr: placementCefr,
            );
        if (prereqs.isNotEmpty) {
          final GrammarTreeNode? chosen = await showGrammarLockedDialog(
            context: context,
            prerequisites: prereqs,
          );
          if (!mounted) return;
          if (chosen == null) {
            Navigator.of(context).pop();
            return;
          }
          targetCode = chosen.code;
          targetTitle = chosen.titleVi;
          targetCefr = chosen.cefrLevel;
        }
      }

      final String? beforeStatus =
          widget.grammar.findTopicByCode(targetCode)?.learnerStatus ??
          node?.learnerStatus;

      setState(() {
        _targetCode = targetCode;
        _targetTitle = targetTitle;
        _targetCefr = targetCefr;
        _placementCefr = placementCefr;
        _beforeStatus = beforeStatus;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = widget.grammar.formatError(e);
        _loading = false;
      });
    }
  }

  ({String targetCode, String? beforeStatus})? _resultPayload() {
    final code = _targetCode;
    if (code == null) return null;
    return (targetCode: code, beforeStatus: _beforeStatus);
  }

  @override
  Widget build(BuildContext context) {
    if (_fallbackToLessonIntro) {
      return LearningLessonIntroPage(
        owner: widget.controller,
        lessonId: widget.lessonId,
      );
    }

    if (!_loading && _error == null && _targetCode != null) {
      return PopScope<({String targetCode, String? beforeStatus})?>(
        canPop: false,
        onPopInvokedWithResult: (bool didPop, _) {
          if (!didPop) {
            Navigator.of(context).pop(_resultPayload());
          }
        },
        child: GrammarTopicDetailPage(
          controller: widget.grammar,
          topicCode: _targetCode!,
          initialTitleVi: _targetTitle ?? _targetCode!,
          initialCefrLevel: _targetCefr ?? 'A1',
          learningController: widget.controller,
          placementCefr: _placementCefr,
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.backgroundLight,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceLight,
        surfaceTintColor: AppColors.surfaceLight,
        elevation: 0,
        title: const Text('Chi tiết ngữ pháp', style: AppTextStyles.heading2),
      ),
      body: SafeArea(
        child: _loading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.primary500),
              )
            : Padding(
                padding: const EdgeInsets.all(16),
                child: LearningError(
                  _error ?? 'Không tải được dữ liệu ngữ pháp.',
                  retry: () => _prepare(force: true),
                ),
              ),
      ),
    );
  }
}
