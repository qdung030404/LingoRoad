import 'dart:ui';

import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';
import '../../shared/figma_dropdown.dart';
import '../../core/api/api_client.dart';
import 'conversation_live_view.dart';
import 'speaking_repository.dart';

class ConversationSettingsDialog extends StatefulWidget {
  const ConversationSettingsDialog({
    super.key,
    required this.initial,
    this.onApplyLive,
  });

  final ConversationSettings initial;
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
  Widget build(BuildContext context) => BackdropFilter(
    filter: ImageFilter.blur(sigmaX: 2, sigmaY: 2),
    child: PopScope(
      canPop: !applying,
      child: Dialog(
        backgroundColor: AppColors.grey0,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        clipBehavior: Clip.antiAlias,
        insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
        constraints: const BoxConstraints(maxWidth: 420),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 5, 4, 5),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Cài đặt trò chuyện',
                        style: designText(20, weight: FontWeight.w500),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Đóng cài đặt',
                      onPressed: applying
                          ? null
                          : () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close_rounded, size: 20),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: AppColors.grey100),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 14, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Tooltip(
                      message: live
                          ? 'Chỉ đổi giọng trước khi bắt đầu hội thoại'
                          : '',
                      child: _setting<ConversationVoice>(
                        label: 'Giọng của Lingo',
                        value: voice,
                        options: const {
                          ConversationVoice.standard: 'Mặc định',
                          ConversationVoice.ava: 'Ava (nữ)',
                          ConversationVoice.brian: 'Brian (nam)',
                        },
                        onChanged: live ? null : (value) => voice = value,
                      ),
                    ),
                    const SizedBox(height: 24),
                    _setting<ConversationSpeechRate>(
                      label: 'Tốc độ nói',
                      value: speechRate,
                      options: const {
                        ConversationSpeechRate.slow: 'Chậm',
                        ConversationSpeechRate.normal: 'Bình thường',
                        ConversationSpeechRate.fast: 'Nhanh',
                      },
                      onChanged: applying
                          ? null
                          : (value) => speechRate = value,
                    ),
                    const SizedBox(height: 24),
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
                      Semantics(
                        liveRegion: true,
                        child: Text(
                          error!,
                          style: designText(14, color: AppColors.error300),
                        ),
                      ),
                    ],
                    const SizedBox(height: 24),
                    FilledButton(
                      style: conversationPrimaryAction(16),
                      onPressed: applying ? null : confirm,
                      child: Text(applying ? 'Đang cập nhật…' : 'Lưu cài đặt'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
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
