import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/theme/app_colors.dart';
import '../../shared/figma_widgets.dart';
import 'recording_waveform.dart';

class ConversationLiveIcon extends StatelessWidget {
  const ConversationLiveIcon(
    this.name, {
    super.key,
    this.size = 24,
    this.color,
  });

  final String name;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) => SvgPicture.asset(
    'assets/figma/conversation-live-$name.svg',
    width: size,
    height: size,
    colorFilter: color == null
        ? null
        : ColorFilter.mode(color!, BlendMode.srcIn),
    excludeFromSemantics: true,
  );
}

/// The topic, call status and timer stay visible as new turns arrive.
class ConversationCallHeader extends StatelessWidget {
  const ConversationCallHeader({
    super.key,
    required this.topic,
    required this.status,
    required this.seconds,
    required this.active,
  });

  final String topic;
  final String status;
  final int seconds;
  final bool active;

  @override
  Widget build(BuildContext context) {
    final elapsed =
        '${seconds ~/ 60}:${(seconds % 60).toString().padLeft(2, '0')}';
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: AppColors.grey0,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.grey100),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0F0D2249),
            offset: Offset(0, 1),
            blurRadius: 4,
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.primary25,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const ConversationLiveIcon('topic', size: 20),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  topic,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: designText(18, weight: FontWeight.w500, height: 1.25),
                ),
              ),
              const SizedBox(width: 8),
              Text('$elapsed / 3:00', style: _bodyStyle(14, AppColors.grey700)),
            ],
          ),
          const SizedBox(height: 12),
          ExcludeSemantics(
            child: LinearProgressIndicator(
              value: (seconds / 180).clamp(0, 1).toDouble(),
              minHeight: 6,
              borderRadius: BorderRadius.circular(8),
              color: AppColors.primary500,
              backgroundColor: AppColors.grey100,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              DecoratedBox(
                decoration: BoxDecoration(
                  color: active ? AppColors.primary600 : AppColors.grey600,
                  shape: BoxShape.circle,
                ),
                child: const SizedBox.square(dimension: 8),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Semantics(
                  liveRegion: true,
                  child: Text(status, style: _bodyStyle(16, AppColors.grey700)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class ConversationWelcome extends StatelessWidget {
  const ConversationWelcome({super.key});

  @override
  Widget build(BuildContext context) => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const ConversationLiveIcon('bot', size: 60),
          const SizedBox(height: 16),
          Text(
            'Cùng bắt đầu câu chuyện',
            textAlign: TextAlign.center,
            style: designText(24, weight: FontWeight.w500, height: 1.25),
          ),
          const SizedBox(height: 8),
          Text(
            'Trả lời từng câu hỏi bằng tiếng Anh. Chạm nút dịch dưới lời AI khi bạn cần hỗ trợ.',
            textAlign: TextAlign.center,
            style: _bodyStyle(16, AppColors.grey700),
          ),
        ],
      ),
    ),
  );
}

class ConversationCallActions extends StatelessWidget {
  const ConversationCallActions({
    super.key,
    required this.connected,
    required this.recording,
    required this.engaged,
    required this.actionLabel,
    required this.onAction,
    this.onToggleMic,
    this.amplitudes,
    this.draft = '',
  });

  final bool connected;
  final bool recording;
  final bool engaged;
  final String actionLabel;
  final VoidCallback? onAction;
  final VoidCallback? onToggleMic;
  final Stream<double>? amplitudes;
  final String draft;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (connected) ...[
          Center(
            child: Material(
              color: AppColors.grey0,
              shadowColor: const Color(0x400D2249),
              elevation: 2,
              shape: const CircleBorder(
                side: BorderSide(color: AppColors.grey100),
              ),
              clipBehavior: Clip.antiAlias,
              child: IconButton(
                onPressed: onToggleMic,
                tooltip: recording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm',
                constraints: const BoxConstraints.tightFor(
                  width: 56,
                  height: 56,
                ),
                icon: ConversationLiveIcon(
                  recording ? 'stop' : 'mic',
                  color: onToggleMic == null ? AppColors.grey500 : null,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            recording
                ? (draft.isEmpty ? 'Đang ghi âm…' : draft)
                : 'Chạm để bắt đầu ghi âm',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: _bodyStyle(16),
          ),
          if (recording && amplitudes != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: RecordingWaveform(amplitudes: amplitudes!),
            ),
          const SizedBox(height: 20),
        ],
        if (engaged)
          OutlinedButton.icon(
            onPressed: onAction,
            icon: const ConversationLiveIcon('end', size: 20),
            label: Text(actionLabel),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(48),
              backgroundColor: AppColors.error0,
              foregroundColor: AppColors.error300,
              side: const BorderSide(color: AppColors.error100),
              shape: const StadiumBorder(),
              textStyle: designText(18, weight: FontWeight.w500),
            ),
          )
        else
          FilledButton.icon(
            onPressed: onAction,
            icon: const ConversationLiveIcon(
              'mic',
              size: 20,
              color: Colors.white,
            ),
            label: Text(actionLabel),
            style: conversationPrimaryAction(18),
          ),
      ],
    ),
  );
}

ButtonStyle conversationPrimaryAction(double fontSize) =>
    FilledButton.styleFrom(
      minimumSize: const Size.fromHeight(48),
      backgroundColor: AppColors.grey900,
      foregroundColor: AppColors.grey0,
      shape: const StadiumBorder(),
      textStyle: designText(fontSize, weight: FontWeight.w500),
    );

TextStyle _bodyStyle(double size, [Color color = AppColors.grey900]) =>
    TextStyle(
      fontFamily: 'Inter',
      fontFamilyFallback: const ['Be Vietnam Pro'],
      color: color,
      fontSize: size,
      height: 1.5,
    );
