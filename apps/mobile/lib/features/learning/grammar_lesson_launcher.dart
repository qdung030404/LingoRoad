import 'package:flutter/material.dart';
import '../grammar/grammar_controller.dart';
import '../grammar/grammar_repository.dart';
import '../grammar/grammar_topic_detail_page.dart';
import 'learning_controller.dart';
import 'learning_pages.dart' show openLearningLesson;
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
  if (!grammar.loaded) {
    await grammar.load();
    if (!context.mounted || !controller.active) return;
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

  final int? beforeCompleted =
      (controller.summary['completedLessonCount'] as num?)?.toInt();
  final String? beforeStatus = node?.learnerStatus;
  final bool wasCatalogueLoaded = controller.catalogueLoaded;

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
    final int? afterCompleted =
        (controller.summary['completedLessonCount'] as num?)?.toInt();
    final String? afterStatus = grammar.findTopicByCode(targetCode)?.learnerStatus;
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
}
