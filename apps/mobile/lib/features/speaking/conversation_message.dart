import 'package:flutter/material.dart';

class ConversationMessage extends StatefulWidget {
  const ConversationMessage({
    super.key,
    required this.isUser,
    required this.text,
    this.translationVi,
    this.onTranslate,
  });
  final bool isUser;
  final String text;
  final String? translationVi;
  final Future<String> Function()? onTranslate;
  @override
  State<ConversationMessage> createState() => _ConversationMessageState();
}

class _ConversationMessageState extends State<ConversationMessage> {
  String? translated;
  bool loading = false, visible = false, failed = false;

  Future<void> toggle() async {
    if (loading) return;
    if (translated != null || widget.translationVi != null) {
      setState(() => visible = !visible);
      return;
    }
    setState(() {
      loading = true;
      failed = false;
    });
    try {
      final value = await widget.onTranslate!();
      if (mounted) {
        setState(() {
          translated = value;
          visible = true;
        });
      }
    } catch (_) {
      if (mounted) setState(() => failed = true);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) => Align(
      alignment: widget.isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: constraints.maxWidth * .9),
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: BoxDecoration(
          color: widget.isUser ? const Color(0xFFE6F5EC) : Colors.white,
          border: Border.all(
            color: widget.isUser
                ? const Color(0xFFD1EBDD)
                : const Color(0xFFE2E7EF),
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  widget.isUser
                      ? Icons.person_outline_rounded
                      : Icons.auto_awesome_rounded,
                  size: 16,
                  color: const Color(0xFF287C47),
                ),
                const SizedBox(width: 6),
                Text(
                  widget.isUser ? 'Bạn' : 'lingoRoad',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF287C47),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            SelectableText(
              widget.text,
              style: const TextStyle(
                fontSize: 16,
                height: 1.5,
                color: Color(0xFF1A2029),
              ),
            ),
            if (!widget.isUser && widget.onTranslate != null) ...[
              const SizedBox(height: 4),
              TextButton.icon(
                style: TextButton.styleFrom(
                  padding: EdgeInsets.zero,
                  minimumSize: const Size(48, 48),
                  alignment: Alignment.centerLeft,
                  foregroundColor: const Color(0xFF287C47),
                ),
                onPressed: loading ? null : toggle,
                icon: loading
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.translate_rounded, size: 18),
                label: Text(
                  loading
                      ? 'Đang dịch…'
                      : failed
                      ? 'Dịch lại'
                      : visible
                      ? 'Ẩn bản dịch'
                      : 'Dịch sang tiếng Việt',
                ),
              ),
              if (failed)
                const Text(
                  'Chưa dịch được. Bạn có thể thử lại.',
                  style: TextStyle(fontSize: 12, color: Color(0xFFB34B29)),
                ),
              if (visible)
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.only(top: 12),
                  decoration: const BoxDecoration(
                    border: Border(top: BorderSide(color: Color(0xFFE2E7EF))),
                  ),
                  child: SelectableText(
                    translated ?? widget.translationVi ?? '',
                    style: const TextStyle(
                      fontSize: 15,
                      height: 1.5,
                      color: Color(0xFF5B6574),
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    ),
  );
}
