import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../core/theme/app_shadows.dart';
import '../../core/theme/app_spacing.dart';
import '../../shared/figma_widgets.dart';
import '../learning/learning_pages.dart' show LearningError;
import '../learning/learning_widgets.dart';
import 'curated_topic_detail_page.dart';
import 'vocabulary_controller.dart';

IconData getTopicIcon(String slug) {
  final s = slug.toLowerCase();
  if (s.contains('greet') || s.contains('intro')) {
    return Icons.waving_hand_outlined;
  }
  if (s.contains('food') ||
      s.contains('din') ||
      s.contains('eat') ||
      s.contains('restaur')) {
    return Icons.restaurant_outlined;
  }
  if (s.contains('travel') || s.contains('direct') || s.contains('trip')) {
    return Icons.flight_takeoff_outlined;
  }
  if (s.contains('work') || s.contains('career') || s.contains('job')) {
    return Icons.work_outline_rounded;
  }
  if (s.contains('routine') || s.contains('day') || s.contains('time')) {
    return Icons.schedule_rounded;
  }
  if (s.contains('shop') || s.contains('store')) {
    return Icons.shopping_bag_outlined;
  }
  if (s.contains('family') || s.contains('friend') || s.contains('relat')) {
    return Icons.people_outline_rounded;
  }
  if (s.contains('health') || s.contains('fit') || s.contains('sport')) {
    return Icons.favorite_outline_rounded;
  }
  return Icons.auto_stories_outlined;
}

class CuratedTopicsCatalogue extends StatefulWidget {
  const CuratedTopicsCatalogue({
    super.key,
    required this.controller,
    this.onOpenDeck,
  });

  final VocabularyController? controller;
  final ValueChanged<String>? onOpenDeck;

  @override
  State<CuratedTopicsCatalogue> createState() => _CuratedTopicsCatalogueState();
}

class _CuratedTopicsCatalogueState extends State<CuratedTopicsCatalogue> {
  final Map<String, bool> _cloningMap = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load({bool force = false}) {
    final ctrl = widget.controller;
    if (ctrl != null && (ctrl.curatedTopics.isEmpty || force)) {
      ctrl.fetchCuratedTopics(force: force);
    }
  }

  Future<void> _cloneTopic(Map<String, dynamic> topic) async {
    final ctrl = widget.controller;
    if (ctrl == null) return;
    final slug = topic['slug']?.toString() ?? '';
    if (slug.isEmpty || _cloningMap[slug] == true) return;

    setState(() => _cloningMap[slug] = true);
    try {
      final res = await ctrl.cloneCuratedTopic(slug);
      if (!mounted) return;
      final deckId = res['deckId']?.toString();
      final count = res['importedWordsCount'] ?? topic['totalWords'];
      final name = res['deckName'] ?? topic['titleVi'];

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Đã thêm $count từ vào bộ từ "$name"!'),
          backgroundColor: AppColors.primary700,
          action: deckId != null && widget.onOpenDeck != null
              ? SnackBarAction(
                  label: 'Mở ngay',
                  textColor: Colors.white,
                  onPressed: () => widget.onOpenDeck!(deckId),
                )
              : null,
        ),
      );
    } catch (e) {
      if (mounted) {
        previewMessage(context, ctrl.message(e));
      }
    } finally {
      if (mounted) setState(() => _cloningMap[slug] = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final ctrl = widget.controller;
    if (ctrl == null) {
      return Padding(
        padding: AppSpacing.allMd,
        child: learningBody('Đăng nhập để xem và lưu các chủ đề từ vựng.'),
      );
    }

    return AnimatedBuilder(
      animation: ctrl,
      builder: (context, _) {
        final loading = ctrl.loadingCuratedTopics;
        final error = ctrl.curatedTopicsError;
        final topics = ctrl.curatedTopics;

        if (loading && topics.isEmpty) {
          return const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 36),
              child: CircularProgressIndicator(color: AppColors.primary500),
            ),
          );
        }

        if (error != null && topics.isEmpty) {
          return LearningError(
            error,
            retry: () => _load(force: true),
          );
        }

        if (topics.isEmpty) {
          return Center(
            child: Padding(
              padding: AppSpacing.allLg,
              child: Column(
                children: [
                  learningBody('Chưa có chủ đề từ vựng nào.'),
                  TextButton(
                    onPressed: () => _load(force: true),
                    child: const Text('Tải lại'),
                  ),
                ],
              ),
            ),
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      learningHeading('Chủ đề từ vựng mẫu', size: 22),
                      const SizedBox(height: 4),
                      Text(
                        'Khám phá và lưu bộ từ vào danh sách học của bạn',
                        style: designText(14, color: AppColors.grey600),
                      ),
                    ],
                  ),
                ),
                LearningPill('${topics.length} chủ đề', small: true),
              ],
            ),
            const SizedBox(height: 16),
            for (final topic in topics) ...[
              _CuratedTopicCard(
                topic: topic,
                isCloned: ctrl.isTopicCloned(topic['titleVi']?.toString() ?? ''),
                isCloning: _cloningMap[topic['slug']?.toString() ?? ''] == true,
                onClone: () => _cloneTopic(topic),
                onOpenCloned: () {
                  final deckId = ctrl.getClonedDeckId(
                    topic['titleVi']?.toString() ?? '',
                  );
                  if (deckId != null && widget.onOpenDeck != null) {
                    widget.onOpenDeck!(deckId);
                  }
                },
                onTap: () => previewPush(
                  context,
                  CuratedTopicDetailPage(
                    controller: ctrl,
                    topic: topic,
                    onOpenDeck: widget.onOpenDeck,
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],
          ],
        );
      },
    );
  }
}

