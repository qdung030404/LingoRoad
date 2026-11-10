import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import '../../core/theme/app_colors.dart';
import '../learning/learning_widgets.dart';
import 'speaking_controller.dart';
import 'speaking_repository.dart';
import 'voice_conversation_page.dart';
import 'conversation_message.dart';

class VoiceConversationsPage extends StatefulWidget {
  const VoiceConversationsPage({super.key, required this.controller});
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
    topics = loadTopics();
    history = loadHistory();
  }

  void reload() => setState(() {
    topics = loadTopics();
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
        IconButton(
          tooltip: viewingHistory ? 'Chọn chủ đề' : 'Lịch sử hội thoại',
          icon: Icon(
            viewingHistory ? Icons.chat_bubble_outline : Icons.history,
          ),
          onPressed: () => setState(() => viewingHistory = !viewingHistory),
        ),
      ],
    ),
    body: FutureBuilder<Json>(
      future: viewingHistory ? history : topics,
      builder: (context, snapshot) {
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
                'AI hỏi từng câu ngắn. Bạn trả lời bằng tiếng Anh và có thể yêu cầu giải thích tiếng Việt.',
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
                child: LearningCard(
                  children: [
                    learningHeading(
                      viewingHistory
                          ? ((item['topicSnapshot'] as Map?)?['text']
                                    ?.toString() ??
                                'Hội thoại AI')
                          : item['text'].toString(),
                      size: 20,
                    ),
                    if (viewingHistory)
                      learningBody(
                        conversationStatus(item['status']?.toString()),
                      ),
                    if (!viewingHistory)
                      for (final hint in item['hints'] as List? ?? [])
                        learningBody('• $hint', size: 14),
                    FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.grey900,
                        foregroundColor: Colors.white,
                        minimumSize: const Size.fromHeight(48),
                      ),
                      onPressed:
                          widget.controller.active &&
                              (viewingHistory || data['enabled'] == true)
                          ? () => open(item)
                          : null,
                      child: Text(
                        viewingHistory ? 'Xem hội thoại' : 'Chọn chủ đề',
                      ),
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
                          content: Text(
                            'Chưa tải được trang tiếp. Hãy thử lại.',
                          ),
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
    ),
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
    detail = widget.controller.repository.conversation(widget.id);
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
                detail = widget.controller.repository.conversation(widget.id);
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
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            learningHeading((row['topicSnapshot'] as Map)['text'].toString()),
            learningBody(conversationStatus(row['status']?.toString())),
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
            if (turns.isEmpty)
              const Text('Phiên này chưa ghi nhận lượt nói nào.'),
            for (final turn in turns)
              ConversationMessage(
                key: ValueKey(turn['id']),
                isUser: turn['role'] == 'USER',
                text: turn['transcript'].toString(),
                translationVi: turn['translationVi'] as String?,
                onTranslate: turn['role'] == 'USER'
                    ? null
                    : () {
                        if (!widget.controller.active) {
                          throw const ApiFailure(
                            'Phiên đăng nhập đã thay đổi.',
                          );
                        }
                        return widget.controller.repository
                            .translateConversationTurn(
                              widget.id,
                              turn['providerItemId'].toString(),
                            );
                      },
              ),
          ],
        );
      },
    ),
  );
}
