import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/learning_media_image.dart';
import '../learning/learning_widgets.dart';
import 'conversation_preparation.dart';
import 'speaking_controller.dart';
import 'speaking_modes_page.dart';
import 'speaking_pages.dart';
import 'speaking_repository.dart';
import 'voice_conversation_page.dart';
import 'voice_conversations_page.dart';

const _topicPresentation = {
  'introduce yourself': (
    Icons.person_outline_rounded,
    'Tên, nơi ở và sở thích',
  ),
  'my day': (Icons.schedule_rounded, 'Thói quen và hoạt động hằng ngày'),
  'my family': (
    Icons.people_outline_rounded,
    'Người thân và sinh hoạt gia đình',
  ),
  'my hobbies': (Icons.interests_outlined, 'Những việc bạn thích làm'),
  'my favourite food': (Icons.restaurant_outlined, 'Món ăn bạn yêu thích'),
  'where i live': (Icons.home_outlined, 'Nơi ở và khu vực xung quanh'),
  'travel and holidays': (
    Icons.flight_takeoff_rounded,
    'Chuyến đi đáng nhớ và kỳ nghỉ mơ ước',
  ),
  'shopping and clothes': (
    Icons.shopping_bag_outlined,
    'Trang phục thường ngày và thói quen mua sắm',
  ),
  'health and sports': (
    Icons.fitness_center_rounded,
    'Thể thao, vận động và giữ gìn sức khỏe',
  ),
  'study and future plans': (
    Icons.school_outlined,
    'Việc học hiện tại và mục tiêu nghề nghiệp',
  ),
  'weather and seasons': (
    Icons.wb_sunny_outlined,
    'Thời tiết, các mùa và hoạt động ngoài trời',
  ),
  'technology in daily life': (
    Icons.devices_rounded,
    'Thiết bị số và ứng dụng hữu ích mỗi ngày',
  ),
};

Future<void> openSpeakingTopicFromPlan(
  BuildContext context, {
  required SpeakingController controller,
  required String topicId,
  required Widget Function() practicePage,
}) => previewPush<void>(
  context,
  ConversationPreparation(
    controller: controller,
    topicId: topicId,
    activities: (topic) => _TopicActivities(
      controller: controller,
      topic: topic,
      practicePage: practicePage,
    ),
  ),
);

class SpeakingTopicCatalogue extends StatefulWidget {
  const SpeakingTopicCatalogue({
    super.key,
    required this.controller,
    required this.practicePage,
  });

  final SpeakingController controller;
  final Widget Function() practicePage;

  @override
  State<SpeakingTopicCatalogue> createState() => _SpeakingTopicCatalogueState();
}

class _SpeakingTopicCatalogueState extends State<SpeakingTopicCatalogue> {
  static const int _initialVisibleTopics = 4;

  SpeakingController get controller => widget.controller;
  late Future<Json> topics;
  bool _showAllTopics = false;

  Future<Json> loadTopics() async {
    try {
      return await controller.repository.conversationTopics();
    } catch (_) {
      return {'loadError': true};
    }
  }

