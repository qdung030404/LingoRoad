import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/figma_dropdown.dart';
import '../../core/api/api_client.dart';
import 'speaking_repository.dart';

class ConversationSettingsDialog extends StatefulWidget {
  const ConversationSettingsDialog({
    super.key,
    required this.initial,
    required this.startOnConfirm,
    this.onApplyLive,
  });

  final ConversationSettings initial;
  final bool startOnConfirm;
  final Future<void> Function(ConversationSettings)? onApplyLive;

  @override
  State<ConversationSettingsDialog> createState() =>
      _ConversationSettingsDialogState();
}

class _ConversationSettingsDialogState
    extends State<ConversationSettingsDialog> {
  late var voice = widget.initial.voice;
  late var speechRate = widget.initial.speechRate;
  late var turnPause = widget.initial.turnPause;

  bool applying = false;
  String? error;
  bool get live => widget.onApplyLive != null;

  Future<void> confirm() async {
    final choice = ConversationSettings(
      voice: voice,
      speechRate: speechRate,
      turnPause: turnPause,
    );
    final applyLive = widget.onApplyLive;
    if (applyLive != null) {
      setState(() {
        applying = true;
        error = null;
      });
      try {
        await applyLive(choice);
      } catch (failure) {
        if (mounted) {
          setState(() {
            applying = false;
            error = failure is ApiFailure
                ? failure.message
                : 'Chưa cập nhật được cài đặt. Hãy thử lại.';
          });
        }
        return;
      }
    }
    if (!mounted) return;
    Navigator.of(context).pop(choice);
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !applying,
    child: AlertDialog(
      title: Text('Cài đặt trò chuyện', style: designHeading(20)),
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      scrollable: true,
      content: SizedBox(
        width: 320,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              live
                  ? 'Bạn có thể đổi tốc độ nói và thời gian chờ. Giọng được chọn trước cuộc gọi.'
                  : 'Micro sẽ bật khi bạn chọn Bắt đầu.',
              style: designText(14, color: AppColors.grey800),
            ),
            const SizedBox(height: 20),
            _setting<ConversationVoice>(
              label: 'Giọng của Lingo',
              value: voice,
              options: const {
                ConversationVoice.standard: 'Mặc định',
                ConversationVoice.ava: 'Ava (nữ)',
                ConversationVoice.brian: 'Brian (nam)',
              },
              onChanged: live ? null : (value) => voice = value,
            ),
            const SizedBox(height: 16),
            _setting<ConversationSpeechRate>(
              label: 'Tốc độ nói',
              value: speechRate,
              options: const {
                ConversationSpeechRate.slow: 'Chậm',
                ConversationSpeechRate.normal: 'Bình thường',
                ConversationSpeechRate.fast: 'Nhanh',
              },
              onChanged: applying ? null : (value) => speechRate = value,
            ),
            const SizedBox(height: 16),
            _setting<ConversationTurnPause>(
              label: 'Chờ bạn nói tiếp',
              value: turnPause,
              options: const {
                ConversationTurnPause.normal: 'Bình thường',
                ConversationTurnPause.long: 'Lâu hơn',
              },
              onChanged: applying ? null : (value) => turnPause = value,
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(
                error!,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ],
          ],
        ),
      ),
      actions: [
        OutlinedButton(
          style: OutlinedButton.styleFrom(minimumSize: const Size(48, 48)),
          onPressed: applying ? null : () => Navigator.of(context).pop(),
          child: Text(widget.startOnConfirm ? 'Để sau' : 'Hủy'),
        ),
        FilledButton(
          style: FilledButton.styleFrom(
            minimumSize: const Size(48, 48),
            backgroundColor: AppColors.grey900,
            foregroundColor: Colors.white,
          ),
          onPressed: applying ? null : confirm,
          child: Text(
            applying
                ? 'Đang cập nhật…'
                : widget.startOnConfirm
                ? 'Bắt đầu'
                : 'Áp dụng',
          ),
        ),
      ],
    ),
  );

  Widget _setting<T extends Enum>({
    required String label,
    required T value,
    required Map<T, String> options,
    required ValueChanged<T>? onChanged,
  }) => FigmaDropdown(
    label: label,
    items: {
      for (final option in options.entries) option.key.name: option.value,
    },
    value: value.name,
    onChanged: onChanged == null
        ? null
        : (key) => onChanged(
            options.keys.firstWhere((option) => option.name == key),
          ),
  );
}
