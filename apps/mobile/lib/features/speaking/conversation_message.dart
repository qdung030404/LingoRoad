import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_radius.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/learning_media_image.dart';
import 'conversation_live_view.dart';

class ConversationMessage extends StatefulWidget {
  const ConversationMessage({
    super.key,
    required this.isUser,
    required this.text,
    this.translationVi,
    this.onTranslate,
    this.voiceName = 'standard',
  });
  final bool isUser;
  final String text;
  final String? translationVi;
  final Future<String> Function()? onTranslate;
  final String voiceName;
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
    builder: (context, constraints) {
      final user = widget.isUser;
      final avatar = user
          ? const ConversationLiveIcon('user', size: 36)
          : LearningMediaImage(
              imageUrl: personaAvatarAsset(widget.voiceName),
              width: 36,
              height: 36,
              borderRadius: BorderRadius.circular(18),
            );
      final message = SelectableText(
        widget.text,
        style: _messageStyle(
          14,
          user ? AppColors.primary900 : AppColors.grey900,
        ),
      );
      return Align(
        alignment: user ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          constraints: BoxConstraints(
            maxWidth: constraints.maxWidth * (user ? .65 : .95),
          ),
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(11),
          decoration: BoxDecoration(
            color: user ? AppColors.primary25 : AppColors.grey0,
            border: Border.all(
              color: user ? AppColors.primary500 : AppColors.grey100,
            ),
            borderRadius: AppRadius.cardRadius,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (user) ...[
                Row(
                  children: [
                    avatar,
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Bạn',
                        style: _messageStyle(
                          16,
                          AppColors.primary900,
                        ).copyWith(fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                message,
              ] else ...[
                Semantics(
                  label: 'Lingo',
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      avatar,
                      const SizedBox(width: 12),
                      Expanded(child: message),
                    ],
                  ),
                ),
                if (widget.onTranslate != null || widget.translationVi != null)
                  TextButton.icon(
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: const Size(48, 40),
                      alignment: Alignment.centerLeft,
                      foregroundColor: AppColors.primary700,
                      textStyle: _messageStyle(12, AppColors.primary700),
                    ),
                    onPressed: loading ? null : toggle,
                    icon: loading
                        ? const SizedBox.square(
                            dimension: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const ConversationLiveIcon('translate', size: 20),
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
                  Text(
                    'Chưa dịch được. Bạn có thể thử lại.',
                    style: _messageStyle(12, AppColors.error300),
                  ),
                if (visible)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.only(top: 12),
                    decoration: const BoxDecoration(
                      border: Border(top: BorderSide(color: AppColors.grey100)),
                    ),
                    child: SelectableText(
                      translated ?? widget.translationVi ?? '',
                      style: _messageStyle(14, AppColors.grey800),
                    ),
                  ),
              ],
            ],
          ),
        ),
      );
    },
  );
}

TextStyle _messageStyle(double size, Color color) =>
    designText(size, color: color, height: 1.5);