  @override
  void initState() {
    super.initState();
    topics = loadTopics();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && controller.active) unawaited(controller.initialize());
    });
  }

  void openTopic(Json item) {
    previewPush(
      context,
      ConversationPreparation(
        controller: controller,
        topicId: item['id'] as String,
        activities: (topic) => _TopicActivities(
          controller: controller,
          topic: topic,
          practicePage: widget.practicePage,
        ),
      ),
    );
  }

  void openExtra(String mode) {
    previewPush(
      context,
      SpeakingModesPage(
        controller: controller,
        practicePage: widget.practicePage,
        initialMode: mode,
      ),
    );
  }

  Widget topicGridCard(Json topic, {required bool compact}) {
    final title = topic['title']?.toString() ?? topic['text'].toString();
    final (icon, description) =
        _topicPresentation[title.toLowerCase()] ??
        (Icons.chat_bubble_outline_rounded, null);
    final imageUrl = topicIllustrationAsset(
      title,
      imageUrl: topic['imageUrl'] as String?,
    );
    return _SpeakingTopicGridCard(
      key: ValueKey('speaking-topic-${topic['id'] ?? title}'),
      title: title,
      detail: description,
      icon: icon,
      imageUrl: imageUrl,
      compact: compact,
      onTap: () => openTopic(topic),
    );
  }

  Widget buildTopicGrid(List<Json> items) => LayoutBuilder(
    builder: (context, constraints) {
      final compact = constraints.maxWidth < 330;
      if (constraints.maxWidth < 250) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            for (var i = 0; i < items.length; i++) ...[
              if (i > 0) const SizedBox(height: 10),
              topicGridCard(items[i], compact: true),
            ],
          ],
        );
      }
      final rows = <Widget>[];
      for (var i = 0; i < items.length; i += 2) {
        final left = items[i];
        final right = i + 1 < items.length ? items[i + 1] : null;
        if (rows.isNotEmpty) rows.add(const SizedBox(height: 12));
        rows.add(
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: topicGridCard(left, compact: compact)),
                const SizedBox(width: 12),
                Expanded(
                  child: right != null
                      ? topicGridCard(right, compact: compact)
                      : const SizedBox.shrink(),
                ),
              ],
            ),
          ),
        );
      }
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: rows,
      );
    },
  );

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) {
      final active = controller.active;
      final ready = active && !controller.busy && !controller.processing;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (active && controller.processing) ...[
            OutlinedButton(
              onPressed: () => previewPush(context, widget.practicePage()),
              child: const Text('Tiếp tục bài đang chấm'),
            ),
            const SizedBox(height: 10),
          ],
          FutureBuilder<Json>(
            future: topics,
            builder: (context, snapshot) {
              if (!active) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    learningHeading('Chủ đề luyện nói', size: 20),
                    const SizedBox(height: 8),
                    const Text('Phiên đăng nhập đã thay đổi.'),
                  ],
                );
              }
              if (snapshot.connectionState != ConnectionState.done) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    learningHeading('Chủ đề luyện nói', size: 20),
                    const SizedBox(height: 16),
                    const Center(child: CircularProgressIndicator()),
                  ],
                );
              }
              final data = snapshot.data;
              if (data == null || data['loadError'] == true) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    learningHeading('Chủ đề luyện nói', size: 20),
                    const SizedBox(height: 8),
                    const Text('Chưa tải được chủ đề luyện nói.'),
                    TextButton(
                      onPressed: () => setState(() => topics = loadTopics()),
                      child: const Text('Thử lại'),
                    ),
                  ],
                );
              }
              final items = speakingItems(data['items']);
              if (items.isEmpty) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    learningHeading('Chủ đề luyện nói', size: 20),
                    const SizedBox(height: 8),
                    const Text('Chưa có chủ đề luyện nói.'),
                  ],
                );
              }
              final hasMore = items.length > _initialVisibleTopics;
              final visibleItems = (!_showAllTopics && hasMore)
                  ? items.take(_initialVisibleTopics).toList()
                  : items;
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  learningHeading('Chủ đề luyện nói', size: 20),
                  const SizedBox(height: 12),
                  AnimatedSize(
                    duration: MediaQuery.disableAnimationsOf(context)
                        ? Duration.zero
                        : const Duration(milliseconds: 220),
                    curve: Curves.easeOutCubic,
                    alignment: Alignment.topCenter,
                    child: buildTopicGrid(visibleItems),
                  ),
                  if (hasMore) ...[
                    const SizedBox(height: 12),
                    Material(
                      color: AppColors.grey0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                        side: const BorderSide(color: AppColors.grey200),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: InkWell(
                        key: const Key('toggleSpeakingTopicsButton'),
                        onTap: () => setState(
                          () => _showAllTopics = !_showAllTopics,
                        ),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(minHeight: 48),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 10,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Flexible(
                                  child: Text(
                                    _showAllTopics ? 'Thu gọn' : 'Hiện thêm',
                                    textAlign: TextAlign.center,
                                    style: designText(
                                      14,
                                      weight: FontWeight.w700,
                                      color: AppColors.primary700,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Icon(
                                  _showAllTopics
                                      ? Icons.keyboard_arrow_up_rounded
                                      : Icons.keyboard_arrow_down_rounded,
                                  size: 20,
                                  color: AppColors.primary700,
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
            },
          ),
          const SizedBox(height: 22),
          learningHeading('Luyện thêm', size: 18),
          const SizedBox(height: 8),
          _SpeakingRow(
            title: 'Miêu tả bức tranh',
            history: active
                ? () => previewPush(
                    context,
                    SpeakingHistoryPage(
                      controller: controller,
                      mode: 'PICTURE_DESCRIPTION',
                    ),
                  )
                : null,
            detail: 'Quan sát tranh và diễn đạt · Tối đa 60 giây',
            icon: Icons.collections_outlined,
            imageUrl: 'assets/illustrations/picture-campus-cafe.jpg',
            onTap: ready ? () => openExtra('PICTURE_DESCRIPTION') : null,
          ),
          _SpeakingRow(
            title: 'Bộ câu đọc mở rộng',
            history: active
                ? () => previewPush(
                    context,
                    SpeakingHistoryPage(
                      controller: controller,
                      mode: 'READ_ALOUD',
                    ),
                  )
                : null,
            detail: 'Luyện thêm câu và đoạn ngắn',
            icon: Icons.menu_book_outlined,
            onTap: ready ? () => openExtra('READ_ALOUD') : null,
          ),
          _SpeakingRow(
            title: 'Thử thách phát âm',
            history: active
                ? () => previewPush(
                    context,
                    SpeakingHistoryPage(
                      controller: controller,
                      mode: 'TONGUE_TWISTER',
                    ),
                  )
                : null,
            detail: 'Câu líu lưỡi theo từng màn',
            icon: Icons.emoji_events_outlined,
            onTap: ready ? () => openExtra('TONGUE_TWISTER') : null,
          ),
        ],
      );
    },
  );
}

