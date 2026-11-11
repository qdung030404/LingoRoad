import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/figma_widgets.dart';
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
};

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
  SpeakingController get controller => widget.controller;
  late Future<Json> topics;

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

  Widget topicCard(Json topic) {
    final title = topic['title']?.toString() ?? topic['text'].toString();
    final (icon, description) =
        _topicPresentation[title.toLowerCase()] ??
        (Icons.chat_bubble_outline_rounded, null);
    return _SpeakingRow(
      title: title,
      detail: description,
      icon: icon,
      onTap: () => openTopic(topic),
    );
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) {
      final active = controller.active;
      final ready = active && !controller.busy && !controller.processing;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          learningHeading('Chủ đề luyện nói', size: 22),
          const SizedBox(height: 8),
          if (active && controller.processing)
            OutlinedButton(
              onPressed: () => previewPush(context, widget.practicePage()),
              child: const Text('Tiếp tục bài đang chấm'),
            ),
          FutureBuilder<Json>(
            future: topics,
            builder: (context, snapshot) {
              if (!active) return const Text('Phiên đăng nhập đã thay đổi.');
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              final data = snapshot.data;
              if (data == null || data['loadError'] == true) {
                return Column(
                  children: [
                    const Text('Chưa tải được chủ đề luyện nói.'),
                    TextButton(
                      onPressed: () => setState(() => topics = loadTopics()),
                      child: const Text('Thử lại'),
                    ),
                  ],
                );
              }
              final items = speakingItems(data['items']);
              if (items.isEmpty) return const Text('Chưa có chủ đề luyện nói.');
              return Column(
                children: [for (final item in items) topicCard(item)],
              );
            },
          ),
          const SizedBox(height: 16),
          learningHeading('Luyện thêm', size: 18),
          const SizedBox(height: 8),
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
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          learningHeading('Cách luyện', size: 18),
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
                    SpeakingHistoryPage(controller: controller, mode: 'TOPIC'),
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
                      showSettingsOnEntry: true,
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
      );
    },
  );
}

class _SpeakingRow extends StatelessWidget {
  const _SpeakingRow({
    required this.title,
    this.detail,
    required this.icon,
    required this.onTap,
    this.primary = false,
    this.history,
    this.historyTooltip,
  });

  final String title;
  final String? detail;
  final IconData icon;
  final VoidCallback? onTap;
  final bool primary;
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
    final content = Padding(
      padding: primary
          ? const EdgeInsets.symmetric(horizontal: 16, vertical: 20)
          : const EdgeInsets.all(12),
      child: Row(
        children: [
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
      padding: const EdgeInsets.only(bottom: 8),
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
