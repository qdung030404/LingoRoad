import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/figma_widgets.dart';
import '../learning/learning_widgets.dart';
import 'speaking_controller.dart';
import 'speaking_history_list.dart';
import 'speaking_repository.dart';
import 'speaking_review_widgets.dart';
import 'voice_conversation_page.dart';
import 'conversation_history_chat.dart';
import 'conversation_assessment.dart';

class VoiceConversationsPage extends StatefulWidget {
  const VoiceConversationsPage({
    super.key,
    required this.controller,
    this.historyOnly = false,
  });
  final bool historyOnly;
  final SpeakingController controller;
  @override
  State<VoiceConversationsPage> createState() => _VoiceConversationsPageState();
}

class _VoiceConversationsPageState extends State<VoiceConversationsPage> {
  late Future<Json> topics;
  bool viewingHistory = false;
  SpeakingRepository get repository => widget.controller.repository;

  Future<Json> loadTopics() => repository.conversationTopics().catchError(
    (Object _) => <String, dynamic>{'loadError': true},
  );

  @override
  void initState() {
    super.initState();
    if (!widget.historyOnly) topics = loadTopics();
  }

  void reload() {
    final request = loadTopics();
    setState(() {
      topics = request;
    });
  }

  Future<void> openTopic(Json item) async {
    if (!widget.controller.active) return;
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) =>
            VoiceConversationPage(controller: widget.controller, topic: item),
      ),
    );
    if (mounted && widget.controller.active) reload();
  }

  @override
  Widget build(BuildContext context) => widget.historyOnly || viewingHistory
      ? SpeakingHistoryList(
          title: 'Lịch sử hội thoại',
          emptyMessage: 'Chưa có phiên hội thoại nào.',
          errorMessage: 'Chưa tải được hội thoại.',
          active: () => widget.controller.active,
          loadPage: (cursor) => repository.conversations(cursor: cursor),
          hide: (ids) async {
            await repository.hideConversationHistory(ids);
            unawaited(
              widget.controller.conversationRecordings.deleteBatch(
                widget.controller.accountId,
                ids,
              ),
            );
          },
          onBack: widget.historyOnly
              ? null
              : () => setState(() => viewingHistory = false),
          describe: (item) {
            final status = item['status']?.toString();
            return SpeakingHistoryEntry(
              id: item['id'] as String,
              title: _conversationTopicTitle(item),
              date: item['createdAt']?.toString(),
              canHide: status == 'ENDED' || status == 'INTERRUPTED',
              details: [
                conversationStatus(status),
                ?conversationGradeStatus(item['assessmentStatus']),
              ],
            );
          },
          open: (id) async {
            await Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => _ConversationHistoryDetail(
                  controller: widget.controller,
                  id: id,
                ),
              ),
            );
          },
        )
      : Scaffold(
          appBar: AppBar(
            title: const Text('Hội thoại AI'),
            actions: [
              IconButton(
                tooltip: 'Lịch sử hội thoại',
                icon: const Icon(Icons.history),
                onPressed: () => setState(() => viewingHistory = true),
              ),
            ],
          ),
          body: buildTopics(),
        );

  Widget buildTopics() => FutureBuilder<Json>(
    future: topics,
    builder: (context, snapshot) {
      if (!widget.controller.active) {
        return const Center(child: Text('Phiên đăng nhập đã thay đổi.'));
      }
      if (snapshot.hasError || snapshot.data?['loadError'] == true) {
        return Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Chưa tải được hội thoại.'),
              TextButton(onPressed: reload, child: const Text('Thử lại')),
            ],
          ),
        );
      }
      if (!snapshot.hasData) {
        return const Center(child: CircularProgressIndicator());
      }
      final data = snapshot.data!;
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          learningHeading('Bạn muốn trò chuyện về điều gì?', size: 24),
          const SizedBox(height: 8),
          learningBody(
            'Chọn chủ đề để xem hướng dẫn và chuẩn bị trước khi trò chuyện.',
          ),
          const SizedBox(height: 16),
          if (data['enabled'] != true)
            const Text('Hội thoại AI đang tạm dừng. Bạn vẫn xem được lịch sử.'),
          for (final item in speakingItems(data['items']))
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: FigmaCard(
                padding: EdgeInsets.zero,
                child: Material(
                  color: Colors.transparent,
                  borderRadius: AppRadius.cardRadius,
                  clipBehavior: Clip.antiAlias,
                  child: ListTile(
                    key: ValueKey('conversation-topic-${item['id']}'),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 8,
                    ),
                    title: Text(
                      item['title']?.toString() ?? item['text'].toString(),
                      style: designHeading(18),
                    ),
                    trailing: const Icon(
                      Icons.chevron_right_rounded,
                      color: AppColors.grey800,
                    ),
                    onTap: () => openTopic(item),
                  ),
                ),
              ),
            ),
        ],
      );
    },
  );
}