class _TopicActivities extends StatelessWidget {
  const _TopicActivities({
    required this.controller,
    required this.topic,
    required this.practicePage,
  });

  final SpeakingController controller;
  final Json topic;
  final Widget Function() practicePage;

  Future<void> openPractice(BuildContext context, String mode) async {
    try {
      final opened = await controller.openTopicPractice(topic, mode);
      if (opened && context.mounted && controller.active) {
        await previewPush(context, practicePage());
      }
    } catch (_) {
      if (context.mounted && controller.active) {
        previewMessage(context, 'Chưa mở được bài luyện. Hãy thử lại.');
      }
    }
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) {
      final practice = topic['practice'] as Map?;
      final read = practice?['readAloud'] as Map?;
      final solo = practice?['topic'] as Map?;
      final canRead =
          read?['enabled'] == true &&
          (read?['items'] as List? ?? []).isNotEmpty;
      final canSpeak = solo?['enabled'] == true && solo?['prompt'] is Map;
      final canCall = topic['enabled'] == true;
      final ready =
          controller.active &&
          !controller.busy &&
          !controller.processing &&
          !controller.recording;
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.grey0,
          borderRadius: AppRadius.cardRadius,
          border: Border.all(color: AppColors.grey100),
          boxShadow: [
            BoxShadow(
              color: AppColors.grey900.withValues(alpha: 0.06),
              blurRadius: 18,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            learningHeading('Cách luyện', size: 17),
            const SizedBox(height: 12),
            _SpeakingRow(
              title: 'Nghe và đọc',
              history: controller.active
                  ? () => previewPush(
                      context,
                      SpeakingHistoryPage(
                        controller: controller,
                        mode: 'READ_ALOUD',
                      ),
                    )
                  : null,
              detail: canRead
                  ? 'Nghe câu mẫu rồi đọc thành tiếng'
                  : 'Tạm thời chưa khả dụng',
              icon: Icons.headphones,
              onTap: ready && canRead
                  ? () => openPractice(context, 'READ_ALOUD')
                  : null,
            ),
            _SpeakingRow(
              title: 'Tự nói',
              history: controller.active
                  ? () => previewPush(
                      context,
                      SpeakingHistoryPage(
                        controller: controller,
                        mode: 'TOPIC',
                      ),
                    )
                  : null,
              detail: canSpeak
                  ? 'Tự diễn đạt theo gợi ý · Tối đa 60 giây'
                  : 'Tạm thời chưa khả dụng',
              icon: Icons.mic_none,
              onTap: ready && canSpeak
                  ? () => openPractice(context, 'TOPIC')
                  : null,
            ),
            _SpeakingRow(
              title: 'Trò chuyện cùng Lingo',
              primary: true,
              marginBottom: controller.processing ? 8 : 0,
              historyTooltip: 'Lịch sử hội thoại AI',
              history: controller.active
                  ? () => previewPush(
                      context,
                      VoiceConversationsPage(
                        controller: controller,
                        historyOnly: true,
                      ),
                    )
                  : null,
              detail: canCall
                  ? 'Bật micro và đối đáp · Tối đa 3 phút'
                  : 'Tạm thời chưa khả dụng',
              icon: Icons.forum_outlined,
              onTap: ready && canCall
                  ? () => previewPush(
                      context,
                      VoiceConversationPage(
                        controller: controller,
                        topic: topic,
                        skipPreparation: true,
                      ),
                    )
                  : null,
            ),
            if (controller.processing)
              learningBody(
                'Một bài nói đang được chấm. Bạn có thể mở lại từ trang Nói.',
                size: 13,
              ),
          ],
        ),
      );
    },
  );
}

class _SpeakingTopicGridCard extends StatelessWidget {
  const _SpeakingTopicGridCard({
    super.key,
    required this.title,
    this.detail,
    required this.icon,
    required this.imageUrl,
    required this.compact,
    required this.onTap,
  });

