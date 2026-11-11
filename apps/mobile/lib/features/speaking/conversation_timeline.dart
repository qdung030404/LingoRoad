import 'package:flutter/material.dart';

class ConversationTimeline extends StatefulWidget {
  const ConversationTimeline({
    super.key,
    required this.revision,
    required this.children,
  });
  final Object revision;
  final List<Widget> children;
  @override
  State<ConversationTimeline> createState() => _ConversationTimelineState();
}

class _ConversationTimelineState extends State<ConversationTimeline> {
  final scroll = ScrollController();
  @override
  void didUpdateWidget(covariant ConversationTimeline oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.revision == widget.revision) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || !scroll.hasClients) return;
      if (MediaQuery.disableAnimationsOf(context)) {
        scroll.jumpTo(0);
      } else {
        scroll.animateTo(
          0,
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListView(
    key: const ValueKey('conversation-timeline'),
    controller: scroll,
    reverse: true,
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
    children: widget.children.reversed.toList(),
  );
}
