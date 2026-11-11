import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';
import '../learning/learning_widgets.dart';
import 'speaking_controller.dart';
import 'speaking_repository.dart';
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
  late Future<Json> history;
  bool viewingHistory = false;
  SpeakingRepository get repository => widget.controller.repository;
  Future<Json> loadTopics() => repository.conversationTopics().catchError(
    (Object _) => <String, dynamic>{'loadError': true},
  );
  Future<Json> loadHistory() => repository.conversations().catchError(
    (Object _) => <String, dynamic>{'loadError': true},
  );

  @override
  void initState() {
    super.initState();
    viewingHistory = widget.historyOnly;
    topics = widget.historyOnly ? Future.value({}) : loadTopics();
    history = loadHistory();
  }

  void reload() => setState(() {
    if (!widget.historyOnly) topics = loadTopics();
    history = loadHistory();
  });

  Future<void> open(Json item) async {
    if (!widget.controller.active) return;
    if (viewingHistory) {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => _ConversationHistoryDetail(
            controller: widget.controller,
            id: item['id'] as String,
          ),
        ),
      );
    } else {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) =>
              VoiceConversationPage(controller: widget.controller, topic: item),
        ),
      );
    }
    if (mounted && widget.controller.active) reload();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(viewingHistory ? 'Lịch sử hội thoại' : 'Hội thoại AI'),
      actions: [
        if (!widget.historyOnly)
          IconButton(
            tooltip: viewingHistory ? 'Chọn chủ đề' : 'Lịch sử hội thoại',
            icon: Icon(
              viewingHistory ? Icons.chat_bubble_outline : Icons.history,
            ),
            onPressed: () => setState(() => viewingHistory = !viewingHistory),
          ),
      ],
    ),
    body: buildList(),
  );

  Widget buildList() => FutureBuilder<Json>(
    future: viewingHistory ? history : topics,
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
      final items = speakingItems(data['items']);
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (!viewingHistory) ...[
            learningHeading('Bạn muốn trò chuyện về điều gì?', size: 24),
            const SizedBox(height: 8),
            learningBody(
              'Chọn chủ đề để xem hướng dẫn và chuẩn bị trước khi trò chuyện.',
            ),
            const SizedBox(height: 16),
            if (data['enabled'] != true)
              const Text(
                'Hội thoại AI đang tạm dừng. Bạn vẫn xem được lịch sử.',
              ),
          ],
          if (viewingHistory && items.isEmpty)
            const Text('Chưa có phiên hội thoại nào.'),
          for (final item in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: !viewingHistory
                  ? FigmaCard(
                      padding: EdgeInsets.zero,
                      child: Material(
                        color: Colors.transparent,
                        borderRadius: BorderRadius.circular(16),
                        clipBehavior: Clip.antiAlias,
                        child: ListTile(
                          key: ValueKey('conversation-topic-${item['id']}'),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 8,
                          ),
                          title: Text(
                            item['title']?.toString() ??
                                item['text'].toString(),
                            style: designHeading(18),
                          ),
                          trailing: const Icon(
                            Icons.chevron_right_rounded,
                            color: AppColors.grey800,
                          ),
                          onTap: widget.controller.active
                              ? () => open(item)
                              : null,
                        ),
                      ),
                    )
                  : LearningCard(
                      children: [
                        learningHeading(
                          (item['topicSnapshot'] as Map?)?['text']
                                  ?.toString() ??
                              'Hội thoại AI',
                          size: 20,
                        ),
                        learningBody(
                          conversationStatus(item['status']?.toString()),
                        ),
                        if (conversationGradeStatus(item['assessmentStatus'])
                            case final grade?)
                          learningBody(grade, size: 14),
                        FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.grey900,
                            foregroundColor: Colors.white,
                            minimumSize: const Size.fromHeight(48),
                          ),
                          onPressed: widget.controller.active
                              ? () => open(item)
                              : null,
                          child: const Text('Xem hội thoại'),
                        ),
                      ],
                    ),
            ),
          if (viewingHistory && data['nextCursor'] != null)
            TextButton(
              onPressed: () async {
                try {
                  final next = await repository.conversations(
                    cursor: data['nextCursor'] as String,
                  );
                  if (mounted && widget.controller.active) {
                    setState(() {
                      history = Future.value({
                        ...next,
                        'items': [...items, ...speakingItems(next['items'])],
                      });
                    });
                  }
                } catch (_) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Chưa tải được trang tiếp. Hãy thử lại.'),
                      ),
                    );
                  }
                }
              },
              child: const Text('Xem thêm'),
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
  @override
  void initState() {
    super.initState();
    detail = widget.controller.repository.conversationSummary(widget.id);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Xem lại hội thoại')),
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
        final header = Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            learningHeading((row['topicSnapshot'] as Map)['text'].toString()),
            learningBody(conversationStatus(row['status']?.toString())),
            const SizedBox(height: 16),
          ],
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