  final String title;
  final String? detail;
  final IconData icon;
  final String imageUrl;
  final bool compact;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final imageHeight = compact ? 86.0 : 98.0;
    return Container(
      decoration: BoxDecoration(
        borderRadius: AppRadius.cardRadius,
        boxShadow: [
          BoxShadow(
            color: AppColors.grey900.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: AppColors.grey0,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.cardRadius,
          side: const BorderSide(color: AppColors.grey100),
        ),
        clipBehavior: Clip.antiAlias,
        child: Semantics(
          button: true,
          child: InkWell(
            onTap: onTap,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(
                  height: imageHeight,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      LearningMediaImage(
                        imageUrl: imageUrl,
                        width: double.infinity,
                        height: imageHeight,
                        fit: BoxFit.cover,
                        semanticLabel: title,
                      ),
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Color(0x380D2115),
                              Color(0x000D2115),
                              Color(0x2E0D2115),
                            ],
                            stops: [0.0, 0.55, 1.0],
                          ),
                        ),
                      ),
                      Positioned(
                        top: 8,
                        left: 8,
                        child: Container(
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: const Color(0x66122B1B),
                            borderRadius: BorderRadius.circular(9),
                            border: Border.all(color: const Color(0x40FFFFFF)),
                          ),
                          alignment: Alignment.center,
                          child: Icon(icon, size: 15, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    compact ? 10 : 12,
                    10,
                    compact ? 10 : 12,
                    12,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: designHeading(
                          compact ? 14 : 15,
                          color: AppColors.grey900,
                          height: 1.25,
                        ).copyWith(fontWeight: FontWeight.w700),
                      ),
                      if (detail != null && detail!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          detail!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: designText(
                            compact ? 11.5 : 12,
                            color: AppColors.grey700,
                            height: 1.32,
                          ),
                        ),
                      ],
                    ],
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

class _SpeakingRow extends StatelessWidget {
  const _SpeakingRow({
    required this.title,
    this.detail,
    required this.icon,
    this.imageUrl,
    required this.onTap,
    this.primary = false,
    this.marginBottom = 8,
    this.history,
    this.historyTooltip,
  });

  final String title;
  final String? detail;
  final IconData icon;
  final String? imageUrl;
  final VoidCallback? onTap;
  final bool primary;
  final double marginBottom;
  final VoidCallback? history;
  final String? historyTooltip;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    final dark = primary && enabled;
    final heading = dark
        ? Colors.white
        : enabled
        ? AppColors.grey900
        : AppColors.grey800;
    final secondary = dark ? AppColors.grey200 : AppColors.grey800;
    final hasImage = imageUrl != null && imageUrl!.trim().isNotEmpty;
    final content = Padding(
      padding: primary
          ? const EdgeInsets.symmetric(horizontal: 16, vertical: 20)
          : const EdgeInsets.all(12),
      child: Row(
        children: [
          if (hasImage && !primary)
            LearningMediaImage(
              imageUrl: imageUrl,
              width: 48,
              height: 48,
              borderRadius: BorderRadius.circular(12),
              semanticLabel: title,
            )
          else
            Container(
              width: primary ? 52 : 44,
              height: primary ? 52 : 44,
              decoration: BoxDecoration(
                color: enabled ? AppColors.primary25 : AppColors.grey50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                icon,
                size: primary ? 26 : 22,
                color: enabled ? AppColors.primary700 : AppColors.grey800,
              ),
            ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: designHeading(primary ? 20 : 16, color: heading),
                ),
                if (detail != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    detail!,
                    style: designText(13, color: secondary, height: 1.35),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Icon(
            Icons.chevron_right_rounded,
            size: primary ? 24 : 20,
            color: dark ? AppColors.primary50 : secondary,
          ),
        ],
      ),
    );
    final target = Material(
      color: dark ? AppColors.grey900 : Colors.transparent,
      borderRadius: AppRadius.cardRadius,
      clipBehavior: Clip.antiAlias,
      child: Semantics(
        button: true,
        enabled: enabled,
        child: InkWell(onTap: onTap, child: content),
      ),
    );
    return Padding(
      padding: EdgeInsets.only(bottom: marginBottom),
      child: Row(
        children: [
          Expanded(
            child: dark
                ? target
                : FigmaCard(padding: EdgeInsets.zero, child: target),
          ),
          if (history != null) ...[
            const SizedBox(width: 4),
            IconButton(
              tooltip: historyTooltip ?? 'Lịch sử · $title',
              onPressed: history,
              icon: const Icon(Icons.history),
            ),
          ],
        ],
      ),
    );
  }
}