String conversationStatus(String? status) => switch (status) {
  'CREATED' => 'Chờ kết nối',
  'CONNECTING' => 'Đang kết nối',
  'ACTIVE' => 'Đang hội thoại',
  'ENDED' => 'Đã kết thúc',
  'INTERRUPTED' => 'Phiên bị gián đoạn',
  _ => 'Đang cập nhật',
};

String? conversationGradeStatus(Object? status) => switch (status) {
  'UNASSESSED' => 'Chưa chấm điểm',
  'PROCESSING' => 'Đang chấm điểm',
  'READY' => 'Đã chấm điểm',
  'PARTIAL' => 'Đã chấm một phần',
  'FAILED' => 'Chưa chấm được',
  'UNKNOWN' => 'Lần chấm bị gián đoạn',
  _ => null,
};

String _conversationTopicTitle(Json conversation) {
  final topic = conversation['topicSnapshot'];
  if (topic is Map) {
    for (final key in ['title', 'text']) {
      final value = topic[key];
      if (value is String && value.trim().isNotEmpty) return value.trim();
    }
  }
  return 'Hội thoại với Lingo';
}

class _ConversationHistoryDetail extends StatefulWidget {
  const _ConversationHistoryDetail({
    required this.controller,
    required this.id,
  });
  final SpeakingController controller;
  final String id;
  @override
  State<_ConversationHistoryDetail> createState() =>
      _ConversationHistoryDetailState();
}

class _ConversationHistoryDetailState
    extends State<_ConversationHistoryDetail> {
  late Future<Json> detail;
  late final recording = widget.controller.conversationRecordings.read(
    widget.controller.accountId,
    widget.id,
  );
  @override
  void initState() {
    super.initState();
    detail = widget.controller.repository.conversationSummary(widget.id);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('Xem lại hội thoại', style: designHeading(18))),
    body: FutureBuilder<Json>(
      future: detail,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          return Center(
            child: TextButton(
              onPressed: () => setState(() {
                detail = widget.controller.repository.conversationSummary(
                  widget.id,
                );
              }),
              child: const Text('Tải lại hội thoại'),
            ),
          );
        }
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final row = snapshot.data!;
        final turns = speakingItems(row['turns']);
        final status = row['status']?.toString();
        final header = SpeakingReviewHeader(
          title: _conversationTopicTitle(row),
          icon: Icons.forum_outlined,
          statusLabel: conversationStatus(status),
          dateLabel: formatSpeakingHistoryDate(row['createdAt']?.toString()),
          completed: status == 'ENDED',
        );
        final chat = ConversationHistoryChat(
          controller: widget.controller,
          id: widget.id,
        );
        if (['ENDED', 'INTERRUPTED'].contains(row['status']) &&
            (row['hasUserTurns'] == true ||
                turns.any((turn) => turn['role'] == 'USER'))) {
          return ConversationAssessment(
            controller: widget.controller,
            conversation: row,
            reviewRecording: recording,
            fullPage: true,
            resultHeader: header,
            resultFooter: Padding(
              padding: const EdgeInsets.only(top: 24),
              child: chat,
            ),
          );
        }
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            header,
            if (['CREATED', 'CONNECTING', 'ACTIVE'].contains(row['status']))
              TextButton(
                onPressed: () async {
                  if (!widget.controller.active) return;
                  try {
                    final updated = await widget.controller.repository
                        .finishConversation(widget.id);
                    if (mounted) setState(() => detail = Future.value(updated));
                  } catch (_) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text(
                            'Chưa xác nhận được trạng thái phiên. Hãy thử lại.',
                          ),
                        ),
                      );
                    }
                  }
                },
                child: const Text('Kết thúc phiên đang mở'),
              ),
            chat,
          ],
        );
      },
    ),
  );
}