class _CuratedTopicCard extends StatelessWidget {
  const _CuratedTopicCard({
    required this.topic,
    required this.isCloned,
    required this.isCloning,
    required this.onClone,
    required this.onOpenCloned,
    required this.onTap,
  });

  final Map<String, dynamic> topic;
  final bool isCloned;
  final bool isCloning;
  final VoidCallback onClone;
  final VoidCallback onOpenCloned;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final titleVi = topic['titleVi']?.toString() ?? '';
    final titleEn = topic['titleEn']?.toString() ?? '';
    final description = topic['description']?.toString() ?? '';
    final totalWords = topic['totalWords']?.toString() ?? '0';
    final slug = topic['slug']?.toString() ?? '';
    final iconData = getTopicIcon(slug);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: AppRadius.cardRadius,
        border: Border.all(color: AppColors.grey200),
        boxShadow: AppShadows.level1,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: AppRadius.cardRadius,
        child: InkWell(
          borderRadius: AppRadius.cardRadius,
          onTap: onTap,
          child: Padding(
            padding: AppSpacing.allMd,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: const BoxDecoration(
                    color: AppColors.primary25,
                    borderRadius: AppRadius.cardSm,
                  ),
                  child: Icon(
                    iconData,
                    color: AppColors.primary700,
                    size: 26,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        titleVi,
                        style: designHeading(16),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        titleEn,
                        style: designText(13, color: AppColors.grey600),
                      ),
                      if (description.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: designText(12, color: AppColors.grey500),
                        ),
                      ],
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          LearningPill('$totalWords từ', small: true),
                          if (isCloned)
                            const LearningPill(
                              'Đã lưu',
                              small: true,
                              fill: AppColors.primary50,
                              color: AppColors.primary800,
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (isCloning)
                  const SizedBox(
                    width: 32,
                    height: 32,
                    child: Padding(
                      padding: EdgeInsets.all(6),
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.primary500,
                      ),
                    ),
                  )
                else if (isCloned)
                  TextButton.icon(
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      minimumSize: const Size(0, 36),
                    ),
                    onPressed: onOpenCloned,
                    icon: const Icon(Icons.arrow_forward_ios_rounded, size: 14),
                    label: const Text('Mở'),
                  )
                else
                  IconButton(
                    tooltip: 'Lưu bộ từ vào Từ của tôi',
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.primary25,
                      foregroundColor: AppColors.primary700,
                    ),
                    icon: const Icon(Icons.bookmark_add_outlined, size: 20),
                    onPressed: onClone,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
