import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/api/api_client.dart';
import 'conversation_message.dart';
import 'speaking_controller.dart';
import 'speaking_repository.dart';

class ConversationHistoryChat extends StatefulWidget {
  const ConversationHistoryChat({
    super.key,
    required this.controller,
    required this.id,
  });
  final SpeakingController controller;
  final String id;
  @override
  State<ConversationHistoryChat> createState() =>
      _ConversationHistoryChatState();
}

class _ConversationHistoryChatState extends State<ConversationHistoryChat> {
  Future<Json>? transcript;
  bool expanded = false;
  Timer? identityWatch;
  @override
  void initState() {
    super.initState();
    identityWatch = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!widget.controller.active) {
        identityWatch?.cancel();
        if (mounted) {
          setState(() {
            expanded = false;
            transcript = null;
          });
        }
      }
    });
  }

  Future<Json> load() async {
    try {
      if (!widget.controller.active) return {'loadError': true};
      final result = await widget.controller.repository.conversationTranscript(
        widget.id,
      );
      if (!widget.controller.active) return {'loadError': true};
      return result;
    } catch (_) {
      return {'loadError': true};
    }
  }

  @override
  void dispose() {
    identityWatch?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.controller.active) return const SizedBox.shrink();
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: const BorderSide(color: Color(0xFFE2E7EF)),
    );
    return Material(
      color: Colors.white,
      shape: shape,
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        key: const Key('conversation-chat-history'),
        shape: shape,
        collapsedShape: shape,
        tilePadding: const EdgeInsets.symmetric(horizontal: 16),
        childrenPadding: const EdgeInsets.fromLTRB(12, 4, 12, 12),
        leading: const Icon(Icons.forum_outlined, color: Color(0xFF287C47)),
        title: const Text(
          'Lịch sử chat',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        onExpansionChanged: (value) => setState(() {
          expanded = value;
          if (value) transcript ??= load();
        }),
        children: [
          if (expanded)
            FutureBuilder<Json>(
              future: transcript,
              builder: (context, snapshot) {
                if (snapshot.hasError || snapshot.data?['loadError'] == true) {
                  return Column(
                    children: [
                      const Text('Chưa tải được lời thoại.'),
                      TextButton(
                        onPressed: () => setState(() {
                          transcript = load();
                        }),
                        child: const Text('Tải lại lời thoại'),
                      ),
                    ],
                  );
                }
                if (!snapshot.hasData) {
                  return const Padding(
                    padding: EdgeInsets.all(24),
                    child: SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  );
                }
                final turns = speakingItems(snapshot.data!['items']);
                if (turns.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('Phiên này chưa ghi nhận lượt nói nào.'),
                  );
                }
                return Column(
                  children: [
                    for (final (index, turn) in turns.indexed)
                      ConversationMessage(
                        key: ValueKey(
                          turn['id'] ?? turn['providerItemId'] ?? 'turn-$index',
                        ),
                        isUser: turn['role'] == 'USER',
                        text: turn['transcript']?.toString() ?? '',
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
        ],
      ),
    );
  }
}
